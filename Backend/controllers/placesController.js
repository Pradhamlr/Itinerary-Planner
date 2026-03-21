const PlacesService = require('../services/placesService');
const Place = require('../models/Place');

// @route   GET /api/places/:city
// @desc    Get places for a city from database
// @access  Public
exports.getPlacesByCity = async (req, res) => {
  try {
    const { city } = req.params;

    if (!city || city.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a city name',
      });
    }

    const places = await PlacesService.getPlacesByCity(city);

    if (places.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No places found for ${city}. This city may not be in our Kerala dataset.`,
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: `Found ${places.length} places in ${city}`,
      data: places,
      count: places.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch places',
    });
  }
};

// @route   GET /api/places/type/:city/:type
// @desc    Get places filtered by type
// @access  Public
exports.getPlacesByType = async (req, res) => {
  try {
    const { city, type } = req.params;

    if (!city || !type) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both city and type',
      });
    }

    const places = await PlacesService.getPlacesByType(city, type);

    res.status(200).json({
      success: true,
      message: `Found ${places.length} ${type} places in ${city}`,
      data: places,
      count: places.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch places by type',
    });
  }
};

// @route   GET /api/places/rating/:city
// @desc    Get highly rated places
// @access  Public
exports.getPlacesByRating = async (req, res) => {
  try {
    const { city } = req.params;
    const { minRating } = req.query;

    if (!city) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a city name',
      });
    }

    const rating = minRating ? parseFloat(minRating) : 4.0;
    const places = await PlacesService.getPlacesByRating(city, rating);

    res.status(200).json({
      success: true,
      message: `Found ${places.length} places with rating >= ${rating} in ${city}`,
      data: places,
      count: places.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch places by rating',
    });
  }
};

// @route   GET /api/places/cities
// @desc    Get all available cities
// @access  Public
exports.getAllCities = async (req, res) => {
  try {
    const cities = await PlacesService.getAllCities();

    res.status(200).json({
      success: true,
      message: `Found ${cities.length} cities`,
      data: cities,
      count: cities.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch cities',
    });
  }
};

// @route   GET /api/places/stats/:city
// @desc    Get statistics for a city
// @access  Public
exports.getCityStats = async (req, res) => {
  try {
    const { city } = req.params;

    if (!city) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a city name',
      });
    }

    const stats = await PlacesService.getCityStats(city);

    res.status(200).json({
      success: true,
      message: `Statistics for ${city}`,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch city statistics',
    });
  }
};
