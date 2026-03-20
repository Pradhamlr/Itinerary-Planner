const axios = require('axios');

const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';

const formatCoordinate = (point) => `${Number(point.lat)},${Number(point.lng)}`;

async function getTravelTimes(origins, destinations) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || origins.length === 0 || destinations.length === 0) {
    return null;
  }

  const response = await axios.get(DISTANCE_MATRIX_URL, {
    timeout: 30000,
    params: {
      origins: origins.map(formatCoordinate).join('|'),
      destinations: destinations.map(formatCoordinate).join('|'),
      key: apiKey,
      mode: 'driving',
    },
  });

  if (response.data?.status !== 'OK') {
    throw new Error(response.data?.error_message || response.data?.status || 'Distance Matrix request failed');
  }

  return (response.data.rows || []).map((row) =>
    (row.elements || []).map((element) => {
      if (element.status !== 'OK') {
        return null;
      }

      return {
        durationSeconds: element.duration?.value ?? null,
        durationText: element.duration?.text ?? null,
        distanceMeters: element.distance?.value ?? null,
        distanceText: element.distance?.text ?? null,
      };
    }));
}

module.exports = {
  getTravelTimes,
};
