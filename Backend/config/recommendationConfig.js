const recommendationConfig = {
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  candidateFetchLimit: Number(process.env.CANDIDATE_FETCH_LIMIT || 600),
  candidatePoolLimit: Number(process.env.CANDIDATE_POOL_LIMIT || 120),
  candidateSampleSize: Number(process.env.CANDIDATE_SAMPLE_SIZE || 40),
  placesPerDay: Number(process.env.PLACES_PER_DAY || 4),
  minAttractionRating: Number(process.env.MIN_ATTRACTION_RATING || 4.2),
  minAttractionReviews: Number(process.env.MIN_ATTRACTION_REVIEWS || 500),
  explorationAttractionRating: Number(process.env.EXPLORATION_ATTRACTION_RATING || 3.9),
  explorationAttractionReviews: Number(process.env.EXPLORATION_ATTRACTION_REVIEWS || 100),
  explorationPoolMultiplier: Number(process.env.EXPLORATION_POOL_MULTIPLIER || 3),
  popularityGatePrimary: Number(process.env.POPULARITY_GATE_PRIMARY || 7.8),
  popularityGateFallback: Number(process.env.POPULARITY_GATE_FALLBACK || 7.5),
  popularityGateMinResults: Number(process.env.POPULARITY_GATE_MIN_RESULTS || 120),
  weightedRatingThreshold: Number(process.env.WEIGHTED_RATING_THRESHOLD || 2000),
  trackBWeightedRatingCutoff: Number(process.env.TRACK_B_WEIGHTED_RATING_CUTOFF || 4.15),
  trackBFallbackWeightedRatingCutoff: Number(process.env.TRACK_B_FALLBACK_WEIGHTED_RATING_CUTOFF || 3.5),
  strictInterestScoreThreshold: Number(process.env.STRICT_INTEREST_SCORE_THRESHOLD || 0.85),
  shoppingInterestScoreThreshold: Number(process.env.SHOPPING_INTEREST_SCORE_THRESHOLD || 0.62),
  shoppingSemanticInterestScoreThreshold: Number(process.env.SHOPPING_SEMANTIC_INTEREST_SCORE_THRESHOLD || 0.85),
  strictInterestMediumThreshold: Number(process.env.STRICT_INTEREST_MEDIUM_THRESHOLD || 0.85),
  strictInterestHighThreshold: Number(process.env.STRICT_INTEREST_HIGH_THRESHOLD || 0.9),
  strictInterestMediumBoost: Number(process.env.STRICT_INTEREST_MEDIUM_BOOST || 0.1),
  strictInterestHighBoost: Number(process.env.STRICT_INTEREST_HIGH_BOOST || 0.2),
  minRestaurantRating: Number(process.env.MIN_RESTAURANT_RATING || 4.2),
  minRestaurantReviews: Number(process.env.MIN_RESTAURANT_REVIEWS || 300),
  restaurantPoolLimit: Number(process.env.RESTAURANT_POOL_LIMIT || 80),
  restaurantSampleSize: Number(process.env.RESTAURANT_SAMPLE_SIZE || 20),
  restaurantReturnCount: Number(process.env.RESTAURANT_RETURN_COUNT || 10),
  mlFallbackScore: Number(process.env.ML_FALLBACK_SCORE || 0.5),
}

const interestTypeMap = {
  beaches: ['beach', 'natural_feature'],
  culture: ['museum', 'art_gallery', 'hindu_temple', 'temple', 'church', 'monument'],
  nature: ['park', 'zoo', 'garden', 'natural_feature'],
  food: ['restaurant', 'cafe'],
  shopping: ['shopping_mall', 'store'],
  nightlife: ['bar', 'night_club'],
  history: ['museum', 'historical_landmark', 'monument', 'church', 'synagogue', 'temple'],
  art: ['art_gallery', 'museum'],
  adventure: ['amusement_park', 'park', 'natural_feature'],
  sports: ['park'],
}

const allowedAttractionTypes = new Set([
  'tourist_attraction',
  'museum',
  'church',
  'hindu_temple',
  'temple',
  'mosque',
  'synagogue',
  'art_gallery',
  'park',
  'zoo',
  'aquarium',
  'amusement_park',
  'natural_feature',
  'beach',
  'historical_landmark',
  'monument',
  'landmark',
])

const blockedAttractionTypes = new Set([
  'travel_agency',
  'tour_operator',
  'tour_agency',
  'tourist_information_center',
  'florist',
  'store',
])

const genericPlaceTypes = new Set([
  'establishment',
  'point_of_interest',
  'premise',
])

const restaurantTypes = new Set([
  'restaurant',
  'cafe',
  'bar',
  'bakery',
  'meal_takeaway',
  'night_club',
])

const blockedRestaurantTypes = new Set([
  'lodging',
  'hotel',
  'resort_hotel',
  'travel_agency',
  'tour_operator',
  'tour_agency',
])

module.exports = {
  recommendationConfig,
  interestTypeMap,
  allowedAttractionTypes,
  blockedAttractionTypes,
  genericPlaceTypes,
  restaurantTypes,
  blockedRestaurantTypes,
}
