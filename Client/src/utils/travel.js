export const INTEREST_OPTIONS = [
  { value: 'history', label: 'History', accent: 'bg-[#dfe8f7] text-[#264778]' },
  { value: 'nature', label: 'Nature', accent: 'bg-[#d9f4f2] text-[#00504c]' },
  { value: 'culture', label: 'Culture', accent: 'bg-[#e7ebf1] text-[#405f91]' },
  { value: 'food', label: 'Food', accent: 'bg-[#def7f7] text-[#00696b]' },
  { value: 'shopping', label: 'Shopping', accent: 'bg-[#edf0f2] text-[#43474e]' },
  { value: 'art', label: 'Art', accent: 'bg-[#e9eefb] text-[#264778]' },
  { value: 'beaches', label: 'Beaches', accent: 'bg-[#dcf7f7] text-[#00696b]' },
];

export const getInterestMeta = (interest) =>
  INTEREST_OPTIONS.find((option) => option.value === interest) || {
    value: interest,
    label: interest,
    accent: 'bg-[#e7e8e9] text-[#191c1d]',
  };

const buildCommonsImageUrl = (fileName, width = 1400) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=${width}`;

export const HERO_EDITORIAL_IMAGES = {
  dashboard: {
    url: buildCommonsImageUrl('Sailboat Sunset (16135892578).jpg', 1600),
    position: 'center',
  },
  createTrip: {
    url: buildCommonsImageUrl('Mountain landscape (52340856545).jpg', 1600),
    position: 'center',
  },
};

const CITY_HERO_IMAGES = {
  kochi: {
    url: buildCommonsImageUrl('Kochi Skyline.jpg'),
    position: 'center',
  },
  cochin: {
    url: buildCommonsImageUrl('Kochi Skyline.jpg'),
    position: 'center',
  },
  thiruvananthapuram: {
    url: buildCommonsImageUrl('Kovalam beach(1).jpg'),
    position: 'center',
  },
  trivandrum: {
    url: buildCommonsImageUrl('Kovalam beach(1).jpg'),
    position: 'center',
  },
  thrissur: {
    url: buildCommonsImageUrl('Thrissur Pooram 2011 DSCN3042.JPG'),
    position: 'center',
  },
  kozhikode: {
    url: buildCommonsImageUrl('Kozhikode Beach 01517.JPG'),
    position: 'center',
  },
  calicut: {
    url: buildCommonsImageUrl('Kozhikode Beach 01517.JPG'),
    position: 'center',
  },
  alappuzha: {
    url: buildCommonsImageUrl('Alappuzha beach in Kerala (1).jpg'),
    position: 'center',
  },
  alleppey: {
    url: buildCommonsImageUrl('Alappuzha beach in Kerala (1).jpg'),
    position: 'center',
  },
  kannur: {
    url: buildCommonsImageUrl('Kannur fort.jpg'),
    position: 'center',
  },
  cannanore: {
    url: buildCommonsImageUrl('Kannur fort.jpg'),
    position: 'center',
  },
  wayanad: {
    url: buildCommonsImageUrl('Tea plantation at Wayanad.jpg'),
    position: 'center',
  },
  munnar: {
    url: buildCommonsImageUrl('Tea Gardens at Munnar.jpg'),
    position: 'center',
  },
};

export const getCityHeroImage = (city) => {
  const normalized = String(city || '').trim().toLowerCase();
  return CITY_HERO_IMAGES[normalized] || null;
};

export const getCityGradient = (seed = '') => {
  const gradients = [
    'from-[#000514] via-[#001e43] to-[#00345f]',
    'from-[#001120] via-[#001e43] to-[#00696b]',
    'from-[#0c1f33] via-[#1d3f63] to-[#00696b]',
    'from-[#00182f] via-[#00294a] to-[#0d9488]',
    'from-[#101c31] via-[#23456f] to-[#006e70]',
  ];

  const normalized = String(seed).trim().toLowerCase();
  const hash = [...normalized].reduce((total, char) => total + char.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
};

export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export const formatCategory = (category) =>
  String(category || 'place')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const formatCityName = (city) =>
  String(city || '')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const getPrimaryPlaceType = (place) => {
  if (place.category) {
    return String(place.category).replace(/\s+/g, '_').toLowerCase();
  }

  if (!place.types || place.types.length === 0) {
    return 'place';
  }

  const relevantTypes = [
    'tourist_attraction',
    'museum',
    'park',
    'beach',
    'church',
    'hindu_temple',
    'restaurant',
    'art_gallery',
    'zoo',
    'campground',
    'shopping_mall',
  ];

  return place.types.find((type) => relevantTypes.includes(type)) || place.types[0];
};

export const getPlaceTypeTheme = (type) => {
  const themes = {
    tourist_attraction: 'bg-[#dfe8f7] text-[#264778]',
    museum: 'bg-[#e7ebf1] text-[#405f91]',
    park: 'bg-[#d9f4f2] text-[#00504c]',
    beach: 'bg-[#dcf7f7] text-[#00696b]',
    church: 'bg-[#edf0f2] text-[#43474e]',
    hindu_temple: 'bg-[#e7ebf1] text-[#264778]',
    restaurant: 'bg-[#def7f7] text-[#00696b]',
    art_gallery: 'bg-[#e9eefb] text-[#264778]',
    zoo: 'bg-[#dff1ef] text-[#00504c]',
    campground: 'bg-[#d9f4f2] text-[#00504c]',
    shopping_mall: 'bg-[#edf0f2] text-[#43474e]',
    place: 'bg-[#e7e8e9] text-[#191c1d]',
  };

  return themes[type] || themes.place;
};

export const getPlaceVisual = (place) => {
  const type = getPrimaryPlaceType(place);
  const visuals = {
    tourist_attraction: { icon: 'Compass', gradient: 'from-[#001120] to-[#001e43]' },
    museum: { icon: 'Gallery', gradient: 'from-[#0c1f33] to-[#23456f]' },
    park: { icon: 'Forest', gradient: 'from-[#00504c] to-[#0d9488]' },
    beach: { icon: 'Coast', gradient: 'from-[#00696b] to-[#56f5f8]' },
    church: { icon: 'Heritage', gradient: 'from-[#23456f] to-[#405f91]' },
    hindu_temple: { icon: 'Temple', gradient: 'from-[#264778] to-[#001e43]' },
    restaurant: { icon: 'Cuisine', gradient: 'from-[#00696b] to-[#0d9488]' },
    art_gallery: { icon: 'Studio', gradient: 'from-[#405f91] to-[#264778]' },
    zoo: { icon: 'Safari', gradient: 'from-[#00504c] to-[#00696b]' },
    shopping_mall: { icon: 'Market', gradient: 'from-[#43474e] to-[#001e43]' },
  };

  return visuals[type] || { icon: 'Explore', gradient: 'from-[#001e43] to-[#191c1d]' };
};

export const getStarFillLevels = (rating) => {
  const numericRating = Math.max(0, Math.min(5, Number(rating || 0)));

  return Array.from({ length: 5 }, (_, index) => {
    const fill = Math.max(0, Math.min(1, numericRating - index));
    return Number((fill * 100).toFixed(1));
  });
};

export const getWhyThisPlaceText = (place) => {
  const whyRecommended = Array.isArray(place?.why_recommended) ? place.why_recommended.filter(Boolean) : [];
  if (whyRecommended.length > 0) {
    return whyRecommended[0];
  }

  const explanationTags = Array.isArray(place?.explanation_tags) ? place.explanation_tags.filter(Boolean) : [];
  if (explanationTags.length > 0) {
    return `Chosen because it matches ${explanationTags[0].toLowerCase()}.`;
  }

  const inferredTags = Array.isArray(place?.inferred_interest_tags) ? place.inferred_interest_tags.filter(Boolean) : [];
  if (inferredTags.length > 0) {
    return `Good fit for ${formatCategory(inferredTags[0]).toLowerCase()} interests.`;
  }

  const category = formatCategory(place?.category || place?.types?.[0] || 'your trip style');
  return `Included as a strong ${category.toLowerCase()} option for this itinerary.`;
};

export const getPlaceInsightBadges = (place) => {
  const badges = [];
  const rating = Number(place?.rating || place?.user_rating || 0);
  const pricePerNight = Number(place?.price_per_night);
  const distanceKm = Number(place?.distance_km);

  if (rating >= 4.5) {
    badges.push('Top Rated');
  }

  if (Number.isFinite(pricePerNight) && pricePerNight > 0 && pricePerNight <= 3500) {
    badges.push('Budget Friendly');
  }

  if (Number.isFinite(distanceKm) && distanceKm <= 5) {
    badges.push('Nearby');
  }

  return badges;
};

export const getTripTypeLabel = (itineraryDays = []) => {
  const validDays = itineraryDays.filter((day) => day && (day.route_stats || day.route));
  if (validDays.length === 0) {
    return 'Moderate';
  }

  const averageStops = validDays.reduce((sum, day) => sum + (day.route_stats?.stop_count || day.route?.length || 0), 0) / validDays.length;
  const averageMinutes = validDays.reduce((sum, day) => sum + (day.route_stats?.total_day_minutes || 0), 0) / validDays.length;

  if (averageStops <= 3 && averageMinutes <= 360) {
    return 'Relaxed';
  }

  if (averageStops >= 6 || averageMinutes >= 540) {
    return 'Fast-paced';
  }

  return 'Moderate';
};

export const getDayDifficulty = (dayPlan) => {
  const stopCount = dayPlan?.route_stats?.stop_count || dayPlan?.route?.length || 0;
  const totalMinutes = dayPlan?.route_stats?.total_day_minutes || 0;
  const travelMinutes = dayPlan?.route_stats?.total_travel_minutes || 0;

  if (stopCount <= 3 && totalMinutes <= 360 && travelMinutes <= 120) {
    return 'Low';
  }

  if (stopCount >= 6 || totalMinutes >= 540 || travelMinutes >= 210) {
    return 'High';
  }

  return 'Medium';
};

export const formatHotelMetric = (value, formatter) => {
  if (value === undefined || value === null || value === '') {
    return 'Estimated value';
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 'Estimated value';
  }

  return formatter ? formatter(numericValue) : String(numericValue);
};
