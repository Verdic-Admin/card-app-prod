/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * seed_catalog.js
 * Creates catalog_sets + catalog_parallels tables and seeds them with 2026 Topps data.
 * Safe to run on every deploy — all inserts use ON CONFLICT DO NOTHING.
 */
const { Client } = require('pg');

const connectionString = (
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  ''
).trim();

if (!connectionString) {
  console.log('[seed_catalog] No DATABASE_URL — skipping.');
  process.exit(0);
}

const SETS = [
  ['2026 Topps Series 1',        'mlb'],
  ['2026 Topps Heritage',        'mlb'],
  ['2026 Topps Heritage Chrome', 'mlb'],
  ['2026 Topps Celebration',     'mlb'],
];

const PARALLELS = [
  // ── 2026 Topps Series 1 ───────────────────────────────────────────────────
  ['2026 Topps Series 1', 'Base'],
  ['2026 Topps Series 1', 'Yellow'],
  ['2026 Topps Series 1', 'Yellow Foil'],
  ['2026 Topps Series 1', 'Rainbow Foil'],
  ['2026 Topps Series 1', 'Gold Foil'],
  ['2026 Topps Series 1', 'Royal Blue'],
  ['2026 Topps Series 1', 'Blue Holofoil'],
  ['2026 Topps Series 1', 'Purple Holofoil'],
  ['2026 Topps Series 1', 'Green Crackle'],
  ['2026 Topps Series 1', 'Orange Crackle'],
  ['2026 Topps Series 1', 'Red Crackle'],
  ['2026 Topps Series 1', 'Vintage Stock'],
  ['2026 Topps Series 1', 'Independence Day'],
  ['2026 Topps Series 1', 'Black'],
  ['2026 Topps Series 1', "Father's Day Powder Blue"],
  ['2026 Topps Series 1', "Mother's Day Hot Pink"],
  ['2026 Topps Series 1', 'Memorial Day Camo'],
  ['2026 Topps Series 1', 'Clear'],
  ['2026 Topps Series 1', 'Platinum'],
  ['2026 Topps Series 1', 'First Edition'],
  ['2026 Topps Series 1', 'Gold'],
  ['2026 Topps Series 1', 'Printing Plate Black'],
  ['2026 Topps Series 1', 'Printing Plate Cyan'],
  ['2026 Topps Series 1', 'Printing Plate Magenta'],
  ['2026 Topps Series 1', 'Printing Plate Yellow'],
  // ── 2026 Topps Celebration (Mega Box) ────────────────────────────────────
  ['2026 Topps Celebration', 'Confetti'],
  ['2026 Topps Celebration', 'Confetti Red'],
  ['2026 Topps Celebration', 'Confetti Blue'],
  ['2026 Topps Celebration', 'Confetti Green'],
  ['2026 Topps Celebration', 'Opening Day Foil'],
  // ── 2026 Topps Heritage (paper) ──────────────────────────────────────────
  ['2026 Topps Heritage', 'Base'],
  ['2026 Topps Heritage', 'Dark Gray Bordered'],
  ['2026 Topps Heritage', 'Dark Green Bordered'],
  ['2026 Topps Heritage', 'Red Bordered'],
  ['2026 Topps Heritage', 'Light Purple Bordered'],
  ['2026 Topps Heritage', 'Dark Yellow Bordered'],
  ['2026 Topps Heritage', 'Black Bordered'],
  ['2026 Topps Heritage', 'Deckle Edge'],
  ['2026 Topps Heritage', 'Heritage Orange'],
  ['2026 Topps Heritage', 'Flip Stock'],
  // ── 2026 Topps Heritage Chrome ───────────────────────────────────────────
  ['2026 Topps Heritage Chrome', 'Refractor'],
  ['2026 Topps Heritage Chrome', 'Light Blue Sparkle'],
  ['2026 Topps Heritage Chrome', 'Silver Sparkle'],
  ['2026 Topps Heritage Chrome', 'Pink Sparkle'],
  ['2026 Topps Heritage Chrome', 'Burgundy Sparkle'],
  ['2026 Topps Heritage Chrome', 'Aqua Sparkle'],
  ['2026 Topps Heritage Chrome', 'Blue Bordered'],
  ['2026 Topps Heritage Chrome', 'Green Bordered'],
  ['2026 Topps Heritage Chrome', 'Black Bordered'],
  ['2026 Topps Heritage Chrome', 'Gold Bordered'],
  ['2026 Topps Heritage Chrome', 'Orange Bordered'],
  ['2026 Topps Heritage Chrome', 'Red Bordered'],
  ['2026 Topps Heritage Chrome', 'Superfractor'],
];

async function run() {
  const client = new Client({ connectionString, connectionTimeoutMillis: 10_000 });
  await client.connect();
  await client.query("SET statement_timeout = '30s'");

  // Create tables
  await client.query(`
    CREATE TABLE IF NOT EXISTS catalog_sets (
      card_set TEXT PRIMARY KEY,
      sport    TEXT DEFAULT 'mlb'
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS catalog_parallels (
      id            SERIAL PRIMARY KEY,
      card_set      TEXT,
      parallel_name TEXT NOT NULL,
      UNIQUE (COALESCE(card_set, ''), parallel_name)
    )
  `);

  // Seed sets
  for (const [name, sport] of SETS) {
    await client.query(
      `INSERT INTO catalog_sets (card_set, sport) VALUES ($1, $2) ON CONFLICT (card_set) DO NOTHING`,
      [name, sport]
    );
  }
  console.log(`[seed_catalog] catalog_sets: ${SETS.length} sets ready`);

  // Seed parallels
  let inserted = 0;
  for (const [set, parallel] of PARALLELS) {
    const res = await client.query(
      `INSERT INTO catalog_parallels (card_set, parallel_name) VALUES ($1, $2)
       ON CONFLICT (COALESCE(card_set, ''), parallel_name) DO NOTHING`,
      [set, parallel]
    );
    if (res.rowCount > 0) inserted++;
  }
  console.log(`[seed_catalog] catalog_parallels: ${PARALLELS.length} entries ready (${inserted} new)`);

  await client.end();
  console.log('[seed_catalog] Done.');
}

run().catch(err => {
  console.warn('[seed_catalog] Failed (non-fatal):', err.message || err);
  process.exit(0);
});
