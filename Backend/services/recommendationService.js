const axios = require('axios');
const Place = require('../models/Place');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const MAX_PLACES_FOR_SCORING = Number(process.env.RECOMMENDATION_PLACE_LIMIT || 220);
const MIN_RATINGS_THRESHOLD = Number(process.env.RECOMMENDATION_MIN_RATINGS || 50);
const ATTRACTIONS_PER_DAY = Number(process.env.ITINERARY_ATTRACTIONS_PER_DAY || 4);
const MAX_RESTAURANTS = Number(process.env.RECOMMENDATION_RESTAURANT_LIMIT || 8);

const INTEREST_TYPE_MAP = {
  beaches: ['beach', 'natural_feature'],
  culture: ['museum', 'art_gallery', 'hindu_temple', 'church', 'historical_landmark', 'monument'],
  nature: ['park', 'zoo', 'garden'],
  food: ['restaurant', 'cafe'],
  shopping: ['shopping_mall', 'store'],
  nightlife: ['bar', 'night_club'],
  history: ['museum', 'historical_landmark', 'monument', 'tourist_attraction'],
  art: ['art_gallery', 'museum'],
  adventure: ['park', 'natural_feature', 'tourist_attraction'],
  sports: ['stadium', 'park'],
};

const ATTRACTION_TYPES = new Set([
  'tourist_attraction',
  'museum',
  'beach',
  'park',
  'historical_landmark',
  'landmark',
  'monument',
  'church',
  'hindu_temple',
  'mosque',
  'art_gallery',
  'zoo',
  'garden',
  'natural_feature',
]);

const RESTAURANT_TYPES = new Set([
  'restaurant',
  'cafe',
  'bar',
  'bakery',
  'meal_takeaway',
  'night_club',
]);

const normalizeInterest = (interest) => String(interest || '').trim().toLowerCase();
const normalizeType = (type) => String(type || '').trim().toLowerCase();

const getNormalizedTypes = (place) => (place.types || []).map(normalizeType);

const getPrimaryCategory = (place) => {
  const types = getNormalizedTypes(place);
  if (types.length === 0) {
    return 'other';
  }

  return String(types[0]).replace(/_/g, ' ');
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

const hasAnyType = (place, typeSet) => getNormalizedTypes(place).some((type) => typeSet.has(type));

const getInterestMatchScore = (tripInterests, placeTypes) => {
  const normalizedTypes = new Set((placeTypes || []).map(normalizeType));
  const normalizedInterests = (tripInterests || []).map(normalizeInterest).filter(Boolean);

  if (normalizedInterests.length === 0) {
    return 0;
  }

  return normalizedInterests.some((interest) => {
    const mappedTypes = INTEREST_TYPE_MAP[interest] || [];
    return mappedTypes.some((type) => normalizedTypes.has(type));
  }) ? 1 : 0;
};

const filterPlacesByInterests = (places, tripInterests) => {
  const normalizedInterests = (tripInterests || []).map(normalizeInterest).filter(Boolean);
  if (normalizedInterests.length === 0) {
    return {
      places,
      interestFilterApplied: false,
    };
  }

  const allowedTypes = new Set(
    normalizedInterests.flatMap((interest) => INTEREST_TYPE_MAP[interest] || []),
  );

  const filteredPlaces = places.filter((place) =>
    getNormalizedTypes(place).some((type) => allowedTypes.has(type)),
  );

  return {
    places: filteredPlaces.length > 0 ? filteredPlaces : places,
    interestFilterApplied: filteredPlaces.length > 0,
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

const buildAttractionRecommendation = (place, scores) => {
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
    popularity_score: Number(scores.popularityScore.toFixed(4)),
    interest_match: scores.interestMatch,
    final_score: Number(scores.finalScore.toFixed(4)),
  };
};

const buildRestaurantSuggestion = (place) => {
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
  };
};

class RecommendationService {
  static async fetchCandidatePlaces(city) {
    return Place.find({ city: String(city).toLowerCase() })
      .sort({ rating: -1, user_ratings_total: -1 })
      .limit(MAX_PLACES_FOR_SCORING);
  }

  static async fetchMlRecommendations(places) {
    const response = await axios.post(
      `${ML_SERVICE_URL}/recommend`,
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

  static buildAttractionRankings(attractions, mlScoreMap, tripInterests) {
    const candidateRatings = attractions
      .map((place) => Number(place.rating || 0))
      .filter((rating) => Number.isFinite(rating) && rating > 0);
    const averageRating = candidateRatings.length > 0
      ? candidateRatings.reduce((sum, rating) => sum + rating, 0) / candidateRatings.length
      : 0;

    const rawPopularityScores = attractions.map((place) => Math.log((Number(place.user_ratings_total) || 0) + 1));
    const normalizePopularity = buildScoreNormalizer(rawPopularityScores);

    return attractions
      .map((place) => {
        const rating = Number(place.rating || 0);
        const ratingsTotal = Number(place.user_ratings_total || 0);
        const mlScore = Number(mlScoreMap.get(place.place_id) || 0);
        const weightedRating = ((ratingsTotal / (ratingsTotal + MIN_RATINGS_THRESHOLD)) * rating)
          + ((MIN_RATINGS_THRESHOLD / (ratingsTotal + MIN_RATINGS_THRESHOLD)) * averageRating);
        const weightedRatingNormalized = weightedRating / 5;
        const popularityScore = normalizePopularity(Math.log(ratingsTotal + 1));
        const interestMatch = getInterestMatchScore(tripInterests, place.types);
        const finalScore = (mlScore * 0.45)
          + (weightedRatingNormalized * 0.30)
          + (popularityScore * 0.20)
          + (interestMatch * 0.05);

        return buildAttractionRecommendation(place, {
          mlScore,
          weightedRating,
          popularityScore,
          interestMatch,
          finalScore,
        });
      })
      .sort((first, second) => {
        if (second.final_score !== first.final_score) {
          return second.final_score - first.final_score;
        }

        return (second.user_ratings_total || 0) - (first.user_ratings_total || 0);
      });
  }

  static buildRestaurantSuggestions(places) {
    return places
      .filter((place) => hasAnyType(place, RESTAURANT_TYPES))
      .filter((place) => Number(place.rating || 0) > 4 && Number(place.user_ratings_total || 0) > 100)
      .sort((first, second) => {
        const firstRestaurantScore = Number(first.rating || 0) + Number(first.user_ratings_total || 0);
        const secondRestaurantScore = Number(second.rating || 0) + Number(second.user_ratings_total || 0);
        return secondRestaurantScore - firstRestaurantScore;
      })
      .slice(0, MAX_RESTAURANTS)
      .map(buildRestaurantSuggestion);
  }

  static async getRecommendationsForTrip(trip) {
    const candidatePlaces = await this.fetchCandidatePlaces(trip.city);

    if (candidatePlaces.length === 0) {
      return {
        trip_days: trip.days,
        attractions: [],
        restaurants: [],
        metadata: {
          total_candidates: 0,
          interest_filter_applied: false,
          ranking_strategy: 'ml + popularity',
        },
      };
    }

    const { places: interestFilteredPlaces, interestFilterApplied } = filterPlacesByInterests(candidatePlaces, trip.interests);

    const attractionPool = interestFilteredPlaces.filter((place) => hasAnyType(place, ATTRACTION_TYPES));
    const restaurantPool = candidatePlaces;

    let mlScoreMap = new Map();
    if (attractionPool.length > 0) {
      let mlRecommendations;
      try {
        mlRecommendations = await this.fetchMlRecommendations(attractionPool);
      } catch (error) {
        const details = error.response?.data?.detail || error.message;
        throw new Error(`ML service unavailable: ${details}`);
      }

      mlScoreMap = new Map(
        mlRecommendations.map((recommendation) => [
          recommendation.place_id,
          Number(recommendation.recommendation_score || 0),
        ]),
      );
    }

    const rankedAttractions = this.buildAttractionRankings(attractionPool, mlScoreMap, trip.interests);
    const attractionLimit = Math.max(ATTRACTIONS_PER_DAY, Number(trip.days || 1) * ATTRACTIONS_PER_DAY);
    const selectedAttractions = rankedAttractions.slice(0, attractionLimit);
    const restaurants = this.buildRestaurantSuggestions(restaurantPool);

    return {
      trip_days: trip.days,
      attractions: selectedAttractions,
      restaurants,
      metadata: {
        total_candidates: candidatePlaces.length,
        interest_filter_applied: interestFilterApplied,
        ranking_strategy: 'ml + popularity',
        attraction_pool_size: attractionPool.length,
        restaurant_pool_size: restaurantPool.filter((place) => hasAnyType(place, RESTAURANT_TYPES)).length,
      },
    };
  }
}

module.exports = RecommendationService;
