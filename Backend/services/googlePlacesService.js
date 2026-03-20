const axios = require('axios');

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const PLACES_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

// Delay utility
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get coordinates for a city using Google Geocoding API
 */
const getCityCoordinates = async (cityName) => {
  try {
    const response = await axios.get(GEOCODING_URL, {
      params: {
        address: `${cityName}, Kerala, India`,
        key: GOOGLE_API_KEY,
      },
    });

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      console.log(`✓ Geocoded ${cityName}: ${location.lat}, ${location.lng}`);
      return {
        lat: location.lat,
        lng: location.lng,
      };
    }

    console.error(`✗ Failed to geocode ${cityName}: ${response.data.status}`);
    return null;
  } catch (error) {
    console.error(`✗ Error geocoding ${cityName}:`, error.message);
    return null;
  }
};

/**
 * Generate grid of coordinates around a center point
 */
const generateGridCoordinates = (centerLat, centerLng, gridSize = 0.02) => {
  const coordinates = [];
  
  // Center point
  coordinates.push({ lat: centerLat, lng: centerLng });
  
  // Grid points around center
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
      // Wait before requesting next page
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
        pageCount++;
        
        console.log(`  → Fetched ${places.length} places (page ${pageCount})`);
      } else {
        console.error(`  ✗ API error: ${response.data.status}`);
        break;
      }

      // Rate limiting
      await delay(600);

    } while (pageToken && pageCount < maxPages);

    return allPlaces;
  } catch (error) {
    console.error(`  ✗ Error fetching places:`, error.message);
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
        fields: 'reviews,editorial_summary,current_opening_hours',
        key: GOOGLE_API_KEY,
      },
    });

    if (response.data.status === 'OK') {
      return response.data.result;
    }

    return null;
  } catch (error) {
    console.error(`  ✗ Error fetching place details:`, error.message);
    return null;
  }
};

/**
 * Normalize place data from Google API
 */
const normalizePlaceData = (place, cityName) => {
  return {
    place_id: place.place_id,
    name: place.name,
    city: cityName.toLowerCase(),
    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng,
    rating: place.rating || 0,
    user_ratings_total: place.user_ratings_total || 0,
    types: place.types || [],
    description: place.vicinity || '',
    reviews: [],
    opening_hours: {
      open_now: place.opening_hours?.open_now ?? undefined,
      weekday_text: Array.isArray(place.opening_hours?.weekday_text) ? place.opening_hours.weekday_text : [],
      periods: [],
    },
    source: 'google',
  };
};

/**
 * Fetch all places for a city with grid search
 */
const fetchPlacesForCity = async (cityName, placeTypes) => {
  console.log(`\n📍 Processing ${cityName}...`);
  
  // Get city coordinates
  const cityCoords = await getCityCoordinates(cityName);
  if (!cityCoords) {
    console.error(`✗ Skipping ${cityName} - geocoding failed`);
    return [];
  }

  // Generate grid coordinates
  const gridCoordinates = generateGridCoordinates(cityCoords.lat, cityCoords.lng);
  console.log(`  Grid size: ${gridCoordinates.length} points`);

  const allPlaces = [];
  const seenPlaceIds = new Set();

  // Fetch places for each type at each grid point
  for (const type of placeTypes) {
    console.log(`  Fetching ${type}...`);
    
    for (const coord of gridCoordinates) {
      const places = await fetchPlacesNearby(coord.lat, coord.lng, type);
      
      // Filter duplicates
      for (const place of places) {
        if (!seenPlaceIds.has(place.place_id)) {
          seenPlaceIds.add(place.place_id);
          allPlaces.push(normalizePlaceData(place, cityName));
        }
      }
    }
  }

  console.log(`✓ ${cityName}: Collected ${allPlaces.length} unique places`);
  return allPlaces;
};

module.exports = {
  getCityCoordinates,
  fetchPlacesNearby,
  getPlaceDetails,
  fetchPlacesForCity,
  normalizePlaceData,
};
