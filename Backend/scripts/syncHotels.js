require('dotenv').config();

const connectDB = require('../config/db');
const HotelService = require('../services/hotelService');
const logger = require('../utils/logger');

async function run() {
  try {
    await connectDB();
    const result = await HotelService.syncHotelsForAllCities();

    logger.info('Hotel sync complete', {
      cities: result.cities,
      summary: result.summary,
    });

    console.log(JSON.stringify({
      success: true,
      cities: result.cities,
      summary: result.summary,
    }, null, 2));
    process.exit(0);
  } catch (error) {
    logger.error('Hotel sync failed', {
      message: error.message,
    });
    console.error(error);
    process.exit(1);
  }
}

run();
