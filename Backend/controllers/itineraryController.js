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
