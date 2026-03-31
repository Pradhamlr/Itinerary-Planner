const Hotel = require('../models/Hotel');

const DEFAULT_RADIUS_KM = Number(process.env.DYNAMIC_HOTEL_RADIUS_KM || 10);
const RADIUS_EXPANSION_KM = Number(process.env.DYNAMIC_HOTEL_RADIUS_EXPANSION_KM || 20);
const MAX_SUGGESTIONS_PER_DAY = Math.max(5, Math.min(Number(process.env.DYNAMIC_HOTEL_LIMIT || 6), 10));

const isFiniteCoordinate = (value) => Number.isFinite(Number(value));

const haversineDistanceKm = (first, second) => {
  const lat1 = Number(first?.lat);
  const lng1 = Number(first?.lng);
  const lat2 = Number(second?.lat);
  const lng2 = Number(second?.lng);

  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) {
    return Infinity;
  }

  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = (
    (Math.sin(dLat / 2) ** 2)
    + (Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * (Math.sin(dLng / 2) ** 2))
  );
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const roundTo = (value, precision = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Number(numeric.toFixed(precision));
};

const normalizeFilters = (filters = {}) => ({
  min_price: filters.min_price !== undefined && filters.min_price !== '' ? Number(filters.min_price) : null,
  max_price: filters.max_price !== undefined && filters.max_price !== '' ? Number(filters.max_price) : null,
  star: filters.star !== undefined && filters.star !== '' ? Number(filters.star) : null,
});

const buildDayAnchor = (day) => {
  const route = Array.isArray(day?.route) ? day.route : [];
  const startLocation = route[0] || day?.start_location || null;
  const endLocation = route[route.length - 1] || null;

  return {
    day: Number(day?.day),
    start_location: startLocation
      ? {
        place_id: startLocation.place_id,
        name: startLocation.name,
        lat: Number(startLocation.lat),
        lng: Number(startLocation.lng),
      }
      : null,
    end_location: endLocation
      ? {
        place_id: endLocation.place_id,
        name: endLocation.name,
        lat: Number(endLocation.lat),
        lng: Number(endLocation.lng),
      }
      : null,
  };
};

class DynamicHotelPlanningService {
  static async queryNearbyHotels(city, anchor, filters, radiusKm) {
    const query = {
      city: String(city || '').trim().toLowerCase(),
    };

    if (filters.star !== null && Number.isFinite(filters.star)) {
      query.star_category = { $gte: filters.star };
    }

    if (filters.min_price !== null || filters.max_price !== null) {
      query.price_per_night = {};
      if (filters.min_price !== null && Number.isFinite(filters.min_price)) {
        query.price_per_night.$gte = filters.min_price;
      }
      if (filters.max_price !== null && Number.isFinite(filters.max_price)) {
        query.price_per_night.$lte = filters.max_price;
      }
    }

    const hotels = await Hotel.find(query).lean();
    const radiusBounded = hotels
      .map((hotel) => {
        const distance_km = haversineDistanceKm(
          anchor,
          {
            lat: hotel.location?.lat,
            lng: hotel.location?.lng,
          },
        );
        return {
          ...hotel,
          distance_km,
        };
      })
      .filter((hotel) => Number.isFinite(hotel.distance_km) && hotel.distance_km <= radiusKm);

    return radiusBounded;
  }

  static rankHotels(hotels, filters) {
    const targetPrice = filters.min_price !== null && filters.max_price !== null
      ? (filters.min_price + filters.max_price) / 2
      : filters.max_price !== null
        ? filters.max_price
        : filters.min_price !== null
          ? filters.min_price
          : null;

    return [...hotels]
      .map((hotel) => {
        const priceSuitability = targetPrice && Number.isFinite(hotel.price_per_night)
          ? 1 / (1 + Math.abs(hotel.price_per_night - targetPrice))
          : Number.isFinite(hotel.price_per_night) ? 0.0002 * (10000 - Math.min(hotel.price_per_night, 10000)) : 0;

        const rankingScore = (
          (1 / (1 + hotel.distance_km)) * 0.7
          + ((Number(hotel.user_rating) || 0) / 5) * 0.2
          + priceSuitability * 0.1
        );

        return {
          ...hotel,
          ranking_score: rankingScore,
        };
      })
      .sort((left, right) => {
        if (right.ranking_score !== left.ranking_score) {
          return right.ranking_score - left.ranking_score;
        }
        if (left.distance_km !== right.distance_km) {
          return left.distance_km - right.distance_km;
        }
        return (right.user_rating || 0) - (left.user_rating || 0);
      })
      .slice(0, MAX_SUGGESTIONS_PER_DAY)
      .map((hotel) => ({
        _id: hotel._id,
        place_id: hotel.place_id,
        name: hotel.name,
        city: hotel.city,
        address: hotel.address,
        location: hotel.location,
        price_per_night: hotel.price_per_night,
        star_category: hotel.star_category,
        user_rating: hotel.user_rating,
        total_ratings: hotel.total_ratings,
        distance_km: roundTo(hotel.distance_km),
        source: hotel.source,
      }));
  }

  static async getSuggestionsForAnchor(city, anchor, filters) {
    const primaryHotels = await this.queryNearbyHotels(city, anchor, filters, DEFAULT_RADIUS_KM);
    if (primaryHotels.length > 0) {
      return {
        search_radius_km: DEFAULT_RADIUS_KM,
        suggested_hotels: this.rankHotels(primaryHotels, filters),
      };
    }

    const expandedHotels = await this.queryNearbyHotels(city, anchor, filters, RADIUS_EXPANSION_KM);
    return {
      search_radius_km: RADIUS_EXPANSION_KM,
      suggested_hotels: this.rankHotels(expandedHotels, filters),
    };
  }

  static async buildDynamicHotelPlan(trip, filters = {}, options = {}) {
    const snapshot = trip.finalizedItinerarySnapshot || trip.itinerarySnapshot;
    const itineraryDays = Array.isArray(snapshot?.itinerary) ? snapshot.itinerary : [];
    if (itineraryDays.length === 0) {
      throw new Error('Generate an itinerary before requesting dynamic hotel planning');
    }

    const normalizedFilters = normalizeFilters(filters);
    const skipLastDay = String(options.skip_last_day || 'false').toLowerCase() === 'true';
    const relevantDays = skipLastDay ? itineraryDays.slice(0, -1) : itineraryDays;

    const dynamic_hotels = [];
    for (const day of relevantDays) {
      const context = buildDayAnchor(day);
      if (!context.end_location || !isFiniteCoordinate(context.end_location.lat) || !isFiniteCoordinate(context.end_location.lng)) {
        dynamic_hotels.push({
          day: context.day,
          start_location: context.start_location,
          end_location: context.end_location,
          continue_previous_available: context.day > 1,
          search_radius_km: 0,
          suggested_hotels: [],
        });
        continue;
      }

      const suggestions = await this.getSuggestionsForAnchor(trip.city, context.end_location, normalizedFilters);
      dynamic_hotels.push({
        day: context.day,
        start_location: context.start_location,
        end_location: context.end_location,
        continue_previous_available: context.day > 1,
        search_radius_km: suggestions.search_radius_km,
        suggested_hotels: suggestions.suggested_hotels,
      });
    }

    return {
      trip_id: trip._id,
      city: trip.city,
      planning_mode: 'dynamic',
      dynamic_hotels,
      metadata: {
        filters: normalizedFilters,
        skip_last_day: skipLastDay,
        suggestion_limit: MAX_SUGGESTIONS_PER_DAY,
        base_radius_km: DEFAULT_RADIUS_KM,
        expanded_radius_km: RADIUS_EXPANSION_KM,
      },
    };
  }
}

module.exports = DynamicHotelPlanningService;
