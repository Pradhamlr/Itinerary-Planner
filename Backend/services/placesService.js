const Place = require('../models/Place');
const { fetchPlacesForCity } = require('./googlePlacesService');

class PlacesService {
  /**
   * Get places by city from database (Google Places data)
   */
  static async getPlacesByCity(city) {
    try {
      const cityLower = city.toLowerCase();
      const places = await Place.find({ city: cityLower }).limit(100);
      return places;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get places filtered by type
   */
  static async getPlacesByType(city, type) {
    try {
      const cityLower = city.toLowerCase();
      const places = await Place.find({
        city: cityLower,
        types: type,
      }).limit(50);
      return places;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get places with minimum rating
   */
  static async getPlacesByRating(city, minRating = 4.0) {
    try {
      const cityLower = city.toLowerCase();
      const places = await Place.find({
        city: cityLower,
        rating: { $gte: minRating },
      })
        .sort({ rating: -1, user_ratings_total: -1 })
        .limit(50);
      return places;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all unique cities in database
   */
  static async getAllCities() {
    try {
      const cities = await Place.distinct('city');
      return cities;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get statistics for a city
   */
  static async getCityStats(city) {
    try {
      const cityLower = city.toLowerCase();
      const totalPlaces = await Place.countDocuments({ city: cityLower });
      const avgRating = await Place.aggregate([
        { $match: { city: cityLower, rating: { $gt: 0 } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } },
      ]);

      const typeDistribution = await Place.aggregate([
        { $match: { city: cityLower } },
        { $unwind: '$types' },
        { $group: { _id: '$types', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      return {
        city: cityLower,
        totalPlaces,
        averageRating: avgRating.length > 0 ? avgRating[0].avgRating.toFixed(2) : 0,
        typeDistribution,
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = PlacesService;
