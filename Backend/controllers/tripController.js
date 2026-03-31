const TripService = require('../services/tripService');

// @route   POST /api/trips
// @desc    Create a new trip
// @access  Private
exports.createTrip = async (req, res) => {
  try {
    const { city, days, interests, hotelLocation, startDate, stayPlanningMode } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!city || !days) {
      return res.status(400).json({
        success: false,
        message: 'Please provide city and days',
      });
    }

    const tripData = {
      city,
      days,
      startDate,
      interests: interests || [],
      stayPlanningMode: stayPlanningMode === 'dynamic' ? 'dynamic' : 'static',
      hotelLocation,
    };

    const trip = await TripService.createTrip(userId, tripData);

    res.status(201).json({
      success: true,
      message: 'Trip created successfully',
      data: trip,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create trip',
    });
  }
};

// @route   GET /api/trips
// @desc    Get all trips for logged-in user
// @access  Private
exports.getUserTrips = async (req, res) => {
  try {
    const userId = req.user.userId;

    const trips = await TripService.getUserTrips(userId);

    res.status(200).json({
      success: true,
      message: 'Trips retrieved successfully',
      data: trips,
      count: trips.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve trips',
    });
  }
};

// @route   GET /api/trips/:id
// @desc    Get a single trip by ID
// @access  Private
exports.getTripById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const trip = await TripService.getTripById(id, userId);

    res.status(200).json({
      success: true,
      message: 'Trip retrieved successfully',
      data: trip,
    });
  } catch (error) {
    if (error.message === 'Trip not found') {
      return res.status(404).json({
        success: false,
        message: 'Trip not found',
      });
    }

    if (error.message === 'Not authorized to access this trip') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this trip',
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retrieve trip',
    });
  }
};

// @route   PUT /api/trips/:id
// @desc    Update a trip
// @access  Private
exports.updateTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updateData = req.body;

    const trip = await TripService.updateTrip(id, userId, updateData);

    res.status(200).json({
      success: true,
      message: 'Trip updated successfully',
      data: trip,
    });
  } catch (error) {
    if (error.message === 'Trip not found') {
      return res.status(404).json({
        success: false,
        message: 'Trip not found',
      });
    }

    if (error.message === 'Not authorized to update this trip') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this trip',
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update trip',
    });
  }
};

// @route   DELETE /api/trips/:id
// @desc    Delete a trip
// @access  Private
exports.deleteTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    await TripService.deleteTrip(id, userId);

    res.status(200).json({
      success: true,
      message: 'Trip deleted successfully',
    });
  } catch (error) {
    if (error.message === 'Trip not found') {
      return res.status(404).json({
        success: false,
        message: 'Trip not found',
      });
    }

    if (error.message === 'Not authorized to delete this trip') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this trip',
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete trip',
    });
  }
};
