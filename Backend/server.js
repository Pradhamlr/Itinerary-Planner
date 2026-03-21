require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const tripRoutes = require('./routes/tripRoutes');
const placesRoutes = require('./routes/placesRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const itineraryRoutes = require('./routes/itineraryRoutes');
const initializePlacesDataset = require('./startup/seedPlaces');
const validateEnv = require('./config/validateEnv');
const logger = require('./utils/logger');

// Initialize Express app
const app = express();

// Async startup function
const startServer = async () => {
  try {
    validateEnv();

    // Connect to MongoDB
    await connectDB();

    // Initialize Kerala places dataset
    await initializePlacesDataset();

    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Routes
    app.get('/', (req, res) => {
      res.status(200).json({
        success: true,
        message: 'Smart Itinerary Planner API running',
        version: '1.0.0',
        phase: '3 - Google Places Integration',
        dataSource: 'Google Places API',
        dataset: 'Kerala Tourism Places',
        endpoints: {
          auth: {
            signup: 'POST /api/auth/signup',
            login: 'POST /api/auth/login',
            verifyEmail: 'POST /api/auth/verify-email',
            forgotPassword: 'POST /api/auth/forgot-password',
            verifyResetCode: 'POST /api/auth/verify-reset-code',
            resetPassword: 'POST /api/auth/reset-password',
          },
          trips: {
            create: 'POST /api/trips',
            getAll: 'GET /api/trips',
            getOne: 'GET /api/trips/:id',
            update: 'PUT /api/trips/:id',
            delete: 'DELETE /api/trips/:id',
          },
          places: {
            getAllCities: 'GET /api/places/cities',
            getCityStats: 'GET /api/places/stats/:city',
            getByRating: 'GET /api/places/rating/:city?minRating=4.0',
            getByType: 'GET /api/places/type/:city/:type',
            getByCity: 'GET /api/places/:city',
          },
          recommendations: {
            getByTrip: 'GET /api/recommendations/:tripId',
          },
          itinerary: {
            getByTrip: 'GET /api/itinerary/:tripId',
          },
        },
      });
    });

    // Register routes
    app.use('/api/auth', authRoutes);
    app.use('/api/trips', tripRoutes);
    app.use('/api/places', placesRoutes);
    app.use('/api/recommendations', recommendationRoutes);
    app.use('/api/itinerary', itineraryRoutes);

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found',
      });
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
      logger.error('Unhandled request error', {
        path: req.path,
        method: req.method,
        message: err.message,
      });
      res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
      });
    });

    // Start server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`${'='.repeat(60)}\n`);
    });
  } catch (error) {
    logger.error('Failed to start server', { message: error.message });
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = app;
