/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * inject_catalog.js — One-time manual catalog injection
 *
 * Run this locally to push 2026 Topps data into your Railway Postgres.
 *
 * Usage:
 *   $env:DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"
 *   node inject_catalog.js
 *
 * The DATABASE_URL is your Railway Postgres "External Connection URL"
 * found in Railway → Postgres plugin → Connect tab.
 */

const { Client } = require('pg');

// Hardcoded — public read access on this table, anon key is fine
const SUPABASE_URL = 'https://pmfufpczhsgrobgkpert.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZnVmcGN6aHNncm9iZ2twZXJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MzY3OTMsImV4cCI6MjA5MDAxMjc5M30.kXCo2vji8soAUfcsuMj_nYykl6wAg_YswvU5EnHHRNc';

const TARGET_SETS = [
  '2026 Topps Series 1 Baseball',
  '2026 Topps Heritage Baseball',
  '2026 Topps Heritage',
];

const DATABASE_URL = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
if (!DATABASE_URL || DATABASE_URL.includes('your_railway')) {
  console.error('ERROR: Set DATABASE_URL to your Railway Postgres External Connection URL first.');
  console.error('  $env:DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"');
  process.exit(1);
}

async function fetchPage(setName, offset) {
  const url = `${SUPABASE_URL}/rest/v1/master_card_catalog`
    + `?select=player_name,card_number,card_set,insert_name,parallel_name`
    + `&card_set=eq.${encodeURIComponent(setName)}`
    + `&limit=1000&offset=${offset}`;

  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchAllForSet(setName) {
  const all = [];
  let offset = 0;
  while (true) {
    process.stdout.write(`  page ${Math.floor(offset / 1000) + 1}...`);
    const rows = await fetchPage(setName, offset);
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    process.stdout.write(` ${rows.length} rows\n`);
    if (rows.length < 1000) break;
    offset += 1000;
  }
  return all;
}

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 15_000 });
  await client.connect();
  await client.query("SET statement_timeout = '300s'");
  console.log('Connected to Railway Postgres.\n');

  // Create tables
  await client.query(`
    CREATE TABLE IF NOT EXISTS catalog_cards (
      id            SERIAL PRIMARY KEY,
      card_set      TEXT NOT NULL,
      player_name   TEXT,
      card_number   TEXT,
      insert_name   TEXT,
      parallel_name TEXT
    )
  `);
  await client.query(`CREATE TABLE IF NOT EXISTS catalog_sets (card_set TEXT PRIMARY KEY, sport TEXT DEFAULT 'mlb')`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS catalog_parallels (
      id SERIAL PRIMARY KEY,
      card_set TEXT,
      parallel_name TEXT NOT NULL
    )
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_parallels_unique
    ON catalog_parallels (COALESCE(card_set, ''), parallel_name)
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_catalog_cards_player ON catalog_cards (player_name)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_catalog_cards_set    ON catalog_cards (card_set)`);
  console.log('Tables ready.\n');

  let grandTotal = 0;

  for (const setName of TARGET_SETS) {
    console.log(`\nFetching: ${setName}`);
    let rows = [];
    try {
      rows = await fetchAllForSet(setName);
    } catch (e) {
      console.error(`  FAILED: ${e.message}`);
      continue;
    }
    console.log(`  Total: ${rows.length} rows`);
    if (rows.length === 0) continue;

    // Clear and re-insert
    await client.query(`DELETE FROM catalog_cards WHERE card_set = $1`, [setName]);
    await client.query(`DELETE FROM catalog_parallels WHERE card_set = $1`, [setName]);
    await client.query(`DELETE FROM catalog_sets WHERE card_set = $1`, [setName]);
    await client.query(`INSERT INTO catalog_sets (card_set, sport) VALUES ($1, 'mlb') ON CONFLICT DO NOTHING`, [setName]);

    // Insert in chunks of 200
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const values = chunk.map((_, j) => {
        const b = j * 5;
        return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5})`;
      }).join(',');
      const params = chunk.flatMap(r => [
        r.card_set || setName,
        r.player_name || null,
        r.card_number || null,
        r.insert_name || null,
        r.parallel_name || null,
      ]);
      await client.query(
        `INSERT INTO catalog_cards (card_set, player_name, card_number, insert_name, parallel_name) VALUES ${values}`,
        params
      );
      process.stdout.write(`  inserted ${Math.min(i + 200, rows.length)}/${rows.length}\r`);
    }
    console.log(`  ✓ ${rows.length} cards inserted for ${setName}`);

    // Extract parallels
    const parallels = [...new Set(rows.map(r => r.parallel_name).filter(Boolean))];
    for (const p of parallels) {
      await client.query(
        `INSERT INTO catalog_parallels (card_set, parallel_name) VALUES ($1, $2)
         ON CONFLICT (COALESCE(card_set, ''), parallel_name) DO NOTHING`,
        [setName, p]
      );
    }
    console.log(`  ✓ ${parallels.length} parallels for ${setName}`);
    grandTotal += rows.length;
  }

  await client.end();
  console.log(`\n✅ Done! ${grandTotal} total cards injected into catalog_cards.`);
}

run().catch(err => {
  console.error('FATAL:', err.message || err);
  process.exit(1);
});
