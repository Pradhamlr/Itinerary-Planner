const STANDARD_PLACE_TYPES = [
  'tourist_attraction',
  'museum',
  'art_gallery',
  'park',
  'beach',
  'church',
  'hindu_temple',
  'mosque',
  'synagogue',
  'shopping_mall',
];

const STANDARD_TYPE_CAPS = {
  tourist_attraction: 120,
  museum: 35,
  art_gallery: 25,
  park: 35,
  beach: 24,
  church: 24,
  hindu_temple: 30,
  mosque: 18,
  synagogue: 10,
  shopping_mall: 18,
};

const CITY_EXPANSION_PLAN = [
  {
    city: 'Bengaluru',
    region: 'south',
    priority: 1,
    mode: 'standard',
    profile: {
      radius: 3500,
      gridStep: 0.028,
      gridDepth: 1,
      placeTypes: STANDARD_PLACE_TYPES,
      perTypeCaps: {
        ...STANDARD_TYPE_CAPS,
        tourist_attraction: 140,
        park: 40,
        shopping_mall: 20,
      },
    },
  },
  {
    city: 'Chennai',
    region: 'south',
    priority: 1,
    mode: 'standard',
    profile: {
      radius: 3500,
      gridStep: 0.03,
      gridDepth: 1,
      placeTypes: STANDARD_PLACE_TYPES,
      perTypeCaps: {
        ...STANDARD_TYPE_CAPS,
        beach: 30,
        tourist_attraction: 130,
      },
    },
  },
  {
    city: 'Mysuru',
    region: 'south',
    priority: 1,
    mode: 'standard',
    profile: {
      radius: 4200,
      gridStep: 0.02,
      gridDepth: 1,
      placeTypes: STANDARD_PLACE_TYPES,
      perTypeCaps: {
        ...STANDARD_TYPE_CAPS,
        tourist_attraction: 100,
        museum: 28,
        shopping_mall: 12,
      },
    },
  },
  {
    city: 'Puducherry',
    region: 'south',
    priority: 1,
    mode: 'standard',
    profile: {
      radius: 3200,
      gridStep: 0.018,
      gridDepth: 1,
      placeTypes: STANDARD_PLACE_TYPES,
      perTypeCaps: {
        ...STANDARD_TYPE_CAPS,
        beach: 28,
        tourist_attraction: 90,
        shopping_mall: 10,
      },
    },
  },
  {
    city: 'Hyderabad',
    region: 'south',
    priority: 1,
    mode: 'standard',
    profile: {
      radius: 3600,
      gridStep: 0.03,
      gridDepth: 1,
      placeTypes: STANDARD_PLACE_TYPES,
      perTypeCaps: {
        ...STANDARD_TYPE_CAPS,
        tourist_attraction: 135,
        museum: 40,
        shopping_mall: 18,
      },
    },
  },
  {
    city: 'Jaipur',
    region: 'north',
    priority: 1,
    mode: 'standard',
    profile: {
      radius: 3800,
      gridStep: 0.028,
      gridDepth: 1,
      placeTypes: STANDARD_PLACE_TYPES,
      perTypeCaps: {
        ...STANDARD_TYPE_CAPS,
        tourist_attraction: 140,
        museum: 36,
        hindu_temple: 34,
      },
    },
  },
  {
    city: 'Udaipur',
    region: 'north',
    priority: 1,
    mode: 'standard',
    profile: {
      radius: 3600,
      gridStep: 0.022,
      gridDepth: 1,
      placeTypes: STANDARD_PLACE_TYPES,
      perTypeCaps: {
        ...STANDARD_TYPE_CAPS,
        tourist_attraction: 105,
        museum: 24,
        shopping_mall: 10,
      },
    },
  },
  {
    city: 'Varanasi',
    region: 'north',
    priority: 1,
    mode: 'standard',
    profile: {
      radius: 3200,
      gridStep: 0.02,
      gridDepth: 1,
      placeTypes: STANDARD_PLACE_TYPES,
      perTypeCaps: {
        ...STANDARD_TYPE_CAPS,
        tourist_attraction: 115,
        hindu_temple: 42,
        church: 10,
        shopping_mall: 8,
      },
    },
  },
];

const CITY_LOOKUP = new Map(CITY_EXPANSION_PLAN.map((entry) => [entry.city.toLowerCase(), entry]));

module.exports = {
  CITY_EXPANSION_PLAN,
  CITY_LOOKUP,
};
