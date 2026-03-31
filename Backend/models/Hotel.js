const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema(
  {
    place_id: {
      type: String,
      trim: true,
      sparse: true,
    },
    name: {
      type: String,
      required: [true, 'Please provide a hotel name'],
      trim: true,
    },
    name_normalized: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    city: {
      type: String,
      required: [true, 'Please provide a city'],
      lowercase: true,
      trim: true,
    },
    location: {
      lat: {
        type: Number,
        required: [true, 'Please provide latitude'],
      },
      lng: {
        type: Number,
        required: [true, 'Please provide longitude'],
      },
    },
    geo: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
    address: {
      type: String,
      trim: true,
    },
    price_per_night: {
      type: Number,
      default: null,
      min: 0,
    },
    star_category: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    user_rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    total_ratings: {
      type: Number,
      default: 0,
      min: 0,
    },
    source: {
      type: String,
      default: 'google + rapidapi',
    },
    last_updated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

hotelSchema.index({ place_id: 1 }, { unique: true, sparse: true });
hotelSchema.index({ city: 1, name_normalized: 1 }, { unique: true });
hotelSchema.index({ city: 1, price_per_night: 1, star_category: 1 });
hotelSchema.index({ geo: '2dsphere' });

module.exports = mongoose.model('Hotel', hotelSchema);
