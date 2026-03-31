const axios = require('axios');
const Hotel = require('../models/Hotel');
const Place = require('../models/Place');
const logger = require('../utils/logger');
const { getCityCoordinates, fetchPlacesNearby } = require('./googlePlacesService');

const GOOGLE_TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const RAPIDAPI_DEFAULT_HOST = process.env.RAPIDAPI_HOTELS_HOST || 'xotelo-hotel-prices.p.rapidapi.com';
const RAPIDAPI_DEFAULT_PATH = process.env.RAPIDAPI_HOTELS_SEARCH_PATH || '/search';
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_TIMEOUT_MS = Number(process.env.RAPIDAPI_TIMEOUT_MS || 15000);
const GOOGLE_TIMEOUT_MS = Number(process.env.GOOGLE_PLACES_TIMEOUT_MS || 15000);
const HOTEL_SYNC_BATCH_DELAY_MS = Number(process.env.HOTEL_SYNC_BATCH_DELAY_MS || 350);
const DEFAULT_HOTEL_SAMPLE_SIZE = Number(process.env.DEFAULT_HOTEL_SAMPLE_SIZE || 10);
const HOTEL_QUERY_PAGE_LIMIT = Number(process.env.HOTEL_QUERY_PAGE_LIMIT || 2);
const HOTEL_ENRICHMENT_BATCH_SIZE = Number(process.env.HOTEL_ENRICHMENT_BATCH_SIZE || 50);
const FALLBACK_CITIES = [
  'kochi',
  'thiruvananthapuram',
  'kozhikode',
  'alappuzha',
  'munnar',
  'wayanad',
  'thrissur',
  'kannur',
];
const PREMIUM_CITIES = new Set(['kochi', 'munnar', 'alappuzha', 'wayanad']);
const MID_PREMIUM_CITIES = new Set(['thiruvananthapuram', 'kozhikode', 'thrissur']);
const LUXURY_KEYWORDS = [
  'luxury',
  'premium',
  '5-star',
  'five star',
  'spa',
  'pool',
  'infinity pool',
  'fine dining',
  'waterfront',
  'backwater',
  'sea view',
  'lake view',
  'private beach',
  'resort',
  'palace',
  'heritage resort',
  'balcony view',
  'suite',
];
const MID_RANGE_KEYWORDS = [
  'comfortable',
  'business hotel',
  'clean rooms',
  'clean room',
  'good service',
  'well maintained',
  'spacious',
  'family stay',
  'pleasant stay',
  'professional',
  'buffet',
  'friendly staff',
];
const BUDGET_KEYWORDS = [
  'budget',
  'affordable',
  'basic',
  'small rooms',
  'small room',
  'value for money',
  'cheap',
  'economical',
  'dormitory',
  'hostel',
  'homestay',
  'tourist home',
];
const HOMESTAY_TYPE_KEYWORDS = ['homestay', 'home stay', 'hostel', 'lodge', 'guest house', 'tourist home', 'dormitory'];
const STANDARD_TYPE_KEYWORDS = ['hotel', 'inn', 'residency', 'residencies', 'suite', 'suites'];
const PREMIUM_TYPE_KEYWORDS = ['resort', 'palace', 'luxury', 'premium', 'spa resort', 'boutique resort'];
const POSITIVE_REVIEW_KEYWORDS = [
  'excellent',
  'amazing',
  'great',
  'wonderful',
  'clean',
  'comfortable',
  'friendly',
  'helpful',
  'memorable',
  'beautiful',
  'superb',
  'recommended',
];
const NEGATIVE_REVIEW_KEYWORDS = [
  'worst',
  'dirty',
  'poor',
  'bad',
  'unhygienic',
  'smelly',
  'disappointing',
  'overpriced',
  'broken',
  'food poison',
  'not clean',
  'rude',
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeCity = (city) => String(city || '').trim().toLowerCase();

const normalizeHotelName = (value) => String(value || '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\b(hotel|hotels|resort|resorts|stay|stays|inn|suites|suite)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const tokenize = (value) => new Set(normalizeHotelName(value).split(' ').filter(Boolean));

const jaccardScore = (left, right) => {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  });

  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : overlap / union;
};

const parseInteger = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  const cleaned = String(value).replace(/[^0-9.]/g, '');
  if (!cleaned) {
    return null;
  }

  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
};

const parseFloatValue = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const inferStarCategory = (rating) => {
  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating)) {
    return 2;
  }

  if (numericRating >= 4.5) {
    return 5;
  }
  if (numericRating >= 4.0) {
    return 4;
  }
  if (numericRating >= 3.5) {
    return 3;
  }
  return 2;
};

const buildRapidApiQuery = (hotel) => `${hotel.name} ${hotel.city}`.trim();

const extractRapidApiCandidates = (payload) => {
  const queue = [payload];
  const candidates = [];
  const seen = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) {
      continue;
    }
    seen.add(current);

    if (Array.isArray(current)) {
      current.forEach((item) => queue.push(item));
      continue;
    }

    if (typeof current !== 'object') {
      continue;
    }

    const possibleName = current.name || current.hotel_name || current.title || current.property_name;
    const possiblePrice = current.price_per_night
      ?? current.price
      ?? current.min_price
      ?? current.avg_price
      ?? current.lead_price
      ?? current.nightly_price;
    const possibleStars = current.star_category
      ?? current.stars
      ?? current.starRating
      ?? current.class;
    const possibleCity = current.city || current.city_name || current.location || current.address;

    if (possibleName && (possiblePrice !== undefined || possibleStars !== undefined)) {
      candidates.push({
        name: String(possibleName),
        city: typeof possibleCity === 'string' ? possibleCity : '',
        price_per_night: parseInteger(possiblePrice),
        star_category: parseInteger(possibleStars),
      });
    }

    Object.values(current).forEach((value) => {
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    });
  }

  return candidates;
};

const pickBestRapidApiMatch = (hotel, candidates) => {
  const city = normalizeCity(hotel.city);
  const ranked = candidates
    .map((candidate) => {
      const nameScore = jaccardScore(hotel.name, candidate.name);
      const cityScore = candidate.city && normalizeCity(candidate.city).includes(city) ? 0.2 : 0;
      return {
        candidate,
        score: nameScore + cityScore,
      };
    })
    .filter((item) => item.score >= 0.35)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.candidate || null;
};

const sampleArray = (items, count) => {
  const cloned = [...items];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
  }
  return cloned.slice(0, Math.min(count, cloned.length));
};

const buildStableHash = (value) => {
  const text = String(value || '');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash * 31) + text.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const stableRangeOffset = (seed, min, max) => {
  if (max <= min) {
    return min;
  }
  const hash = buildStableHash(seed);
  const ratio = (hash % 10000) / 10000;
  return min + ((max - min) * ratio);
};

const countKeywordHits = (text, keywords) => keywords.reduce(
  (count, keyword) => count + (text.includes(keyword) ? 1 : 0),
  0,
);

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

const roundToNearestHundred = (value) => Math.round(value / 100) * 100;

class HotelService {
  static async findSupportingPlace(hotel) {
    if (hotel.place_id) {
      const exactPlace = await Place.findOne({ place_id: hotel.place_id }).lean();
      if (exactPlace) {
        return exactPlace;
      }
    }

    const normalizedCity = normalizeCity(hotel.city);
    const normalizedName = normalizeHotelName(hotel.name);
    if (!normalizedName) {
      return null;
    }

    const placeCandidates = await Place.find({
      city: normalizedCity,
      types: 'lodging',
    })
      .select({
        place_id: 1,
        name: 1,
        city: 1,
        description: 1,
        rating: 1,
        user_ratings_total: 1,
        reviews: 1,
      })
      .lean();

    const ranked = placeCandidates
      .map((candidate) => ({
        candidate,
        score: jaccardScore(hotel.name, candidate.name),
      }))
      .filter((item) => item.score >= 0.45)
      .sort((left, right) => right.score - left.score);

    return ranked[0]?.candidate || null;
  }

  static buildEstimationSignals(hotel, place) {
    const description = String(place?.description || hotel.address || '').toLowerCase();
    const reviewTexts = Array.isArray(place?.reviews)
      ? place.reviews
        .map((review) => String(review?.text || '').toLowerCase())
        .filter(Boolean)
      : [];
    const combinedReviewText = reviewTexts.join(' ');
    const combinedText = [hotel.name, description, combinedReviewText].filter(Boolean).join(' ').toLowerCase();
    const userRating = parseFloatValue(hotel.user_rating) || parseFloatValue(place?.rating) || 0;
    const totalRatings = Number(hotel.total_ratings) || Number(place?.user_ratings_total) || 0;
    const luxuryHits = countKeywordHits(combinedText, LUXURY_KEYWORDS);
    const midRangeHits = countKeywordHits(combinedText, MID_RANGE_KEYWORDS);
    const budgetHits = countKeywordHits(combinedText, BUDGET_KEYWORDS);
    const positiveHits = countKeywordHits(combinedReviewText, POSITIVE_REVIEW_KEYWORDS);
    const negativeHits = countKeywordHits(combinedReviewText, NEGATIVE_REVIEW_KEYWORDS);
    const reviewSentiment = clamp((positiveHits - negativeHits) / 10, -0.35, 0.35);
    const city = normalizeCity(hotel.city);
    const locationPremium = PREMIUM_CITIES.has(city)
      ? 0.18
      : MID_PREMIUM_CITIES.has(city)
        ? 0.08
        : 0;
    const propertyType = this.detectPropertyType(hotel, place, combinedText);

    return {
      description,
      reviewTexts,
      combinedText,
      userRating,
      totalRatings,
      luxuryHits,
      midRangeHits,
      budgetHits,
      positiveHits,
      negativeHits,
      reviewSentiment,
      locationPremium,
      propertyType,
    };
  }

  static detectPropertyType(hotel, place = null, precomputedText = '') {
    const combinedText = precomputedText || [hotel?.name, place?.description, hotel?.address]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (HOMESTAY_TYPE_KEYWORDS.some((keyword) => combinedText.includes(keyword))) {
      return 'budget';
    }

    if (PREMIUM_TYPE_KEYWORDS.some((keyword) => combinedText.includes(keyword))) {
      return 'premium';
    }

    if (STANDARD_TYPE_KEYWORDS.some((keyword) => combinedText.includes(keyword))) {
      return 'standard';
    }

    return 'standard';
  }

  static estimateHotelAttributes(hotel, place = null) {
    const signals = this.buildEstimationSignals(hotel, place);
    let star = inferStarCategory(signals.userRating);

    if (signals.propertyType === 'premium' && signals.luxuryHits >= 1) {
      star += 1;
    }

    if (signals.luxuryHits >= 2) {
      star += 1;
    } else if (signals.budgetHits >= 2) {
      star -= 1;
    } else if (signals.midRangeHits >= 2 && star < 4) {
      star += 1;
    }

    if (signals.reviewSentiment <= -0.2) {
      star -= 1;
    } else if (signals.reviewSentiment >= 0.2 && signals.userRating >= 4.3) {
      star += 1;
    }

    if (signals.totalRatings < 20 && signals.userRating > 0 && star > 4) {
      star -= 1;
    }

    if (star >= 5 && !(signals.propertyType === 'premium' && signals.luxuryHits >= 2)) {
      star = 4;
    }

    if (signals.propertyType === 'budget') {
      star = Math.min(star, 3);
    }

    star = clamp(Math.round(star), 1, 5);

    const priceRanges = {
      5: [5000, 12000],
      4: [3000, 5000],
      3: [1500, 3000],
      2: [800, 1500],
      1: [800, 1200],
    };
    const [minPrice, maxPrice] = priceRanges[star] || priceRanges[2];
    const amenityLift = clamp((signals.luxuryHits * 0.06) + (signals.midRangeHits * 0.03) - (signals.budgetHits * 0.05), -0.12, 0.25);
    const ratingLift = clamp(((signals.userRating - 4) * 0.12), -0.15, 0.18);
    const reviewLift = clamp((Math.log10(signals.totalRatings + 1) - 1.2) * 0.05, -0.05, 0.1);
    const randomLift = stableRangeOffset(`${hotel.name}|${hotel.city}`, -0.08, 0.12);
    const rangePosition = clamp(
      0.38 + signals.locationPremium + amenityLift + ratingLift + reviewLift + signals.reviewSentiment + randomLift,
      0.08,
      0.96,
    );
    const rawPrice = minPrice + ((maxPrice - minPrice) * rangePosition);
    const price_per_night = roundToNearestHundred(clamp(rawPrice, minPrice, maxPrice));

    let confidence = 'low';
    const strongLuxurySignal = signals.propertyType === 'premium' && signals.luxuryHits >= 2 && signals.userRating >= 4.2;
    const strongBudgetSignal = signals.propertyType === 'budget' && signals.budgetHits >= 1 && signals.totalRatings >= 20;
    const mixedSignal = signals.luxuryHits + signals.midRangeHits + signals.budgetHits >= 1 || signals.reviewTexts.length >= 1;

    if ((strongLuxurySignal || strongBudgetSignal) && signals.totalRatings >= 40) {
      confidence = 'high';
    } else if (signals.userRating >= 3.8 && mixedSignal) {
      confidence = 'medium';
    }

    return {
      star_category: star,
      price_per_night,
      confidence,
      supporting_place_id: place?.place_id || null,
    };
  }

  static async getHotelCities() {
    const dbCities = await Place.distinct('city');
    const normalizedCities = dbCities
      .map(normalizeCity)
      .filter(Boolean);

    if (normalizedCities.length > 0) {
      return normalizedCities.sort((left, right) => left.localeCompare(right));
    }

    return [...FALLBACK_CITIES];
  }

  static async fetchHotelsFromGoogle(city) {
    if (!GOOGLE_PLACES_API_KEY) {
      throw new Error('Missing Google Places API key for hotel sync.');
    }

    const allHotels = [];
    const seenPlaceIds = new Set();
    let nextPageToken = null;
    let pageCount = 0;

    try {
      do {
        if (nextPageToken) {
          await delay(2000);
        }

        const params = nextPageToken
          ? {
            pagetoken: nextPageToken,
            key: GOOGLE_PLACES_API_KEY,
          }
          : {
            query: `hotels in ${city}`,
            region: 'in',
            key: GOOGLE_PLACES_API_KEY,
          };

        const response = await axios.get(GOOGLE_TEXT_SEARCH_URL, {
          params,
          timeout: GOOGLE_TIMEOUT_MS,
        });

        const status = response.data?.status;
        if (!['OK', 'ZERO_RESULTS'].includes(status)) {
          throw new Error(status || 'UNKNOWN_ERROR');
        }

        const results = response.data?.results || [];
        results.forEach((place) => {
          if (!place?.place_id || seenPlaceIds.has(place.place_id)) {
            return;
          }

          seenPlaceIds.add(place.place_id);
          allHotels.push({
            place_id: place.place_id,
            name: place.name,
            city: normalizeCity(city),
            address: place.formatted_address || place.vicinity || '',
            location: {
              lat: Number(place.geometry?.location?.lat) || 0,
              lng: Number(place.geometry?.location?.lng) || 0,
            },
            user_rating: parseFloatValue(place.rating) || 0,
            total_ratings: Number(place.user_ratings_total) || 0,
          });
        });

        nextPageToken = response.data?.next_page_token || null;
        pageCount += 1;
        await delay(HOTEL_SYNC_BATCH_DELAY_MS);
      } while (nextPageToken && pageCount < HOTEL_QUERY_PAGE_LIMIT);
    } catch (error) {
      logger.warn('Google hotel text search failed, falling back to nearby search', {
        city,
        message: error.message,
      });

      const cityCoordinates = await getCityCoordinates(city);
      if (!cityCoordinates) {
        throw new Error(`Unable to geocode city for hotel search: ${city}`);
      }

      const nearbyHotels = await fetchPlacesNearby(cityCoordinates.lat, cityCoordinates.lng, 'lodging', 15000);
      nearbyHotels.forEach((place) => {
        if (!place?.place_id || seenPlaceIds.has(place.place_id)) {
          return;
        }

        seenPlaceIds.add(place.place_id);
        allHotels.push({
          place_id: place.place_id,
          name: place.name,
          city: normalizeCity(city),
          address: place.formatted_address || place.vicinity || '',
          location: {
            lat: Number(place.geometry?.location?.lat) || 0,
            lng: Number(place.geometry?.location?.lng) || 0,
          },
          user_rating: parseFloatValue(place.rating) || 0,
          total_ratings: Number(place.user_ratings_total) || 0,
        });
      });
    }

    return allHotels;
  }

  static async enrichHotelWithRapidApi(hotel) {
    if (!RAPIDAPI_KEY) {
      return {
        price_per_night: null,
        star_category: inferStarCategory(hotel.user_rating),
      };
    }

    const url = `https://${RAPIDAPI_DEFAULT_HOST}${RAPIDAPI_DEFAULT_PATH}`;
    const params = {
      query: buildRapidApiQuery(hotel),
      location_type: 'accommodation',
    };

    try {
      const response = await axios.get(url, {
        params,
        timeout: RAPIDAPI_TIMEOUT_MS,
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': RAPIDAPI_DEFAULT_HOST,
        },
      });

      const candidates = extractRapidApiCandidates(response.data);
      const match = pickBestRapidApiMatch(hotel, candidates);

      return {
        price_per_night: match?.price_per_night ?? null,
        star_category: match?.star_category ?? inferStarCategory(hotel.user_rating),
      };
    } catch (error) {
      logger.warn('RapidAPI hotel enrichment failed', {
        city: hotel.city,
        hotel: hotel.name,
        message: error.response?.data?.message || error.message,
      });
      return {
        price_per_night: null,
        star_category: inferStarCategory(hotel.user_rating),
      };
    }
  }

  static normalizeStoredHotel(hotel, enrichment) {
    const starCategory = Number.isFinite(Number(enrichment.star_category))
      ? Number(enrichment.star_category)
      : inferStarCategory(hotel.user_rating);
    return {
      place_id: hotel.place_id || undefined,
      name: hotel.name,
      name_normalized: normalizeHotelName(hotel.name),
      city: normalizeCity(hotel.city),
      location: {
        lat: Number(hotel.location?.lat),
        lng: Number(hotel.location?.lng),
      },
      geo: {
        type: 'Point',
        coordinates: [Number(hotel.location?.lng), Number(hotel.location?.lat)],
      },
      address: hotel.address || '',
      price_per_night: enrichment.price_per_night,
      star_category: starCategory,
      user_rating: parseFloatValue(hotel.user_rating) || 0,
      total_ratings: Number(hotel.total_ratings) || 0,
      source: 'google + rapidapi',
      last_updated: new Date(),
    };
  }

  static async upsertHotel(hotelRecord) {
    const filter = hotelRecord.place_id
      ? { place_id: hotelRecord.place_id }
      : {
        city: hotelRecord.city,
        name_normalized: hotelRecord.name_normalized,
      };

    return Hotel.findOneAndUpdate(
      filter,
      {
        $set: hotelRecord,
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  static async syncHotelsForCity(city) {
    const normalizedCity = normalizeCity(city);
    const googleHotels = await this.fetchHotelsFromGoogle(normalizedCity);
    let savedCount = 0;
    let failedCount = 0;

    for (const hotel of googleHotels) {
      try {
        const rapidApiEnrichment = await this.enrichHotelWithRapidApi(hotel);
        const supportingPlace = await this.findSupportingPlace(hotel);
        const estimated = this.estimateHotelAttributes(hotel, supportingPlace);
        const enrichment = {
          price_per_night: rapidApiEnrichment.price_per_night ?? estimated.price_per_night,
          star_category: rapidApiEnrichment.star_category ?? estimated.star_category,
        };
        const hotelRecord = this.normalizeStoredHotel(hotel, enrichment);
        await this.upsertHotel(hotelRecord);
        savedCount += 1;
      } catch (error) {
        failedCount += 1;
        logger.warn('Hotel sync entry failed', {
          city: normalizedCity,
          hotel: hotel.name,
          message: error.message,
        });
      }
    }

    logger.info('Hotel sync city complete', {
      city: normalizedCity,
      fetched: googleHotels.length,
      saved: savedCount,
      failed: failedCount,
    });

    return {
      city: normalizedCity,
      fetched: googleHotels.length,
      saved: savedCount,
      failed: failedCount,
    };
  }

  static async syncHotelsForAllCities() {
    const cities = await this.getHotelCities();
    const summary = [];

    for (const city of cities) {
      try {
        summary.push(await this.syncHotelsForCity(city));
      } catch (error) {
        logger.error('Hotel sync city failed', {
          city,
          message: error.message,
        });
        summary.push({
          city,
          fetched: 0,
          saved: 0,
          failed: 1,
          error: error.message,
        });
      }
    }

    return {
      cities,
      summary,
    };
  }

  static async enrichExistingHotels() {
    const hotels = await Hotel.find({}).lean();
    const summary = {
      total: hotels.length,
      updated: 0,
      failed: 0,
      with_price: 0,
    };

    for (let index = 0; index < hotels.length; index += 1) {
      const hotel = hotels[index];
      try {
        const supportingPlace = await this.findSupportingPlace(hotel);
        const estimated = this.estimateHotelAttributes(hotel, supportingPlace);
        await Hotel.updateOne(
          { _id: hotel._id },
          {
            $set: {
              star_category: estimated.star_category,
              price_per_night: estimated.price_per_night,
              source: 'google + heuristic',
              last_updated: new Date(),
              geo: {
                type: 'Point',
                coordinates: [Number(hotel.location?.lng), Number(hotel.location?.lat)],
              },
            },
          },
        );

        summary.updated += 1;
        if (estimated.price_per_night !== null) {
          summary.with_price += 1;
        }

        if ((index + 1) % HOTEL_ENRICHMENT_BATCH_SIZE === 0) {
          logger.info('Hotel heuristic enrichment progress', {
            processed: index + 1,
            total: hotels.length,
          });
        }
      } catch (error) {
        summary.failed += 1;
        logger.warn('Hotel heuristic enrichment failed', {
          hotel: hotel.name,
          city: hotel.city,
          message: error.message,
        });
      }
    }

    logger.info('Hotel heuristic enrichment complete', summary);
    return summary;
  }

  static async getHotels(city, filters = {}) {
    const normalizedCity = normalizeCity(city);
    const query = { city: normalizedCity };
    const hasMinPrice = filters.min_price !== undefined && filters.min_price !== null && filters.min_price !== '';
    const hasMaxPrice = filters.max_price !== undefined && filters.max_price !== null && filters.max_price !== '';
    const hasStar = filters.star !== undefined && filters.star !== null && filters.star !== '';
    const hasFilters = hasMinPrice || hasMaxPrice || hasStar;

    if (hasMinPrice || hasMaxPrice) {
      query.price_per_night = {};
      if (hasMinPrice) {
        query.price_per_night.$gte = Number(filters.min_price);
      }
      if (hasMaxPrice) {
        query.price_per_night.$lte = Number(filters.max_price);
      }
    }

    if (hasStar) {
      query.star_category = { $gte: Number(filters.star) };
    }

    let hotels = await Hotel.find(query).lean();

    if (!hasFilters) {
      const sampleSize = Math.max(8, Math.min(DEFAULT_HOTEL_SAMPLE_SIZE, 12));
      hotels = sampleArray(hotels, sampleSize);
    } else {
      hotels = hotels.sort((left, right) => {
        const leftPrice = left.price_per_night ?? Number.MAX_SAFE_INTEGER;
        const rightPrice = right.price_per_night ?? Number.MAX_SAFE_INTEGER;
        if (leftPrice !== rightPrice) {
          return leftPrice - rightPrice;
        }
        return (right.user_rating || 0) - (left.user_rating || 0);
      });
    }

    return {
      city: normalizedCity,
      filtersApplied: hasFilters,
      total: hotels.length,
      hotels,
    };
  }
}

module.exports = HotelService;
