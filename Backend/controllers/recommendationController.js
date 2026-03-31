const TripService = require('../services/tripService');
const RecommendationService = require('../services/recommendationService');

const normalizeInterest = (interest) => String(interest || '').trim().toLowerCase();
const attractionDrivenInterests = new Set(['beaches', 'culture', 'nature', 'history', 'art', 'shopping']);

exports.getRecommendationsByTrip = async (req, res) => {
  let trip;
  try {
    const { tripId } = req.params;
    const userId = req.user.userId;
    const allowSoftMatches = String(req.query.softenMatches || '').trim() === '1';

    trip = await TripService.getTripById(tripId, userId);
    const recommendations = await RecommendationService.getRecommendationsForTrip(trip, { allowSoftMatches });
    const responseMetadata = {
      ...recommendations.metadata,
      tripId: trip._id,
      city: trip.city,
      interests: trip.interests || [],
      trip_days: trip.days,
    };

    await TripService.saveRecommendationSnapshot(tripId, userId, {
      attractions: recommendations.attractions,
      masterAttractionPool: recommendations.masterAttractionPool || [],
      replacementAttractionPool: recommendations.replacementAttractionPool || [],
      restaurants: recommendations.restaurants,
      metadata: responseMetadata,
    });

    res.status(200).json({
      success: true,
      message: 'Recommendations generated successfully',
      replacementAttractionPool: recommendations.replacementAttractionPool || [],
      masterAttractionPool: recommendations.masterAttractionPool || [],
      attractions: recommendations.attractions,
      restaurants: recommendations.restaurants,
      metadata: responseMetadata,
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

    if (error.message.startsWith('ML service unavailable:')) {
      return res.status(502).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.startsWith('INSUFFICIENT_STRICT_INTEREST_MATCHES:')) {
      const attractionInterests = (trip?.interests || [])
        .map(normalizeInterest)
        .filter((interest) => attractionDrivenInterests.has(interest));
      const softMatchAvailable = attractionInterests.some((interest) => interest !== 'shopping');

      return res.status(422).json({
        success: false,
        message: error.message.replace('INSUFFICIENT_STRICT_INTEREST_MATCHES:', '').trim(),
        pairingSuggestions: RecommendationService.getInterestPairingSuggestions(trip?.interests || []),
        softMatchAvailable,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate recommendations',
    });
  }
};
