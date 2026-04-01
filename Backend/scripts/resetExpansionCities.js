require('dotenv').config();
const mongoose = require('mongoose');
const Place = require('../models/Place');
const Hotel = require('../models/Hotel');
const { CITY_EXPANSION_PLAN, CITY_LOOKUP } = require('../config/cityExpansionPlan');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    city: '',
    keep: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--city') {
      options.city = args[index + 1] || '';
      index += 1;
    } else if (arg === '--keep') {
      options.keep = String(args[index + 1] || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      index += 1;
    }
  }

  return options;
};

const resolveCities = ({ city, keep }) => {
  if (city) {
    const match = CITY_LOOKUP.get(String(city).trim().toLowerCase());
    if (match) {
      return [match.city.toLowerCase()];
    }

    return [String(city).trim().toLowerCase()].filter(Boolean);
  }

  const keepSet = new Set(keep);
  return CITY_EXPANSION_PLAN
    .map((entry) => entry.city.toLowerCase())
    .filter((expansionCity) => !keepSet.has(expansionCity));
};

const main = async () => {
  const options = parseArgs();
  const cities = resolveCities(options);

  if (cities.length === 0) {
    console.log('No matching expansion cities found to reset.');
    process.exit(0);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);

    const deletedPlaces = await Place.deleteMany({ city: { $in: cities } });
    const deletedHotels = await Hotel.deleteMany({ city: { $in: cities } });

    console.log(JSON.stringify({
      reset_cities: cities,
      deleted_places: deletedPlaces.deletedCount,
      deleted_hotels: deletedHotels.deletedCount,
    }, null, 2));

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('resetExpansionCities failed:', error);
    process.exit(1);
  }
};

main();
