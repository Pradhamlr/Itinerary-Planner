const Trip = require('../models/Trip');

class TripService {
  // Create a new trip
  static async createTrip(userId, tripData) {
    try {
      const trip = new Trip({
        userId,
        ...tripData,
      });

      await trip.save();
      return trip;
    } catch (error) {
      throw error;
    }
  }

  // Get all trips for a user
  static async getUserTrips(userId) {
    try {
      const trips = await Trip.find({ userId }).sort({ createdAt: -1 });
      return trips;
    } catch (error) {
      throw error;
    }
  }

  // Get a single trip by ID
  static async getTripById(tripId, userId) {
    try {
      const trip = await Trip.findById(tripId);

      // Verify ownership
      if (!trip) {
        throw new Error('Trip not found');
      }

      if (trip.userId.toString() !== userId.toString()) {
        throw new Error('Not authorized to access this trip');
      }

      return trip;
    } catch (error) {
      throw error;
    }
  }

  // Update trip
  static async updateTrip(tripId, userId, updateData) {
    try {
      const trip = await Trip.findById(tripId);

      if (!trip) {
        throw new Error('Trip not found');
      }

      if (trip.userId.toString() !== userId.toString()) {
        throw new Error('Not authorized to update this trip');
      }

      // Update only allowed fields
      const allowedUpdates = [
        'city',
        'days',
        'startDate',
        'interests',
        'stayPlanningMode',
        'hotelLocation',
        'places',
        'optimizedRoute',
        'recommendationSnapshot',
        'itinerarySnapshot',
        'finalizedItinerarySnapshot',
        'completed',
        'completionFeedback',
      ];
      Object.keys(updateData).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          trip[key] = updateData[key];
        }
      });

      await trip.save();
      return trip;
    } catch (error) {
      throw error;
    }
  }

  // Delete trip
  static async deleteTrip(tripId, userId) {
    try {
      const trip = await Trip.findById(tripId);

      if (!trip) {
        throw new Error('Trip not found');
      }

      if (trip.userId.toString() !== userId.toString()) {
        throw new Error('Not authorized to delete this trip');
      }

      await Trip.findByIdAndDelete(tripId);
      return { message: 'Trip deleted successfully' };
    } catch (error) {
      throw error;
    }
  }

  static async saveRecommendationSnapshot(tripId, userId, snapshot) {
    try {
      const trip = await this.getTripById(tripId, userId);
      trip.recommendationSnapshot = {
        ...snapshot,
        generatedAt: new Date(),
      };

      await trip.save();
      return trip.recommendationSnapshot;
    } catch (error) {
      throw error;
    }
  }

  static async saveItinerarySnapshot(tripId, userId, snapshot) {
    try {
      const trip = await this.getTripById(tripId, userId);
      trip.itinerarySnapshot = {
        ...snapshot,
        generatedAt: new Date(),
      };

      await trip.save();
      return trip.itinerarySnapshot;
    } catch (error) {
      throw error;
    }
  }

  static async saveFinalizedItinerarySnapshot(tripId, userId, snapshot) {
    try {
      const trip = await this.getTripById(tripId, userId);
      trip.finalizedItinerarySnapshot = {
        ...snapshot,
        generatedAt: new Date(),
      };

      await trip.save();
      return trip.finalizedItinerarySnapshot;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = TripService;
