const axios = require('axios');
const Place = require('../models/Place');
const logger = require('../utils/logger');
const {
  recommendationConfig,
  interestTypeMap,
  allowedAttractionTypes,
  blockedAttractionTypes,
  genericPlaceTypes,
  restaurantTypes,
  blockedRestaurantTypes,
} = require('../config/recommendationConfig');

const normalizeInterest = (interest) => String(interest || '').trim().toLowerCase();
const normalizeType = (type) => String(type || '').trim().toLowerCase();

const getNormalizedTypes = (place) => (place.types || []).map(normalizeType);
const normalizeText = (value) => String(value || '').toLowerCase();

const INTEREST_KEYWORD_MAP = {
  beaches: ['beach', 'coast', 'sea', 'seaside', 'shore', 'sunset point'],
  culture: ['museum', 'temple', 'church', 'heritage', 'cultural', 'tradition', 'palace'],
  shopping: ['mall', 'market', 'bazaar', 'shopping', 'store', 'emporium'],
  nature: ['park', 'hill', 'waterfall', 'lake', 'garden', 'forest', 'island'],
  history: ['fort', 'heritage', 'history', 'historic', 'palace', 'monument', 'memorial'],
  art: ['art', 'gallery', 'exhibition', 'craft', 'studio'],
  adventure: ['adventure', 'trek', 'hike', 'kayak', 'boat', 'camp'],
  sports: ['stadium', 'sports', 'cricket', 'football', 'club'],
  food: ['food', 'restaurant', 'cafe', 'dining', 'street food'],
  nightlife: ['bar', 'club', 'nightlife', 'late night', 'pub'],
};

const getPrimaryCategory = (place) => {
  const types = getNormalizedTypes(place);
  const category = types.find((type) => allowedAttractionTypes.has(type))
    || types.find((type) => restaurantTypes.has(type))
    || types[0];
  return category ? String(category).replace(/_/g, ' ') : 'other';
};

const getReviewTexts = (place) => {
  if (!Array.isArray(place.reviews)) {
    return [];
  }

  return place.reviews
    .map((review) => {
      if (typeof review === 'string') {
        return review.trim();
      }

      return typeof review?.text === 'string' ? review.text.trim() : '';
    })
    .filter(Boolean);
};

const getReviewAverageRating = (place) => {
  if (!Array.isArray(place.reviews) || place.reviews.length === 0) {
    return Number.isFinite(place.rating) ? Number(place.rating) : 0;
  }

  const reviewRatings = place.reviews
    .map((review) => (Number.isFinite(review?.rating) ? Number(review.rating) : null))
    .filter((rating) => Number.isFinite(rating));

  if (reviewRatings.length === 0) {
    return Number.isFinite(place.rating) ? Number(place.rating) : 0;
  }

  return reviewRatings.reduce((sum, rating) => sum + rating, 0) / reviewRatings.length;
};

const getSentimentSignal = (place) => {
  const reviewAverageRating = getReviewAverageRating(place);
  if (!Number.isFinite(reviewAverageRating) || reviewAverageRating <= 0) {
    return 0.5;
  }

  return Math.max(0, Math.min(1, reviewAverageRating / 5));
};

const getPopularitySignal = (place) => Math.log((Number(place.user_ratings_total) || 0) + 1);

const buildMlPayloadPlace = (place) => {
  const reviewTexts = getReviewTexts(place);

  return {
    place_id: place.place_id,
    name: place.name,
    category: getPrimaryCategory(place),
    rating: Number.isFinite(place.rating) ? Number(place.rating) : 0,
    review: reviewTexts.join(' || '),
    city: place.city,
    lat: place.lat,
    lng: place.lng,
    reviews: reviewTexts,
    review_count: reviewTexts.length,
    review_avg_rating: getReviewAverageRating(place),
    user_ratings_total: Number.isFinite(place.user_ratings_total) ? Number(place.user_ratings_total) : 0,
  };
};

const buildScoreNormalizer = (values) => {
  const numericValues = values.filter((value) => Number.isFinite(value));
  if (numericValues.length === 0) {
    return () => 0;
  }

  const minValue = Math.min(...numericValues);
  const maxValue = Math.max(...numericValues);

  if (minValue === maxValue) {
    return () => (maxValue > 0 ? 1 : 0);
  }

  return (value) => (value - minValue) / (maxValue - minValue);
};

const roundTo = (value, precision = 2) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number(numericValue.toFixed(precision));
};

const shuffleArray = (items) => {
  const cloned = [...items];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
  }
  return cloned;
};

const sampleArray = (items, sampleSize) => shuffleArray(items).slice(0, Math.min(sampleSize, items.length));

const takeTopByScore = (items, limit) => [...items].slice(0, Math.min(limit, items.length));

const previewPlaceNames = (places, limit = 10) =>
  places
    .slice(0, limit)
    .map((place) => `${place.name} (${Number(place.rating || 0).toFixed(1)}, ${Number(place.user_ratings_total || 0)} reviews)`)
    .join(' | ');

const hasAnyType = (place, typeSet) => getNormalizedTypes(place).some((type) => typeSet.has(type));
const attractionDrivenInterests = new Set(['beaches', 'culture', 'nature', 'history', 'art', 'adventure', 'sports', 'shopping']);
const restaurantDrivenInterests = new Set(['food', 'nightlife']);
const interestOnlyAttractionTypes = new Set(['shopping_mall', 'store']);
const LANDMARK_TYPES = new Set([
  'tourist_attraction',
  'historical_landmark',
  'landmark',
  'monument',
  'museum',
  'beach',
  'church',
  'temple',
  'hindu_temple',
  'mosque',
  'synagogue',
  'art_gallery',
]);

const normalizeNameForDedup = (name) => String(name || '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\b(the|a|an|ticket counter|entry gate|parking|view point|viewpoint)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const arePlacesNear = (first, second, maxDelta = 0.02) => {
  const latA = Number(first.lat);
  const lngA = Number(first.lng);
  const latB = Number(second.lat);
  const lngB = Number(second.lng);

  if (![latA, lngA, latB, lngB].every(Number.isFinite)) {
    return false;
  }

  return Math.abs(latA - latB) <= maxDelta && Math.abs(lngA - lngB) <= maxDelta;
};

const dedupePlaces = (places) => {
  const deduped = [];

  places.forEach((place) => {
    const normalizedName = normalizeNameForDedup(place.name);
    const existingIndex = deduped.findIndex((candidate) =>
      normalizeNameForDedup(candidate.name) === normalizedName && arePlacesNear(candidate, place),
    );

    if (existingIndex === -1) {
      deduped.push(place);
      return;
    }

    const existing = deduped[existingIndex];
    const existingScore = Number(existing.user_ratings_total || 0) + (Number(existing.rating || 0) * 100);
    const incomingScore = Number(place.user_ratings_total || 0) + (Number(place.rating || 0) * 100);

    if (incomingScore > existingScore) {
      deduped[existingIndex] = place;
    }
  });

  return deduped;
};

const isAllowedAttraction = (place) => {
  const normalizedTypes = getNormalizedTypes(place);
  const specificTypes = normalizedTypes.filter((type) => !genericPlaceTypes.has(type));

  return specificTypes.some((type) => allowedAttractionTypes.has(type))
    && !specificTypes.some((type) => blockedAttractionTypes.has(type));
};

const buildInterestPayloadPlace = (place) => {
  const reviewTexts = getReviewTexts(place);

  return {
    place_id: place.place_id,
    name: place.name,
    category: getPrimaryCategory(place),
    rating: Number.isFinite(place.rating) ? Number(place.rating) : 0,
    review: reviewTexts.join(' || '),
    city: place.city,
    lat: place.lat,
    lng: place.lng,
    reviews: reviewTexts,
    review_count: reviewTexts.length,
    review_avg_rating: getReviewAverageRating(place),
    user_ratings_total: Number.isFinite(place.user_ratings_total) ? Number(place.user_ratings_total) : 0,
  };
};

const isInterestOnlyAttraction = (place, tripInterests) => {
  const attractionInterests = getAttractionRelevantInterests(tripInterests);
  if (!attractionInterests.includes('shopping')) {
    return false;
  }

  return getNormalizedTypes(place).some((type) => interestOnlyAttractionTypes.has(type));
};

const isBlockedRestaurant = (place) => getNormalizedTypes(place).some((type) => blockedRestaurantTypes.has(type));
const isRestaurantLike = (place) => getNormalizedTypes(place).some((type) => restaurantTypes.has(type));

const getAttractionRelevantInterests = (tripInterests) =>
  (tripInterests || [])
    .map(normalizeInterest)
    .filter((interest) => attractionDrivenInterests.has(interest));

const getRestaurantRelevantInterests = (tripInterests) =>
  (tripInterests || [])
    .map(normalizeInterest)
    .filter((interest) => restaurantDrivenInterests.has(interest));

const getAllowedTypesForInterests = (tripInterests, interestResolver = getAttractionRelevantInterests) =>
  new Set(
    interestResolver(tripInterests)
      .flatMap((interest) => interestTypeMap[interest] || []),
  );

function placeMatchesInterest(place, allowedTypes, tripInterests) {
  return getInterestSignals(place, tripInterests).interestScore >= 0.12
    || getNormalizedTypes(place).some((type) => allowedTypes.has(type));
}

function getPlaceKeywordText(place) {
  return [
    place?.name,
    getPrimaryCategory(place),
    ...(Array.isArray(place?.types) ? place.types : []),
    ...getReviewTexts(place).slice(0, 3),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getManualTypeMatchScore(place, normalizedInterests) {
  const normalizedTypes = getNormalizedTypes(place);
  if (normalizedInterests.length === 0) {
    return 0;
  }

  const matchedInterests = normalizedInterests.filter((interest) =>
    (interestTypeMap[interest] || []).some((type) => normalizedTypes.includes(type)),
  );

  return matchedInterests.length / normalizedInterests.length;
}

function getMlInterestMatchScore(place, normalizedInterests) {
  if (normalizedInterests.length === 0) {
    return 0;
  }

  const inferredTags = Array.isArray(place.inferred_interest_tags)
    ? place.inferred_interest_tags.map(normalizeInterest)
    : [];
  const inferredScores = place.inferred_interest_scores && typeof place.inferred_interest_scores === 'object'
    ? place.inferred_interest_scores
    : {};

  const matchedScores = normalizedInterests
    .filter((interest) => inferredTags.includes(interest) || Number(inferredScores[interest]) > 0)
    .map((interest) => Number(inferredScores[interest] || (inferredTags.includes(interest) ? 0.65 : 0)));

  if (matchedScores.length === 0) {
    return 0;
  }

  const total = matchedScores.reduce((sum, value) => sum + value, 0);
  return Math.min(1, total / normalizedInterests.length);
}

function getKeywordMatchScore(place, normalizedInterests) {
  if (normalizedInterests.length === 0) {
    return 0;
  }

  const keywordText = getPlaceKeywordText(place);
  const matchedKeywordInterests = normalizedInterests.filter((interest) =>
    (INTEREST_KEYWORD_MAP[interest] || []).some((keyword) => keywordText.includes(keyword)),
  );

  return matchedKeywordInterests.length / normalizedInterests.length;
}

function getInterestSignals(place, tripInterests) {
  const normalizedInterests = getAttractionRelevantInterests(tripInterests);
  if (normalizedInterests.length === 0) {
    return {
      manualTypeMatch: 0,
      mlInterestMatch: 0,
      keywordMatch: 0,
      interestScore: 0,
      matchedInterests: [],
    };
  }

  const manualTypeMatch = getManualTypeMatchScore(place, normalizedInterests);
  const mlInterestMatch = getMlInterestMatchScore(place, normalizedInterests);
  const keywordMatch = getKeywordMatchScore(place, normalizedInterests);
  const keywordText = getPlaceKeywordText(place);
  const normalizedTypes = getNormalizedTypes(place);
  const inferredTags = Array.isArray(place.inferred_interest_tags)
    ? place.inferred_interest_tags.map(normalizeInterest)
    : [];
  const matchedInterests = normalizedInterests.filter((interest) =>
    inferredTags.includes(interest)
    || (interestTypeMap[interest] || []).some((type) => normalizedTypes.includes(type))
    || (INTEREST_KEYWORD_MAP[interest] || []).some((keyword) => keywordText.includes(keyword)),
  );

  return {
    manualTypeMatch,
    mlInterestMatch,
    keywordMatch,
    interestScore: roundTo((manualTypeMatch * 0.6) + (mlInterestMatch * 0.3) + (keywordMatch * 0.1), 4),
    matchedInterests,
  };
}

const filterByInterests = (places, tripInterests, requiredAttractionCount) => {
  const normalizedInterests = getAttractionRelevantInterests(tripInterests);
  if (normalizedInterests.length === 0) {
    return {
      places: [],
      interestFilterApplied: false,
      minimumInterestMatches: 0,
    };
  }

  const allowedTypes = new Set(normalizedInterests.flatMap((interest) => interestTypeMap[interest] || []));
  const filteredPlaces = places.filter((place) =>
    placeMatchesInterest(place, allowedTypes, tripInterests),
  );
  const minimumInterestMatches = Math.min(
    filteredPlaces.length,
    Math.max(1, Math.ceil(requiredAttractionCount * 0.2)),
  );

  return {
    places: filteredPlaces,
    interestFilterApplied: filteredPlaces.length > 0 && minimumInterestMatches > 0,
    minimumInterestMatches,
  };
};

const getInterestMatchScore = (place, tripInterests) => {
  return getInterestSignals(place, tripInterests).interestScore;
};

const getRestaurantInterestBoost = (place, tripInterests) => {
  const normalizedInterests = getRestaurantRelevantInterests(tripInterests);
  if (normalizedInterests.length === 0) {
    return 0;
  }

  const types = getNormalizedTypes(place);
  let boost = 0;

  if (normalizedInterests.includes('food') && types.some((type) => ['restaurant', 'cafe', 'bakery', 'meal_takeaway'].includes(type))) {
    boost += 1;
  }

  if (normalizedInterests.includes('nightlife') && types.some((type) => ['bar', 'night_club'].includes(type))) {
    boost += 1;
  }

  return boost;
};

const getMustSeeBoost = (place) => {
  const rating = Number(place.rating || 0);
  const totalRatings = Number(place.user_ratings_total || 0);
  const hasLandmarkType = getNormalizedTypes(place).some((type) => LANDMARK_TYPES.has(type));

  if (!hasLandmarkType) {
    return 0;
  }

  if (rating >= 4.6 && totalRatings >= 5000) {
    return 0.12;
  }

  if (rating >= 4.5 && totalRatings >= 2500) {
    return 0.08;
  }

  if (rating >= 4.4 && totalRatings >= 1200) {
    return 0.04;
  }

  return 0;
};

const buildExplanationTags = ({
  place,
  weightedRating,
  normalizedPopularitySignal,
  interestSignals,
  mustSeeBoost,
}) => {
  const tags = [];

  if (mustSeeBoost > 0) {
    tags.push('Must-see');
  }

  if (normalizedPopularitySignal >= 0.75 || Number(place.user_ratings_total || 0) >= 2000) {
    tags.push('Popular');
  }

  if (weightedRating >= 4.5 || Number(place.rating || 0) >= 4.6) {
    tags.push('Highly rated');
  }

  if (interestSignals?.matchedInterests?.length) {
    tags.push(`Matches ${interestSignals.matchedInterests[0]}`);
  }

  const primaryType = getPrimaryCategory(place);
  if (primaryType && !tags.includes(primaryType)) {
    tags.push(primaryType.replace(/\b\w/g, (char) => char.toUpperCase()));
  }

  return tags.slice(0, 4);
};

const getThemeBucket = (place) => {
  const types = getNormalizedTypes(place);

  if (types.some((type) => ['church', 'temple', 'hindu_temple', 'mosque', 'synagogue'].includes(type))) {
    return 'religious';
  }

  if (types.some((type) => ['museum', 'historical_landmark', 'monument'].includes(type))) {
    return 'history';
  }

  if (types.some((type) => ['beach', 'park', 'zoo', 'aquarium', 'natural_feature', 'amusement_park'].includes(type))) {
    return 'nature';
  }

  if (types.some((type) => ['art_gallery'].includes(type))) {
    return 'art';
  }

  if (types.some((type) => ['tourist_attraction', 'landmark'].includes(type))) {
    return 'landmark';
  }

  if (types.some((type) => ['shopping_mall', 'store'].includes(type))) {
    return 'shopping';
  }

  return 'other';
};

const selectDiverseAttractions = (rankedAttractions, totalAttractions, tripInterests) => {
  const selected = [];
  const remaining = [...rankedAttractions];
  const themeCounts = new Map();
  const attractionInterests = getAttractionRelevantInterests(tripInterests);
  const minimumInterestMatches = attractionInterests.length > 0
    ? Math.min(
        rankedAttractions.filter((place) => getInterestMatchScore(place, tripInterests) > 0).length,
        Math.max(2, Math.ceil(totalAttractions * 0.35)),
      )
    : 0;
  const religiousCap = attractionInterests.some((interest) => ['culture', 'history'].includes(interest))
    ? Math.max(3, Math.ceil(totalAttractions / 4))
    : Math.max(2, Math.ceil(totalAttractions / 6));
  const defaultThemeCap = Math.max(2, Math.ceil(totalAttractions / 3));
  let selectedInterestMatches = 0;

  while (remaining.length > 0 && selected.length < totalAttractions) {
    const prioritizeInterestMatch = selectedInterestMatches < minimumInterestMatches;
    const nextIndex = remaining.findIndex((place) => {
      const theme = getThemeBucket(place);
      const cap = theme === 'religious' ? religiousCap : defaultThemeCap;
      const withinThemeCap = (themeCounts.get(theme) || 0) < cap;
      const isInterestMatch = getInterestMatchScore(place, tripInterests) > 0;

      if (prioritizeInterestMatch) {
        return withinThemeCap && isInterestMatch;
      }

      return withinThemeCap;
    });

    if (nextIndex === -1) {
      if (selectedInterestMatches < minimumInterestMatches) {
        const fallbackInterestIndex = remaining.findIndex((place) => getInterestMatchScore(place, tripInterests) > 0);
        if (fallbackInterestIndex >= 0) {
          const [chosen] = remaining.splice(fallbackInterestIndex, 1);
          selected.push(chosen);
          const chosenTheme = getThemeBucket(chosen);
          themeCounts.set(chosenTheme, (themeCounts.get(chosenTheme) || 0) + 1);
          selectedInterestMatches += 1;
          continue;
        }
      }

      break;
    }

    const [chosen] = remaining.splice(nextIndex, 1);
    selected.push(chosen);
    const chosenTheme = getThemeBucket(chosen);
    themeCounts.set(chosenTheme, (themeCounts.get(chosenTheme) || 0) + 1);
    if (getInterestMatchScore(chosen, tripInterests) > 0) {
      selectedInterestMatches += 1;
    }
  }

  while (remaining.length > 0 && selected.length < totalAttractions) {
    selected.push(remaining.shift());
  }

  return selected;
};

const blendCandidatePools = (primaryPool, secondaryPool, targetSize, primaryRatio = 0.6) => {
  const desiredPrimaryCount = Math.ceil(targetSize * primaryRatio);
  const desiredSecondaryCount = Math.max(0, targetSize - desiredPrimaryCount);

  const blended = [
    ...takeTopByScore(primaryPool, desiredPrimaryCount),
    ...sampleArray(secondaryPool, desiredSecondaryCount),
  ];

  return dedupePlaces(blended);
};

const sampleCandidatesWithExploration = (items, sampleSize) => {
  if (items.length <= sampleSize) {
    return items;
  }

  const primaryBandSize = Math.min(items.length, Math.max(sampleSize * 2, 40));
  const primaryBand = items.slice(0, primaryBandSize);
  const exploratoryBand = items.slice(primaryBandSize);
  const primarySampleSize = Math.min(primaryBand.length, Math.max(1, Math.ceil(sampleSize * 0.7)));
  const exploratorySampleSize = Math.max(0, sampleSize - primarySampleSize);

  return dedupePlaces([
    ...sampleArray(primaryBand, primarySampleSize),
    ...sampleArray(exploratoryBand.length > 0 ? exploratoryBand : primaryBand, exploratorySampleSize),
  ]);
};

const rankByQualityAndPopularity = (places) =>
  [...places].sort((a, b) => {
    const scoreA = (Number(a.rating || 0) * 0.6) + (getPopularitySignal(a) * 0.4);
    const scoreB = (Number(b.rating || 0) * 0.6) + (getPopularitySignal(b) * 0.4);
    return scoreB - scoreA;
  });

const fillCandidateFloor = (currentPool, fallbackPool, minimumSize) => {
  if (currentPool.length >= minimumSize) {
    return currentPool;
  }

  const usedPlaceIds = new Set(currentPool.map((place) => place.place_id));
  const backfill = rankByQualityAndPopularity(fallbackPool)
    .filter((place) => !usedPlaceIds.has(place.place_id))
    .slice(0, Math.max(0, minimumSize - currentPool.length));

  return dedupePlaces([...currentPool, ...backfill]);
};

const shuffleTopBand = (rankedAttractions, totalAttractions) => {
  if (rankedAttractions.length <= totalAttractions) {
    return rankedAttractions;
  }

  const topBandSize = Math.min(rankedAttractions.length, Math.max(totalAttractions * 3, 24));
  const topBand = rankedAttractions.slice(0, topBandSize)
    .map((place, index) => ({
      place,
      weight: place.final_score
        + (Math.random() * 0.06)
        - ((index / Math.max(1, topBandSize)) * 0.01),
    }))
    .sort((first, second) => second.weight - first.weight)
    .map((entry) => entry.place);

  return [
    ...topBand,
    ...rankedAttractions.slice(topBandSize),
  ];
};

const buildRestaurantWeight = (place, tripInterests) => {
  const rating = Number(place.rating || 0);
  const reviewCount = Number(place.user_ratings_total || 0);
  const popularitySignal = getPopularitySignal(place);
  const interestBoost = getRestaurantInterestBoost(place, tripInterests);

  return (rating * 0.45)
    + (popularitySignal * 0.35)
    + (Math.log10(reviewCount + 1) * 0.15)
    + (interestBoost * 0.35);
};

const buildAttractionResponse = (place, scores) => {
  const reviewTexts = getReviewTexts(place);
  const reviewSnippet = reviewTexts[0] || place.description || 'No review snippet available yet.';

  return {
    _id: place._id,
    place_id: place.place_id,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    city: place.city,
    rating: place.rating,
    reviewSnippet: reviewSnippet.slice(0, 220),
    types: place.types || [],
    category: getPrimaryCategory(place),
    user_ratings_total: place.user_ratings_total || 0,
    ml_score: Number(scores.mlScore.toFixed(4)),
    weighted_rating: Number(scores.weightedRating.toFixed(4)),
    popularity_score: Number(scores.normalizedPopularitySignal.toFixed(4)),
    sentiment_score: Number(scores.sentimentScore.toFixed(4)),
    interest_match_score: scores.interestMatchScore,
    must_see_boost: Number(scores.mustSeeBoost.toFixed(4)),
    final_score: Number(scores.finalScore.toFixed(4)),
    explanation_tags: scores.explanationTags || [],
    why_recommended: scores.whyRecommended || [],
    interest_match_details: {
      manual_type_match: scores.interestSignals?.manualTypeMatch || 0,
      ml_interest_match: scores.interestSignals?.mlInterestMatch || 0,
      keyword_match: scores.interestSignals?.keywordMatch || 0,
      matched_interests: scores.interestSignals?.matchedInterests || [],
    },
    inferred_interest_tags: Array.isArray(place.inferred_interest_tags) ? place.inferred_interest_tags : [],
  };
};

const buildRestaurantResponse = (place) => {
  const reviewTexts = getReviewTexts(place);
  const reviewSnippet = reviewTexts[0] || place.description || 'Popular place for a meal break.';

  return {
    _id: place._id,
    place_id: place.place_id,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    city: place.city,
    rating: place.rating,
    reviewSnippet: reviewSnippet.slice(0, 180),
    types: place.types || [],
    category: getPrimaryCategory(place),
    user_ratings_total: place.user_ratings_total || 0,
    explanation_tags: [
      Number(place.rating || 0) >= 4.5 ? 'Highly rated' : null,
      Number(place.user_ratings_total || 0) >= 1000 ? 'Popular' : null,
      'Food stop',
    ].filter(Boolean),
  };
};

const buildMasterPoolSize = (tripDays, rankedCount, visibleCount) => {
  const requestedSize = Math.max(40, Number(tripDays || 1) * 10, visibleCount * 2);
  return Math.min(rankedCount, Math.min(80, requestedSize));
};

class RecommendationService {
  static async fetchCandidatePlaces(city) {
    return Place.find({ city: String(city).toLowerCase() })
      .sort({ user_ratings_total: -1 })
      .limit(recommendationConfig.candidateFetchLimit);
  }

  static async fetchMlRecommendations(places) {
    const response = await axios.post(
      `${recommendationConfig.mlServiceUrl}/recommend`,
      {
        places: places.map(buildMlPayloadPlace),
        top_k: places.length,
      },
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data?.recommendations || [];
  }

  static async fetchInterestPredictions(places) {
    const response = await axios.post(
      `${recommendationConfig.mlServiceUrl}/predict/interests/batch`,
      {
        places: places.map(buildInterestPayloadPlace),
      },
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data?.results || [];
  }

  static async attachInterestPredictions(places, tripInterests) {
    const relevantInterests = getAttractionRelevantInterests(tripInterests);
    if (relevantInterests.length === 0 || places.length === 0) {
      return places;
    }

    try {
      const predictions = await this.fetchInterestPredictions(places);
      const predictionMap = new Map(
        predictions.map((prediction) => [prediction.place_id, prediction]),
      );

      return places.map((place) => {
        const prediction = predictionMap.get(place.place_id);
        if (!prediction) {
          return place;
        }

        return {
          ...place,
          inferred_interest_tags: prediction.interest_tags || [],
          inferred_interest_scores: prediction.interest_scores || {},
        };
      });
    } catch (error) {
      const details = error.response?.data?.detail || error.message;
      logger.warn('Interest prediction fallback active', { details });
      return places;
    }
  }

  static buildAttractionCandidatePool(places, tripInterests, requiredAttractionCount) {
    const attractionInterests = getAttractionRelevantInterests(tripInterests);
    const hasAttractionInterests = attractionInterests.length > 0;
    const strictTypeFilter = dedupePlaces(
      places.filter((place) => isAllowedAttraction(place) || isInterestOnlyAttraction(place, tripInterests)),
    );
    let afterTypeFilter = strictTypeFilter;

    if (hasAttractionInterests && afterTypeFilter.length < Math.max(8, requiredAttractionCount)) {
      const softInterestMatches = dedupePlaces(
        places.filter((place) =>
          getInterestSignals(place, tripInterests).interestScore >= 0.08
          && !getNormalizedTypes(place).some((type) => blockedAttractionTypes.has(type))
          && !isBlockedRestaurant(place)
          && !isRestaurantLike(place),
        ),
      );

      afterTypeFilter = dedupePlaces([...afterTypeFilter, ...softInterestMatches]);
    }

    if (hasAttractionInterests && afterTypeFilter.length === 0) {
      afterTypeFilter = dedupePlaces(
        places.filter((place) =>
          Number(place.rating || 0) >= recommendationConfig.explorationAttractionRating
          && Number(place.user_ratings_total || 0) >= recommendationConfig.explorationAttractionReviews
          && !getNormalizedTypes(place).some((type) => blockedAttractionTypes.has(type))
          && !isBlockedRestaurant(place)
          && !isRestaurantLike(place),
        ),
      );
    }
    const afterQualityFilter = afterTypeFilter
      .filter((place) => Number(place.rating || 0) >= recommendationConfig.minAttractionRating)
      .filter((place) => Number(place.user_ratings_total || 0) >= recommendationConfig.minAttractionReviews);
    const explorationMinRating = Math.min(
      recommendationConfig.minAttractionRating,
      recommendationConfig.explorationAttractionRating,
    );
    const explorationMinReviews = Math.min(
      recommendationConfig.minAttractionReviews,
      recommendationConfig.explorationAttractionReviews,
    );
    const relaxedExplorationSource = afterTypeFilter
      .filter((place) => Number(place.rating || 0) >= explorationMinRating)
      .filter((place) => Number(place.user_ratings_total || 0) >= explorationMinReviews);

    let popularityGateUsed = recommendationConfig.popularityGatePrimary;
    let afterPopularityFilter = afterQualityFilter
      .filter((place) => getPopularitySignal(place) >= recommendationConfig.popularityGatePrimary);

    if (afterPopularityFilter.length < recommendationConfig.popularityGateMinResults) {
      popularityGateUsed = recommendationConfig.popularityGateFallback;
      afterPopularityFilter = afterQualityFilter
        .filter((place) => getPopularitySignal(place) >= recommendationConfig.popularityGateFallback);
    }

    const popularPool = afterPopularityFilter
      .sort((a, b) => {
        const scoreA = (getPopularitySignal(a) * 0.7) + ((a.rating || 0) * 0.3);
        const scoreB = (getPopularitySignal(b) * 0.7) + ((b.rating || 0) * 0.3);
        return scoreB - scoreA;
      })
      .slice(0, recommendationConfig.candidatePoolLimit);

    const dedupedPopularPool = dedupePlaces(popularPool);
    const explorationPool = dedupePlaces(
      relaxedExplorationSource
        .sort((a, b) => {
          const scoreA = (getPopularitySignal(a) * 0.35) + ((a.rating || 0) * 0.65);
          const scoreB = (getPopularitySignal(b) * 0.35) + ((b.rating || 0) * 0.65);
          return scoreB - scoreA;
        })
        .filter((place) => !dedupedPopularPool.some((popularPlace) => popularPlace.place_id === place.place_id))
        .slice(
          0,
          Math.min(
            relaxedExplorationSource.length,
            recommendationConfig.candidatePoolLimit * recommendationConfig.explorationPoolMultiplier,
          ),
        ),
    );
    const noInterestCandidateFloor = Math.max(requiredAttractionCount * 2, 30);
    const baseCandidatePool = hasAttractionInterests
      ? blendCandidatePools(
          dedupedPopularPool,
          explorationPool,
          Math.min(
            relaxedExplorationSource.length,
            recommendationConfig.candidatePoolLimit + Math.max(45, requiredAttractionCount * 3),
          ),
          0.55,
        )
      : (
        dedupedPopularPool.length >= noInterestCandidateFloor
          ? dedupedPopularPool
          : blendCandidatePools(
              dedupedPopularPool,
              explorationPool,
              Math.min(
                relaxedExplorationSource.length,
                Math.max(noInterestCandidateFloor, requiredAttractionCount * 3),
              ),
              0.78,
            )
      );

    const broaderInterestSource = relaxedExplorationSource
      .sort((a, b) => {
        const scoreA = (getPopularitySignal(a) * 0.7) + ((a.rating || 0) * 0.3);
        const scoreB = (getPopularitySignal(b) * 0.7) + ((b.rating || 0) * 0.3);
        return scoreB - scoreA;
      })
      .slice(0, Math.min(recommendationConfig.candidateFetchLimit, recommendationConfig.candidatePoolLimit * 4));

    const { places: interestFilteredPlaces, interestFilterApplied, minimumInterestMatches } = filterByInterests(
      broaderInterestSource,
      tripInterests,
      requiredAttractionCount,
    );

    const interestPool = dedupePlaces(interestFilteredPlaces);
    const baseMinimumCandidateFloor = hasAttractionInterests
      ? Math.max(requiredAttractionCount * 3, 36)
      : Math.max(requiredAttractionCount * 2, 30);

    const preFloorCandidatePool = hasAttractionInterests && interestPool.length > 0
      ? blendCandidatePools(
          baseCandidatePool,
          interestPool,
          Math.max(baseCandidatePool.length, requiredAttractionCount * 3),
          interestFilterApplied ? 0.58 : 0.68,
        )
      : baseCandidatePool;
    const interestAwareFallbackPool = dedupePlaces([
      ...interestPool,
      ...explorationPool,
      ...broaderInterestSource,
      ...afterQualityFilter,
      ...afterTypeFilter,
    ]);
    const candidatePool = fillCandidateFloor(
      preFloorCandidatePool,
      interestAwareFallbackPool,
      Math.min(interestAwareFallbackPool.length, baseMinimumCandidateFloor),
    );
    const interestPoolContribution = candidatePool.filter((place) =>
      interestPool.some((interestPlace) => interestPlace.place_id === place.place_id),
    ).length;

    logger.info('Recommendation candidate pipeline', {
      total_places: places.length,
      after_type_filter: afterTypeFilter.length,
      type_filter_preview: previewPlaceNames(afterTypeFilter),
      after_quality_filter: afterQualityFilter.length,
      quality_filter_preview: previewPlaceNames(afterQualityFilter),
      relaxed_exploration_source_count: relaxedExplorationSource.length,
      relaxed_exploration_thresholds: {
        min_rating: explorationMinRating,
        min_reviews: explorationMinReviews,
        pool_multiplier: recommendationConfig.explorationPoolMultiplier,
      },
      has_attraction_interests: hasAttractionInterests,
      after_popularity_filter: afterPopularityFilter.length,
      popularity_gate_used: popularityGateUsed,
      popularity_filter_preview: previewPlaceNames(afterPopularityFilter),
      popular_pool_size: dedupedPopularPool.length,
      exploration_pool_size: explorationPool.length,
      base_candidate_pool_size: baseCandidatePool.length,
      pre_floor_candidate_pool_size: preFloorCandidatePool.length,
      candidate_floor_target: baseMinimumCandidateFloor,
      interest_pool_size: interestPool.length,
      minimum_interest_matches: minimumInterestMatches,
      candidate_pool_size: candidatePool.length,
      interest_pool_contribution_count: interestPoolContribution,
      interest_pool_contribution_ratio: roundTo(
        candidatePool.length > 0 ? interestPoolContribution / candidatePool.length : 0,
        3,
      ),
      after_interest_filter: interestFilteredPlaces.length,
      interest_filter_preview: previewPlaceNames(interestFilteredPlaces),
    });

    return {
      candidatePool,
      interestFilterApplied,
      dedupedCount: popularPool.length - dedupedPopularPool.length,
    };
  }

  static buildRestaurantPool(places, tripInterests) {
    return places
      .filter((place) => hasAnyType(place, restaurantTypes))
      .filter((place) => !isBlockedRestaurant(place))
      .filter((place) => Number(place.rating || 0) >= recommendationConfig.minRestaurantRating)
      .filter((place) => Number(place.user_ratings_total || 0) >= recommendationConfig.minRestaurantReviews)
      .sort((first, second) => {
        const secondInterestBoost = getRestaurantInterestBoost(second, tripInterests);
        const firstInterestBoost = getRestaurantInterestBoost(first, tripInterests);
        if (secondInterestBoost !== firstInterestBoost) {
          return secondInterestBoost - firstInterestBoost;
        }

        if ((second.rating || 0) !== (first.rating || 0)) {
          return (second.rating || 0) - (first.rating || 0);
        }

        return (second.user_ratings_total || 0) - (first.user_ratings_total || 0);
      })
      .slice(0, recommendationConfig.restaurantPoolLimit);
  }

  static rankAttractions(attractions, mlScoreMap, tripInterests) {
    const ratingValues = attractions
      .map((place) => Number(place.rating || 0))
      .filter((rating) => Number.isFinite(rating) && rating > 0);
    const averageRating = ratingValues.length > 0
      ? ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length
      : 0;

    const popularitySignals = attractions.map((place) => getPopularitySignal(place));
    const normalizePopularitySignal = buildScoreNormalizer(popularitySignals);

    return attractions
      .map((place) => {
        const rating = Number(place.rating || 0);
        const reviewCount = Number(place.user_ratings_total || 0);
        const weightedRating = ((reviewCount / (reviewCount + recommendationConfig.weightedRatingThreshold)) * rating)
          + ((recommendationConfig.weightedRatingThreshold / (reviewCount + recommendationConfig.weightedRatingThreshold)) * averageRating);
        const normalizedPopularitySignal = normalizePopularitySignal(getPopularitySignal(place));
        const sentimentScore = getSentimentSignal(place);
        const interestSignals = getInterestSignals(place, tripInterests);
        const interestMatchScore = interestSignals.interestScore;
        const mustSeeBoost = getMustSeeBoost(place);
        const mlScore = Number(mlScoreMap.get(place.place_id) || 0);
        const finalScore = (mlScore * 0.35)
          + (weightedRating * 0.30)
          + (normalizedPopularitySignal * 0.25)
          + (sentimentScore * 0.10)
          + (interestMatchScore * 0.18)
          + mustSeeBoost
          + (Math.random() * 0.02);
        const explanationTags = buildExplanationTags({
          place,
          weightedRating,
          normalizedPopularitySignal,
          interestSignals,
          mustSeeBoost,
        });
        const whyRecommended = [
          Number(place.rating || 0) > 4.5 ? 'Highly rated' : null,
          Number(place.user_ratings_total || 0) >= 1500 ? 'Popular with travelers' : null,
          interestSignals.matchedInterests[0] ? `Matches your interest: ${interestSignals.matchedInterests[0]}` : null,
          mustSeeBoost > 0 ? 'Strong landmark signal' : null,
        ].filter(Boolean).slice(0, 2);

        return buildAttractionResponse(place, {
          mlScore,
          weightedRating,
          normalizedPopularitySignal,
          sentimentScore,
          interestMatchScore,
          mustSeeBoost,
          finalScore,
          explanationTags,
          whyRecommended,
          interestSignals,
        });
      })
      .sort((first, second) => {
        if (second.final_score !== first.final_score) {
          return second.final_score - first.final_score;
        }

        return (second.user_ratings_total || 0) - (first.user_ratings_total || 0);
      });
  }

  static buildRestaurants(restaurants, tripInterests) {
    const weightedRestaurants = restaurants.map((place) => ({
      place,
      weight: buildRestaurantWeight(place, tripInterests),
    }));

    const primaryBandSize = Math.min(weightedRestaurants.length, Math.max(recommendationConfig.restaurantSampleSize * 2, 24));
    const primaryBand = weightedRestaurants
      .sort((first, second) => second.weight - first.weight)
      .slice(0, primaryBandSize);
    const exploratoryBand = weightedRestaurants
      .sort((first, second) => second.weight - first.weight)
      .slice(primaryBandSize, Math.min(weightedRestaurants.length, recommendationConfig.restaurantPoolLimit));

    const sampledPrimary = sampleArray(primaryBand, Math.min(primaryBand.length, Math.max(1, Math.ceil(recommendationConfig.restaurantReturnCount * 0.7))));
    const sampledExploratory = sampleArray(
      exploratoryBand.length > 0 ? exploratoryBand : primaryBand,
      Math.max(0, recommendationConfig.restaurantReturnCount - sampledPrimary.length),
    );

    const selectedRestaurants = [...sampledPrimary, ...sampledExploratory]
      .map((entry, index) => ({
        place: entry.place,
        weight: entry.weight + (Math.random() * 0.2) - (index * 0.01),
      }))
      .sort((first, second) => second.weight - first.weight)
      .slice(0, recommendationConfig.restaurantReturnCount)
      .map((entry) => entry.place);

    return dedupePlaces(selectedRestaurants).slice(0, recommendationConfig.restaurantReturnCount).map(buildRestaurantResponse);
  }

  static async getRecommendationsForTrip(trip) {
    const totalAttractions = Math.max(
      recommendationConfig.placesPerDay,
      Number(trip.days || 1) * recommendationConfig.placesPerDay,
    );
    const requiredAttractionCount = totalAttractions;
    const rawCandidatePlaces = await this.fetchCandidatePlaces(trip.city);
    const candidatePlaces = await this.attachInterestPredictions(rawCandidatePlaces, trip.interests);
    const { candidatePool, interestFilterApplied, dedupedCount } = this.buildAttractionCandidatePool(
      candidatePlaces,
      trip.interests,
      requiredAttractionCount,
    );

    const dynamicSampleSize = Math.max(recommendationConfig.candidateSampleSize, requiredAttractionCount * 4);
    const normalizedInterests = getAttractionRelevantInterests(trip.interests);
    const interestTypes = new Set(normalizedInterests.flatMap((interest) => interestTypeMap[interest] || []));

    const broaderSamplingFallbackPool = dedupePlaces([
      ...candidatePool,
      ...rankByQualityAndPopularity(
        candidatePlaces.filter((place) => isAllowedAttraction(place) || isInterestOnlyAttraction(place, trip.interests)),
      ),
    ]);

    let sampledCandidates;

    if (interestTypes.size > 0) {
      const interestMatches = candidatePool.filter((place) =>
        placeMatchesInterest(place, interestTypes, trip.interests),
      );
      const otherPlaces = candidatePool.filter((place) => !interestMatches.includes(place));

      if (interestMatches.length > 0) {
        const interestSample = sampleCandidatesWithExploration(interestMatches, Math.floor(dynamicSampleSize * 0.45));
        const otherSample = sampleCandidatesWithExploration(otherPlaces, dynamicSampleSize - interestSample.length);
        sampledCandidates = [...interestSample, ...otherSample];
      } else {
        sampledCandidates = sampleCandidatesWithExploration(candidatePool, dynamicSampleSize);
      }
    } else {
      sampledCandidates = sampleCandidatesWithExploration(candidatePool, dynamicSampleSize);
    }

    sampledCandidates = fillCandidateFloor(
      dedupePlaces(sampledCandidates),
      broaderSamplingFallbackPool,
      Math.min(
        broaderSamplingFallbackPool.length,
        Math.max(requiredAttractionCount * 2, Math.min(dynamicSampleSize, 32)),
      ),
    );

    logger.info('Recommendation sampling complete', {
      sampled_candidates: sampledCandidates.length,
      dynamic_sample_size: dynamicSampleSize,
      sampled_interest_matches: sampledCandidates.filter((place) => getInterestMatchScore(place, trip.interests) > 0).length,
    });

    let mlScoreMap = new Map();
    if (sampledCandidates.length > 0) {
      try {
        const mlRecommendations = await this.fetchMlRecommendations(sampledCandidates);
        mlScoreMap = new Map(
          mlRecommendations.map((recommendation) => [
            recommendation.place_id,
            Number(recommendation.recommendation_score || 0),
          ]),
        );
      } catch (error) {
        const details = error.response?.data?.detail || error.message;
        logger.warn('ML scoring fallback active', { details });
        mlScoreMap = new Map(
          sampledCandidates.map((place) => [place.place_id, recommendationConfig.mlFallbackScore]),
        );
      }
    }

    const rankedAttractions = this.rankAttractions(sampledCandidates, mlScoreMap, trip.interests);
    const replacementPoolTargetSize = Math.min(
      rankedAttractions.length,
      Math.max(60, totalAttractions * 4),
    );
    const replacementAttractionPool = selectDiverseAttractions(rankedAttractions, replacementPoolTargetSize, trip.interests);
    const masterPoolTargetSize = buildMasterPoolSize(trip.days, rankedAttractions.length, totalAttractions);
    const masterAttractionPool = selectDiverseAttractions(rankedAttractions, masterPoolTargetSize, trip.interests);
    const variedTopAttractions = shuffleTopBand(masterAttractionPool, totalAttractions);
    const selectedAttractions = selectDiverseAttractions(variedTopAttractions, totalAttractions, trip.interests);
    logger.info('Recommendation ranking complete', {
      replacement_attraction_pool_count: replacementAttractionPool.length,
      master_attraction_pool_count: masterAttractionPool.length,
      master_attraction_pool_preview: previewPlaceNames(masterAttractionPool),
      final_attraction_count: selectedAttractions.length,
      final_attraction_preview: previewPlaceNames(selectedAttractions),
    });

    const restaurantPool = this.buildRestaurantPool(candidatePlaces, trip.interests);
    const restaurants = this.buildRestaurants(restaurantPool, trip.interests);

    return {
      replacementAttractionPool,
      masterAttractionPool,
      attractions: selectedAttractions,
      restaurants,
      metadata: {
        ranking_mode: (trip.interests || []).length > 0 ? 'hybrid' : 'popularity',
        total_candidates: candidatePlaces.length,
        interest_filter_applied: interestFilterApplied,
        attraction_interest_count: getAttractionRelevantInterests(trip.interests).length,
        side_channel_interest_count: getRestaurantRelevantInterests(trip.interests).length,
        deduplicated_candidates: dedupedCount,
        master_pool_count: masterAttractionPool.length,
        ranking_strategy: 'dynamic multi-stage tourism ranking',
        ml_service_fallback: sampledCandidates.length > 0 && sampledCandidates.every((place) =>
          Number(mlScoreMap.get(place.place_id)) === recommendationConfig.mlFallbackScore),
      },
    };
  }
}

module.exports = RecommendationService;
