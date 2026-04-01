require('dotenv').config();
const path = require('path');
const { spawnSync } = require('child_process');

const NEXT_BATCH_CITIES = [
  'Udaipur',
  'Goa',
  'Manali',
  'Delhi',
  'Mumbai',
  'Pune',
  'Jaipur',
];

for (const city of NEXT_BATCH_CITIES) {
  console.log(`\n=== Syncing hotels for ${city} ===`);
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'syncHotels.js'), '--city', city],
    { stdio: 'inherit' },
  );

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('\nNext expansion batch hotel sync complete.');
