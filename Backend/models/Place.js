const mongoose = require('mongoose');

const placeSchema = new mongoose.Schema(
  {
    place_id: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, 'Please provide a place name'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'Please provide a city'],
      lowercase: true,
      trim: true,
    },
    lat: {
      type: Number,
      required: [true, 'Please provide latitude'],
    },
    lng: {
      type: Number,
      required: [true, 'Please provide longitude'],
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
    },
    user_ratings_total: {
      type: Number,
      default: 0,
    },
    types: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      trim: true,
    },
    reviews: {
      type: [{
        author_name: String,
        rating: Number,
        text: String,
        time: Number,
      }],
      default: [],
    },
    opening_hours: {
      open_now: Boolean,
      weekday_text: {
        type: [String],
        default: [],
      },
      periods: {
        type: [{
          open: {
            day: Number,
            time: String,
          },
          close: {
            day: Number,
            time: String,
          },
        }],
        default: [],
      },
    },
    source: {
      type: String,
      default: 'google',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
placeSchema.index({ city: 1 });
placeSchema.index({ place_id: 1 });
placeSchema.index({ types: 1 });

module.exports = mongoose.model('Place', placeSchema);
