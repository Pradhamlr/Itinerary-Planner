const router = require('express').Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getItinerary,
  regenerateItineraryDay,
  recalculateItineraryDay,
  finalizeItinerary,
  getSwapSuggestions,
  swapItineraryPlace,
} = require('../controllers/itineraryController');

router.use(authMiddleware);

router.get('/:tripId', getItinerary);
router.post('/:tripId/regenerate-day/:dayNumber', regenerateItineraryDay);
router.post('/:tripId/recalculate-day/:dayNumber', recalculateItineraryDay);
router.post('/:tripId/finalize', finalizeItinerary);
router.post('/:tripId/swap-options/:dayNumber', getSwapSuggestions);
router.post('/:tripId/swap-place/:dayNumber', swapItineraryPlace);

module.exports = router;
