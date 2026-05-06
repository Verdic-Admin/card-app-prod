/**
 * sync_catalog.js — Card Catalog Reference Sync
 * ─────────────────────────────────────────────
 * Runs at container startup (after init_db.js) to populate local read-only
 * reference tables from the Player Index Supabase instance.
 *
 * Tables created/refreshed in Railway Postgres:
 *   catalog_players  (player_name, sport)
 *   catalog_sets     (player_name, card_set, sport)
 *   catalog_inserts  (player_name, card_set, insert_name)
 *   catalog_parallels(card_set, parallel_name)
 *
 * These are NEVER written to by the app — read-only reference for typeaheads.
 * The Card Shop DB never connects to Supabase at runtime; this script is the
 * only bridge and only runs at deploy time.
 *
 * Required env vars (set on Railway service):
 *   CATALOG_SUPABASE_URL     — Supabase project URL (e.g. https://xxx.supabase.co)
 *   CATALOG_SUPABASE_ANON_KEY — Supabase anon/public key
 *   DATABASE_URL or POSTGRES_URL — Card Shop's Railway Postgres
 */

const { Client } = require('pg');

const SUPABASE_URL = (process.env.CATALOG_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SUPABASE_KEY = (process.env.CATALOG_SUPABASE_ANON_KEY || '').trim();
const DATABASE_URL = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.log('[sync_catalog] CATALOG_SUPABASE_URL / CATALOG_SUPABASE_ANON_KEY not set — skipping catalog sync.');
  process.exit(0);
}

if (!DATABASE_URL) {
  console.log('[sync_catalog] DATABASE_URL not set — skipping catalog sync.');
  process.exit(0);
}

/** Fetch all pages from a Supabase table via REST API */
async function fetchAll(table, select, filter = '') {
  const PAGE_SIZE = 1000;
  let offset = 0;
  const all = [];

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${PAGE_SIZE}&offset=${offset}${filter ? '&' + filter : ''}`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase REST error on ${table}: ${res.status} ${text}`);
    }

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 15_000 });
  await client.connect();
  await client.query("SET statement_timeout = '120s'");

  console.log('[sync_catalog] Creating reference tables if needed...');

  // Create tables (idempotent)
  await client.query(`
    CREATE TABLE IF NOT EXISTS catalog_players (
      player_name TEXT NOT NULL,
      sport       TEXT,
      PRIMARY KEY (player_name)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS catalog_sets (
      player_name TEXT NOT NULL,
      card_set    TEXT NOT NULL,
      sport       TEXT,
      PRIMARY KEY (player_name, card_set)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS catalog_inserts (
      player_name TEXT NOT NULL,
      card_set    TEXT NOT NULL,
      insert_name TEXT NOT NULL,
      PRIMARY KEY (player_name, card_set, insert_name)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS catalog_parallels (
      card_set      TEXT NOT NULL,
      parallel_name TEXT NOT NULL,
      PRIMARY KEY (card_set, parallel_name)
    );
  `);

  // ── Sync players ────────────────────────────────────────────────────────────
  console.log('[sync_catalog] Fetching players from Supabase...');
  let players = [];
  try {
    players = await fetchAll('player_metadata', 'player_name,sport', 'player_name=not.is.null');
    console.log(`[sync_catalog]   → ${players.length} players fetched`);
  } catch (e) {
    console.warn('[sync_catalog] Could not fetch players:', e.message);
  }

  if (players.length > 0) {
    await client.query('TRUNCATE catalog_players');
    for (let i = 0; i < players.length; i += 500) {
      const chunk = players.slice(i, i + 500);
      const values = chunk.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2})`).join(', ');
      const params = chunk.flatMap(r => [r.player_name, r.sport || 'mlb']);
      await client.query(
        `INSERT INTO catalog_players (player_name, sport) VALUES ${values} ON CONFLICT DO NOTHING`,
        params
      );
    }
    console.log(`[sync_catalog]   ✓ catalog_players synced (${players.length} rows)`);
  }

  // ── Sync sets (player_name + card_set combos) ───────────────────────────────
  console.log('[sync_catalog] Fetching card sets from Supabase...');
  let sets = [];
  try {
    sets = await fetchAll(
      'master_card_catalog',
      'player_name,card_set,sport',
      'player_name=not.is.null&card_set=not.is.null'
    );
    console.log(`[sync_catalog]   → ${sets.length} set rows fetched`);
  } catch (e) {
    console.warn('[sync_catalog] Could not fetch sets:', e.message);
  }

  if (sets.length > 0) {
    await client.query('TRUNCATE catalog_sets');
    // Deduplicate before insert
    const seen = new Set();
    const dedupedSets = sets.filter(r => {
      const key = `${r.player_name}|${r.card_set}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    for (let i = 0; i < dedupedSets.length; i += 500) {
      const chunk = dedupedSets.slice(i, i + 500);
      const values = chunk.map((_, j) => `($${j * 3 + 1}, $${j * 3 + 2}, $${j * 3 + 3})`).join(', ');
      const params = chunk.flatMap(r => [r.player_name, r.card_set, r.sport || 'mlb']);
      await client.query(
        `INSERT INTO catalog_sets (player_name, card_set, sport) VALUES ${values} ON CONFLICT DO NOTHING`,
        params
      );
    }
    console.log(`[sync_catalog]   ✓ catalog_sets synced (${dedupedSets.length} unique rows)`);
  }

  // ── Sync inserts ─────────────────────────────────────────────────────────────
  console.log('[sync_catalog] Fetching inserts from Supabase...');
  let inserts = [];
  try {
    inserts = await fetchAll(
      'master_card_catalog',
      'player_name,card_set,insert_name',
      'insert_name=not.is.null&insert_name=neq.Base&insert_name=neq.'
    );
    console.log(`[sync_catalog]   → ${inserts.length} insert rows fetched`);
  } catch (e) {
    console.warn('[sync_catalog] Could not fetch inserts:', e.message);
  }

  if (inserts.length > 0) {
    await client.query('TRUNCATE catalog_inserts');
    const seen = new Set();
    const dedupedInserts = inserts.filter(r => {
      if (!r.player_name || !r.card_set || !r.insert_name) return false;
      const key = `${r.player_name}|${r.card_set}|${r.insert_name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    for (let i = 0; i < dedupedInserts.length; i += 500) {
      const chunk = dedupedInserts.slice(i, i + 500);
      const values = chunk.map((_, j) => `($${j * 3 + 1}, $${j * 3 + 2}, $${j * 3 + 3})`).join(', ');
      const params = chunk.flatMap(r => [r.player_name, r.card_set, r.insert_name]);
      await client.query(
        `INSERT INTO catalog_inserts (player_name, card_set, insert_name) VALUES ${values} ON CONFLICT DO NOTHING`,
        params
      );
    }
    console.log(`[sync_catalog]   ✓ catalog_inserts synced (${dedupedInserts.length} unique rows)`);
  }

  // ── Sync parallels ───────────────────────────────────────────────────────────
  console.log('[sync_catalog] Fetching parallels from Supabase...');
  let parallels = [];
  try {
    parallels = await fetchAll(
      'master_card_catalog',
      'card_set,parallel_name',
      'parallel_name=not.is.null&parallel_name=neq.Base&parallel_name=neq.'
    );
    console.log(`[sync_catalog]   → ${parallels.length} parallel rows fetched`);
  } catch (e) {
    console.warn('[sync_catalog] Could not fetch parallels:', e.message);
  }

  if (parallels.length > 0) {
    await client.query('TRUNCATE catalog_parallels');
    const seen = new Set();
    const dedupedParallels = parallels.filter(r => {
      if (!r.card_set || !r.parallel_name) return false;
      const key = `${r.card_set}|${r.parallel_name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    for (let i = 0; i < dedupedParallels.length; i += 500) {
      const chunk = dedupedParallels.slice(i, i + 500);
      const values = chunk.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2})`).join(', ');
      const params = chunk.flatMap(r => [r.card_set, r.parallel_name]);
      await client.query(
        `INSERT INTO catalog_parallels (card_set, parallel_name) VALUES ${values} ON CONFLICT DO NOTHING`,
        params
      );
    }
    console.log(`[sync_catalog]   ✓ catalog_parallels synced (${dedupedParallels.length} unique rows)`);
  }

  await client.end();
  console.log('[sync_catalog] Catalog sync complete.');
}

run().catch(err => {
  console.warn('[sync_catalog] Sync failed (non-fatal):', err.message || err);
  // Never crash the container — sync failure is always non-fatal
  process.exit(0);
});
