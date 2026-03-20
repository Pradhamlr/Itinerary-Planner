const { kmeans } = require('ml-kmeans');
const RecommendationService = require('./recommendationService');
const { getTravelTimes } = require('../utils/googleDistance');
const logger = require('../utils/logger');

function haversineDistance(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;

  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const c = sinLat * sinLat
    + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  const d = 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));

  return R * d;
}

function estimateTravelSeconds(a, b) {
  const distanceKm = haversineDistance(a, b);
  const assumedCitySpeedKmPerHour = 24;
  return Math.max(300, Math.round((distanceKm / assumedCitySpeedKmPerHour) * 3600));
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  const roundedMinutes = Math.max(1, Math.round(seconds / 60));
  if (roundedMinutes < 60) {
    return `${roundedMinutes} mins`;
  }

  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return minutes > 0 ? `${hours} hr ${minutes} mins` : `${hours} hr`;
}

function getTripBaseDate(trip) {
  const candidate = trip?.startDate ? new Date(trip.startDate) : null;
  if (candidate && !Number.isNaN(candidate.getTime())) {
    return candidate;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getDateForDay(baseDate, dayIndex) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(baseDate.getDate() + dayIndex);
  return nextDate;
}

function getGoogleWeekday(date) {
  return date.getDay();
}

const SLOT_WINDOWS = {
  Morning: { start: 9 * 60, end: 12 * 60 },
  'Late Morning': { start: 11 * 60, end: 14 * 60 },
  Afternoon: { start: 13 * 60, end: 17 * 60 },
  Evening: { start: 17 * 60, end: 21 * 60 },
  Flexible: { start: 9 * 60, end: 21 * 60 },
};

function parseGoogleTime(value) {
  if (!value || String(value).length !== 4) {
    return null;
  }

  const hours = Number(String(value).slice(0, 2));
  const minutes = Number(String(value).slice(2, 4));

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return (hours * 60) + minutes;
}

function isPlaceOpenForSlot(place, slotLabel, targetDate) {
  const periods = place?.opening_hours?.periods || [];
  if (!Array.isArray(periods) || periods.length === 0) {
    return true;
  }

  const slotWindow = SLOT_WINDOWS[slotLabel] || SLOT_WINDOWS.Flexible;
  const targetWeekday = getGoogleWeekday(targetDate);
  return periods.some((period) => {
    const openTime = parseGoogleTime(period?.open?.time);
    const closeTime = parseGoogleTime(period?.close?.time);
    const openDay = Number(period?.open?.day);
    const closeDay = Number(period?.close?.day);

    if (!Number.isFinite(openTime) || !Number.isFinite(openDay)) {
      return false;
    }

    const effectiveCloseTime = Number.isFinite(closeTime)
      ? (closeTime <= openTime ? closeTime + (24 * 60) : closeTime)
      : 24 * 60;
    const spansOvernight = Number.isFinite(closeTime) && closeTime <= openTime;

    const slotStart = slotWindow.start;
    const slotEnd = slotWindow.end;
    const sameDayMatch = openDay === targetWeekday
      && openTime <= slotEnd
      && effectiveCloseTime >= slotStart;

    const overnightMatch = spansOvernight
      && Number.isFinite(closeDay)
      && closeDay === targetWeekday
      && effectiveCloseTime >= (24 * 60) + slotStart
      && openDay !== targetWeekday;

    return sameDayMatch || overnightMatch;
  });
}

function assignTimeSlots(route, targetDate) {
  const slotLabelsByCount = {
    1: ['Morning'],
    2: ['Morning', 'Afternoon'],
    3: ['Morning', 'Afternoon', 'Evening'],
    4: ['Morning', 'Late Morning', 'Afternoon', 'Evening'],
  };

  const labels = slotLabelsByCount[Math.min(route.length, 4)] || [];
  const remaining = [...route];
  const scheduled = [];

  labels.forEach((label) => {
    if (remaining.length === 0) {
      return;
    }

    const matchIndex = remaining.findIndex((place) => isPlaceOpenForSlot(place, label, targetDate));
    const chosenIndex = matchIndex >= 0 ? matchIndex : 0;
    const [chosen] = remaining.splice(chosenIndex, 1);
    scheduled.push({
      ...chosen,
      time_slot: label,
    });
  });

  return [
    ...scheduled,
    ...remaining.map((place) => ({
      ...place,
      time_slot: 'Flexible',
    })),
  ];
}

function getClusterCenter(cluster) {
  if (cluster.length === 0) {
    return { lat: 0, lng: 0 };
  }

  const totals = cluster.reduce(
    (accumulator, place) => ({
      lat: accumulator.lat + Number(place.lat || 0),
      lng: accumulator.lng + Number(place.lng || 0),
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: totals.lat / cluster.length,
    lng: totals.lng / cluster.length,
  };
}

function rebalanceClusters(clusters, placesPerDay) {
  const balanced = clusters.map((cluster) => [...cluster]);

  let changed = true;
  while (changed) {
    changed = false;

    const largestIndex = balanced.reduce(
      (bestIndex, cluster, index, items) => (cluster.length > items[bestIndex].length ? index : bestIndex),
      0,
    );
    const smallestIndex = balanced.reduce(
      (bestIndex, cluster, index, items) => (cluster.length < items[bestIndex].length ? index : bestIndex),
      0,
    );

    const largestCluster = balanced[largestIndex];
    const smallestCluster = balanced[smallestIndex];

    if (!largestCluster || !smallestCluster) {
      break;
    }

    if (largestCluster.length <= placesPerDay || largestCluster.length - smallestCluster.length <= 1) {
      break;
    }

    const smallestCenter = getClusterCenter(smallestCluster);
    let farthestIndex = 0;
    let farthestDistance = -1;

    largestCluster.forEach((place, index) => {
      const distance = haversineDistance(place, smallestCenter);
      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthestIndex = index;
      }
    });

    const [movedPlace] = largestCluster.splice(farthestIndex, 1);
    if (movedPlace) {
      smallestCluster.push(movedPlace);
      changed = true;
    }
  }

  return balanced;
}

function clusterAttractions(attractions, days) {
  if (attractions.length === 0) {
    return [];
  }

  const clusterCount = Math.max(1, Math.min(days, attractions.length));
  const placesPerDay = Math.ceil(attractions.length / clusterCount);
  const coordinates = attractions.map((place) => [place.lat, place.lng]);
  const result = kmeans(coordinates, clusterCount);

  const clusters = Array.from({ length: clusterCount }, () => []);

  attractions.forEach((place, index) => {
    const clusterId = result.clusters[index];
    clusters[clusterId].push(place);
  });

  return rebalanceClusters(clusters, placesPerDay)
    .filter((cluster) => cluster.length > 0);
}

function isValidPoint(point) {
  return Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng));
}

function getDefaultStartPoint(points, startPoint) {
  if (isValidPoint(startPoint)) {
    return {
      place_id: startPoint.place_id || 'trip-start',
      name: startPoint.name || 'Trip start',
      lat: Number(startPoint.lat),
      lng: Number(startPoint.lng),
      isStartLocation: true,
    };
  }

  const highestRated = [...points].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))[0];
  return highestRated || null;
}

async function buildTravelTimeMatrix(nodes) {
  try {
    const matrix = await getTravelTimes(nodes, nodes);
    if (matrix) {
      return { matrix, mode: 'google-distance-matrix' };
    }
  } catch (error) {
    logger.warn('Distance Matrix fallback active', { message: error.message });
  }

  const fallbackMatrix = nodes.map((origin) =>
    nodes.map((destination) => ({
      durationSeconds: origin === destination ? 0 : estimateTravelSeconds(origin, destination),
      durationText: origin === destination ? '0 mins' : formatDuration(estimateTravelSeconds(origin, destination)),
      distanceMeters: null,
      distanceText: null,
    })));

  return { matrix: fallbackMatrix, mode: 'haversine-fallback' };
}

async function solveTSP(points, startPoint, targetDate) {
  if (points.length === 0) {
    return { route: [], routingMode: 'none' };
  }

  if (points.length === 1) {
    return {
      route: assignTimeSlots([{ ...points[0], travel_time_to_next: null }], targetDate),
      routingMode: isValidPoint(startPoint) ? 'google-distance-matrix' : 'rating-start',
    };
  }

  const defaultStart = getDefaultStartPoint(points, startPoint);
  const allNodes = isValidPoint(startPoint) ? [defaultStart, ...points] : [...points];
  const { matrix, mode } = await buildTravelTimeMatrix(allNodes);
  const nodeIndexMap = new Map(allNodes.map((node, index) => [node.place_id || `${node.lat},${node.lng}`, index]));

  const visited = new Set();
  const route = [];
  let current = defaultStart;

  if (!isValidPoint(startPoint) && current?.place_id) {
    visited.add(current.place_id);
    route.push(current);
  }

  while (route.length < points.length) {
    let nextPoint = null;
    let minTravelTime = Infinity;
    const currentIndex = nodeIndexMap.get(current.place_id || `${current.lat},${current.lng}`);

    for (const point of points) {
      if (visited.has(point.place_id)) {
        continue;
      }

      const pointIndex = nodeIndexMap.get(point.place_id || `${point.lat},${point.lng}`);
      const durationSeconds = matrix?.[currentIndex]?.[pointIndex]?.durationSeconds;

      if (Number.isFinite(durationSeconds) && durationSeconds < minTravelTime) {
        minTravelTime = durationSeconds;
        nextPoint = point;
      }
    }

    if (!nextPoint) {
      break;
    }

    visited.add(nextPoint.place_id);
    route.push(nextPoint);
    current = nextPoint;
  }

  const enrichedRoute = route.map((place, index) => {
    const nextPlace = route[index + 1];
    if (!nextPlace) {
      return {
        ...place,
        travel_time_to_next: null,
      };
    }

    const currentIndex = nodeIndexMap.get(place.place_id || `${place.lat},${place.lng}`);
    const nextIndex = nodeIndexMap.get(nextPlace.place_id || `${nextPlace.lat},${nextPlace.lng}`);
    const travelSeconds = matrix?.[currentIndex]?.[nextIndex]?.durationSeconds;
    const travelText = matrix?.[currentIndex]?.[nextIndex]?.durationText || formatDuration(travelSeconds);

    return {
      ...place,
      travel_time_to_next: travelText,
    };
  });

  const slotAwareRoute = assignTimeSlots(enrichedRoute, targetDate);
  const finalRoute = slotAwareRoute.map((place, index) => {
    const nextPlace = slotAwareRoute[index + 1];
    if (!nextPlace) {
      return {
        ...place,
        travel_time_to_next: null,
      };
    }

    const currentIndex = nodeIndexMap.get(place.place_id || `${place.lat},${place.lng}`);
    const nextIndex = nodeIndexMap.get(nextPlace.place_id || `${nextPlace.lat},${nextPlace.lng}`);
    const travelSeconds = matrix?.[currentIndex]?.[nextIndex]?.durationSeconds;
    const travelText = matrix?.[currentIndex]?.[nextIndex]?.durationText || formatDuration(travelSeconds);

    return {
      ...place,
      travel_time_to_next: travelText,
    };
  });

  return {
    route: finalRoute,
    routingMode: mode,
  };
}

function buildMealSuggestions(route, restaurants) {
  if (!Array.isArray(restaurants) || restaurants.length === 0 || route.length === 0) {
    return [];
  }

  const midpoint = route[Math.floor(route.length / 2)] || route[0];
  const finalStop = route[route.length - 1];
  const sortedByLunchDistance = [...restaurants]
    .sort((a, b) => haversineDistance(midpoint, a) - haversineDistance(midpoint, b));
  const lunchRestaurant = sortedByLunchDistance[0] || null;

  const sortedByDinnerDistance = [...restaurants]
    .filter((restaurant) => restaurant.place_id !== lunchRestaurant?.place_id)
    .sort((a, b) => haversineDistance(finalStop, a) - haversineDistance(finalStop, b));
  const dinnerRestaurant = sortedByDinnerDistance[0] || null;

  return [
    lunchRestaurant ? { type: 'Lunch', restaurant: lunchRestaurant } : null,
    dinnerRestaurant ? { type: 'Dinner', restaurant: dinnerRestaurant } : null,
  ].filter(Boolean);
}

class ItineraryService {
  static async generateItinerary(trip) {
    const recommendation = await RecommendationService.getRecommendationsForTrip(trip);
    const attractions = recommendation.attractions || [];
    const clusters = clusterAttractions(attractions, trip.days);
    const baseDate = getTripBaseDate(trip);
    const startLocation = isValidPoint(trip.hotelLocation)
      ? {
          place_id: 'hotel-location',
          name: trip.hotelLocation.name || 'Hotel / Start location',
          lat: Number(trip.hotelLocation.lat),
          lng: Number(trip.hotelLocation.lng),
        }
      : null;

    const itinerary = await Promise.all(clusters.map(async (cluster, index) => {
      const dayDate = getDateForDay(baseDate, index);
      const { route, routingMode } = await solveTSP(cluster, startLocation, dayDate);
      const openingHoursApplied = route.some((place) => Array.isArray(place?.opening_hours?.periods) && place.opening_hours.periods.length > 0);
      return {
        day: index + 1,
        date: dayDate.toISOString(),
        route,
        center: getClusterCenter(cluster),
        start_location: startLocation,
        routing_mode: routingMode,
        meal_suggestions: buildMealSuggestions(route, recommendation.restaurants || []),
        opening_hours_applied: openingHoursApplied,
      };
    }));

    return {
      itinerary,
      restaurants: recommendation.restaurants || [],
      metadata: {
        ...(recommendation.metadata || {}),
        trip_start_date: baseDate.toISOString(),
        routing_mode: itinerary[0]?.routing_mode || 'none',
        start_location_enabled: Boolean(startLocation),
        opening_hours_applied: itinerary.some((day) => day.opening_hours_applied),
        schedule_intelligence: 'time-slot + meal suggestions + opening-hours awareness',
      },
    };
  }
}

module.exports = ItineraryService;
