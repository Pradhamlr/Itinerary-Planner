require('dotenv').config();
const mongoose = require('mongoose');
const Place = require('../models/Place');
const { fetchPlaceByTextQuery, getPlaceDetails, buildPlacePhotoUrl } = require('../services/googlePlacesService');

const SPECIFIC_PLACE_QUERIES = [
  {
    query: 'Lulu Mall Kochi Kerala India',
    city: 'Kochi',
    preferredNameIncludes: 'lulu',
    preferredTypes: ['shopping_mall'],
  },
  {
    query: 'Broadway MetharBazar Cloth Bazar Shenoys Ernakulam Kerala India',
    city: 'Kochi',
    preferredNameIncludes: 'broadway metharbazar',
    preferredTypes: ['market'],
  },
];

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const enrichPlaceWithDetails = async (place) => {
  if (!place?.place_id) {
    return place;
  }

  const details = await getPlaceDetails(place.place_id);
  if (!details) {
    return place;
  }

  return {
    ...place,
    photos: Array.isArray(details.photos)
      ? details.photos
        .map((photo) => ({
          photo_reference: photo.photo_reference,
          height: photo.height,
          width: photo.width,
          html_attributions: Array.isArray(photo.html_attributions) ? photo.html_attributions : [],
        }))
        .filter((photo) => photo.photo_reference)
      : place.photos || [],
    description: details.editorial_summary?.overview || place.description || '',
    reviews: Array.isArray(details.reviews)
      ? details.reviews.map((review) => ({
          author_name: review.author_name,
          rating: review.rating,
          text: review.text,
          time: review.time,
        }))
      : place.reviews || [],
    opening_hours: {
      open_now: details.current_opening_hours?.open_now ?? place.opening_hours?.open_now,
      weekday_text: Array.isArray(details.current_opening_hours?.weekday_text)
        ? details.current_opening_hours.weekday_text
        : place.opening_hours?.weekday_text || [],
      periods: Array.isArray(details.current_opening_hours?.periods)
        ? details.current_opening_hours.periods
        : place.opening_hours?.periods || [],
    },
  };
};

const upsertPlace = async (place) => {
  const firstPhotoReference = Array.isArray(place.photos) && place.photos[0]?.photo_reference
    ? place.photos[0].photo_reference
    : null;

  const document = {
    ...place,
    photo_reference: firstPhotoReference,
    photo_url: buildPlacePhotoUrl(firstPhotoReference),
  };

  const updated = await Place.findOneAndUpdate(
    { place_id: place.place_id },
    { $set: document },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return updated;
};

const syncSpecificShoppingPlaces = async () => {
  for (const entry of SPECIFIC_PLACE_QUERIES) {
    console.log(`\nFetching ${entry.query}...`);
    const basePlace = await fetchPlaceByTextQuery(entry.query, entry.city, {
      preferredNameIncludes: entry.preferredNameIncludes,
      preferredTypes: entry.preferredTypes,
    });
    if (!basePlace) {
      console.log(`Skipping ${entry.query} - no result`);
      continue;
    }

    const enrichedPlace = await enrichPlaceWithDetails(basePlace);
    const savedPlace = await upsertPlace(enrichedPlace);
    console.log(`Saved ${savedPlace.name} (${savedPlace.city})`);
  }
};

const main = async () => {
  try {
    await connectDB();
    await syncSpecificShoppingPlaces();
    await mongoose.connection.close();
    console.log('\nSpecific shopping place sync complete.');
    process.exit(0);
  } catch (error) {
    console.error('Specific shopping sync failed:', error);
    process.exit(1);
  }
};

main();
