/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * sync_catalog.js — Card Catalog Sync from Player Index (Supabase)
 * ─────────────────────────────────────────────────────────────────
 * Runs at container startup. Pulls 2026 Topps Series 1, Heritage, and
 * Heritage Chrome data from the Player Index Supabase DB and writes it
 * into local Railway Postgres read-only reference tables.
 *
 * Tables populated:
 *   catalog_cards    (player_name, card_number, card_set, insert_name, parallel_name)
 *   catalog_sets     (card_set, sport)
 *   catalog_parallels(card_set, parallel_name)
 *
 * Uses env vars already present in Railway — no new vars needed:
 *   NEXT_PUBLIC_SUPABASE_URL      — Supabase project URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase anon key
 *   DATABASE_URL / POSTGRES_URL   — Card Shop Railway Postgres
 */

const { Client } = require('pg');

// Use existing Railway env vars — no new vars needed
const SUPABASE_URL = (
  process.env.CATALOG_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ''
).trim().replace(/\/+$/, '');

const SUPABASE_KEY = (
  process.env.CATALOG_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ''
).trim();

const DATABASE_URL = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();

// Only sync these sets
const TARGET_SETS = [
  '2026 Topps Series 1 Baseball',
  '2026 Topps Heritage Baseball',
  '2026 Topps Heritage',
];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.log('[sync_catalog] No Supabase credentials found — skipping catalog sync.');
  process.exit(0);
}
if (!DATABASE_URL) {
  console.log('[sync_catalog] No DATABASE_URL — skipping catalog sync.');
  process.exit(0);
}

async function fetchPage(setName, offset) {
  const filter = `card_set=eq.${encodeURIComponent(setName)}`;
  const url = `${SUPABASE_URL}/rest/v1/master_card_catalog?select=player_name,card_number,card_set,insert_name,parallel_name&${filter}&limit=1000&offset=${offset}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${txt}`);
  }
  return res.json();
}

async function fetchAllForSet(setName) {
  const all = [];
  let offset = 0;
  while (true) {
    const rows = await fetchPage(setName, offset);
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < 1000) break;
    offset += 1000;
  }
  return all;
}

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 15_000 });
  await client.connect();
  await client.query("SET statement_timeout = '180s'");

  console.log('[sync_catalog] Creating catalog tables if needed...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS catalog_cards (
      id            SERIAL PRIMARY KEY,
      card_set      TEXT NOT NULL,
      player_name   TEXT,
      card_number   TEXT,
      insert_name   TEXT,
      parallel_name TEXT
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS catalog_sets (
      card_set TEXT PRIMARY KEY,
      sport    TEXT DEFAULT 'mlb'
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS catalog_parallels (
      id            SERIAL PRIMARY KEY,
      card_set      TEXT,
      parallel_name TEXT NOT NULL,
      UNIQUE (COALESCE(card_set, ''), parallel_name)
    );
  `);

  // Add indexes for fast typeahead queries
  await client.query(`CREATE INDEX IF NOT EXISTS idx_catalog_cards_player ON catalog_cards (player_name);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_catalog_cards_set    ON catalog_cards (card_set);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_catalog_cards_num    ON catalog_cards (card_number);`);

  // Sync each set
  for (const setName of TARGET_SETS) {
    console.log(`[sync_catalog] Fetching: ${setName}...`);
    let rows = [];
    try {
      rows = await fetchAllForSet(setName);
      console.log(`[sync_catalog]   → ${rows.length} rows`);
    } catch (e) {
      console.warn(`[sync_catalog]   ✗ Failed: ${e.message}`);
      continue;
    }

    if (rows.length === 0) continue;

    // Clear old data for this set, re-insert fresh
    await client.query(`DELETE FROM catalog_cards WHERE card_set = $1`, [setName]);
    await client.query(`DELETE FROM catalog_parallels WHERE card_set = $1`, [setName]);
    await client.query(`DELETE FROM catalog_sets WHERE card_set = $1`, [setName]);

    // Insert set
    await client.query(
      `INSERT INTO catalog_sets (card_set, sport) VALUES ($1, 'mlb') ON CONFLICT (card_set) DO NOTHING`,
      [setName]
    );

    // Bulk insert cards in chunks of 500
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const values = chunk.map((_, j) => {
        const base = j * 5;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
      }).join(', ');
      const params = chunk.flatMap(r => [
        r.card_set    || setName,
        r.player_name || null,
        r.card_number || null,
        r.insert_name || null,
        r.parallel_name || null,
      ]);
      await client.query(
        `INSERT INTO catalog_cards (card_set, player_name, card_number, insert_name, parallel_name) VALUES ${values}`,
        params
      );
      inserted += chunk.length;
    }
    console.log(`[sync_catalog]   ✓ catalog_cards: ${inserted} rows for ${setName}`);

    // Extract unique parallels for this set
    const parallels = [...new Set(rows.map(r => r.parallel_name).filter(Boolean))];
    for (const p of parallels) {
      await client.query(
        `INSERT INTO catalog_parallels (card_set, parallel_name) VALUES ($1, $2)
         ON CONFLICT (COALESCE(card_set, ''), parallel_name) DO NOTHING`,
        [setName, p]
      );
    }
    console.log(`[sync_catalog]   ✓ catalog_parallels: ${parallels.length} for ${setName}`);
  }

  await client.end();
  console.log('[sync_catalog] Catalog sync complete.');
}

run().catch(err => {
  console.warn('[sync_catalog] Sync failed (non-fatal):', err.message || err);
  process.exit(0);
});
