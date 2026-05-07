const { Client } = require('pg');

const DATABASE_URL = "postgresql://postgres:ZdrsmcxtKuLppIfonbVBlXrRwuwYwNRZ@tramway.proxy.rlwy.net:38274/railway";

const missingParallels = [
  ['2026 Topps Series 1 Baseball', 'Spring Training'],
  ['2026 Topps Series 1 Baseball', 'Green Spring Training'],
  ['2026 Topps Series 1 Baseball', 'Gold Spring Training'],
  ['2026 Topps Series 1 Baseball', 'Orange Spring Training'],
  ['2026 Topps Series 1 Baseball', 'Red Spring Training'],
  ['2026 Topps Series 1 Baseball', 'Rose Gold Spring Training'],
  ['2026 Topps Series 1 Baseball', 'Yellow'],
  ['2026 Topps Series 1 Baseball', 'Yellow Foil'],
  ['2026 Topps Series 1 Baseball', 'Rainbow Foil'],
  ['2026 Topps Series 1 Baseball', 'Gold Foil'],
  ['2026 Topps Series 1 Baseball', 'Royal Blue'],
  ['2026 Topps Series 1 Baseball', 'Blue Holofoil'],
  ['2026 Topps Series 1 Baseball', 'Purple Holofoil'],
  ['2026 Topps Series 1 Baseball', 'Green Crackle'],
  ['2026 Topps Series 1 Baseball', 'Orange Crackle'],
  ['2026 Topps Series 1 Baseball', 'Red Crackle'],
  ['2026 Topps Series 1 Baseball', 'Vintage Stock'],
  ['2026 Topps Series 1 Baseball', 'Independence Day'],
  ['2026 Topps Series 1 Baseball', 'Black'],
  ['2026 Topps Series 1 Baseball', "Father's Day Powder Blue"],
  ['2026 Topps Series 1 Baseball', "Mother's Day Hot Pink"],
  ['2026 Topps Series 1 Baseball', 'Memorial Day Camo'],
  ['2026 Topps Series 1 Baseball', 'Clear'],
  ['2026 Topps Series 1 Baseball', 'Platinum'],
  ['2026 Topps Series 1 Baseball', 'First Edition'],
  ['2026 Topps Series 1 Baseball', 'Gold'],
  ['2026 Topps Series 1 Baseball', 'Printing Plate Black'],
  ['2026 Topps Series 1 Baseball', 'Printing Plate Cyan'],
  ['2026 Topps Series 1 Baseball', 'Printing Plate Magenta'],
  ['2026 Topps Series 1 Baseball', 'Printing Plate Yellow'],
];

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  
  for (const [set, parallel] of missingParallels) {
    await client.query(
      `INSERT INTO catalog_parallels (card_set, parallel_name) VALUES ($1, $2)
       ON CONFLICT (COALESCE(card_set, ''), parallel_name) DO NOTHING`,
      [set, parallel]
    );
  }
  
  console.log(`Injected ${missingParallels.length} missing parallels!`);
  await client.end();
}

run();
