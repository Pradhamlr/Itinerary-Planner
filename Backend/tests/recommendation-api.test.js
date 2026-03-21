const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const supertest = require('supertest');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const TripService = require('../services/tripService');
const RecommendationService = require('../services/recommendationService');
const recommendationController = require('../controllers/recommendationController');

test('GET /api/recommendations/:tripId returns ranked recommendations', async () => {
  const originalGetTripById = TripService.getTripById;
  const originalGetRecommendationsForTrip = RecommendationService.getRecommendationsForTrip;
  const originalSaveRecommendationSnapshot = TripService.saveRecommendationSnapshot;

  TripService.getTripById = async () => ({
    _id: 'trip-1',
    city: 'kochi',
    interests: ['culture'],
    days: 3,
  });

  RecommendationService.getRecommendationsForTrip = async () => ({
    attractions: [{ place_id: 'a1', name: 'Mattancherry Palace' }],
    restaurants: [{ place_id: 'r1', name: 'Paragon' }],
    metadata: { ranking_mode: 'hybrid', interest_filter_applied: true },
  });

  TripService.saveRecommendationSnapshot = async () => ({});

  const app = express();
  app.get('/api/recommendations/:tripId', (req, res, next) => {
    req.user = { userId: 'user-1' };
    next();
  }, recommendationController.getRecommendationsByTrip);

  const response = await supertest(app).get('/api/recommendations/trip-1');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.attractions[0].name, 'Mattancherry Palace');
  assert.equal(response.body.metadata.trip_days, 3);

  TripService.getTripById = originalGetTripById;
  RecommendationService.getRecommendationsForTrip = originalGetRecommendationsForTrip;
  TripService.saveRecommendationSnapshot = originalSaveRecommendationSnapshot;
});
