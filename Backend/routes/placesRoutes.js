const express = require('express');
const router = express.Router();
const {
  getPlacesByCity,
  getPlacesByType,
  getPlacesByRating,
  getAllCities,
  getCityStats,
} = require('../controllers/placesController');

// GET /api/places/cities - Get all available cities
router.get('/cities', getAllCities);

// GET /api/places/stats/:city - Get city statistics
router.get('/stats/:city', getCityStats);

// GET /api/places/rating/:city - Get highly rated places
router.get('/rating/:city', getPlacesByRating);

// GET /api/places/type/:city/:type - Get places by type
router.get('/type/:city/:type', getPlacesByType);

// GET /api/places/:city - Get all places for a city
router.get('/:city', getPlacesByCity);

module.exports = router;
