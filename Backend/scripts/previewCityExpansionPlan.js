const { CITY_EXPANSION_PLAN } = require('../config/cityExpansionPlan');

const summarizeEntry = (entry) => ({
  city: entry.city,
  region: entry.region,
  priority: entry.priority,
  mode: entry.mode,
  radius: entry.profile.radius,
  gridStep: entry.profile.gridStep,
  gridDepth: entry.profile.gridDepth,
  placeTypes: entry.profile.placeTypes,
  perTypeCaps: entry.profile.perTypeCaps,
});

const main = () => {
  const summary = CITY_EXPANSION_PLAN
    .sort((first, second) => first.priority - second.priority || first.city.localeCompare(second.city))
    .map(summarizeEntry);

  console.log(JSON.stringify(summary, null, 2));
};

main();
