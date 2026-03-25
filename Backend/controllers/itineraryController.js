const TripService = require('../services/tripService');
const ItineraryService = require('../services/itineraryService');

exports.getItinerary = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const userId = req.user.userId;
    const trip = await TripService.getTripById(tripId, userId);

    const result = await ItineraryService.generateItinerary(trip);
    const responsePayload = {
      ...result,
      metadata: {
        ...(result.metadata || {}),
        tripId: trip._id,
        city: trip.city,
        interests: trip.interests || [],
        trip_days: trip.days,
      },
    };

    await TripService.saveItinerarySnapshot(tripId, userId, responsePayload);

    res.status(200).json(responsePayload);
  } catch (error) {
    if (error.message === 'Trip not found') {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (error.message === 'Not authorized to access this trip') {
      return res.status(403).json({ message: 'Not authorized to access this trip' });
    }

    return res.status(500).json({ message: error.message || 'Failed to generate itinerary' });
  }
};

exports.regenerateItineraryDay = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const dayNumber = req.params.dayNumber;
    const userId = req.user.userId;
    const trip = await TripService.getTripById(tripId, userId);

    const result = await ItineraryService.regenerateDay(trip, dayNumber);
    const responsePayload = {
      ...result,
      metadata: {
        ...(result.metadata || {}),
        tripId: trip._id,
        city: trip.city,
        interests: trip.interests || [],
        trip_days: trip.days,
        regenerated_day: Number(dayNumber),
      },
    };

    await TripService.saveItinerarySnapshot(tripId, userId, responsePayload);

    res.status(200).json(responsePayload);
  } catch (error) {
    if (error.message === 'Trip not found') {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (error.message === 'Not authorized to access this trip') {
      return res.status(403).json({ message: 'Not authorized to access this trip' });
    }

    return res.status(500).json({ message: error.message || 'Failed to regenerate itinerary day' });
  }
};

exports.recalculateItineraryDay = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const dayNumber = req.params.dayNumber;
    const userId = req.user.userId;
    const trip = await TripService.getTripById(tripId, userId);

    const result = await ItineraryService.recalculateDayOrder(trip, dayNumber, req.body?.route || []);
    const responsePayload = {
      ...result,
      metadata: {
        ...(result.metadata || {}),
        tripId: trip._id,
        city: trip.city,
        interests: trip.interests || [],
        trip_days: trip.days,
        recalculated_day: Number(dayNumber),
      },
    };

    await TripService.saveItinerarySnapshot(tripId, userId, responsePayload);

    res.status(200).json(responsePayload);
  } catch (error) {
    if (error.message === 'Trip not found') {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (error.message === 'Not authorized to access this trip') {
      return res.status(403).json({ message: 'Not authorized to access this trip' });
    }

    return res.status(500).json({ message: error.message || 'Failed to recalculate itinerary day' });
  }
};

exports.finalizeItinerary = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const userId = req.user.userId;
    const trip = await TripService.getTripById(tripId, userId);

    const snapshotToFinalize = req.body?.itinerarySnapshot || trip.itinerarySnapshot;
    if (!snapshotToFinalize?.itinerary?.length) {
      return res.status(400).json({ message: 'Generate an itinerary before finalizing it.' });
    }

    const finalizedSnapshot = await TripService.saveFinalizedItinerarySnapshot(tripId, userId, {
      ...snapshotToFinalize,
      metadata: {
        ...(snapshotToFinalize.metadata || {}),
        tripId: trip._id,
        city: trip.city,
        interests: trip.interests || [],
        trip_days: trip.days,
        finalized: true,
      },
    });

    res.status(200).json({
      message: 'Final itinerary saved successfully.',
      finalizedItinerarySnapshot: finalizedSnapshot,
    });
  } catch (error) {
    if (error.message === 'Trip not found') {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (error.message === 'Not authorized to access this trip') {
      return res.status(403).json({ message: 'Not authorized to access this trip' });
    }

    return res.status(500).json({ message: error.message || 'Failed to finalize itinerary' });
  }
};

exports.getSwapSuggestions = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const dayNumber = req.params.dayNumber;
    const { placeId } = req.body || {};
    const userId = req.user.userId;
    const trip = await TripService.getTripById(tripId, userId);

    const result = await ItineraryService.getSwapSuggestions(trip, dayNumber, placeId);
    res.status(200).json(result);
  } catch (error) {
    if (error.message === 'Trip not found' || error.message === 'Requested itinerary day not found' || error.message === 'Requested place not found in this itinerary day') {
      return res.status(404).json({ message: error.message });
    }

    if (error.message === 'Not authorized to access this trip') {
      return res.status(403).json({ message: 'Not authorized to access this trip' });
    }

    return res.status(500).json({ message: error.message || 'Failed to load swap suggestions' });
  }
};

exports.swapItineraryPlace = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const dayNumber = req.params.dayNumber;
    const { placeId, replacementPlaceId } = req.body || {};
    const userId = req.user.userId;
    const trip = await TripService.getTripById(tripId, userId);

    const result = await ItineraryService.swapPlaceInDay(trip, dayNumber, placeId, replacementPlaceId);
    const responsePayload = {
      ...result,
      metadata: {
        ...(result.metadata || {}),
        tripId: trip._id,
        city: trip.city,
        interests: trip.interests || [],
        trip_days: trip.days,
      },
    };

    await TripService.saveItinerarySnapshot(tripId, userId, responsePayload);

    res.status(200).json(responsePayload);
  } catch (error) {
    if (
      error.message === 'Trip not found'
      || error.message === 'Requested itinerary day not found'
      || error.message === 'Requested place not found in this itinerary day'
      || error.message === 'Requested replacement is no longer available'
    ) {
      return res.status(404).json({ message: error.message });
    }

    if (error.message === 'Not authorized to access this trip') {
      return res.status(403).json({ message: 'Not authorized to access this trip' });
    }

    if (error.message === 'Unlock this place before swapping it') {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: error.message || 'Failed to swap itinerary place' });
  }
};
