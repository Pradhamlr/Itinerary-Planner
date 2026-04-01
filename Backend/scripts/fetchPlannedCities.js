require('dotenv').config();
const mongoose = require('mongoose');
const Place = require('../models/Place');
const {
  getCityCoordinates,
  fetchPlacesNearby,
  normalizePlaceData,
} = require('../services/googlePlacesService');
const { CITY_EXPANSION_PLAN, CITY_LOOKUP } = require('../config/cityExpansionPlan');

const normalize = (value) => String(value || '').trim().toLowerCase();

const DEFAULT_MIN_REVIEWS = 25;
const DEFAULT_MIN_RATING = 3.8;
const GENERIC_BLOCKLIST = [
  'apartment',
  'apartments',
  'agency',
  'agencies',
  'building',
  'buildings',
  'complex',
  'complexes',
  'enterprises',
  'enterprisess',
  'franchisee',
  'fuel',
  'gas',
  'godown',
  'heights',
  'hospital',
  'hostel',
  'mart',
  'memorial building',
  'office',
  'pump',
  'residency',
  'residential',
  'school',
  'service center',
  'services',
  'showroom',
  'super gas',
  'traders',
];

const BLOCKED_FETCH_TYPES = new Set([
  'travel_agency',
  'tour_agency',
  'tour_operator',
  'local_government_office',
  'insurance_agency',
  'car_rental',
  'car_repair',
  'gas_station',
  'lodging',
  'pharmacy',
  'hospital',
  'health',
  'school',
  'university',
  'hardware_store',
  'drugstore',
]);

const KEEP_KEYWORDS = [
  'bazar',
  'bazaar',
  'broadway',
  'cathedral',
  'fort',
  'gallery',
  'garden',
  'heritage',
  'lake',
  'lulu',
  'market',
  'museum',
  'palace',
  'park',
  'promenade',
  'temple',
];

const KEEP_TYPES = new Set([
  'museum',
  'art_gallery',
  'beach',
  'park',
  'church',
  'hindu_temple',
  'mosque',
  'synagogue',
  'shopping_mall',
]);

const HIGH_SIGNAL_TOURIST_ATTRACTION_REVIEWS = 150;
const HIGH_SIGNAL_TOURIST_ATTRACTION_RATING = 4.2;

const isMeaningfulTouristAttraction = (place) => {
  const types = Array.isArray(place.types) ? place.types.map(normalize) : [];
  const rating = Number(place.rating || 0);
  const reviews = Number(place.user_ratings_total || 0);
  const normalizedName = normalize(place.name);

  if (!types.includes('tourist_attraction')) {
    return false;
  }

  if (KEEP_TYPES.size > 0 && types.some((type) => KEEP_TYPES.has(type))) {
    return true;
  }

  if (KEEP_KEYWORDS.some((keyword) => normalizedName.includes(keyword))) {
    return true;
  }

  if (reviews >= 500) {
    return true;
  }

  return reviews >= HIGH_SIGNAL_TOURIST_ATTRACTION_REVIEWS && rating >= HIGH_SIGNAL_TOURIST_ATTRACTION_RATING;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    city: '',
    priority: null,
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--city') {
      options.city = args[index + 1] || '';
      index += 1;
    } else if (arg === '--priority') {
      options.priority = Number(args[index + 1] || 0) || null;
      index += 1;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
};

const generateGridCoordinates = (centerLat, centerLng, gridStep = 0.02, gridDepth = 1) => {
  const coordinates = [{ lat: centerLat, lng: centerLng }];

  for (let latStep = -gridDepth; latStep <= gridDepth; latStep += 1) {
    for (let lngStep = -gridDepth; lngStep <= gridDepth; lngStep += 1) {
      if (latStep === 0 && lngStep === 0) {
        continue;
      }

      coordinates.push({
        lat: centerLat + (latStep * gridStep),
        lng: centerLng + (lngStep * gridStep),
      });
    }
  }

  return coordinates;
};

const hasBlockedGenericName = (name) => {
  const normalizedName = normalize(name);
  if (!normalizedName) {
    return true;
  }

  if (KEEP_KEYWORDS.some((keyword) => normalizedName.includes(keyword))) {
    return false;
  }

  return GENERIC_BLOCKLIST.some((keyword) => normalizedName.includes(keyword));
};

const isLikelyLowSignalPlace = (place) => {
  const rating = Number(place.rating || 0);
  const reviews = Number(place.user_ratings_total || 0);
  const types = Array.isArray(place.types) ? place.types.map(normalize) : [];

  if (types.some((type) => BLOCKED_FETCH_TYPES.has(type))) {
    return true;
  }

  if (types.some((type) => KEEP_TYPES.has(type))) {
    return false;
  }

  if (types.includes('tourist_attraction')) {
    return !isMeaningfulTouristAttraction(place);
  }

  if (reviews === 0 && rating === 0) {
    return true;
  }

  if (reviews < DEFAULT_MIN_REVIEWS && rating < DEFAULT_MIN_RATING) {
    return true;
  }

  return hasBlockedGenericName(place.name);
};

const dedupePlaces = (places) => {
  const seen = new Map();

  places.forEach((place) => {
    const placeId = normalize(place.place_id);
    const key = placeId || `${normalize(place.name)}::${normalize(place.city)}::${place.lat}::${place.lng}`;
    const currentScore = (Number(place.user_ratings_total || 0) * 10) + (Number(place.rating || 0) * 100);
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, place);
      return;
    }

    const existingScore = (Number(existing.user_ratings_total || 0) * 10) + (Number(existing.rating || 0) * 100);
    if (currentScore > existingScore) {
      seen.set(key, place);
    }
  });

  return Array.from(seen.values());
};

const capPlacesByType = (places, type, cap) =>
  [...places]
    .sort((first, second) => {
      const secondScore = (Number(second.user_ratings_total || 0) * 10) + (Number(second.rating || 0) * 100);
      const firstScore = (Number(first.user_ratings_total || 0) * 10) + (Number(first.rating || 0) * 100);
      return secondScore - firstScore;
    })
    .slice(0, cap)
    .map((place) => ({
      ...place,
      source: `${place.source || 'google'}:${type}`,
    }));

const resolveCitiesToFetch = ({ city, priority }) => {
  if (city) {
    const match = CITY_LOOKUP.get(city.toLowerCase());
    return match ? [match] : [];
  }

  if (priority) {
    return CITY_EXPANSION_PLAN.filter((entry) => entry.priority === priority);
  }

  return CITY_EXPANSION_PLAN.filter((entry) => entry.priority === 1);
};

const savePlaces = async (places, dryRun) => {
  let inserted = 0;
  let updated = 0;

  for (const place of places) {
    if (dryRun) {
      continue;
    }

    const existing = await Place.findOne({ place_id: place.place_id });
    if (existing) {
      await Place.updateOne({ _id: existing._id }, { $set: place });
      updated += 1;
    } else {
      await Place.create(place);
      inserted += 1;
    }
  }

  return { inserted, updated };
};

const fetchCityProfile = async (entry) => {
  const { city, profile } = entry;
  const cityCoords = await getCityCoordinates(city, entry.geocodeQuery);
  if (!cityCoords) {
    throw new Error(`Failed to geocode ${city}`);
  }

  const coordinates = generateGridCoordinates(
    cityCoords.lat,
    cityCoords.lng,
    profile.gridStep,
    profile.gridDepth,
  );

  const cityPlaces = [];
  for (const type of profile.placeTypes) {
    const perTypeCap = Number(profile.perTypeCaps?.[type] || 0) || 0;
    let fetched = [];

    for (const coordinate of coordinates) {
      const results = await fetchPlacesNearby(coordinate.lat, coordinate.lng, type, profile.radius);
      fetched.push(...results.map((place) => normalizePlaceData(place, city)));
    }

    fetched = dedupePlaces(fetched).filter((place) => !isLikelyLowSignalPlace(place));
    const capped = perTypeCap > 0 ? capPlacesByType(fetched, type, perTypeCap) : fetched;
    cityPlaces.push(...capped);
  }

  return dedupePlaces(cityPlaces);
};

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
};

const main = async () => {
  const options = parseArgs();
  const cities = resolveCitiesToFetch(options);

  if (cities.length === 0) {
    console.log('No matching cities found in the expansion plan.');
    process.exit(0);
  }

  try {
    await connectDB();
    console.log(`MongoDB connected. Fetching ${cities.length} planned cities...`);

    for (const entry of cities) {
      console.log(`\nFetching ${entry.city} (${entry.region}, priority ${entry.priority})...`);
      const places = await fetchCityProfile(entry);
      const { inserted, updated } = await savePlaces(places, options.dryRun);

      console.log(JSON.stringify({
        city: entry.city,
        mode: entry.mode,
        fetched_places: places.length,
        dry_run: options.dryRun,
        inserted,
        updated,
      }, null, 2));
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('fetchPlannedCities failed:', error);
    process.exit(1);
  }
};

main();
