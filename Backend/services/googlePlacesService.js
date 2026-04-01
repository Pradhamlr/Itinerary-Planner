const axios = require('axios');
const { CITY_LOOKUP } = require('../config/cityExpansionPlan');

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const PLACES_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

const buildPlacePhotoUrl = (photoReference, maxWidth = 800) => {
  if (!GOOGLE_API_KEY || !photoReference) {
    return null;
  }

  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(photoReference)}&key=${encodeURIComponent(GOOGLE_API_KEY)}`;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeCity = (value) => String(value || '').trim().toLowerCase();

const buildGeocodingAddress = (cityName, queryOverride = '') => {
  if (String(queryOverride || '').trim()) {
    return String(queryOverride).trim();
  }

  return CITY_LOOKUP.has(normalizeCity(cityName))
    ? `${cityName}, India`
    : `${cityName}, Kerala, India`;
};

/**
 * Get coordinates for a city using Google Geocoding API
 */
const getCityCoordinates = async (cityName, queryOverride = '') => {
  try {
    const address = buildGeocodingAddress(cityName, queryOverride);
    const response = await axios.get(GEOCODING_URL, {
      params: {
        address,
        key: GOOGLE_API_KEY,
      },
    });

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      console.log(`Geocoded ${cityName} using "${address}": ${location.lat}, ${location.lng}`);
      return {
        lat: location.lat,
        lng: location.lng,
      };
    }

    console.error(`Failed to geocode ${cityName} using "${address}": ${response.data.status}`);
    return null;
  } catch (error) {
    console.error(`Error geocoding ${cityName}:`, error.message);
    return null;
  }
};

/**
 * Generate grid of coordinates around a center point
 */
const generateGridCoordinates = (centerLat, centerLng, gridSize = 0.02) => {
  const coordinates = [];

  coordinates.push({ lat: centerLat, lng: centerLng });

  for (let latOffset = -gridSize; latOffset <= gridSize; latOffset += gridSize) {
    for (let lngOffset = -gridSize; lngOffset <= gridSize; lngOffset += gridSize) {
      if (latOffset !== 0 || lngOffset !== 0) {
        coordinates.push({
          lat: centerLat + latOffset,
          lng: centerLng + lngOffset,
        });
      }
    }
  }

  return coordinates;
};

/**
 * Fetch places from Google Places API with pagination
 */
const fetchPlacesNearby = async (lat, lng, type, radius = 5000) => {
  const allPlaces = [];
  let pageToken = null;
  let pageCount = 0;
  const maxPages = 3;

  try {
    do {
      if (pageToken) {
        await delay(2000);
      }

      const params = {
        location: `${lat},${lng}`,
        radius,
        type,
        key: GOOGLE_API_KEY,
      };

      if (pageToken) {
        params.pagetoken = pageToken;
      }

      const response = await axios.get(PLACES_URL, { params });

      if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
        const places = response.data.results || [];
        allPlaces.push(...places);

        pageToken = response.data.next_page_token;
        pageCount += 1;

        console.log(`  -> Fetched ${places.length} places (page ${pageCount})`);
      } else {
        console.error(`  API error: ${response.data.status}`);
        break;
      }

      await delay(600);
    } while (pageToken && pageCount < maxPages);

    return allPlaces;
  } catch (error) {
    console.error('  Error fetching places:', error.message);
    return allPlaces;
  }
};

/**
 * Get place details including reviews
 */
const getPlaceDetails = async (placeId) => {
  try {
    const response = await axios.get(PLACE_DETAILS_URL, {
      params: {
        place_id: placeId,
        fields: 'reviews,editorial_summary,current_opening_hours,photos',
        key: GOOGLE_API_KEY,
      },
    });

    if (response.data.status === 'OK') {
      return response.data.result;
    }

    return null;
  } catch (error) {
    console.error('  Error fetching place details:', error.message);
    return null;
  }
};

/**
 * Normalize place data from Google API
 */
const normalizePlaceData = (place, cityName) => ({
  place_id: place.place_id,
  name: place.name,
  city: cityName.toLowerCase(),
  lat: place.geometry.location.lat,
  lng: place.geometry.location.lng,
  rating: place.rating || 0,
  user_ratings_total: place.user_ratings_total || 0,
  types: place.types || [],
  description: place.vicinity || '',
  photos: Array.isArray(place.photos)
    ? place.photos
      .map((photo) => ({
        photo_reference: photo.photo_reference,
        height: photo.height,
        width: photo.width,
        html_attributions: Array.isArray(photo.html_attributions) ? photo.html_attributions : [],
      }))
      .filter((photo) => photo.photo_reference)
    : [],
  reviews: [],
  opening_hours: {
    open_now: place.opening_hours?.open_now ?? undefined,
    weekday_text: Array.isArray(place.opening_hours?.weekday_text) ? place.opening_hours.weekday_text : [],
    periods: [],
  },
  source: 'google',
});

const fetchPlaceByTextQuery = async (query, cityName, options = {}) => {
  try {
    const response = await axios.get(TEXT_SEARCH_URL, {
      params: {
        query,
        key: GOOGLE_API_KEY,
      },
    });

    if (response.data.status !== 'OK' || !Array.isArray(response.data.results) || response.data.results.length === 0) {
      console.error(`Failed to fetch "${query}": ${response.data.status}`);
      return null;
    }

    const results = response.data.results;
    const preferredNameIncludes = String(options.preferredNameIncludes || '').trim().toLowerCase();
    const preferredTypes = Array.isArray(options.preferredTypes)
      ? options.preferredTypes.map((type) => String(type || '').trim().toLowerCase()).filter(Boolean)
      : [];

    const primaryResult = results.find((result) => {
      const resultName = String(result.name || '').trim().toLowerCase();
      const resultTypes = Array.isArray(result.types)
        ? result.types.map((type) => String(type || '').trim().toLowerCase())
        : [];

      const matchesName = !preferredNameIncludes || resultName.includes(preferredNameIncludes);
      const matchesType = preferredTypes.length === 0 || preferredTypes.some((type) => resultTypes.includes(type));

      return matchesName && matchesType;
    }) || results[0];

    return normalizePlaceData(primaryResult, cityName);
  } catch (error) {
    console.error(`Error fetching "${query}":`, error.message);
    return null;
  }
};

/**
 * Fetch all places for a city with grid search
 */
const fetchPlacesForCity = async (cityName, placeTypes) => {
  console.log(`\nProcessing ${cityName}...`);

  const cityCoords = await getCityCoordinates(cityName);
  if (!cityCoords) {
    console.error(`Skipping ${cityName} - geocoding failed`);
    return [];
  }

  const gridCoordinates = generateGridCoordinates(cityCoords.lat, cityCoords.lng);
  console.log(`  Grid size: ${gridCoordinates.length} points`);

  const allPlaces = [];
  const seenPlaceIds = new Set();

  for (const type of placeTypes) {
    console.log(`  Fetching ${type}...`);

    for (const coord of gridCoordinates) {
      const places = await fetchPlacesNearby(coord.lat, coord.lng, type);

      for (const place of places) {
        if (!seenPlaceIds.has(place.place_id)) {
          seenPlaceIds.add(place.place_id);
          allPlaces.push(normalizePlaceData(place, cityName));
        }
      }
    }
  }

  console.log(`Collected ${allPlaces.length} unique places for ${cityName}`);
  return allPlaces;
};

module.exports = {
  getCityCoordinates,
  fetchPlacesNearby,
  getPlaceDetails,
  fetchPlacesForCity,
  fetchPlaceByTextQuery,
  normalizePlaceData,
  buildPlacePhotoUrl,
};
