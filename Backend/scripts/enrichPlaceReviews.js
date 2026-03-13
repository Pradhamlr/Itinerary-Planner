require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');

const Place = require('../models/Place');

const MONGO_URI = process.env.MONGO_URI;
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
const PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const REQUEST_DELAY_MS = Number(process.env.REVIEW_ENRICH_DELAY_MS || 300);
const REQUEST_TIMEOUT_MS = Number(process.env.REVIEW_ENRICH_TIMEOUT_MS || 15000);
const MAX_REVIEWS = Number(process.env.REVIEW_ENRICH_MAX_REVIEWS || 5);
const ENRICH_LIMIT = Number(process.env.REVIEW_ENRICH_LIMIT || 0);
const FORCE_REFRESH = process.env.REVIEW_ENRICH_FORCE === 'true';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const getPlacesNeedingEnrichmentQuery = () => {
  if (FORCE_REFRESH) {
    return { place_id: { $exists: true, $ne: '' } };
  }

  return {
    place_id: { $exists: true, $ne: '' },
    $or: [
      { reviews: { $exists: false } },
      { reviews: { $size: 0 } },
    ],
  };
};

const fetchPlaceDetails = async (placeId) => {
  const response = await axios.get(PLACE_DETAILS_URL, {
    timeout: REQUEST_TIMEOUT_MS,
    params: {
      place_id: placeId,
      fields: 'reviews,rating,user_ratings_total',
      key: GOOGLE_API_KEY,
    },
  });

  return response.data;
};

const normalizeReviews = (reviews) => {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    return [];
  }

  const seenTexts = new Set();

  return reviews
    .slice(0, MAX_REVIEWS)
    .map((review) => {
      const text = typeof review?.text === 'string' ? review.text.trim() : '';

      if (!text) {
        return null;
      }

      const dedupeKey = text.toLowerCase();
      if (seenTexts.has(dedupeKey)) {
        return null;
      }

      seenTexts.add(dedupeKey);

      return {
        author_name: typeof review.author_name === 'string' ? review.author_name : 'Google user',
        rating: Number.isFinite(review.rating) ? Number(review.rating) : undefined,
        text,
        time: Number.isFinite(review.time) ? Number(review.time) : undefined,
      };
    })
    .filter(Boolean);
};

const enrichPlaceReviews = async () => {
  if (!GOOGLE_API_KEY) {
    console.error('Missing Google API key. Set GOOGLE_MAPS_API_KEY in Backend/.env');
    process.exit(1);
  }

  const query = getPlacesNeedingEnrichmentQuery();
  const totalPlaces = await Place.countDocuments(query);

  if (totalPlaces === 0) {
    console.log('No places need review enrichment');
    return;
  }

  console.log(`Places queued for enrichment: ${totalPlaces}`);
  if (FORCE_REFRESH) {
    console.log('Force refresh enabled: existing reviews may be replaced');
  }
  if (ENRICH_LIMIT > 0) {
    console.log(`Processing limit enabled: ${ENRICH_LIMIT} places`);
  }

  let processed = 0;
  let enrichedPlaces = 0;
  let noReviewPlaces = 0;
  let failedRequests = 0;
  let totalReviewsStored = 0;

  let cursorQuery = Place.find(query)
    .sort({ updatedAt: 1, createdAt: 1 })
    .select({ place_id: 1, name: 1, rating: 1, user_ratings_total: 1, reviews: 1 })
    .lean();

  if (ENRICH_LIMIT > 0) {
    cursorQuery = cursorQuery.limit(ENRICH_LIMIT);
  }

  const cursor = cursorQuery.cursor();

  for await (const place of cursor) {
    processed += 1;

    try {
      const apiResponse = await fetchPlaceDetails(place.place_id);

      if (apiResponse.status !== 'OK') {
        failedRequests += 1;
        console.error(`Failed for ${place.place_id}: ${apiResponse.status}`);
      } else {
        const reviewDocs = normalizeReviews(apiResponse.result?.reviews);
        const update = {
          reviews: reviewDocs,
        };

        if (Number.isFinite(apiResponse.result?.rating)) {
          update.rating = Number(apiResponse.result.rating);
        }

        if (Number.isFinite(apiResponse.result?.user_ratings_total)) {
          update.user_ratings_total = Number(apiResponse.result.user_ratings_total);
        }

        await Place.updateOne(
          { place_id: place.place_id },
          { $set: update },
        );

        totalReviewsStored += reviewDocs.length;

        if (reviewDocs.length > 0) {
          enrichedPlaces += 1;
        } else {
          noReviewPlaces += 1;
        }
      }
    } catch (error) {
      failedRequests += 1;
      console.error(`Request error for ${place.place_id}: ${error.message}`);
    }

    if (processed % 25 === 0 || (ENRICH_LIMIT > 0 && processed === ENRICH_LIMIT) || processed === totalPlaces) {
      console.log(`Processed ${processed} places`);
    }

    await delay(REQUEST_DELAY_MS);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Review enrichment complete');
  console.log(`Processed: ${processed}`);
  console.log(`Places with stored reviews: ${enrichedPlaces}`);
  console.log(`Places with no reviews returned: ${noReviewPlaces}`);
  console.log(`Failed requests: ${failedRequests}`);
  console.log(`Review documents stored: ${totalReviewsStored}`);
  console.log('='.repeat(60) + '\n');
};

const main = async () => {
  try {
    await connectDB();
    await enrichPlaceReviews();
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    try {
      await mongoose.connection.close();
    } catch (closeError) {
      // Ignore close failures during fatal shutdown.
    }
    process.exit(1);
  }
};

main();
