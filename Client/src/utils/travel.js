export const INTEREST_OPTIONS = [
  { value: 'history', label: 'History', accent: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'nature', label: 'Nature', accent: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'culture', label: 'Culture', accent: 'bg-sky-100 text-sky-800 border-sky-200' },
  { value: 'food', label: 'Food', accent: 'bg-rose-100 text-rose-800 border-rose-200' },
  { value: 'shopping', label: 'Shopping', accent: 'bg-violet-100 text-violet-800 border-violet-200' },
  { value: 'adventure', label: 'Adventure', accent: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'art', label: 'Art', accent: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
  { value: 'beaches', label: 'Beaches', accent: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { value: 'nightlife', label: 'Nightlife', accent: 'bg-slate-200 text-slate-800 border-slate-300' },
  { value: 'sports', label: 'Sports', accent: 'bg-lime-100 text-lime-800 border-lime-200' },
];

export const getInterestMeta = (interest) =>
  INTEREST_OPTIONS.find((option) => option.value === interest) || {
    value: interest,
    label: interest,
    accent: 'bg-slate-100 text-slate-700 border-slate-200',
  };

export const getCityGradient = (seed = '') => {
  const gradients = [
    'from-sky-500 via-cyan-400 to-teal-300',
    'from-emerald-500 via-lime-400 to-amber-200',
    'from-orange-500 via-amber-300 to-rose-200',
    'from-indigo-500 via-sky-400 to-cyan-200',
    'from-fuchsia-500 via-rose-400 to-orange-200',
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
    tourist_attraction: 'bg-amber-100 text-amber-800',
    museum: 'bg-indigo-100 text-indigo-800',
    park: 'bg-emerald-100 text-emerald-800',
    beach: 'bg-cyan-100 text-cyan-800',
    church: 'bg-blue-100 text-blue-800',
    hindu_temple: 'bg-orange-100 text-orange-800',
    restaurant: 'bg-rose-100 text-rose-800',
    art_gallery: 'bg-fuchsia-100 text-fuchsia-800',
    zoo: 'bg-lime-100 text-lime-800',
    campground: 'bg-green-100 text-green-800',
    shopping_mall: 'bg-violet-100 text-violet-800',
    place: 'bg-slate-100 text-slate-800',
  };

  return themes[type] || themes.place;
};

export const getPlaceVisual = (place) => {
  const type = getPrimaryPlaceType(place);
  const visuals = {
    tourist_attraction: { icon: 'Compass', gradient: 'from-amber-400 to-orange-500' },
    museum: { icon: 'Gallery', gradient: 'from-indigo-400 to-sky-500' },
    park: { icon: 'Forest', gradient: 'from-emerald-400 to-green-500' },
    beach: { icon: 'Coast', gradient: 'from-cyan-400 to-sky-500' },
    church: { icon: 'Heritage', gradient: 'from-blue-400 to-indigo-500' },
    hindu_temple: { icon: 'Temple', gradient: 'from-orange-400 to-rose-500' },
    restaurant: { icon: 'Cuisine', gradient: 'from-rose-400 to-red-500' },
    art_gallery: { icon: 'Studio', gradient: 'from-fuchsia-400 to-pink-500' },
    zoo: { icon: 'Safari', gradient: 'from-lime-400 to-emerald-500' },
    shopping_mall: { icon: 'Market', gradient: 'from-violet-400 to-fuchsia-500' },
  };

  return visuals[type] || { icon: 'Explore', gradient: 'from-slate-500 to-slate-700' };
};

export const renderStars = (rating) => {
  const numericRating = Number(rating || 0);
  const filled = Math.round(numericRating);
  return Array.from({ length: 5 }, (_, index) => (index < filled ? '*' : '-')).join('');
};
