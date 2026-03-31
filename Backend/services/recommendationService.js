const axios = require('axios');
const Place = require('../models/Place');
const logger = require('../utils/logger');
const { getPlaceDetails, buildPlacePhotoUrl } = require('./googlePlacesService');
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

const STRICT_INTEREST_ERROR_PREFIX = 'INSUFFICIENT_STRICT_INTEREST_MATCHES:';
const INTEREST_PAIRING_SUGGESTIONS = {
  beaches: [
    { interest: 'nature', reason: 'Nature widens the pool with islands, waterfront parks, viewpoints, and calmer coastal stops.' },
  ],
  culture: [
    { interest: 'history', reason: 'History usually unlocks heritage landmarks, monuments, and story-rich cultural sites nearby.' },
    { interest: 'art', reason: 'Art helps surface galleries, design-focused spaces, and craft-led cultural experiences.' },
  ],
  art: [
    { interest: 'history', reason: 'History pairs well with art by bringing in museums, palaces, and heritage spaces with stronger curation.' },
    { interest: 'culture', reason: 'Culture expands art trips with living traditions, performances, and community-led creative spots.' },
  ],
  history: [
    { interest: 'culture', reason: 'Culture helps history trips surface temples, churches, museums, and ceremonial landmarks that fit the same vibe.' },
    { interest: 'art', reason: 'Art adds galleries and museum-like spaces that still feel aligned with a history-led day.' },
  ],
  nature: [
    { interest: 'beaches', reason: 'Beaches helps nature trips pick up waterfront promenades, island edges, and scenic coastlines.' },
  ],
  shopping: [
    { interest: 'culture', reason: 'Culture helps shopping discover heritage markets, craft lanes, and souvenir-heavy local districts.' },
    { interest: 'history', reason: 'History can unlock old trading streets, bazaars, and landmark market areas that suit shopping trips.' },
  ],
  food: [
    { interest: 'culture', reason: 'Culture broadens food trips with classic neighborhoods, heritage cafes, and iconic local dining pockets.' },
  ],
};

const toInterestLabel = (interest) => {
  const normalized = normalizeInterest(interest);
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : '';
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
    description: place.description,
    types: place.types || [],
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
const getPlacePhotos = (place) => Array.isArray(place.photos) ? place.photos : [];
const getPrimaryPhotoReference = (place) => getPlacePhotos(place).find((photo) => photo?.photo_reference)?.photo_reference || null;
const getPhotoUrl = (place, maxWidth = 800) => buildPlacePhotoUrl(getPrimaryPhotoReference(place), maxWidth);
const normalizePhotos = (photos) => (
  Array.isArray(photos)
    ? photos
      .map((photo) => ({
        photo_reference: photo.photo_reference,
        height: photo.height,
        width: photo.width,
        html_attributions: Array.isArray(photo.html_attributions) ? photo.html_attributions : [],
      }))
      .filter((photo) => photo.photo_reference)
    : []
);
const attractionDrivenInterests = new Set(['beaches', 'culture', 'nature', 'history', 'art', 'adventure', 'sports', 'shopping']);
const restaurantDrivenInterests = new Set(['food', 'nightlife']);
const interestOnlyAttractionTypes = new Set([
  'shopping_mall',
  'market',
  'clothing_store',
  'jewelry_store',
]);
const directShoppingTypes = new Set([
  'shopping_mall',
  'market',
  'clothing_store',
  'jewelry_store',
]);
const strictRetailDedupTypes = new Set([
  'shopping_mall',
  'market',
  'clothing_store',
  'jewelry_store',
]);
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

const hasStrictRetailDedupType = (place) => getNormalizedTypes(place).some((type) => strictRetailDedupTypes.has(type));

const getPlaceQualityScore = (place) => Number(place.user_ratings_total || 0) + (Number(place.rating || 0) * 100);

const dedupePlaces = (places) => {
  const deduped = [];

  places.forEach((place) => {
    const normalizedName = normalizeNameForDedup(place.name);
    const existingIndex = deduped.findIndex((candidate) =>
      normalizeNameForDedup(candidate.name) === normalizedName
      && (
        arePlacesNear(candidate, place)
        || (hasStrictRetailDedupType(candidate) && hasStrictRetailDedupType(place))
      ),
    );

    if (existingIndex === -1) {
      deduped.push(place);
      return;
    }

    const existing = deduped[existingIndex];
    const existingScore = getPlaceQualityScore(existing);
    const incomingScore = getPlaceQualityScore(place);

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
    description: place.description,
    types: place.types || [],
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

const getInterestPairingSuggestions = (tripInterests) => {
  const normalizedInterests = getAttractionRelevantInterests(tripInterests);
  if (normalizedInterests.length !== 1) {
    return [];
  }

  const [primaryInterest] = normalizedInterests;
  return (INTEREST_PAIRING_SUGGESTIONS[primaryInterest] || []).map((entry) => ({
    ...entry,
    primary_interest: primaryInterest,
    primary_interest_label: toInterestLabel(primaryInterest),
    suggested_interest_label: toInterestLabel(entry.interest),
  }));
};

const STREET_SHOPPING_INTENTS = new Set([
  'street shopping',
  'local shopping',
  'souvenir shopping',
  'fashion shopping',
]);

const SECONDARY_SHOPPING_INTENTS = new Set([
  'mall shopping',
  'budget shopping',
  'electronics shopping',
  'jewelry shopping',
]);
const BLOCKED_SHOPPING_TYPES = new Set([
  'grocery_or_supermarket',
  'supermarket',
  'real_estate_agency',
  'electronics_store',
]);

const INTEREST_INTENT_SIGNAL_MAP = {
  art: new Set([
    'art experience',
    'museum visit',
    'cultural landmark',
    'craft shopping',
    'live music',
  ]),
  history: new Set([
    'heritage site',
    'museum visit',
    'cultural landmark',
    'tourist hotspot',
  ]),
  culture: new Set([
    'cultural landmark',
    'spiritual stop',
    'heritage site',
    'local favorite',
    'live music',
  ]),
  beaches: new Set([
    'beach walk',
    'waterfront',
    'sunset spot',
    'scenic views',
  ]),
  nature: new Set([
    'nature escape',
    'scenic views',
    'sunset spot',
    'waterfront',
    'relaxing',
  ]),
  food: new Set([
    'street food',
    'casual dining',
    'fine dining',
    'cafe stop',
    'budget eats',
    'seafood',
  ]),
};

const getInterestTrackRatio = (tripInterests) => {
  const hasAttractionInterests = getAttractionRelevantInterests(tripInterests).length > 0;
  return hasAttractionInterests
    ? { popularRatio: 0, interestRatio: 1 }
    : { popularRatio: 1, interestRatio: 0 };
};

const getAllowedTypesForInterests = (tripInterests, interestResolver = getAttractionRelevantInterests) =>
  new Set(
    interestResolver(tripInterests)
      .flatMap((interest) => interestTypeMap[interest] || []),
  );

function placeMatchesInterest(place, allowedTypes, tripInterests) {
  const normalizedInterests = getAttractionRelevantInterests(tripInterests);
  if (normalizedInterests.length === 0) {
    return getNormalizedTypes(place).some((type) => allowedTypes.has(type));
  }

  return getInterestSignals(place, tripInterests).isEligibleStrictMatch;
}

function getPlaceKeywordText(place) {
  return [
    place?.name,
    getPrimaryCategory(place),
    ...(Array.isArray(place?.types) ? place.types : []),
    ...(Array.isArray(place?.intent_tags) ? place.intent_tags : []),
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

function getInferredInterestScores(place) {
  return place.inferred_interest_scores && typeof place.inferred_interest_scores === 'object'
    ? place.inferred_interest_scores
    : {};
}

function getInferredInterestTags(place) {
  return Array.isArray(place?.inferred_interest_tags)
    ? place.inferred_interest_tags.map((tag) => normalizeInterest(tag)).filter(Boolean)
    : [];
}

function getInterestThresholdForLabel(interest, options = {}) {
  const normalizedInterest = normalizeInterest(interest);
  const allowSoftMatches = Boolean(options.allowSoftMatches);
  if (normalizedInterest === 'beaches') {
    return allowSoftMatches
      ? recommendationConfig.softBeachesInterestScoreThreshold
      : recommendationConfig.beachesInterestScoreThreshold;
  }
  if (normalizedInterest === 'shopping') {
    return recommendationConfig.shoppingInterestScoreThreshold;
  }

  return allowSoftMatches
    ? recommendationConfig.softInterestScoreThreshold
    : recommendationConfig.strictInterestScoreThreshold;
}

function getActiveInterestThreshold(place) {
  const threshold = Number(place?._activeInterestThreshold);
  if (Number.isFinite(threshold)) {
    return threshold;
  }

  const activeInterest = normalizeInterest(place?._activeInterestLabel);
  return getInterestThresholdForLabel(activeInterest || '', {
    allowSoftMatches: Boolean(place?._allowSoftMatches),
  });
}

function getActiveWeightedRatingCutoff(place) {
  const cutoff = Number(place?._activeWeightedRatingCutoff);
  return Number.isFinite(cutoff) ? cutoff : recommendationConfig.trackBWeightedRatingCutoff;
}

function getSelectedInterestScoreBreakdown(place, normalizedInterests) {
  const allowSoftMatches = Boolean(place?._allowSoftMatches);
  const inferredScores = getInferredInterestScores(place);
  const selectedScores = normalizedInterests
    .map((interest) => ({
      interest,
      score: Number(inferredScores[interest] || 0),
      threshold: getInterestThresholdForLabel(interest, { allowSoftMatches }),
    }))
    .filter(({ score }) => Number.isFinite(score) && score > 0)
    .sort((first, second) => second.score - first.score);

  const maxSelectedScore = selectedScores[0]?.score || 0;
  const averageSelectedScore = selectedScores.length > 0
    ? selectedScores.reduce((sum, entry) => sum + entry.score, 0) / selectedScores.length
    : 0;
  const strongMatchedInterests = selectedScores
    .filter(({ score, threshold }) => score >= threshold)
    .map(({ interest }) => interest);
  const mediumConfidenceInterests = selectedScores
    .filter(({ score }) => score >= recommendationConfig.strictInterestMediumThreshold)
    .map(({ interest }) => interest);
  const highConfidenceInterests = selectedScores
    .filter(({ score }) => score >= recommendationConfig.strictInterestHighThreshold)
    .map(({ interest }) => interest);

  const matchedThresholds = selectedScores
    .filter(({ score, threshold }) => score >= threshold)
    .map(({ threshold }) => threshold);
  const activeThreshold = matchedThresholds.length > 0
    ? Math.min(...matchedThresholds)
    : selectedScores.length > 0
      ? selectedScores[0].threshold
      : getActiveInterestThreshold(place);

  return {
    selectedScores,
    maxSelectedScore,
    averageSelectedScore,
    strongMatchedInterests,
    mediumConfidenceInterests,
    highConfidenceInterests,
    activeThreshold,
  };
}

function getMlInterestMatchScore(place, normalizedInterests) {
  if (normalizedInterests.length === 0) {
    return 0;
  }

  const { averageSelectedScore } = getSelectedInterestScoreBreakdown(place, normalizedInterests);
  return Math.min(1, averageSelectedScore);
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

function isDirectShoppingPlace(place) {
  const normalizedTypes = getNormalizedTypes(place);
  if (normalizedTypes.some((type) => BLOCKED_SHOPPING_TYPES.has(type))) {
    return false;
  }

  return normalizedTypes.some((type) => directShoppingTypes.has(type));
}

function hasShoppingKeywordMatch(place) {
  const keywordText = getPlaceKeywordText(place);
  return (INTEREST_KEYWORD_MAP.shopping || []).some((keyword) => keywordText.includes(keyword));
}

function getShoppingIntentBoost(place) {
  const intentTags = Array.isArray(place?.intent_tags)
    ? place.intent_tags.map((tag) => normalizeText(tag).trim()).filter(Boolean)
    : [];

  if (intentTags.length === 0) {
    return 0;
  }

  let boost = 0;
  if (intentTags.some((tag) => STREET_SHOPPING_INTENTS.has(tag))) {
    boost += 0.12;
  }
  if (intentTags.some((tag) => SECONDARY_SHOPPING_INTENTS.has(tag))) {
    boost += 0.05;
  }

  return roundTo(Math.min(boost, 0.16), 4);
}

function getIntentBoostForInterest(place, interest) {
  const normalizedInterest = normalizeInterest(interest);
  if (!normalizedInterest || normalizedInterest === 'shopping') {
    return 0;
  }

  const supportedIntentTags = INTEREST_INTENT_SIGNAL_MAP[normalizedInterest];
  if (!supportedIntentTags) {
    return 0;
  }

  const intentTags = Array.isArray(place?.intent_tags)
    ? place.intent_tags.map((tag) => normalizeText(tag).trim()).filter(Boolean)
    : [];
  if (intentTags.length === 0) {
    return 0;
  }

  let boost = 0;
  if (intentTags.some((tag) => supportedIntentTags.has(tag))) {
    boost += 0.08;
  }

  const types = getNormalizedTypes(place);
  if ((interestTypeMap[normalizedInterest] || []).some((type) => types.includes(type))) {
    boost += 0.04;
  }

  return roundTo(Math.min(boost, 0.12), 4);
}

function getGeneralInterestIntentBoost(place, normalizedInterests) {
  return roundTo(
    Math.min(
      normalizedInterests
        .filter((interest) => interest !== 'shopping')
        .reduce((maxBoost, interest) => Math.max(maxBoost, getIntentBoostForInterest(place, interest)), 0),
      0.12,
    ),
    4,
  );
}

function isHighConfidenceShoppingMatch(place) {
  const shoppingScore = Number(getInferredInterestScores(place).shopping || 0);
  return Number.isFinite(shoppingScore) && shoppingScore >= recommendationConfig.shoppingSemanticInterestScoreThreshold;
}

function isHighConfidenceShoppingCandidate(place) {
  return isHighConfidenceShoppingMatch(place)
    && !getNormalizedTypes(place).some((type) => BLOCKED_SHOPPING_TYPES.has(type))
    && !getNormalizedTypes(place).some((type) => blockedAttractionTypes.has(type))
    && !isBlockedRestaurant(place)
    && !isRestaurantLike(place);
}

function getEligibleInterests(place, normalizedInterests) {
  const inferredScores = getInferredInterestScores(place);
  const allowSoftMatches = Boolean(place?._allowSoftMatches);

  return normalizedInterests.filter((interest) => {
    const score = Number(inferredScores[interest] || 0);
    if (!Number.isFinite(score) || score <= 0) {
      return false;
    }

      if (interest === 'shopping') {
        const shoppingIntentBoost = getShoppingIntentBoost(place);
        const normalizedTypes = getNormalizedTypes(place);
        if (normalizedTypes.some((type) => BLOCKED_SHOPPING_TYPES.has(type))) {
          return false;
        }

        if (isDirectShoppingPlace(place)) {
          return score >= recommendationConfig.shoppingInterestScoreThreshold;
        }

        return score >= recommendationConfig.shoppingSemanticInterestScoreThreshold
          && (hasShoppingKeywordMatch(place) || shoppingIntentBoost >= 0.1);
      }

      return score >= getInterestThresholdForLabel(interest, { allowSoftMatches });
    });
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
      maxSelectedScore: 0,
      averageSelectedScore: 0,
      confidenceBoost: 0,
      isEligibleStrictMatch: false,
      strongMatchedInterests: [],
      mediumConfidenceInterests: [],
      highConfidenceInterests: [],
    };
  }

  const manualTypeMatch = getManualTypeMatchScore(place, normalizedInterests);
  const keywordMatch = getKeywordMatchScore(place, normalizedInterests);
  const eligibleInterests = getEligibleInterests(place, normalizedInterests);
  const {
    maxSelectedScore,
    averageSelectedScore,
    strongMatchedInterests,
    mediumConfidenceInterests,
    highConfidenceInterests,
    activeThreshold,
  } = getSelectedInterestScoreBreakdown(place, normalizedInterests);
  const confidenceBoost = maxSelectedScore >= recommendationConfig.strictInterestHighThreshold
    ? recommendationConfig.strictInterestHighBoost
    : maxSelectedScore >= recommendationConfig.strictInterestMediumThreshold
      ? recommendationConfig.strictInterestMediumBoost
      : 0;
  const shoppingIntentBoost = normalizedInterests.includes('shopping') ? getShoppingIntentBoost(place) : 0;
  const generalIntentBoost = getGeneralInterestIntentBoost(place, normalizedInterests);
  const mlInterestMatch = roundTo(Math.min(1, maxSelectedScore + confidenceBoost + shoppingIntentBoost + generalIntentBoost), 4);
  const matchedInterests = eligibleInterests;
  const isEligibleStrictMatch = eligibleInterests.length > 0;

  return {
    manualTypeMatch,
    mlInterestMatch,
    keywordMatch,
    interestScore: roundTo(Math.min(1, mlInterestMatch), 4),
    matchedInterests,
    maxSelectedScore: roundTo(maxSelectedScore, 4),
    averageSelectedScore: roundTo(averageSelectedScore, 4),
    confidenceBoost: roundTo(confidenceBoost, 4),
    shoppingIntentBoost,
    generalIntentBoost,
    isEligibleStrictMatch,
    strongMatchedInterests: eligibleInterests,
    mediumConfidenceInterests,
    highConfidenceInterests,
    activeThreshold,
  };
}

const filterByNormalizedInterests = (places, normalizedInterests, requiredAttractionCount, options = {}) => {
  const allowSoftMatches = Boolean(options.allowSoftMatches);
  if (normalizedInterests.length === 0) {
    return {
      places: [],
      interestFilterApplied: false,
      minimumInterestMatches: 0,
      strongMatchCount: 0,
      mediumConfidenceCount: 0,
      highConfidenceCount: 0,
      softMatchAvailable: false,
      softMatchApplied: false,
      softMatchCount: 0,
    };
  }
  const ratingValues = places
    .map((place) => Number(place.rating || 0))
    .filter((rating) => Number.isFinite(rating) && rating > 0);
  const averageRating = ratingValues.length > 0
    ? ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length
    : 0;
  const buildFilteredPlacesForThreshold = (threshold, weightedRatingCutoff) => places.filter((place) => {
    const rating = Number(place.rating || 0);
    const reviewCount = Number(place.user_ratings_total || 0);
    const weightedRating = ((reviewCount / (reviewCount + recommendationConfig.weightedRatingThreshold)) * rating)
      + ((recommendationConfig.weightedRatingThreshold / (reviewCount + recommendationConfig.weightedRatingThreshold)) * averageRating);
    const interestSignals = getInterestSignals(
      {
        ...place,
        _activeInterestThreshold: threshold,
        _activeInterestLabel: normalizedInterests[0] || null,
        _allowSoftMatches: allowSoftMatches,
      },
      normalizedInterests,
    );

    return weightedRating >= weightedRatingCutoff
      && interestSignals.isEligibleStrictMatch
      && !getNormalizedTypes(place).some((type) => blockedAttractionTypes.has(type))
      && !isBlockedRestaurant(place)
      && !isRestaurantLike(place);
  });
  const primaryThreshold = recommendationConfig.strictInterestScoreThreshold;
  const primaryWeightedRatingCutoff = recommendationConfig.trackBWeightedRatingCutoff;
  const fallbackWeightedRatingCutoff = recommendationConfig.trackBFallbackWeightedRatingCutoff;
  const primaryMatches = buildFilteredPlacesForThreshold(primaryThreshold, primaryWeightedRatingCutoff);
  const shouldUseFallback = primaryMatches.length < requiredAttractionCount
    && fallbackWeightedRatingCutoff < primaryWeightedRatingCutoff;
  const activeThreshold = primaryThreshold;
  const activeWeightedRatingCutoff = shouldUseFallback ? fallbackWeightedRatingCutoff : primaryWeightedRatingCutoff;
  const filteredPlaces = (shouldUseFallback
    ? buildFilteredPlacesForThreshold(primaryThreshold, fallbackWeightedRatingCutoff)
    : primaryMatches)
    .map((place) => ({
      ...place,
      _activeInterestThreshold: activeThreshold,
      _activeInterestLabel: normalizedInterests[0] || null,
      _allowSoftMatches: allowSoftMatches,
      _activeWeightedRatingCutoff: activeWeightedRatingCutoff,
    }));
  const minimumInterestMatches = Math.min(
    filteredPlaces.length,
    requiredAttractionCount,
  );
  const strongMatchCount = filteredPlaces.length;
  const mediumConfidenceCount = filteredPlaces.filter((place) =>
    getInterestSignals(place, normalizedInterests).maxSelectedScore >= recommendationConfig.strictInterestMediumThreshold,
  ).length;
  const highConfidenceCount = filteredPlaces.filter((place) =>
    getInterestSignals(place, normalizedInterests).maxSelectedScore >= recommendationConfig.strictInterestHighThreshold,
  ).length;

  return {
    places: filteredPlaces,
    interestFilterApplied: filteredPlaces.length > 0 && minimumInterestMatches > 0,
    minimumInterestMatches,
    strongMatchCount,
    mediumConfidenceCount,
      highConfidenceCount,
      thresholdUsed: activeThreshold,
      fallbackApplied: shouldUseFallback,
      weightedRatingCutoffUsed: activeWeightedRatingCutoff,
      softMatchAvailable: !allowSoftMatches && normalizedInterests.some((interest) => interest !== 'shopping'),
      softMatchApplied: allowSoftMatches,
      softMatchCount: allowSoftMatches ? filteredPlaces.length : 0,
    };
};

const filterByInterests = (places, tripInterests, requiredAttractionCount, options = {}) =>
  filterByNormalizedInterests(
    places,
    getAttractionRelevantInterests(tripInterests),
    requiredAttractionCount,
    options,
  );

const getInterestMatchScore = (place, tripInterests) => {
  return getInterestSignals(place, tripInterests).interestScore;
};

const hasStrictInterestMatch = (place, tripInterests) => getInterestSignals(place, tripInterests).isEligibleStrictMatch;

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
        rankedAttractions.filter((place) => hasStrictInterestMatch(place, tripInterests)).length,
        Math.max(2, Math.ceil(totalAttractions * 0.55)),
      )
    : 0;
  const religiousCap = attractionInterests.some((interest) => ['culture', 'history'].includes(interest))
    ? Math.max(3, Math.ceil(totalAttractions / 4))
    : Math.max(2, Math.ceil(totalAttractions / 6));
  const defaultThemeCap = Math.max(2, Math.ceil(totalAttractions / 3));
  let selectedInterestMatches = 0;

  if (attractionInterests.includes('shopping')) {
    const mandatoryShoppingPlaces = remaining.filter((place) => isHighConfidenceShoppingMatch(place));
    while (mandatoryShoppingPlaces.length > 0 && selected.length < totalAttractions) {
      const chosen = mandatoryShoppingPlaces.shift();
      const remainingIndex = remaining.findIndex((place) => place.place_id === chosen.place_id);
      if (remainingIndex === -1) {
        continue;
      }

      remaining.splice(remainingIndex, 1);
      selected.push(chosen);
      const chosenTheme = getThemeBucket(chosen);
      themeCounts.set(chosenTheme, (themeCounts.get(chosenTheme) || 0) + 1);
      if (hasStrictInterestMatch(chosen, tripInterests)) {
        selectedInterestMatches += 1;
      }
    }
  }

  while (remaining.length > 0 && selected.length < totalAttractions) {
    const prioritizeInterestMatch = selectedInterestMatches < minimumInterestMatches;
    const nextIndex = remaining.findIndex((place) => {
      const theme = getThemeBucket(place);
      const cap = theme === 'religious' ? religiousCap : defaultThemeCap;
      const withinThemeCap = (themeCounts.get(theme) || 0) < cap;
      const isInterestMatch = hasStrictInterestMatch(place, tripInterests);

      if (prioritizeInterestMatch) {
        return withinThemeCap && isInterestMatch;
      }

      return withinThemeCap;
    });

    if (nextIndex === -1) {
      if (selectedInterestMatches < minimumInterestMatches) {
        const fallbackInterestIndex = remaining.findIndex((place) => hasStrictInterestMatch(place, tripInterests));
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
    if (hasStrictInterestMatch(chosen, tripInterests)) {
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
  const photoReference = getPrimaryPhotoReference(place);
  const matchedInterests = scores.interestSignals?.matchedInterests || [];
  const selectedInterestLabel = matchedInterests[0] || null;
  const selectedInterestThreshold = Number((scores.interestSignals?.activeThreshold || recommendationConfig.strictInterestScoreThreshold).toFixed(2));
  const selectedInterestScore = Number((scores.interestSignals?.maxSelectedScore || 0).toFixed(4));
  const generalIntentBoost = scores.interestSignals?.generalIntentBoost || 0;
  const shoppingIntentBoost = scores.interestSignals?.shoppingIntentBoost || 0;
  const inferredInterestTags = Array.isArray(place.inferred_interest_tags) ? place.inferred_interest_tags : [];
  const selectedInterestTagMatched = selectedInterestLabel
    ? inferredInterestTags.map(normalizeInterest).includes(selectedInterestLabel)
    : false;
  const selectedIntentQualified = shoppingIntentBoost > 0 || generalIntentBoost > 0;
  const eligibilitySignals = [
    selectedInterestScore >= selectedInterestThreshold ? 'score-threshold' : null,
    selectedInterestTagMatched ? 'clean-tag' : null,
    selectedIntentQualified ? 'intent-assist' : null,
  ].filter(Boolean);

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
    photo_reference: photoReference,
    photo_url: getPhotoUrl(place, 1000),
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
    selected_interest_score: selectedInterestScore,
    selected_interest_threshold: selectedInterestThreshold,
    selected_weighted_rating_cutoff: Number(getActiveWeightedRatingCutoff(place).toFixed(2)),
    selected_interest_label: selectedInterestLabel,
    selected_interest_eligibility: {
      qualified_by: eligibilitySignals,
      score_threshold_met: selectedInterestScore >= selectedInterestThreshold,
      clean_tag_matched: selectedInterestTagMatched,
      intent_assisted: selectedIntentQualified,
    },
    interest_match_details: {
      manual_type_match: scores.interestSignals?.manualTypeMatch || 0,
      ml_interest_match: scores.interestSignals?.mlInterestMatch || 0,
      keyword_match: scores.interestSignals?.keywordMatch || 0,
      general_intent_boost: generalIntentBoost,
      shopping_intent_boost: shoppingIntentBoost,
      matched_interests: matchedInterests,
    },
    inferred_interest_tags: inferredInterestTags,
    intent_tags: Array.isArray(place.intent_tags) ? place.intent_tags : [],
  };
};

const buildRestaurantResponse = (place) => {
  const reviewTexts = getReviewTexts(place);
  const reviewSnippet = reviewTexts[0] || place.description || 'Popular place for a meal break.';
  const photoReference = getPrimaryPhotoReference(place);

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
    photo_reference: photoReference,
    photo_url: getPhotoUrl(place, 800),
    category: getPrimaryCategory(place),
    user_ratings_total: place.user_ratings_total || 0,
    explanation_tags: [
      Number(place.rating || 0) >= 4.5 ? 'Highly rated' : null,
      Number(place.user_ratings_total || 0) >= 1000 ? 'Popular' : null,
      'Food stop',
    ].filter(Boolean),
    intent_tags: Array.isArray(place.intent_tags) ? place.intent_tags : [],
  };
};

const buildMasterPoolSize = (tripDays, rankedCount, visibleCount) => {
  const requestedSize = Math.max(40, Number(tripDays || 1) * 10, visibleCount * 2);
  return Math.min(rankedCount, Math.min(80, requestedSize));
};

class RecommendationService {
  static async hydratePlacePhoto(place, photoCache = new Map()) {
    if (!place?.place_id) {
      return place;
    }

    if (getPrimaryPhotoReference(place)) {
      photoCache.set(place.place_id, getPlacePhotos(place));
      return place;
    }

    if (photoCache.has(place.place_id)) {
      const cachedPhotos = photoCache.get(place.place_id);
      return cachedPhotos?.length ? { ...place, photos: cachedPhotos } : place;
    }

    try {
      const placeDetails = await getPlaceDetails(place.place_id);
      const photos = normalizePhotos(placeDetails?.photos);

      if (photos.length === 0) {
        photoCache.set(place.place_id, []);
        return place;
      }

      await Place.updateOne(
        { place_id: place.place_id },
        { $set: { photos } },
      );

      photoCache.set(place.place_id, photos);

      return {
        ...place,
        photos,
      };
    } catch (error) {
      logger.warn('Photo enrichment fallback active', {
        place_id: place.place_id,
        details: error.response?.data?.error_message || error.message,
      });
      photoCache.set(place.place_id, []);
      return place;
    }
  }

  static async hydratePlacePhotos(places, limit = places.length, photoCache = new Map()) {
    if (!process.env.GOOGLE_MAPS_API_KEY || !Array.isArray(places) || places.length === 0) {
      return places;
    }

    const cappedLimit = Math.max(0, Math.min(Number(limit) || places.length, places.length));
    const hydrated = [...places];
    const concurrency = 4;

    for (let index = 0; index < cappedLimit; index += concurrency) {
      const batchIndexes = Array.from(
        { length: Math.min(concurrency, cappedLimit - index) },
        (_, offset) => index + offset,
      );

      const batchResults = await Promise.all(
        batchIndexes.map((batchIndex) => this.hydratePlacePhoto(hydrated[batchIndex], photoCache)),
      );

      batchIndexes.forEach((batchIndex, resultIndex) => {
        hydrated[batchIndex] = batchResults[resultIndex];
      });
    }

    return hydrated;
  }

  static async attachPhotoMetadataToResponses(places, limit = places.length, photoCache = new Map()) {
    if (!Array.isArray(places) || places.length === 0) {
      return places;
    }

    const cappedLimit = Math.max(0, Math.min(Number(limit) || places.length, places.length));
    const targetIds = [...new Set(
      places
        .slice(0, cappedLimit)
        .map((place) => place?.place_id)
        .filter(Boolean),
    )];

    if (targetIds.length === 0) {
      return places;
    }

    let dbPlaces = await Place.find({ place_id: { $in: targetIds } })
      .lean()
      .select({ place_id: 1, photos: 1 });

    dbPlaces.forEach((place) => {
      photoCache.set(place.place_id, getPlacePhotos(place));
    });

    const missingPlaceIds = targetIds.filter((placeId) => {
      const cachedPhotos = photoCache.get(placeId);
      return !Array.isArray(cachedPhotos) || cachedPhotos.length === 0;
    });

    if (missingPlaceIds.length > 0) {
      const missingPlaces = places
        .filter((place) => missingPlaceIds.includes(place.place_id))
        .map((place) => ({
          place_id: place.place_id,
          photos: Array.isArray(photoCache.get(place.place_id)) ? photoCache.get(place.place_id) : [],
        }));

      await this.hydratePlacePhotos(missingPlaces, missingPlaces.length, photoCache);
    }

    const photoMap = new Map(
      targetIds.map((placeId) => [
        placeId,
        {
          photo_reference: getPrimaryPhotoReference({ photos: photoCache.get(placeId) || [] }),
          photo_url: getPhotoUrl({ photos: photoCache.get(placeId) || [] }, 1000),
        },
      ]),
    );

    return places.map((place, index) => {
      if (index >= cappedLimit) {
        return place;
      }

      const photoData = photoMap.get(place.place_id);
      if (!photoData?.photo_reference && !photoData?.photo_url) {
        return place;
      }

      return {
        ...place,
        photo_reference: photoData.photo_reference || place.photo_reference || null,
        photo_url: photoData.photo_url || place.photo_url || null,
      };
    });
  }

  static seedPhotoCache(places, photoCache = new Map()) {
    (places || []).forEach((place) => {
      if (place?.place_id && Array.isArray(place.photos)) {
        photoCache.set(place.place_id, place.photos);
      }
    });

    return photoCache;
  }

  static async fetchCandidatePlaces(city) {
    return Place.find({ city: String(city).toLowerCase() })
      .lean()
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
          intent_tags: prediction.intent_tags || [],
        };
      });
    } catch (error) {
      const details = error.response?.data?.detail || error.message;
      logger.warn('Interest prediction fallback active', { details });
      return places;
    }
  }

  static buildAttractionCandidatePool(places, tripInterests, requiredAttractionCount, options = {}) {
    const allowSoftMatches = Boolean(options.allowSoftMatches);
    const attractionInterests = getAttractionRelevantInterests(tripInterests);
    const hasAttractionInterests = attractionInterests.length > 0;
    const { popularRatio, interestRatio } = getInterestTrackRatio(tripInterests);
    const strictTypeFilter = dedupePlaces(
      places.filter((place) => isAllowedAttraction(place) || isInterestOnlyAttraction(place, tripInterests)),
    );
    const highConfidenceShoppingCandidates = hasAttractionInterests && attractionInterests.includes('shopping')
      ? dedupePlaces(
          places.filter((place) => isHighConfidenceShoppingCandidate(place)),
        )
      : [];
    let afterTypeFilter = strictTypeFilter;

    if (highConfidenceShoppingCandidates.length > 0) {
      afterTypeFilter = dedupePlaces([
        ...afterTypeFilter,
        ...highConfidenceShoppingCandidates,
      ]);
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
    const explorationMinReviews = hasAttractionInterests
      ? Math.min(
          recommendationConfig.minAttractionReviews,
          recommendationConfig.explorationAttractionReviews,
        )
      : 500;
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
    const baseCandidatePool = hasAttractionInterests
      ? blendCandidatePools(
          dedupedPopularPool,
          explorationPool,
          Math.min(
            relaxedExplorationSource.length,
            recommendationConfig.candidatePoolLimit + Math.max(45, requiredAttractionCount * 3),
          ),
          popularRatio,
        )
      : (
        dedupedPopularPool.length >= Math.max(requiredAttractionCount * 2, 30)
          ? dedupedPopularPool
          : blendCandidatePools(
              dedupedPopularPool,
              explorationPool,
              Math.min(
                relaxedExplorationSource.length,
                Math.max(Math.max(requiredAttractionCount * 2, 30), requiredAttractionCount * 3),
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

    const {
      places: interestFilteredPlaces,
      interestFilterApplied,
      minimumInterestMatches,
      strongMatchCount,
      mediumConfidenceCount,
      highConfidenceCount,
      thresholdUsed,
      fallbackApplied,
      weightedRatingCutoffUsed,
      softMatchAvailable,
      softMatchApplied,
      softMatchCount,
    } = filterByInterests(
      broaderInterestSource,
      tripInterests,
      requiredAttractionCount,
      { allowSoftMatches },
    );
    const hasMultiInterestCombo = attractionInterests.length > 1;
    let interestPool = dedupePlaces(interestFilteredPlaces);
    let shoppingComboDetails = null;

    if (hasMultiInterestCombo) {
      const laneTarget = Math.max(1, Math.ceil(requiredAttractionCount / attractionInterests.length));
      const laneResults = attractionInterests.map((interest) => ({
        interest,
        result: filterByNormalizedInterests(
          broaderInterestSource,
          [interest],
          laneTarget,
          { allowSoftMatches },
        ),
      }));
      const mergedInterestPool = dedupePlaces([
        ...laneResults.flatMap(({ result }) => takeTopByScore(result.places, laneTarget)),
        ...laneResults.flatMap(({ result }) => result.places),
        ...interestFilteredPlaces,
      ]);

      if (mergedInterestPool.length > 0) {
        interestPool = mergedInterestPool;
      }

      shoppingComboDetails = {
        lane_target: laneTarget,
        lanes: laneResults.map(({ interest, result }) => ({
          interest,
          size: result.places.length,
        })),
      };
    }
    const preFloorCandidatePool = hasAttractionInterests
      ? interestPool
      : baseCandidatePool;
    const interestAwareFallbackPool = dedupePlaces([
      ...interestPool,
      ...explorationPool,
      ...broaderInterestSource,
      ...afterQualityFilter,
      ...afterTypeFilter,
    ]);
    const candidatePool = hasAttractionInterests
      ? preFloorCandidatePool
      : fillCandidateFloor(
          preFloorCandidatePool,
          interestAwareFallbackPool,
          Math.min(interestAwareFallbackPool.length, Math.max(requiredAttractionCount * 2, 30)),
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
      track_b_split: hasAttractionInterests ? { popularRatio, interestRatio } : null,
      popularity_filter_preview: previewPlaceNames(afterPopularityFilter),
      popular_pool_size: dedupedPopularPool.length,
      exploration_pool_size: explorationPool.length,
      base_candidate_pool_size: baseCandidatePool.length,
      pre_floor_candidate_pool_size: preFloorCandidatePool.length,
      candidate_floor_target: hasAttractionInterests ? 0 : Math.max(requiredAttractionCount * 2, 30),
      interest_pool_size: interestPool.length,
      minimum_interest_matches: minimumInterestMatches,
      strict_interest_threshold_used: thresholdUsed,
      strict_interest_fallback_applied: fallbackApplied,
      strict_interest_score_threshold: recommendationConfig.strictInterestScoreThreshold,
      shopping_interest_score_threshold: recommendationConfig.shoppingInterestScoreThreshold,
      track_b_weighted_rating_cutoff: recommendationConfig.trackBWeightedRatingCutoff,
      track_b_fallback_weighted_rating_cutoff: recommendationConfig.trackBFallbackWeightedRatingCutoff,
      track_b_weighted_rating_cutoff_used: weightedRatingCutoffUsed,
      strict_interest_medium_threshold: recommendationConfig.strictInterestMediumThreshold,
      strict_interest_high_threshold: recommendationConfig.strictInterestHighThreshold,
      strict_interest_strong_matches: strongMatchCount,
      strict_interest_medium_confidence_matches: mediumConfidenceCount,
      strict_interest_high_confidence_matches: highConfidenceCount,
      soft_match_available: softMatchAvailable,
      soft_match_applied: softMatchApplied,
      soft_match_count: softMatchCount,
      shopping_combo_details: shoppingComboDetails,
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
      strictInterestThresholdUsed: thresholdUsed,
      weightedRatingCutoffUsed,
      softMatchAvailable,
      softMatchApplied,
      softMatchCount,
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
    const hasAttractionInterests = getAttractionRelevantInterests(tripInterests).length > 0;
    const normalizedAttractionInterests = getAttractionRelevantInterests(tripInterests);
    const isShoppingTrack = normalizedAttractionInterests.length === 1 && normalizedAttractionInterests[0] === 'shopping';
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
        const shoppingIntentBoost = interestSignals.shoppingIntentBoost || 0;
        const shoppingHighConfidenceBoost = isShoppingTrack
          ? (
              interestSignals.maxSelectedScore >= recommendationConfig.strictInterestHighThreshold ? 0.2
                : interestSignals.maxSelectedScore >= recommendationConfig.shoppingSemanticInterestScoreThreshold ? 0.12
                  : 0
            )
          : 0;
        const interestMatchScore = isShoppingTrack
          ? Math.min(1, interestSignals.interestScore + shoppingIntentBoost + shoppingHighConfidenceBoost)
          : interestSignals.interestScore;
        const mustSeeBoost = getMustSeeBoost(place);
        const mlScore = Number(mlScoreMap.get(place.place_id) || 0);
        const mlWeight = isShoppingTrack ? 0.04 : hasAttractionInterests ? 0.08 : 0.35;
        const ratingWeight = isShoppingTrack ? 0.27 : hasAttractionInterests ? 0.20 : 0.30;
        const popularityWeight = isShoppingTrack ? 0.18 : hasAttractionInterests ? 0.07 : 0.25;
        const sentimentWeight = isShoppingTrack ? 0.06 : 0.10;
        const interestWeight = isShoppingTrack ? 0.72 : hasAttractionInterests ? 0.55 : 0.18;
        const finalScore = (mlScore * mlWeight)
          + (weightedRating * ratingWeight)
          + (normalizedPopularitySignal * popularityWeight)
          + (sentimentScore * sentimentWeight)
          + (interestMatchScore * interestWeight)
          + shoppingHighConfidenceBoost
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
            interestSignals.matchedInterests[0] ? `Strong ${interestSignals.matchedInterests[0]} match` : null,
            isShoppingTrack && shoppingIntentBoost >= 0.1 ? 'Strong street-shopping vibe' : null,
            !isShoppingTrack && (interestSignals.generalIntentBoost || 0) >= 0.08 ? 'Strong curated intent match' : null,
            interestSignals.maxSelectedScore >= recommendationConfig.strictInterestHighThreshold ? 'Exceptional interest confidence' : null,
            isShoppingTrack && interestSignals.maxSelectedScore >= recommendationConfig.shoppingSemanticInterestScoreThreshold ? 'Strong shopping confidence' : null,
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

  static async getRecommendationsForTrip(trip, options = {}) {
    const allowSoftMatches = Boolean(options.allowSoftMatches);
    const photoCache = new Map();
    const totalAttractions = Math.max(
      recommendationConfig.placesPerDay,
      Number(trip.days || 1) * recommendationConfig.placesPerDay,
    );
    const pairingSuggestions = getInterestPairingSuggestions(trip.interests);
    const requiredAttractionCount = totalAttractions;
    const rawCandidatePlaces = await this.fetchCandidatePlaces(trip.city);
    this.seedPhotoCache(rawCandidatePlaces, photoCache);
    const candidatePlaces = await this.attachInterestPredictions(rawCandidatePlaces, trip.interests);
    const {
      candidatePool,
      interestFilterApplied,
        dedupedCount,
        strictInterestThresholdUsed,
        weightedRatingCutoffUsed,
        softMatchAvailable,
        softMatchApplied,
        softMatchCount,
      } = this.buildAttractionCandidatePool(
        candidatePlaces,
        trip.interests,
        requiredAttractionCount,
        { allowSoftMatches },
      );

    const dynamicSampleSize = Math.max(recommendationConfig.candidateSampleSize, requiredAttractionCount * 4);
    const normalizedInterests = getAttractionRelevantInterests(trip.interests);
    const interestTypes = new Set(normalizedInterests.flatMap((interest) => interestTypeMap[interest] || []));
    const { popularRatio, interestRatio } = getInterestTrackRatio(trip.interests);

    let sampledCandidates;

    if (interestTypes.size > 0) {
      const interestMatches = candidatePool.filter((place) =>
        hasStrictInterestMatch(place, trip.interests),
      );

      if (interestMatches.length > 0) {
        const interestSample = sampleCandidatesWithExploration(
          interestMatches,
          Math.min(interestMatches.length, dynamicSampleSize),
        );
        sampledCandidates = [...interestSample];
      } else {
        sampledCandidates = [];
      }
    } else {
      sampledCandidates = sampleCandidatesWithExploration(candidatePool, dynamicSampleSize);
    }

    sampledCandidates = interestTypes.size > 0
      ? dedupePlaces(sampledCandidates)
      : fillCandidateFloor(
          dedupePlaces(sampledCandidates),
          dedupePlaces([
            ...candidatePool,
            ...rankByQualityAndPopularity(
              candidatePlaces.filter((place) => isAllowedAttraction(place) || isInterestOnlyAttraction(place, trip.interests)),
            ),
          ]),
          Math.min(
            candidatePool.length,
            Math.max(requiredAttractionCount * 2, Math.min(dynamicSampleSize, 32)),
          ),
        );

    logger.info('Recommendation sampling complete', {
      sampled_candidates: sampledCandidates.length,
      dynamic_sample_size: dynamicSampleSize,
      track_b_split: interestTypes.size > 0 ? { popularRatio, interestRatio } : null,
      sampled_interest_matches: sampledCandidates.filter((place) => hasStrictInterestMatch(place, trip.interests)).length,
      strict_interest_threshold_used: strictInterestThresholdUsed,
      track_b_weighted_rating_cutoff_used: weightedRatingCutoffUsed,
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

    const sampledCandidatesWithPhotos = await this.hydratePlacePhotos(
      sampledCandidates,
      Math.min(sampledCandidates.length, 24),
      photoCache,
    );
    const rankedAttractions = this.rankAttractions(sampledCandidatesWithPhotos, mlScoreMap, trip.interests);
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

    const restaurantPool = await this.hydratePlacePhotos(
      this.buildRestaurantPool(candidatePlaces, trip.interests),
      Math.min(recommendationConfig.restaurantReturnCount * 3, 18),
      photoCache,
    );
    const restaurants = await this.attachPhotoMetadataToResponses(
      this.buildRestaurants(restaurantPool, trip.interests),
      recommendationConfig.restaurantReturnCount,
      photoCache,
    );

    const hydratedReplacementAttractionPool = await this.attachPhotoMetadataToResponses(
      replacementAttractionPool,
      Math.min(replacementAttractionPool.length, 36),
      photoCache,
    );
    const hydratedMasterAttractionPool = await this.attachPhotoMetadataToResponses(
      masterAttractionPool,
      Math.min(masterAttractionPool.length, 24),
      photoCache,
    );
    const hydratedSelectedAttractions = await this.attachPhotoMetadataToResponses(
      selectedAttractions,
      selectedAttractions.length,
      photoCache,
    );

    return {
      replacementAttractionPool: hydratedReplacementAttractionPool,
      masterAttractionPool: hydratedMasterAttractionPool,
      attractions: hydratedSelectedAttractions,
      restaurants,
      metadata: {
        ranking_mode: (trip.interests || []).length > 0 ? 'hybrid' : 'popularity',
        total_candidates: candidatePlaces.length,
        interest_filter_applied: interestFilterApplied,
        attraction_interest_count: getAttractionRelevantInterests(trip.interests).length,
        side_channel_interest_count: getRestaurantRelevantInterests(trip.interests).length,
          deduplicated_candidates: dedupedCount,
          strict_interest_threshold_used: strictInterestThresholdUsed,
          track_b_weighted_rating_cutoff_used: weightedRatingCutoffUsed,
          soft_match_available: softMatchAvailable,
          soft_match_applied: softMatchApplied,
          soft_match_count: softMatchCount,
          target_attraction_count: totalAttractions,
          master_pool_count: masterAttractionPool.length,
          ranking_strategy: 'dynamic multi-stage tourism ranking',
          pairing_suggestions: hydratedSelectedAttractions.length < totalAttractions ? pairingSuggestions : [],
        ml_service_fallback: sampledCandidates.length > 0 && sampledCandidates.every((place) =>
          Number(mlScoreMap.get(place.place_id)) === recommendationConfig.mlFallbackScore),
      },
    };
  }
}

RecommendationService.getInterestPairingSuggestions = getInterestPairingSuggestions;

module.exports = RecommendationService;
