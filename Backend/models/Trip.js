const mongoose = require('mongoose');

const savedPlaceSchema = new mongoose.Schema(
  {
    place_id: String,
    name: String,
    lat: Number,
    lng: Number,
    city: String,
    rating: Number,
    reviewSnippet: String,
    types: [String],
    photo_reference: String,
    photo_url: String,
    category: String,
    user_ratings_total: Number,
    ml_score: Number,
    weighted_rating: Number,
    popularity_score: Number,
    sentiment_score: Number,
    interest_match_score: Number,
    must_see_boost: Number,
    final_score: Number,
    explanation_tags: [String],
    why_recommended: [String],
    interest_match_details: {
      manual_type_match: Number,
      ml_interest_match: Number,
      keyword_match: Number,
      matched_interests: [String],
    },
    inferred_interest_tags: [String],
    intent_tags: [String],
    travel_time_from_start: String,
    travel_time_to_next: String,
    return_travel_time_to_start: String,
    time_slot: String,
    visit_duration_minutes: Number,
    locked: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const itineraryDaySchema = new mongoose.Schema(
  {
    day: Number,
    day_title: String,
    date: String,
    start_location: {
      place_id: String,
      name: String,
      lat: Number,
      lng: Number,
    },
    end_location: {
      place_id: String,
      name: String,
      lat: Number,
      lng: Number,
    },
    selected_hotel: {
      _id: String,
      place_id: String,
      name: String,
      city: String,
      address: String,
      location: {
        lat: Number,
        lng: Number,
      },
      price_per_night: Number,
      star_category: Number,
      user_rating: Number,
      total_ratings: Number,
      distance_km: Number,
      source: String,
    },
    continued_previous_stay: Boolean,
    routing_mode: String,
    customized_order: Boolean,
    opening_hours_applied: Boolean,
    center: {
      lat: Number,
      lng: Number,
    },
    route_stats: {
      stop_count: Number,
      total_travel_minutes: Number,
      total_visit_minutes: Number,
      meal_break_minutes: Number,
      total_day_minutes: Number,
      over_travel_limit: Boolean,
      over_total_limit: Boolean,
    },
    meal_suggestions: {
      type: [new mongoose.Schema(
        {
          type: String,
          highlight_label: String,
          near_stop_label: String,
          restaurant: savedPlaceSchema,
        },
        { _id: false }
      )],
      default: [],
    },
    route: {
      type: [savedPlaceSchema],
      default: [],
    },
  },
  { _id: false }
);

const recommendationSnapshotSchema = new mongoose.Schema(
  {
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    attractions: {
      type: [savedPlaceSchema],
      default: [],
    },
    masterAttractionPool: {
      type: [savedPlaceSchema],
      default: [],
    },
    replacementAttractionPool: {
      type: [savedPlaceSchema],
      default: [],
    },
    restaurants: {
      type: [savedPlaceSchema],
      default: [],
    },
    metadata: {
      ranking_mode: String,
      total_candidates: Number,
      interest_filter_applied: Boolean,
      ranking_strategy: String,
      ml_service_fallback: Boolean,
      trip_days: Number,
      city: String,
      interests: [String],
    },
  },
  { _id: false }
);

const itinerarySnapshotSchema = new mongoose.Schema(
  {
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    itinerary: {
      type: [itineraryDaySchema],
      default: [],
    },
    restaurants: {
      type: [savedPlaceSchema],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

const tripFeedbackSchema = new mongoose.Schema(
  {
    follow_score: {
      type: Number,
      min: 1,
      max: 5,
    },
    satisfaction_score: {
      type: Number,
      min: 1,
      max: 5,
    },
    hotel_score: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback_text: {
      type: String,
      trim: true,
      default: '',
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Trip must belong to a user'],
    },
    city: {
      type: String,
      required: [true, 'Please provide a city name'],
      trim: true,
    },
    days: {
      type: Number,
      required: [true, 'Please provide number of days'],
      min: [1, 'Trip must be at least 1 day'],
      max: [365, 'Trip cannot exceed 365 days'],
    },
    startDate: {
      type: Date,
    },
    interests: {
      type: [String],
      enum: [
        'adventure',
        'culture',
        'food',
        'nature',
        'history',
        'shopping',
        'nightlife',
        'beaches',
        'art',
        'sports',
      ],
      default: [],
    },
    stayPlanningMode: {
      type: String,
      enum: ['static', 'dynamic'],
      default: 'static',
    },
    hotelLocation: {
      place_id: String,
      name: String,
      lat: Number,
      lng: Number,
    },
    places: [
      {
        name: String,
        category: String,
        rating: Number,
        visitDate: Date,
        notes: String,
      },
    ],
    optimizedRoute: [
      {
        place: String,
        dayNumber: Number,
        order: Number,
        duration: Number, // in hours
      },
    ],
    recommendationSnapshot: {
      type: recommendationSnapshotSchema,
      default: null,
    },
    itinerarySnapshot: {
      type: itinerarySnapshotSchema,
      default: null,
    },
    finalizedItinerarySnapshot: {
      type: itinerarySnapshotSchema,
      default: null,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completionFeedback: {
      type: tripFeedbackSchema,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
tripSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Trip', tripSchema);
