const HotelService = require('../services/hotelService');
const TripService = require('../services/tripService');
const DynamicHotelPlanningService = require('../services/dynamicHotelPlanningService');

exports.getHotels = async (req, res) => {
  try {
    const { city, min_price, max_price, star } = req.query;

    if (!city || String(city).trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a city',
      });
    }

    const result = await HotelService.getHotels(city, {
      min_price,
      max_price,
      star,
    });

    return res.status(200).json({
      success: true,
      message: `Found ${result.total} hotel suggestions for ${result.city}`,
      data: result.hotels,
      count: result.total,
      filtersApplied: result.filtersApplied,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch hotel suggestions',
    });
  }
};

exports.getDynamicHotels = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const userId = req.user.userId;
    const trip = await TripService.getTripById(tripId, userId);

    const result = await DynamicHotelPlanningService.buildDynamicHotelPlan(trip, {
      min_price: req.query.min_price,
      max_price: req.query.max_price,
      star: req.query.star,
    }, {
      skip_last_day: req.query.skip_last_day,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error.message === 'Trip not found') {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (error.message === 'Not authorized to access this trip') {
      return res.status(403).json({ message: 'Not authorized to access this trip' });
    }

    if (error.message === 'Generate an itinerary before requesting dynamic hotel planning') {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: error.message || 'Failed to load dynamic hotel planning' });
  }
};
