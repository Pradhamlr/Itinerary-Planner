const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const supertest = require('supertest');

const TripService = require('../services/tripService');
const ItineraryService = require('../services/itineraryService');
const itineraryController = require('../controllers/itineraryController');

test('GET /api/itinerary/:tripId returns itinerary payload with metadata', async () => {
  const originalGetTripById = TripService.getTripById;
  const originalGenerateItinerary = ItineraryService.generateItinerary;
  const originalSaveItinerarySnapshot = TripService.saveItinerarySnapshot;

  TripService.getTripById = async () => ({
    _id: 'trip-2',
    city: 'kochi',
    interests: ['beaches'],
    days: 2,
  });

  ItineraryService.generateItinerary = async () => ({
    itinerary: [
      {
        day: 1,
        center: { lat: 9.96, lng: 76.24 },
        route: [{ place_id: 'a1', name: 'Fort Kochi Beach' }],
      },
    ],
    restaurants: [{ place_id: 'r1', name: 'Paragon' }],
    metadata: { ranking_mode: 'hybrid' },
  });

  TripService.saveItinerarySnapshot = async () => ({});

  const app = express();
  app.get('/api/itinerary/:tripId', (req, res, next) => {
    req.user = { userId: 'user-1' };
    next();
  }, itineraryController.getItinerary);

  const response = await supertest(app).get('/api/itinerary/trip-2');

  assert.equal(response.status, 200);
  assert.equal(response.body.itinerary[0].route[0].name, 'Fort Kochi Beach');
  assert.equal(response.body.metadata.trip_days, 2);
  assert.equal(response.body.metadata.city, 'kochi');

  TripService.getTripById = originalGetTripById;
  ItineraryService.generateItinerary = originalGenerateItinerary;
  TripService.saveItinerarySnapshot = originalSaveItinerarySnapshot;
});
