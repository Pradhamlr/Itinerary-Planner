require('dotenv').config();
const mongoose = require('mongoose');
const Place = require('../models/Place');

const KEEP_NAME_KEYWORDS = [
  'mall',
  'lulu',
  'broadway',
  'bazaar',
  'market',
  'emporium',
  'shopping centre',
  'shopping center',
  'plaza',
  'arcade',
  'square',
];

const RETAIL_TYPES = new Set([
  'shopping_mall',
  'store',
  'market',
  'clothing_store',
  'jewelry_store',
  'electronics_store',
  'home_goods_store',
  'book_store',
  'shoe_store',
  'department_store',
  'supermarket',
]);

const normalize = (value) => String(value || '').trim().toLowerCase();

const shouldKeepShoppingMallType = (place) => {
  const name = normalize(place.name);
  const description = normalize(place.description);
  const types = Array.isArray(place.types) ? place.types.map(normalize) : [];
  const rating = Number(place.rating || 0);
  const reviews = Number(place.user_ratings_total || 0);

  if (KEEP_NAME_KEYWORDS.some((keyword) => name.includes(keyword) || description.includes(keyword))) {
    return true;
  }

  if (reviews >= 200 && rating >= 3.8) {
    return true;
  }

  if (reviews >= 50 && rating >= 4.0 && types.some((type) => RETAIL_TYPES.has(type) && type !== 'shopping_mall')) {
    return true;
  }

  return false;
};

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
};

const main = async () => {
  const apply = process.argv.includes('--apply');
  const deleteMode = process.argv.includes('--delete');

  try {
    await connectDB();
    console.log('MongoDB connected');

    const mallPlaces = await Place.find({ types: 'shopping_mall' }).lean();
    const candidates = mallPlaces.filter((place) => !shouldKeepShoppingMallType(place));

    console.log(`Found ${mallPlaces.length} places with shopping_mall type`);
    console.log(`Flagged ${candidates.length} places as shopping-mall noise`);

    const preview = candidates
      .slice(0, 40)
      .map((place) => ({
        name: place.name,
        city: place.city,
        rating: place.rating || 0,
        user_ratings_total: place.user_ratings_total || 0,
        types: place.types,
      }));
    console.log(JSON.stringify(preview, null, 2));

    if (!apply) {
      console.log('\nPreview only. Re-run with --apply to strip the shopping_mall type or --delete to remove the flagged places entirely.');
      await mongoose.disconnect();
      process.exit(0);
    }

    let changedCount = 0;
    for (const place of candidates) {
      if (deleteMode) {
        await Place.deleteOne({ _id: place._id });
      } else {
        const nextTypes = (place.types || []).filter((type) => normalize(type) !== 'shopping_mall');
        await Place.updateOne({ _id: place._id }, { $set: { types: nextTypes } });
      }
      changedCount += 1;
    }

    console.log(`${deleteMode ? 'Deleted' : 'Updated'} ${changedCount} places`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('cleanupShoppingMallNoise failed:', error);
    process.exit(1);
  }
};

main();
