require('dotenv').config();

const connectDB = require('../config/db');
const HotelService = require('../services/hotelService');
const logger = require('../utils/logger');

async function run() {
  try {
    await connectDB();
    const summary = await HotelService.enrichExistingHotels();

    logger.info('Hotel heuristic backfill complete', summary);
    console.log(JSON.stringify({
      success: true,
      summary,
    }, null, 2));
    process.exit(0);
  } catch (error) {
    logger.error('Hotel heuristic backfill failed', {
      message: error.message,
    });
    console.error(error);
    process.exit(1);
  }
}

run();
