const { seedKeralaPlaces } = require('../services/keralaPlacesSeeder');

/**
 * Initialize places dataset on server startup
 */
const initializePlacesDataset = async () => {
  try {
    await seedKeralaPlaces();
  } catch (error) {
    console.error('Failed to initialize places dataset:', error.message);
    // Don't crash the server, just log the error
  }
};

module.exports = initializePlacesDataset;
