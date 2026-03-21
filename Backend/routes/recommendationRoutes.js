const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getRecommendationsByTrip } = require('../controllers/recommendationController');

const router = express.Router();

router.use(authMiddleware);

router.get('/:tripId', getRecommendationsByTrip);

module.exports = router;
