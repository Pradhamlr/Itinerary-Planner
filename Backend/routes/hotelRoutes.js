const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getHotels, getDynamicHotels } = require('../controllers/hotelController');

const router = express.Router();

router.get('/dynamic/:tripId', authMiddleware, getDynamicHotels);
router.get('/', getHotels);

module.exports = router;
