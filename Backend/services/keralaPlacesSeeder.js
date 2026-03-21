const Place = require('../models/Place');
const { fetchPlacesForCity } = require('./googlePlacesService');

// Kerala cities to seed
const KERALA_CITIES = [
  'Kochi',
  'Thiruvananthapuram',
  'Kozhikode',
  'Alappuzha',
  'Munnar',
  'Wayanad',
  'Thrissur',
  'Kannur',
];

// Place types to collect
const PLACE_TYPES = [
  'tourist_attraction',
  'museum',
  'park',
  'beach',
  'church',
  'temple',
  'restaurant',
  'art_gallery',
  'zoo',
  'campground',
];

/**
 * Check if Place collection is empty
 */
const isPlaceCollectionEmpty = async () => {
  try {
    const count = await Place.countDocuments();
    return count === 0;
  } catch (error) {
    console.error('Error checking Place collection:', error.message);
    return false;
  }
};

/**
 * Save places to database with duplicate prevention
 */
const savePlacesToDatabase = async (places) => {
  let savedCount = 0;
  let skippedCount = 0;

  for (const place of places) {
    try {
      // Check if place already exists
      const existingPlace = await Place.findOne({ place_id: place.place_id });
      
      if (existingPlace) {
        skippedCount++;
        continue;
      }

      // Save new place
      await Place.create(place);
      savedCount++;
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error
        skippedCount++;
      } else {
        console.error(`  ✗ Error saving place ${place.name}:`, error.message);
      }
    }
  }

  return { savedCount, skippedCount };
};

/**
 * Main seeder function
 */
const seedKeralaPlaces = async () => {
  try {
    console.log('\n🌴 Kerala Places Dataset Generation Starting...\n');
    console.log('=' .repeat(60));

    // Check if collection is empty
    const isEmpty = await isPlaceCollectionEmpty();
    
    if (!isEmpty) {
      const count = await Place.countDocuments();
      console.log(`\n✓ Place collection already populated with ${count} places`);
      console.log('Skipping dataset generation.\n');
      return;
    }

    console.log('✓ Place collection is empty. Starting data collection...\n');

    let totalPlaces = [];

    // Fetch places for each city
    for (const city of KERALA_CITIES) {
      try {
        const places = await fetchPlacesForCity(city, PLACE_TYPES);
        totalPlaces = totalPlaces.concat(places);
      } catch (error) {
        console.error(`✗ Error processing ${city}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Total places collected: ${totalPlaces.length}`);
    console.log('\n💾 Saving to database...\n');

    // Save to database
    const { savedCount, skippedCount } = await savePlacesToDatabase(totalPlaces);

    console.log('=' .repeat(60));
    console.log(`\n✓ Dataset generation complete!`);
    console.log(`  → Saved: ${savedCount} places`);
    console.log(`  → Skipped (duplicates): ${skippedCount} places`);
    console.log(`  → Total in database: ${await Place.countDocuments()} places\n`);

  } catch (error) {
    console.error('\n✗ Kerala places seeding failed:', error.message);
    throw error;
  }
};

module.exports = {
  seedKeralaPlaces,
  isPlaceCollectionEmpty,
};
