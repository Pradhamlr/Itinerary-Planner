const { kmeans } = require('ml-kmeans');
const RecommendationService = require('./recommendationService');
const { getTravelTimes } = require('../utils/googleDistance');
const logger = require('../utils/logger');

const MAX_DAY_TRAVEL_MINUTES = Number(process.env.MAX_DAY_TRAVEL_MINUTES || 180);
const MAX_DAY_TOTAL_MINUTES = Number(process.env.MAX_DAY_TOTAL_MINUTES || 600);
const MAX_DAY_STOPS = Number(process.env.MAX_DAY_STOPS || 4);
const SOFT_DAY_TRAVEL_BUFFER_MINUTES = Number(process.env.SOFT_DAY_TRAVEL_BUFFER_MINUTES || 45);
const SOFT_DAY_TOTAL_BUFFER_MINUTES = Number(process.env.SOFT_DAY_TOTAL_BUFFER_MINUTES || 120);
const CLUSTER_STICKINESS_KM = Number(process.env.CLUSTER_STICKINESS_KM || 12);
const LUNCH_BREAK_MINUTES = 60;
const DINNER_BREAK_MINUTES = 75;

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

function formatDistanceKm(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    return null;
  }

  return distanceKm < 10
    ? `${distanceKm.toFixed(1)} km`
    : `${Math.round(distanceKm)} km`;
}

function metersToKm(distanceMeters) {
  const numeric = Number(distanceMeters);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return numeric / 1000;
}

function parseDurationToMinutes(durationText) {
  if (!durationText || typeof durationText !== 'string') {
    return 0;
  }

  const hourMatch = durationText.match(/(\d+)\s*hr/);
  const minuteMatch = durationText.match(/(\d+)\s*mins?/);
  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  return (hours * 60) + minutes;
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

function getSlotLabels(routeLength) {
  const slotLabelsByCount = {
    1: ['Morning'],
    2: ['Morning', 'Afternoon'],
    3: ['Morning', 'Afternoon', 'Evening'],
    4: ['Morning', 'Late Morning', 'Afternoon', 'Evening'],
  };

  return slotLabelsByCount[Math.min(routeLength, 4)] || [];
}

function assignTimeSlotsPreservingOrder(route, targetDate) {
  const labels = getSlotLabels(route.length);

  return route.map((place, index) => ({
    ...place,
    time_slot: labels[index] || (isPlaceOpenForSlot(place, 'Flexible', targetDate) ? 'Flexible' : 'Flexible'),
  }));
}

function estimateVisitDurationMinutes(place) {
  const types = Array.isArray(place?.types) ? place.types.map((type) => String(type).toLowerCase()) : [];

  if (types.some((type) => ['beach', 'park', 'zoo', 'aquarium', 'amusement_park', 'natural_feature'].includes(type))) {
    return 90;
  }

  if (types.some((type) => ['museum', 'historical_landmark', 'monument', 'landmark', 'tourist_attraction'].includes(type))) {
    return 75;
  }

  if (types.some((type) => ['church', 'temple', 'hindu_temple', 'mosque', 'synagogue', 'art_gallery'].includes(type))) {
    return 45;
  }

  return 60;
}

function enrichRouteWithVisitDurations(route) {
  return route.map((place) => ({
    ...place,
    visit_duration_minutes: Number(place.visit_duration_minutes || estimateVisitDurationMinutes(place)),
  }));
}

function isValidPlaceEntry(place) {
  return Boolean(
    place
    && place.place_id
    && place.name
    && Number.isFinite(Number(place.lat))
    && Number.isFinite(Number(place.lng)),
  );
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

function filterPlacesNearCenter(places, center, maxDistanceKm = CLUSTER_STICKINESS_KM) {
  if (!center || !Number.isFinite(Number(center.lat)) || !Number.isFinite(Number(center.lng))) {
    return places;
  }

  const withinBand = places.filter((place) => haversineDistance(place, center) <= maxDistanceKm);
  return withinBand.length > 0 ? withinBand : places;
}

function roundTo(value, precision = 2) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number(numericValue.toFixed(precision));
}

function dedupeByPlaceId(places) {
  const seenPlaceIds = new Set();
  return places.filter((place) => {
    if (!isValidPlaceEntry(place) || seenPlaceIds.has(place.place_id)) {
      return false;
    }

    seenPlaceIds.add(place.place_id);
    return true;
  });
}

function normalizeSavedPlace(place) {
  if (!place) {
    return place;
  }

  return {
    ...place,
    lat: Number(place.lat),
    lng: Number(place.lng),
    rating: Number.isFinite(Number(place.rating)) ? Number(place.rating) : 0,
    user_ratings_total: Number.isFinite(Number(place.user_ratings_total)) ? Number(place.user_ratings_total) : 0,
    visit_duration_minutes: Number.isFinite(Number(place.visit_duration_minutes))
      ? Number(place.visit_duration_minutes)
      : undefined,
  };
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

async function buildOrderedRouteWithTimings(route, startPoint) {
  const normalizedRoute = route.map(normalizeSavedPlace).filter(isValidPlaceEntry);
  if (normalizedRoute.length === 0) {
    return { route: [], routingMode: 'none' };
  }

  const defaultStart = getDefaultStartPoint(normalizedRoute, startPoint);
  const allNodes = isValidPoint(startPoint) ? [defaultStart, ...normalizedRoute] : [...normalizedRoute];
  const { matrix, mode } = await buildTravelTimeMatrix(allNodes);
  const nodeIndexMap = new Map(allNodes.map((node, index) => [node.place_id || `${node.lat},${node.lng}`, index]));
  const startIndex = isValidPoint(startPoint)
    ? nodeIndexMap.get(defaultStart.place_id || `${defaultStart.lat},${defaultStart.lng}`)
    : null;

  return {
    routingMode: mode,
    route: enrichRouteWithVisitDurations(normalizedRoute.map((place, index) => {
      const nextPlace = normalizedRoute[index + 1];
      const currentIndex = nodeIndexMap.get(place.place_id || `${place.lat},${place.lng}`);
      const nextIndex = nextPlace
        ? nodeIndexMap.get(nextPlace.place_id || `${nextPlace.lat},${nextPlace.lng}`)
        : null;

      return {
        ...place,
        travel_time_from_start: index === 0 && isValidPoint(startPoint)
          ? (matrix?.[startIndex]?.[currentIndex]?.durationText || formatDuration(matrix?.[startIndex]?.[currentIndex]?.durationSeconds))
          : null,
        travel_time_to_next: nextPlace
          ? (matrix?.[currentIndex]?.[nextIndex]?.durationText || formatDuration(matrix?.[currentIndex]?.[nextIndex]?.durationSeconds))
          : null,
        return_travel_time_to_start: index === normalizedRoute.length - 1 && isValidPoint(startPoint)
          ? (matrix?.[currentIndex]?.[startIndex]?.durationText || formatDuration(matrix?.[currentIndex]?.[startIndex]?.durationSeconds))
          : null,
      };
    })),
  };
}

async function buildOptimizedCustomRoute(places, startPoint, optimizationMode = 'time') {
  const normalizedPlaces = dedupeByPlaceId((places || []).map(normalizeSavedPlace).filter(isValidPlaceEntry));
  if (normalizedPlaces.length === 0) {
    return {
      route: [],
      summary: {
        optimization_mode: optimizationMode,
        routing_mode: 'none',
        total_stops: 0,
        total_travel_minutes: 0,
        total_distance_km: 0,
      },
    };
  }

  const mode = optimizationMode === 'distance' ? 'distance' : 'time';
  const defaultStart = getDefaultStartPoint(normalizedPlaces, startPoint);
  const allNodes = isValidPoint(startPoint) ? [defaultStart, ...normalizedPlaces] : [...normalizedPlaces];
  const { matrix, mode: routingMode } = await buildTravelTimeMatrix(allNodes);
  const nodeIndexMap = new Map(allNodes.map((node, index) => [node.place_id || `${node.lat},${node.lng}`, index]));

  const visited = new Set();
  const orderedStops = [];
  let current = defaultStart;

  if (!isValidPoint(startPoint) && current?.place_id) {
    visited.add(current.place_id);
    orderedStops.push(current);
  }

  while (orderedStops.length < normalizedPlaces.length) {
    let nextPoint = null;
    let bestScore = Infinity;
    const currentIndex = nodeIndexMap.get(current.place_id || `${current.lat},${current.lng}`);

    for (const point of normalizedPlaces) {
      if (visited.has(point.place_id)) {
        continue;
      }

      const pointIndex = nodeIndexMap.get(point.place_id || `${point.lat},${point.lng}`);
      const durationSeconds = matrix?.[currentIndex]?.[pointIndex]?.durationSeconds;
      const distanceKm = haversineDistance(current, point);
      const score = mode === 'distance'
        ? distanceKm
        : (Number.isFinite(durationSeconds) ? durationSeconds : estimateTravelSeconds(current, point));

      if (score < bestScore) {
        bestScore = score;
        nextPoint = point;
      }
    }

    if (!nextPoint) {
      break;
    }

    visited.add(nextPoint.place_id);
    orderedStops.push(nextPoint);
    current = nextPoint;
  }

  const startIndex = isValidPoint(startPoint)
    ? nodeIndexMap.get(defaultStart.place_id || `${defaultStart.lat},${defaultStart.lng}`)
    : null;

  let totalTravelMinutes = 0;
  let totalDistanceKm = 0;

  const route = orderedStops.map((place, index) => {
    const currentIndex = nodeIndexMap.get(place.place_id || `${place.lat},${place.lng}`);
    const previousPoint = index === 0 ? (isValidPoint(startPoint) ? defaultStart : null) : orderedStops[index - 1];
    const previousIndex = previousPoint
      ? nodeIndexMap.get(previousPoint.place_id || `${previousPoint.lat},${previousPoint.lng}`)
      : null;
    const nextPlace = orderedStops[index + 1];
    const nextIndex = nextPlace
      ? nodeIndexMap.get(nextPlace.place_id || `${nextPlace.lat},${nextPlace.lng}`)
      : null;

    const legFromPreviousSeconds = Number.isFinite(previousIndex)
      ? matrix?.[previousIndex]?.[currentIndex]?.durationSeconds
      : 0;
    const legFromPreviousMinutes = Math.round((legFromPreviousSeconds || 0) / 60);
    const legFromPreviousDistanceKm = Number.isFinite(matrix?.[previousIndex]?.[currentIndex]?.distanceMeters)
      ? metersToKm(matrix?.[previousIndex]?.[currentIndex]?.distanceMeters)
      : (previousPoint ? haversineDistance(previousPoint, place) : 0);

    totalTravelMinutes += legFromPreviousMinutes;
    totalDistanceKm += legFromPreviousDistanceKm;

    return {
      ...place,
      sequence: index + 1,
      travel_time_from_start: index === 0 && isValidPoint(startPoint)
        ? (matrix?.[startIndex]?.[currentIndex]?.durationText || formatDuration(matrix?.[startIndex]?.[currentIndex]?.durationSeconds))
        : null,
      travel_time_from_previous: previousPoint
        ? (matrix?.[previousIndex]?.[currentIndex]?.durationText || formatDuration(legFromPreviousSeconds))
        : null,
      travel_distance_from_previous_km: roundTo(legFromPreviousDistanceKm),
      travel_distance_from_previous_text: matrix?.[previousIndex]?.[currentIndex]?.distanceText || formatDistanceKm(legFromPreviousDistanceKm),
      travel_time_to_next: nextPlace
        ? (matrix?.[currentIndex]?.[nextIndex]?.durationText || formatDuration(matrix?.[currentIndex]?.[nextIndex]?.durationSeconds))
        : null,
      travel_distance_to_next_km: nextPlace
        ? roundTo(
          Number.isFinite(matrix?.[currentIndex]?.[nextIndex]?.distanceMeters)
            ? metersToKm(matrix?.[currentIndex]?.[nextIndex]?.distanceMeters)
            : haversineDistance(place, nextPlace),
        )
        : 0,
      travel_distance_to_next_text: nextPlace
        ? (matrix?.[currentIndex]?.[nextIndex]?.distanceText
          || formatDistanceKm(
            Number.isFinite(matrix?.[currentIndex]?.[nextIndex]?.distanceMeters)
              ? metersToKm(matrix?.[currentIndex]?.[nextIndex]?.distanceMeters)
              : haversineDistance(place, nextPlace),
          ))
        : null,
      visit_duration_minutes: Number(place.visit_duration_minutes || estimateVisitDurationMinutes(place)),
    };
  });

  return {
    route,
    summary: {
      optimization_mode: mode,
      routing_mode: routingMode,
      total_stops: route.length,
      total_travel_minutes: totalTravelMinutes,
      total_distance_km: roundTo(totalDistanceKm),
      start_location_enabled: Boolean(isValidPoint(startPoint)),
    },
  };
}

async function solveTSP(points, startPoint, targetDate) {
  const normalizedPoints = points.map(normalizeSavedPlace).filter(isValidPlaceEntry);

  if (normalizedPoints.length === 0) {
    return { route: [], routingMode: 'none' };
  }

  if (normalizedPoints.length === 1) {
    const singleStopRoute = {
      ...normalizedPoints[0],
      travel_time_to_next: null,
      travel_time_from_start: null,
      return_travel_time_to_start: null,
    };

    return {
      route: enrichRouteWithVisitDurations(assignTimeSlots([singleStopRoute], targetDate)),
      routingMode: isValidPoint(startPoint) ? 'google-distance-matrix' : 'rating-start',
    };
  }

  const defaultStart = getDefaultStartPoint(normalizedPoints, startPoint);
  const allNodes = isValidPoint(startPoint) ? [defaultStart, ...normalizedPoints] : [...normalizedPoints];
  const { matrix, mode } = await buildTravelTimeMatrix(allNodes);
  const nodeIndexMap = new Map(allNodes.map((node, index) => [node.place_id || `${node.lat},${node.lng}`, index]));

  const visited = new Set();
  const route = [];
  let current = defaultStart;

  if (!isValidPoint(startPoint) && current?.place_id) {
    visited.add(current.place_id);
    route.push(current);
  }

  while (route.length < normalizedPoints.length) {
    let nextPoint = null;
    let minTravelTime = Infinity;
    const currentIndex = nodeIndexMap.get(current.place_id || `${current.lat},${current.lng}`);

    for (const point of normalizedPoints) {
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
      for (const point of normalizedPoints) {
        if (visited.has(point.place_id)) {
          continue;
        }

        const fallbackTravelTime = estimateTravelSeconds(current, point);
        if (fallbackTravelTime < minTravelTime) {
          minTravelTime = fallbackTravelTime;
          nextPoint = point;
        }
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
  const startIndex = isValidPoint(startPoint)
    ? nodeIndexMap.get(defaultStart.place_id || `${defaultStart.lat},${defaultStart.lng}`)
    : null;
  const finalRoute = slotAwareRoute.map((place, index) => {
    const nextPlace = slotAwareRoute[index + 1];
    const currentIndex = nodeIndexMap.get(place.place_id || `${place.lat},${place.lng}`);
    const travelTimeFromStart = index === 0 && isValidPoint(startPoint)
      ? (matrix?.[startIndex]?.[currentIndex]?.durationText || formatDuration(matrix?.[startIndex]?.[currentIndex]?.durationSeconds))
      : null;
    const returnTravelTimeToStart = index === slotAwareRoute.length - 1 && isValidPoint(startPoint)
      ? (matrix?.[currentIndex]?.[startIndex]?.durationText || formatDuration(matrix?.[currentIndex]?.[startIndex]?.durationSeconds))
      : null;

    if (!nextPlace) {
      return {
        ...place,
        travel_time_to_next: null,
        travel_time_from_start: travelTimeFromStart,
        return_travel_time_to_start: returnTravelTimeToStart,
      };
    }

    const nextIndex = nodeIndexMap.get(nextPlace.place_id || `${nextPlace.lat},${nextPlace.lng}`);
    const travelSeconds = matrix?.[currentIndex]?.[nextIndex]?.durationSeconds;
    const travelText = matrix?.[currentIndex]?.[nextIndex]?.durationText || formatDuration(travelSeconds);

    return {
      ...place,
      travel_time_to_next: travelText,
      travel_time_from_start: travelTimeFromStart,
      return_travel_time_to_start: returnTravelTimeToStart,
    };
  });

  return {
    route: enrichRouteWithVisitDurations(finalRoute),
    routingMode: mode,
  };
}

function buildMealSuggestions(route, restaurants) {
  if (!Array.isArray(restaurants) || restaurants.length === 0 || route.length === 0) {
    return [];
  }

  const midpoint = route[Math.floor(route.length / 2)] || route[0];
  const finalStop = route[route.length - 1];
  const hasLunchWindow = route.some((place) => ['Morning', 'Late Morning', 'Afternoon'].includes(place.time_slot));
  const hasDinnerWindow = route.some((place) => ['Afternoon', 'Evening', 'Flexible'].includes(place.time_slot));
  const suggestions = [];

  if (route.length >= 2 && hasLunchWindow) {
    const lunchRestaurant = [...restaurants]
      .sort((a, b) => haversineDistance(midpoint, a) - haversineDistance(midpoint, b))[0] || null;

    if (lunchRestaurant) {
      suggestions.push({
        type: 'Lunch',
        restaurant: lunchRestaurant,
        highlight_label: 'Great for lunch',
        near_stop_label: `Near stop ${Math.floor(route.length / 2) + 1}`,
      });
    }
  }

  if (route.length >= 3 && hasDinnerWindow) {
    const usedPlaceId = suggestions[0]?.restaurant?.place_id;
    const dinnerRestaurant = [...restaurants]
      .filter((restaurant) => restaurant.place_id !== usedPlaceId)
      .sort((a, b) => haversineDistance(finalStop, a) - haversineDistance(finalStop, b))[0] || null;

    if (dinnerRestaurant) {
      suggestions.push({
        type: 'Dinner',
        restaurant: dinnerRestaurant,
        highlight_label: 'Good dinner finish',
        near_stop_label: `Near stop ${route.length}`,
      });
    }
  }

  return suggestions;
}

function buildDayStats(route, mealSuggestions) {
  const travelMinutes = route.reduce((sum, place) => (
    sum
    + parseDurationToMinutes(place.travel_time_from_start)
    + parseDurationToMinutes(place.travel_time_to_next)
    + parseDurationToMinutes(place.return_travel_time_to_start)
  ), 0);
  const visitMinutes = route.reduce((sum, place) => sum + Number(place.visit_duration_minutes || 0), 0);
  const mealBreakMinutes = mealSuggestions.reduce((sum, meal) => (
    sum + (meal.type === 'Dinner' ? DINNER_BREAK_MINUTES : LUNCH_BREAK_MINUTES)
  ), 0);
  const totalMinutes = travelMinutes + visitMinutes + mealBreakMinutes;

  return {
    stop_count: route.length,
    total_travel_minutes: travelMinutes,
    total_visit_minutes: visitMinutes,
    meal_break_minutes: mealBreakMinutes,
    total_day_minutes: totalMinutes,
    over_travel_limit: travelMinutes > MAX_DAY_TRAVEL_MINUTES,
    over_total_limit: totalMinutes > MAX_DAY_TOTAL_MINUTES,
  };
}

function trimRouteToFitDay(route, restaurants, lockedPlaceIds = new Set()) {
  let workingRoute = route.filter(isValidPlaceEntry);
  let overflow = [];
  let mealSuggestions = buildMealSuggestions(workingRoute, restaurants);
  let stats = buildDayStats(workingRoute, mealSuggestions);
  const preferredMinimumStops = Math.min(MAX_DAY_STOPS, route.length);
  let trimReason = null;

  while (
    workingRoute.length > 1
    && (
      workingRoute.length > MAX_DAY_STOPS
      || (
        workingRoute.length > preferredMinimumStops
        && (
          stats.total_travel_minutes > (MAX_DAY_TRAVEL_MINUTES + SOFT_DAY_TRAVEL_BUFFER_MINUTES)
          || stats.total_day_minutes > (MAX_DAY_TOTAL_MINUTES + SOFT_DAY_TOTAL_BUFFER_MINUTES)
        )
      )
      || (
        workingRoute.length <= preferredMinimumStops
        && (
          stats.total_travel_minutes > (MAX_DAY_TRAVEL_MINUTES * 1.5)
          || stats.total_day_minutes > (MAX_DAY_TOTAL_MINUTES * 1.35)
        )
      )
    )
  ) {
    let removalIndex = -1;

    for (let index = workingRoute.length - 1; index >= 0; index -= 1) {
      const place = workingRoute[index];
      if (!lockedPlaceIds.has(place.place_id)) {
        removalIndex = index;
        break;
      }
    }

    if (removalIndex === -1) {
      break;
    }

    if (!trimReason) {
      trimReason = workingRoute.length > MAX_DAY_STOPS
        ? 'max-stops'
        : stats.total_travel_minutes > (MAX_DAY_TRAVEL_MINUTES + SOFT_DAY_TRAVEL_BUFFER_MINUTES)
          ? 'travel-limit-soft'
          : stats.total_day_minutes > (MAX_DAY_TOTAL_MINUTES + SOFT_DAY_TOTAL_BUFFER_MINUTES)
            ? 'day-limit-soft'
            : stats.total_travel_minutes > (MAX_DAY_TRAVEL_MINUTES * 1.5)
              ? 'travel-limit-hard'
              : stats.total_day_minutes > (MAX_DAY_TOTAL_MINUTES * 1.35)
                ? 'day-limit-hard'
                : 'pacing-adjustment';
    }

    const [removedPlace] = workingRoute.splice(removalIndex, 1);
    if (removedPlace) {
      overflow = [removedPlace, ...overflow];
    }
    mealSuggestions = buildMealSuggestions(workingRoute, restaurants);
    stats = buildDayStats(workingRoute, mealSuggestions);
  }

  return {
    route: workingRoute,
    overflow,
    mealSuggestions,
    stats,
    trimReason,
  };
}

function applyLockedFlags(route, lockedPlaceIds) {
  return route.map((place) => ({
    ...place,
    locked: lockedPlaceIds.has(place.place_id),
  }));
}

function mergeLockedPlaces(route, lockedPlaces) {
  const existingIds = new Set(route.map((place) => place.place_id));
  const missingLockedPlaces = lockedPlaces.filter((place) => !existingIds.has(place.place_id));

  return [
    ...lockedPlaces.filter((place) => existingIds.has(place.place_id)).map((place) => ({
      ...route.find((routePlace) => routePlace.place_id === place.place_id),
      locked: true,
    })),
    ...missingLockedPlaces.map((place) => ({
      ...place,
      locked: true,
      travel_time_from_start: place.travel_time_from_start || null,
      travel_time_to_next: place.travel_time_to_next || null,
      return_travel_time_to_start: place.return_travel_time_to_start || null,
      visit_duration_minutes: Number(place.visit_duration_minutes || estimateVisitDurationMinutes(place)),
    })),
    ...route.filter((place) => !lockedPlaces.some((lockedPlace) => lockedPlace.place_id === place.place_id)),
  ].filter(isValidPlaceEntry);
}

function getStartLocation(trip) {
  return isValidPoint(trip.hotelLocation)
    ? {
        place_id: 'hotel-location',
        name: trip.hotelLocation.name || 'Hotel / Start location',
        lat: Number(trip.hotelLocation.lat),
        lng: Number(trip.hotelLocation.lng),
      }
    : null;
}

function buildDayTitle(dayNumber, stats) {
  const travelMinutes = Number(stats?.total_travel_minutes || 0);
  const stopCount = Number(stats?.stop_count || 0);

  let descriptor = 'Balanced Discovery';
  if (travelMinutes <= 45 && stopCount <= 3) {
    descriptor = 'Relaxed & Nearby';
  } else if (travelMinutes <= 75 && stopCount <= 4) {
    descriptor = 'Balanced Highlights';
  } else if (travelMinutes <= 120) {
    descriptor = 'Exploration Day';
  } else {
    descriptor = 'Big Adventure Day';
  }

  return `Day ${dayNumber} - ${descriptor}`;
}

function getThemeBucket(place) {
  const types = Array.isArray(place?.types) ? place.types.map((type) => String(type).toLowerCase()) : [];

  if (types.some((type) => ['church', 'temple', 'hindu_temple', 'mosque', 'synagogue'].includes(type))) {
    return 'religious';
  }
  if (types.some((type) => ['museum', 'historical_landmark', 'monument'].includes(type))) {
    return 'history';
  }
  if (types.some((type) => ['beach', 'park', 'zoo', 'aquarium', 'natural_feature', 'amusement_park'].includes(type))) {
    return 'nature';
  }
  if (types.some((type) => ['art_gallery'].includes(type))) {
    return 'art';
  }
  if (types.some((type) => ['tourist_attraction', 'landmark'].includes(type))) {
    return 'landmark';
  }

  return 'other';
}

function getExcludedPlaceIdsByDay(metadata, dayNumber) {
  const perDay = metadata?.excluded_place_ids_by_day || {};
  const dayKey = String(dayNumber);
  return new Set(Array.isArray(perDay[dayKey]) ? perDay[dayKey] : []);
}

function withExcludedPlaceIdsByDay(metadata, dayNumber, placeIds) {
  const perDay = {
    ...(metadata?.excluded_place_ids_by_day || {}),
  };
  perDay[String(dayNumber)] = [...new Set((placeIds || []).filter(Boolean))];

  return {
    ...(metadata || {}),
    excluded_place_ids_by_day: perDay,
  };
}

async function getReplacementRecommendationSource(trip) {
  const snapshot = trip?.recommendationSnapshot;
  if (snapshot?.replacementAttractionPool?.length || snapshot?.masterAttractionPool?.length) {
    return {
      source: snapshot?.replacementAttractionPool?.length
        ? 'recommendation-snapshot-replacement-pool'
        : 'recommendation-snapshot-master-pool',
      attractions: (snapshot.replacementAttractionPool || snapshot.masterAttractionPool || [])
        .map(normalizeSavedPlace)
        .filter(isValidPlaceEntry),
      restaurants: (snapshot.restaurants || []).map(normalizeSavedPlace).filter(isValidPlaceEntry),
      metadata: snapshot.metadata || {},
    };
  }

  const freshRecommendation = await RecommendationService.getRecommendationsForTrip(trip);
  return {
    source: (freshRecommendation.replacementAttractionPool || []).length > 0
      ? 'fresh-recommendation-replacement-pool'
      : 'fresh-recommendation-master-pool',
    attractions: (freshRecommendation.replacementAttractionPool || freshRecommendation.masterAttractionPool || freshRecommendation.attractions || [])
      .map(normalizeSavedPlace)
      .filter(isValidPlaceEntry),
    restaurants: (freshRecommendation.restaurants || []).map(normalizeSavedPlace).filter(isValidPlaceEntry),
    metadata: freshRecommendation.metadata || {},
  };
}

async function getFreshReplacementRecommendationSource(trip) {
  const freshRecommendation = await RecommendationService.getRecommendationsForTrip(trip);
  return {
    source: (freshRecommendation.replacementAttractionPool || []).length > 0
      ? 'fresh-recommendation-replacement-pool'
      : 'fresh-recommendation-master-pool',
    attractions: (freshRecommendation.replacementAttractionPool || freshRecommendation.masterAttractionPool || freshRecommendation.attractions || [])
      .map(normalizeSavedPlace)
      .filter(isValidPlaceEntry),
    restaurants: (freshRecommendation.restaurants || []).map(normalizeSavedPlace).filter(isValidPlaceEntry),
    metadata: freshRecommendation.metadata || {},
  };
}

async function getItineraryRecommendationSource(trip) {
  const snapshot = trip?.recommendationSnapshot;
  const snapshotAttractions = (snapshot?.attractions || [])
    .map(normalizeSavedPlace)
    .filter(isValidPlaceEntry);
  const snapshotRestaurants = (snapshot?.restaurants || [])
    .map(normalizeSavedPlace)
    .filter(isValidPlaceEntry);

  if (snapshotAttractions.length > 0) {
    return {
      source: 'recommendation-snapshot-visible-attractions',
      attractions: snapshotAttractions,
      restaurants: snapshotRestaurants,
      metadata: snapshot.metadata || {},
    };
  }

  const freshRecommendation = await RecommendationService.getRecommendationsForTrip(trip);
  return {
    source: 'fresh-recommendation-run',
    attractions: (freshRecommendation.attractions || []).map(normalizeSavedPlace).filter(isValidPlaceEntry),
    restaurants: (freshRecommendation.restaurants || []).map(normalizeSavedPlace).filter(isValidPlaceEntry),
    metadata: freshRecommendation.metadata || {},
  };
}

function getUsedMealRestaurantIds(itineraryDays = [], excludeDayNumber = null) {
  return new Set(
    (itineraryDays || [])
      .filter((day) => day.day !== excludeDayNumber)
      .flatMap((day) => day.meal_suggestions || [])
      .map((meal) => meal?.restaurant?.place_id)
      .filter(Boolean),
  );
}

function buildSwapCandidates(sourcePlaces, options) {
  const {
    occupiedPlaceIds = new Set(),
    excludedPlaceIds = new Set(),
    originalPlace,
    targetCenter,
    limit = 3,
    tripInterests = [],
  } = options;

  const originalTheme = getThemeBucket(originalPlace);
  const originalTypes = Array.isArray(originalPlace?.types) ? originalPlace.types.map((type) => String(type).toLowerCase()) : [];
  const originalPrimaryType = originalTypes[0] || String(originalPlace?.category || '').toLowerCase().replace(/\s+/g, '_');
  const originalRating = Number(originalPlace?.rating || 0);
  const baseCandidates = dedupeByPlaceId(
    sourcePlaces.filter((place) =>
      !occupiedPlaceIds.has(place.place_id)
      && !excludedPlaceIds.has(place.place_id)
      && place.place_id !== originalPlace?.place_id,
    ),
  );

  const strictCandidates = baseCandidates.filter((place) => {
    const placeTypes = Array.isArray(place?.types) ? place.types.map((type) => String(type).toLowerCase()) : [];
    const samePrimaryType = originalPrimaryType && placeTypes.includes(originalPrimaryType);
    const sameTheme = getThemeBucket(place) === originalTheme;
    const similarRating = Math.abs(Number(place.rating || 0) - originalRating) <= 0.5;
    return (samePrimaryType || sameTheme) && similarRating;
  });
  const mediumCandidates = baseCandidates.filter((place) => {
    const placeTypes = Array.isArray(place?.types) ? place.types.map((type) => String(type).toLowerCase()) : [];
    const samePrimaryType = originalPrimaryType && placeTypes.includes(originalPrimaryType);
    const sameTheme = getThemeBucket(place) === originalTheme;
    const similarRating = Math.abs(Number(place.rating || 0) - originalRating) <= 0.8;
    return samePrimaryType || sameTheme || similarRating;
  });

  const candidateSource = strictCandidates.length >= limit
    ? strictCandidates
    : mediumCandidates.length > 0
      ? mediumCandidates
      : baseCandidates;
  const popularityValues = candidateSource.map((place) => Math.log((Number(place.user_ratings_total) || 0) + 1));
  const maxPopularity = Math.max(...popularityValues, 1);
  const normalizedInterests = Array.isArray(tripInterests) ? tripInterests.map((interest) => String(interest).toLowerCase()) : [];

  return candidateSource
    .map((place) => {
      const placeTypes = Array.isArray(place?.types) ? place.types.map((type) => String(type).toLowerCase()) : [];
      const samePrimaryType = originalPrimaryType && placeTypes.includes(originalPrimaryType);
      const sameTheme = getThemeBucket(place) === originalTheme;
      const normalizedRating = Math.min(1, Math.max(0, Number(place.rating || 0) / 5));
      const popularityScore = Math.log((Number(place.user_ratings_total) || 0) + 1) / maxPopularity;
      const inferredTags = Array.isArray(place.inferred_interest_tags)
        ? place.inferred_interest_tags.map((tag) => String(tag).toLowerCase())
        : [];
      const interestOverlapCount = normalizedInterests.filter((interest) =>
        inferredTags.includes(interest) || placeTypes.includes(interest),
      ).length;
      const interestOverlap = normalizedInterests.length > 0 ? interestOverlapCount / normalizedInterests.length : 0;
      const diversityBoost = samePrimaryType ? 1 : sameTheme ? 0.7 : 0.4;
      const distanceKm = isValidPoint(targetCenter) ? haversineDistance(place, targetCenter) : 0;
      const score = (normalizedRating * 0.4)
        + (popularityScore * 0.3)
        + (interestOverlap * 0.2)
        + (diversityBoost * 0.1)
        - (Math.min(distanceKm, 20) / 120);

      let swapMatchReason = 'Strong alternative';
      if (samePrimaryType && sameTheme) {
        swapMatchReason = 'Most similar match';
      } else if (samePrimaryType) {
        swapMatchReason = 'Same kind of stop';
      } else if (sameTheme) {
        swapMatchReason = 'Similar vibe nearby';
      } else if (interestOverlap > 0) {
        swapMatchReason = 'Matches your trip vibe';
      }

      return {
        ...place,
        swap_match_reason: swapMatchReason,
        swap_score: roundTo(score, 4),
      };
    })
    .sort((first, second) => second.swap_score - first.swap_score)
    .slice(0, limit);
}

function buildSwapCandidateUniverse(sourcePlaces, options) {
  const {
    occupiedPlaceIds = new Set(),
    excludedPlaceIds = new Set(),
    originalPlace,
    targetCenter,
    tripInterests = [],
  } = options;

  return buildSwapCandidates(sourcePlaces, {
    occupiedPlaceIds,
    excludedPlaceIds,
    originalPlace,
    targetCenter,
    limit: Math.max(50, sourcePlaces.length),
    tripInterests,
  });
}

async function buildDayPlan(cluster, index, dayDate, startLocation, restaurants, lockedPlaceIds = new Set(), lockedPlaces = []) {
  const normalizedCluster = cluster.filter(isValidPlaceEntry);
  const originalCenter = getClusterCenter(normalizedCluster);
  const { route, routingMode } = await solveTSP(normalizedCluster, startLocation, dayDate);
  const {
    route: pacedRoute,
    overflow,
    mealSuggestions,
    stats,
    trimReason,
  } = trimRouteToFitDay(route, restaurants || [], lockedPlaceIds);
  const lockedFirstRoute = mergeLockedPlaces(applyLockedFlags(pacedRoute, lockedPlaceIds), lockedPlaces);
  const {
    route: finalTrimmedRoute,
    mealSuggestions: finalMealSuggestions,
    stats: finalStats,
    trimReason: finalTrimReason,
  } = trimRouteToFitDay(lockedFirstRoute, restaurants || [], lockedPlaceIds);
  const finalRoute = applyLockedFlags(finalTrimmedRoute, lockedPlaceIds);
  const finalCenter = getClusterCenter(finalRoute);
  const openingHoursApplied = finalRoute.some((place) => Array.isArray(place?.opening_hours?.periods) && place.opening_hours.periods.length > 0);
  const clusterDriftKm = normalizedCluster.length > 0 && finalRoute.length > 0
    ? haversineDistance(originalCenter, finalCenter)
    : 0;

  logger.info('Itinerary day plan built', {
    day: index + 1,
    source_cluster_size: normalizedCluster.length,
    final_route_size: finalRoute.length,
    overflow_count: overflow.length,
    trim_reason: finalTrimReason || trimReason || 'none',
    cluster_drift_km: roundTo(clusterDriftKm),
    routing_mode: routingMode,
  });

  return {
    dayPlan: {
      day: index + 1,
      day_title: buildDayTitle(index + 1, finalStats),
      date: dayDate.toISOString(),
      route: finalRoute,
      center: finalCenter,
      start_location: startLocation,
      routing_mode: routingMode,
      meal_suggestions: finalMealSuggestions,
      route_stats: finalStats,
      opening_hours_applied: openingHoursApplied,
    },
    overflow,
  };
}

class ItineraryService {
  static async generateItinerary(trip) {
    const recommendation = await getItineraryRecommendationSource(trip);
    const attractions = recommendation.attractions || [];
    const clusters = clusterAttractions(attractions, trip.days);
    const baseDate = getTripBaseDate(trip);
    const startLocation = getStartLocation(trip);
    const clusterCenters = clusters.map((cluster) => getClusterCenter(cluster));

    const itinerary = [];
    let carryForwardPlaces = [];
    const usedMealRestaurantIds = new Set();

    for (let index = 0; index < clusters.length; index += 1) {
      const clusterCenter = clusterCenters[index];
      const stickyCarryForwardPlaces = filterPlacesNearCenter(carryForwardPlaces, clusterCenter);
      const cluster = [
        ...stickyCarryForwardPlaces,
        ...clusters[index],
      ];
      const availableRestaurants = (recommendation.restaurants || []).filter(
        (restaurant) => !usedMealRestaurantIds.has(restaurant.place_id),
      );
      const dayDate = getDateForDay(baseDate, index);
      const { dayPlan, overflow } = await buildDayPlan(
        cluster,
        index,
        dayDate,
        startLocation,
        availableRestaurants.length > 0 ? availableRestaurants : (recommendation.restaurants || []),
        new Set(),
        [],
      );
      (dayPlan.meal_suggestions || []).forEach((meal) => {
        if (meal?.restaurant?.place_id) {
          usedMealRestaurantIds.add(meal.restaurant.place_id);
        }
      });
      carryForwardPlaces = [
        ...carryForwardPlaces.filter((place) => !stickyCarryForwardPlaces.some((carryPlace) => carryPlace.place_id === place.place_id)),
        ...overflow,
      ];

      itinerary.push(dayPlan);
    }

    const unscheduledPlaces = carryForwardPlaces.map((place) => ({
      place_id: place.place_id,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      rating: place.rating,
      category: place.category,
    }));

    logger.info('Itinerary pacing complete', {
      itinerary_days: itinerary.length,
      unscheduled_places: unscheduledPlaces.length,
      max_day_travel_minutes: MAX_DAY_TRAVEL_MINUTES,
      max_day_total_minutes: MAX_DAY_TOTAL_MINUTES,
      recommendation_source: recommendation.source,
    });

    return {
      itinerary,
      restaurants: recommendation.restaurants || [],
      metadata: {
        ...(recommendation.metadata || {}),
        recommendation_source: recommendation.source,
        trip_start_date: baseDate.toISOString(),
        routing_mode: itinerary[0]?.routing_mode || 'none',
        start_location_enabled: Boolean(startLocation),
        opening_hours_applied: itinerary.some((day) => day.opening_hours_applied),
        schedule_intelligence: 'time-slot + meal suggestions + opening-hours awareness + pacing controls',
        max_day_travel_minutes: MAX_DAY_TRAVEL_MINUTES,
        max_day_total_minutes: MAX_DAY_TOTAL_MINUTES,
        supports_day_regeneration: true,
        supports_locked_places: true,
        unscheduled_places: unscheduledPlaces,
      },
    };
  }

  static async regenerateDay(trip, dayNumber) {
    const parsedDayNumber = Number(dayNumber);
    const existingSnapshot = trip.itinerarySnapshot;

    if (!existingSnapshot?.itinerary?.length) {
      throw new Error('Generate a full itinerary before regenerating a day');
    }

    const targetDay = existingSnapshot.itinerary.find((day) => day.day === parsedDayNumber);
    if (!targetDay) {
      throw new Error('Requested itinerary day not found');
    }

    const recommendation = await getReplacementRecommendationSource(trip);
    const startLocation = getStartLocation(trip);
    const baseDate = getTripBaseDate(trip);
    const dayDate = targetDay.date ? new Date(targetDay.date) : getDateForDay(baseDate, parsedDayNumber - 1);
    const desiredStops = Math.max(1, targetDay.route?.length || MAX_DAY_STOPS);
    const currentDayPlaceIds = new Set((targetDay.route || []).map((place) => place.place_id).filter(Boolean));
    const lockedPlaces = (targetDay.route || []).filter((place) => place.locked && isValidPlaceEntry(place));
    const lockedPlaceIds = new Set(lockedPlaces.map((place) => place.place_id));
    const occupiedPlaceIds = new Set(
      (existingSnapshot.itinerary || [])
        .filter((day) => day.day !== parsedDayNumber)
        .flatMap((day) => day.route || [])
        .map((place) => place.place_id),
    );

    lockedPlaceIds.forEach((placeId) => occupiedPlaceIds.add(placeId));

    const targetDayCenter = targetDay.center && Number.isFinite(Number(targetDay.center.lat)) && Number.isFinite(Number(targetDay.center.lng))
      ? { lat: Number(targetDay.center.lat), lng: Number(targetDay.center.lng) }
      : getClusterCenter((targetDay.route || []).filter(isValidPlaceEntry));

    const sameDayUnlockedPlaceIds = new Set(
      (targetDay.route || [])
        .filter((place) => !place.locked)
        .map((place) => place.place_id)
        .filter(Boolean),
    );
    const excludedPlaceIds = getExcludedPlaceIdsByDay(existingSnapshot.metadata, parsedDayNumber);
    const reservedMealRestaurantIds = getUsedMealRestaurantIds(existingSnapshot.itinerary || [], parsedDayNumber);
    const availableRestaurants = (recommendation.restaurants || []).filter(
      (restaurant) => !reservedMealRestaurantIds.has(restaurant.place_id),
    );

    const baseReplacementSource = dedupeByPlaceId(
      (recommendation.attractions || []).filter((place) =>
        !occupiedPlaceIds.has(place.place_id)
        && !sameDayUnlockedPlaceIds.has(place.place_id),
      ),
    );
    const filteredReplacementSource = baseReplacementSource.filter((place) => !excludedPlaceIds.has(place.place_id));

    const stickyReplacementCandidates = filterPlacesNearCenter(
      filteredReplacementSource,
      targetDayCenter,
      CLUSTER_STICKINESS_KM,
    );

    const refillCandidates = stickyReplacementCandidates.length > 0
      ? stickyReplacementCandidates
      : filteredReplacementSource;

    const refillPlaces = refillCandidates.slice(0, Math.max(0, desiredStops - lockedPlaces.length));

    const cluster = [
      ...lockedPlaces.map((place) => ({ ...place, locked: true })),
      ...refillPlaces,
    ].filter(isValidPlaceEntry);

    const { dayPlan } = await buildDayPlan(
      cluster,
      parsedDayNumber - 1,
      dayDate,
      startLocation,
      availableRestaurants.length > 0 ? availableRestaurants : (recommendation.restaurants || []),
      lockedPlaceIds,
      lockedPlaces,
    );

    const updatedItinerary = (existingSnapshot.itinerary || []).map((day) => (
      day.day === parsedDayNumber ? dayPlan : day
    ));
    const nextExcludedPlaceIds = new Set([
      ...excludedPlaceIds,
      ...sameDayUnlockedPlaceIds,
    ]);
    const updatedMetadata = withExcludedPlaceIdsByDay(existingSnapshot.metadata, parsedDayNumber, [...nextExcludedPlaceIds]);

    logger.info('Itinerary day regenerated', {
      day: parsedDayNumber,
      recommendation_source: recommendation.source,
      regeneration_replacement_source: stickyReplacementCandidates.length > 0 ? 'sticky-master-candidates' : 'broad-master-candidates',
      locked_place_count: lockedPlaces.length,
      excluded_same_day_places: sameDayUnlockedPlaceIds.size,
      excluded_day_memory_count: nextExcludedPlaceIds.size,
      target_day_center_lat: roundTo(targetDayCenter.lat, 4),
      target_day_center_lng: roundTo(targetDayCenter.lng, 4),
      refill_candidate_count: refillCandidates.length,
      selected_refill_count: refillPlaces.length,
    });

    return {
      itinerary: updatedItinerary,
      restaurants: recommendation.restaurants || existingSnapshot.restaurants || [],
      metadata: {
        ...updatedMetadata,
        ...(recommendation.metadata || {}),
        trip_start_date: baseDate.toISOString(),
        routing_mode: updatedItinerary[0]?.routing_mode || 'none',
        start_location_enabled: Boolean(startLocation),
        opening_hours_applied: updatedItinerary.some((day) => day.opening_hours_applied),
        schedule_intelligence: 'time-slot + meal suggestions + opening-hours awareness + pacing controls',
        max_day_travel_minutes: MAX_DAY_TRAVEL_MINUTES,
        max_day_total_minutes: MAX_DAY_TOTAL_MINUTES,
        supports_day_regeneration: true,
        supports_locked_places: true,
        supports_place_swaps: true,
        recommendation_source: recommendation.source,
        regeneration_replacement_source: stickyReplacementCandidates.length > 0 ? 'sticky-master-candidates' : 'broad-master-candidates',
        excluded_same_day_places: sameDayUnlockedPlaceIds.size,
        previous_day_place_count: currentDayPlaceIds.size,
      },
    };
  }

  static async getSwapSuggestions(trip, dayNumber, placeId) {
    const parsedDayNumber = Number(dayNumber);
    const existingSnapshot = trip.itinerarySnapshot;

    if (!existingSnapshot?.itinerary?.length) {
      throw new Error('Generate a full itinerary before swapping a place');
    }

    const targetDay = existingSnapshot.itinerary.find((day) => day.day === parsedDayNumber);
    if (!targetDay) {
      throw new Error('Requested itinerary day not found');
    }

    const originalPlace = (targetDay.route || []).find((place) => place.place_id === placeId);
    if (!originalPlace) {
      throw new Error('Requested place not found in this itinerary day');
    }

    const recommendation = await getReplacementRecommendationSource(trip);
    const targetDayCenter = targetDay.center && Number.isFinite(Number(targetDay.center.lat)) && Number.isFinite(Number(targetDay.center.lng))
      ? { lat: Number(targetDay.center.lat), lng: Number(targetDay.center.lng) }
      : getClusterCenter((targetDay.route || []).filter(isValidPlaceEntry));
    const occupiedPlaceIds = new Set(
      (existingSnapshot.itinerary || [])
        .flatMap((day) => day.route || [])
        .map((place) => place.place_id),
    );
    occupiedPlaceIds.delete(placeId);
    const excludedPlaceIds = getExcludedPlaceIdsByDay(existingSnapshot.metadata, parsedDayNumber);

    let suggestions = buildSwapCandidates(recommendation.attractions || [], {
      occupiedPlaceIds,
      excludedPlaceIds,
      originalPlace,
      targetCenter: targetDayCenter,
      limit: 3,
      tripInterests: trip.interests || [],
    });

    let recommendationSource = recommendation.source;
    if (suggestions.length === 0) {
      const freshRecommendation = await getFreshReplacementRecommendationSource(trip);
      suggestions = buildSwapCandidates(freshRecommendation.attractions || [], {
        occupiedPlaceIds,
        excludedPlaceIds,
        originalPlace,
        targetCenter: targetDayCenter,
        limit: 3,
        tripInterests: trip.interests || [],
      });
      recommendationSource = `${recommendation.source}->${freshRecommendation.source}`;
    }

    logger.info('Swap suggestions prepared', {
      day: parsedDayNumber,
      place_id: placeId,
      suggestion_count: suggestions.length,
      recommendation_source: recommendationSource,
      original_place_type: originalPlace.category || originalPlace.types?.[0] || 'place',
    });

    return {
      day: parsedDayNumber,
      place: originalPlace,
      suggestions,
      metadata: {
        recommendation_source: recommendationSource,
        excluded_day_memory_count: excludedPlaceIds.size,
      },
    };
  }

  static async swapPlaceInDay(trip, dayNumber, placeId, replacementPlaceId) {
    const parsedDayNumber = Number(dayNumber);
    const existingSnapshot = trip.itinerarySnapshot;

    if (!existingSnapshot?.itinerary?.length) {
      throw new Error('Generate a full itinerary before swapping a place');
    }

    const targetDay = existingSnapshot.itinerary.find((day) => day.day === parsedDayNumber);
    if (!targetDay) {
      throw new Error('Requested itinerary day not found');
    }

    const originalPlace = (targetDay.route || []).find((place) => place.place_id === placeId);
    if (!originalPlace) {
      throw new Error('Requested place not found in this itinerary day');
    }

    if (originalPlace.locked) {
      throw new Error('Unlock this place before swapping it');
    }

    const recommendation = await getReplacementRecommendationSource(trip);
    const targetDayCenter = targetDay.center && Number.isFinite(Number(targetDay.center.lat)) && Number.isFinite(Number(targetDay.center.lng))
      ? { lat: Number(targetDay.center.lat), lng: Number(targetDay.center.lng) }
      : getClusterCenter((targetDay.route || []).filter(isValidPlaceEntry));
    const occupiedPlaceIds = new Set(
      (existingSnapshot.itinerary || [])
        .flatMap((day) => day.route || [])
        .map((place) => place.place_id),
    );
    occupiedPlaceIds.delete(placeId);
    const excludedPlaceIds = getExcludedPlaceIdsByDay(existingSnapshot.metadata, parsedDayNumber);

    let suggestionUniverse = buildSwapCandidateUniverse(recommendation.attractions || [], {
      occupiedPlaceIds,
      excludedPlaceIds,
      originalPlace,
      targetCenter: targetDayCenter,
      tripInterests: trip.interests || [],
    });

    let recommendationSource = recommendation.source;
    if (suggestionUniverse.length === 0) {
      const freshRecommendation = await getFreshReplacementRecommendationSource(trip);
      suggestionUniverse = buildSwapCandidateUniverse(freshRecommendation.attractions || [], {
        occupiedPlaceIds,
        excludedPlaceIds,
        originalPlace,
        targetCenter: targetDayCenter,
        tripInterests: trip.interests || [],
      });
      recommendationSource = `${recommendation.source}->${freshRecommendation.source}`;
    }

    const replacement = suggestionUniverse.find((place) => place.place_id === replacementPlaceId);
    if (!replacement) {
      throw new Error('Requested replacement is no longer available');
    }

    const reorderedRoute = (targetDay.route || []).map((place) => (
      place.place_id === placeId
        ? { ...replacement, locked: false }
        : place
    ));

    const recalculated = await this.recalculateDayOrder(trip, parsedDayNumber, reorderedRoute);
    const recalculatedDay = (recalculated.itinerary || []).find((day) => day.day === parsedDayNumber);
    const expectedRouteCount = (targetDay.route || []).length;
    let finalizedRecalculated = recalculated;

    if ((recalculatedDay?.route || []).length < expectedRouteCount) {
      const startLocation = getStartLocation(trip);
      const baseDate = getTripBaseDate(trip);
      const dayDate = targetDay.date ? new Date(targetDay.date) : getDateForDay(baseDate, parsedDayNumber - 1);
      const normalizedFallbackRoute = dedupeByPlaceId(
        reorderedRoute.map(normalizeSavedPlace).filter(isValidPlaceEntry),
      );
      const lockedPlaceIds = new Set(
        normalizedFallbackRoute.filter((place) => place.locked).map((place) => place.place_id),
      );
      const preservedRoute = applyLockedFlags(
        assignTimeSlotsPreservingOrder(normalizedFallbackRoute, dayDate),
        lockedPlaceIds,
      );
      const preservedMealSuggestions = buildMealSuggestions(
        preservedRoute,
        recalculated.restaurants || existingSnapshot.restaurants || [],
      );
      const preservedStats = buildDayStats(preservedRoute, preservedMealSuggestions);
      const preservedDay = {
        ...targetDay,
        ...(recalculatedDay || {}),
        day: parsedDayNumber,
        day_title: buildDayTitle(parsedDayNumber, preservedStats),
        date: dayDate.toISOString(),
        route: preservedRoute,
        center: getClusterCenter(preservedRoute),
        start_location: startLocation,
        customized_order: true,
        meal_suggestions: preservedMealSuggestions,
        route_stats: preservedStats,
      };

      finalizedRecalculated = {
        ...recalculated,
        itinerary: (recalculated.itinerary || existingSnapshot.itinerary || []).map((day) => (
          day.day === parsedDayNumber ? preservedDay : day
        )),
        metadata: {
          ...(recalculated.metadata || {}),
          swap_route_preserved_count: preservedRoute.length,
          swap_route_fallback_applied: true,
        },
      };
    }

    const updatedExcludedPlaceIds = new Set([
      ...excludedPlaceIds,
      placeId,
    ]);

    return {
      ...finalizedRecalculated,
      metadata: {
        ...(finalizedRecalculated.metadata || {}),
        ...withExcludedPlaceIdsByDay(finalizedRecalculated.metadata, parsedDayNumber, [...updatedExcludedPlaceIds]),
        swapped_day: parsedDayNumber,
        swapped_out_place_id: placeId,
        swapped_in_place_id: replacementPlaceId,
        recommendation_source: recommendationSource,
      },
    };
  }

  static async recalculateDayOrder(trip, dayNumber, reorderedRoute) {
    const parsedDayNumber = Number(dayNumber);
    const existingSnapshot = trip.itinerarySnapshot;

    if (!existingSnapshot?.itinerary?.length) {
      throw new Error('Generate a full itinerary before recalculating a day');
    }

    const targetDay = existingSnapshot.itinerary.find((day) => day.day === parsedDayNumber);
    if (!targetDay) {
      throw new Error('Requested itinerary day not found');
    }

    const startLocation = getStartLocation(trip);
    const baseDate = getTripBaseDate(trip);
    const dayDate = targetDay.date ? new Date(targetDay.date) : getDateForDay(baseDate, parsedDayNumber - 1);
    const normalizedRequestedRoute = dedupeByPlaceId((reorderedRoute || []).map(normalizeSavedPlace).filter(isValidPlaceEntry));
    const lockedPlaceIds = new Set(normalizedRequestedRoute.filter((place) => place.locked).map((place) => place.place_id));
    const { route, routingMode } = await buildOrderedRouteWithTimings(normalizedRequestedRoute, startLocation);
    const effectiveRoute = route.length >= normalizedRequestedRoute.length
      ? route
      : normalizedRequestedRoute.map((place, index) => ({
        ...place,
        travel_time_from_start: index === 0 ? place.travel_time_from_start || null : null,
        travel_time_to_next: place.travel_time_to_next || null,
        return_travel_time_to_start: index === normalizedRequestedRoute.length - 1 ? place.return_travel_time_to_start || null : null,
      }));
    const orderedRoute = applyLockedFlags(assignTimeSlotsPreservingOrder(effectiveRoute, dayDate), lockedPlaceIds);
    const reservedMealRestaurantIds = getUsedMealRestaurantIds(existingSnapshot.itinerary || [], parsedDayNumber);
    const availableRestaurants = (existingSnapshot.restaurants || []).filter(
      (restaurant) => !reservedMealRestaurantIds.has(restaurant.place_id),
    );
    const mealSuggestions = buildMealSuggestions(
      orderedRoute,
      availableRestaurants.length > 0 ? availableRestaurants : (existingSnapshot.restaurants || []),
    );
    const stats = buildDayStats(orderedRoute, mealSuggestions);
    const updatedDay = {
      ...targetDay,
      day: parsedDayNumber,
      day_title: buildDayTitle(parsedDayNumber, stats),
      date: dayDate.toISOString(),
      route: orderedRoute,
      center: getClusterCenter(orderedRoute),
      start_location: startLocation,
      routing_mode: routingMode,
      customized_order: true,
      meal_suggestions: mealSuggestions,
      route_stats: stats,
      opening_hours_applied: orderedRoute.some((place) => Array.isArray(place?.opening_hours?.periods) && place.opening_hours.periods.length > 0),
    };

    const updatedItinerary = (existingSnapshot.itinerary || []).map((day) => (
      day.day === parsedDayNumber ? updatedDay : day
    ));

    return {
      itinerary: updatedItinerary,
      restaurants: existingSnapshot.restaurants || [],
      metadata: {
        ...(existingSnapshot.metadata || {}),
        trip_start_date: baseDate.toISOString(),
        routing_mode: updatedItinerary[0]?.routing_mode || 'none',
        start_location_enabled: Boolean(startLocation),
        opening_hours_applied: updatedItinerary.some((day) => day.opening_hours_applied),
        schedule_intelligence: 'time-slot + meal suggestions + opening-hours awareness + pacing controls',
        max_day_travel_minutes: MAX_DAY_TRAVEL_MINUTES,
        max_day_total_minutes: MAX_DAY_TOTAL_MINUTES,
        supports_day_regeneration: true,
        supports_locked_places: true,
        reordered_day: parsedDayNumber,
        reorder_route_preserved_count: normalizedRequestedRoute.length,
        reorder_route_result_count: orderedRoute.length,
      },
    };
  }

  static async optimizeCustomRoute({ places, startLocation, optimizationMode }) {
    return buildOptimizedCustomRoute(places, startLocation, optimizationMode);
  }
}

module.exports = ItineraryService;
