require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Place = require('../models/Place');

const CORE_COLUMNS = ['name', 'category', 'types', 'rating', 'review', 'city', 'lat', 'lng'];
const ENRICHED_COLUMNS = ['review_count', 'review_avg_rating', 'user_ratings_total'];

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const escapeCsv = (value) => {
  if (value === null || value === undefined) {
    return '""';
  }

  const sanitized = String(value)
    .replace(/"/g, '""')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ');

  return `"${sanitized}"`;
};

const normalizeCategory = (types) => {
  if (!Array.isArray(types) || types.length === 0) {
    return 'other';
  }

  return String(types[0]).replace(/_/g, ' ').trim() || 'other';
};

const extractReviewSignals = (place) => {
  const reviews = Array.isArray(place.reviews) ? place.reviews : [];
  const normalizedReviews = reviews
    .map((review) => {
      if (typeof review === 'string') {
        return {
          text: review.trim(),
          rating: null,
        };
      }

      return {
        text: typeof review?.text === 'string' ? review.text.trim() : '',
        rating: Number.isFinite(review?.rating) ? Number(review.rating) : null,
      };
    })
    .filter((review) => review.text.length > 0);

  const reviewText = normalizedReviews.map((review) => review.text).join(' || ');
  const ratings = normalizedReviews
    .map((review) => review.rating)
    .filter((rating) => Number.isFinite(rating));

  const reviewCount = normalizedReviews.length;
  const reviewAvgRating = ratings.length > 0
    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    : (Number.isFinite(place.rating) ? place.rating : 0);

  return {
    reviewText,
    reviewCount,
    reviewAvgRating,
  };
};

const exportDataset = async () => {
  try {
    console.log('\nStarting dataset export...\n');
    console.log('='.repeat(60));

    const places = await Place.find({});
    console.log(`Fetched ${places.length} places from MongoDB`);

    if (places.length === 0) {
      console.log('No places found in database. Run the seeder first.');
      process.exit(1);
    }

    const csvRows = [];
    csvRows.push([...CORE_COLUMNS, ...ENRICHED_COLUMNS].join(','));

    let placesWithReviews = 0;
    let placesWithoutReviews = 0;
    let skippedInvalidRows = 0;

    for (const place of places) {
      const category = normalizeCategory(place.types);
      const { reviewText, reviewCount, reviewAvgRating } = extractReviewSignals(place);

      if (reviewCount > 0) {
        placesWithReviews += 1;
      } else {
        placesWithoutReviews += 1;
      }

      const rating = Number.isFinite(place.rating) ? Math.max(0, Math.min(5, place.rating)) : 0;
      const lat = Number.isFinite(place.lat) ? place.lat : null;
      const lng = Number.isFinite(place.lng) ? place.lng : null;
      const userRatingsTotal = Number.isFinite(place.user_ratings_total) ? place.user_ratings_total : 0;

      if (lat === null || lng === null) {
        skippedInvalidRows += 1;
        continue;
      }

      const row = [
        escapeCsv(place.name || 'Unknown'),
        escapeCsv(category),
        escapeCsv(Array.isArray(place.types) ? place.types.join(' | ') : ''),
        rating,
        escapeCsv(reviewText),
        escapeCsv(place.city || 'unknown'),
        lat,
        lng,
        reviewCount,
        Number(reviewAvgRating.toFixed(4)),
        userRatingsTotal,
      ].join(',');

      csvRows.push(row);
    }

    const outputPath = path.join(__dirname, '../../ml-service/dataset/places.csv');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const csvContent = csvRows.join('\n');
    fs.writeFileSync(outputPath, csvContent, 'utf-8');

    console.log('\n' + '='.repeat(60));
    console.log('Dataset exported successfully');
    console.log(`Output file: ${outputPath}`);
    console.log(`Total places: ${places.length}`);
    console.log(`Skipped invalid rows: ${skippedInvalidRows}`);
    console.log(`Exported rows: ${csvRows.length - 1}`);
    console.log(`Places with reviews: ${placesWithReviews}`);
    console.log(`Places without reviews: ${placesWithoutReviews}`);
    console.log(`File size: ${(csvContent.length / 1024).toFixed(2)} KB`);
    console.log('\nReady for ML training\n');
  } catch (error) {
    console.error('\nExport failed:', error.message);
    throw error;
  }
};

const main = async () => {
  try {
    await connectDB();
    await exportDataset();
    await mongoose.connection.close();
    console.log('MongoDB connection closed\n');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
};

main();
