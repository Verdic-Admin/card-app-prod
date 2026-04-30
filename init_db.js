/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Docker entrypoint / postbuild: initializes and migrates the Postgres schema.
 * Safe to run on every deploy — all statements are idempotent
 * (CREATE TABLE IF NOT EXISTS / ALTER TABLE ADD COLUMN IF NOT EXISTS).
 */
const { Client } = require('pg');

/** Run after CREATE TABLE IF NOT EXISTS — safe on existing DBs (PG 9.1+). */
const IDEMPOTENT_ALTER = `
-- inventory: columns referenced by app but missing on older templates
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS print_run TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS checkout_expires_at TIMESTAMPTZ;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_auction BOOLEAN DEFAULT false;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS auction_status TEXT DEFAULT 'pending';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS auction_reserve_price NUMERIC(12, 2);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS auction_end_time TIMESTAMPTZ;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS auction_description TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS current_bid NUMERIC(12, 2);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS bidder_count INT DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS verification_code TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_verified_flip BOOLEAN DEFAULT false;

-- store_settings: full set used by settings.ts, checkout, admin
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS cart_minimum NUMERIC(10, 2) DEFAULT 20.00;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS site_announcement TEXT DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS paypal_email TEXT DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS allow_offers BOOLEAN DEFAULT true;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS social_instagram TEXT DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS social_twitter TEXT DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS social_facebook TEXT DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS social_discord TEXT DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS social_threads TEXT DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS site_author TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS payment_link TEXT DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS payment_instructions TEXT DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS payment_venmo TEXT DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS payment_paypal TEXT DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS payment_cashapp TEXT DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS payment_zelle TEXT DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(10, 2) DEFAULT 4.00;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS free_shipping_threshold NUMERIC(10, 2) DEFAULT 25.00;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS site_announcement_url TEXT;
-- columns read by /admin/page.tsx on older installs (schema drift)
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS oracle_discount_percentage NUMERIC(5, 2) DEFAULT 0.0;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS live_stream_url TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS projection_timeframe TEXT DEFAULT '90-Day';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS auction_qr_url TEXT;

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS auto_updates_enabled BOOLEAN DEFAULT false;

-- shop_config: optional legacy columns (Oracle URL was mirrored here in older templates)
ALTER TABLE shop_config ADD COLUMN IF NOT EXISTS playerindex_api_base_url TEXT;

-- scan_staging (bulk importer / wizard)
ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS raw_front_url TEXT;
ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS raw_back_url TEXT;
ALTER TABLE scan_staging ALTER COLUMN image_url DROP NOT NULL;
ALTER TABLE scan_staging ALTER COLUMN back_image_url DROP NOT NULL;

-- rookie / auto / relic / grading attributes (migration 002)
ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS is_rookie BOOLEAN DEFAULT false;
ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS is_auto BOOLEAN DEFAULT false;
ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS is_relic BOOLEAN DEFAULT false;
ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS grading_company TEXT;
ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS team_name TEXT DEFAULT '';
ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS trend_data JSONB;
ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS player_index_url TEXT;
ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS oracle_projection NUMERIC(10, 2);
ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS oracle_trend_percentage NUMERIC(10, 4);
ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS upload_kind TEXT DEFAULT 'single_pair';
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS auction_bid_increment NUMERIC(12, 2) DEFAULT 1.00;

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_rookie BOOLEAN DEFAULT false;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_auto BOOLEAN DEFAULT false;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_relic BOOLEAN DEFAULT false;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS grading_company TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS grade TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS team_name TEXT;
-- Older Railway templates created inventory before these columns existed on some installs
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS market_price NUMERIC(10, 2);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS listed_price NUMERIC(10, 2);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS back_image_url TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS card_number TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS insert_name TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS parallel_name TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS parallel_insert_type TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS trend_data JSONB;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS player_index_url TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS oracle_projection NUMERIC(10, 2);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS oracle_trend_percentage NUMERIC(10, 4);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS needs_correction BOOLEAN DEFAULT false;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS needs_price_approval BOOLEAN DEFAULT false;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS filename TEXT;
`;

async function runIdempotentAlters(client) {
  const statements = IDEMPOTENT_ALTER.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const sql of statements) {
    try {
      await client.query(sql);
    } catch (e) {
      console.warn('[init_db] alter skipped:', e.message || e);
    }
  }
}


async function init() {
  // DATABASE_URL is injected by Railway Postgres plugin.
  const connectionString = (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ''
  ).trim();

  if (!connectionString) {
    console.warn('WARNING: DATABASE_URL is not defined. Skipping database initialization.');
    return;
  }

  const client = new Client({ connectionString, connectionTimeoutMillis: 10_000 });
  await client.connect();
  // Avoid hanging Railway deploy if another session holds a lock; keep init bounded.
  await client.query("SET statement_timeout = '60s'");

  console.log('Connected to Postgres. Initializing schema...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      player_name TEXT NOT NULL,
      team_name TEXT,
      card_set TEXT,
      insert_name TEXT,
      parallel_name TEXT,
      parallel_insert_type TEXT,
      card_number TEXT,
      print_run TEXT,
      high_price NUMERIC(10, 2),
      low_price NUMERIC(10, 2),
      avg_price NUMERIC(10, 2),
      listed_price NUMERIC(10, 2),
      market_price NUMERIC(10, 2),
      cost_basis NUMERIC(10, 2) DEFAULT 0,
      accepts_offers BOOLEAN DEFAULT false,
      is_lot BOOLEAN DEFAULT false,
      lot_id UUID,
      image_url TEXT,
      back_image_url TEXT,
      coined_image_url TEXT,
      status TEXT DEFAULT 'available',
      trend_data JSONB,
      player_index_url TEXT,
      oracle_projection NUMERIC(10, 2),
      oracle_trend_percentage NUMERIC(10, 4),
      needs_correction BOOLEAN DEFAULT false,
      needs_price_approval BOOLEAN DEFAULT false,
      sold_at TIMESTAMPTZ,
      checkout_expires_at TIMESTAMPTZ,
      is_auction BOOLEAN DEFAULT false,
      auction_status TEXT DEFAULT 'pending',
      auction_reserve_price NUMERIC(12, 2),
      auction_end_time TIMESTAMPTZ,
      auction_description TEXT,
      current_bid NUMERIC(12, 2),
      bidder_count INT DEFAULT 0,
      verification_code TEXT,
      video_url TEXT,
      is_verified_flip BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('- inventory table OK');

  await client.query(`
    CREATE TABLE IF NOT EXISTS shop_config (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      playerindex_api_key TEXT,
      playerindex_api_base_url TEXT,
      discount_rate NUMERIC(5, 2) DEFAULT 0.0,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('- shop_config table OK');

  try {
    await client.query(
      'ALTER TABLE shop_config ADD COLUMN IF NOT EXISTS playerindex_api_base_url TEXT'
    );
  } catch (e) {
    console.warn('[init_db] shop_config playerindex_api_base_url alter:', e.message || e);
  }

  let configRowResult = await client.query('SELECT * FROM shop_config LIMIT 1');
  if (configRowResult.rows.length === 0) {
    await client.query('INSERT INTO shop_config (discount_rate) VALUES (0.0)');
    configRowResult = await client.query('SELECT * FROM shop_config LIMIT 1');
  }
  const configRow = configRowResult.rows[0];

  let playerIndexApiKey = process.env.PLAYERINDEX_API_KEY;

  if (playerIndexApiKey) {
    console.log('API key available (PLAYERINDEX_API_KEY on host).');
    const envGateway = (process.env.FINTECH_API_URL || process.env.API_BASE_URL || '')
      .trim()
      .replace(/\/+$/, '');
    if (envGateway) {
      try {
        await client.query(
          `UPDATE shop_config SET playerindex_api_base_url = $1
           WHERE id = $2
             AND playerindex_api_key IS NOT NULL
             AND (playerindex_api_base_url IS NULL OR TRIM(playerindex_api_base_url) = '')`,
          [envGateway, configRow.id]
        );
      } catch (e) {
        console.warn('[init_db] backfill playerindex_api_base_url:', e.message || e);
      }
    }
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS store_settings (
      id INT PRIMARY KEY,
      oracle_discount_percentage NUMERIC(5, 2) DEFAULT 0.0,
      live_stream_url TEXT,
      site_name TEXT DEFAULT 'Card Shop',
      store_description TEXT DEFAULT 'Zero-fee sports card storefront',
      site_theme TEXT DEFAULT 'dark',
      projection_timeframe TEXT DEFAULT '90-Day',
      cart_minimum NUMERIC(10, 2) DEFAULT 20.00,
      site_announcement TEXT DEFAULT '',
      paypal_email TEXT DEFAULT '',
      allow_offers BOOLEAN DEFAULT true,
      social_instagram TEXT DEFAULT '',
      social_twitter TEXT DEFAULT '',
      social_facebook TEXT DEFAULT '',
      social_discord TEXT DEFAULT '',
      social_threads TEXT DEFAULT '',
      site_author TEXT,
      payment_link TEXT DEFAULT '',
      payment_instructions TEXT DEFAULT '',
      payment_venmo TEXT DEFAULT '',
      payment_paypal TEXT DEFAULT '',
      payment_cashapp TEXT DEFAULT '',
      payment_zelle TEXT DEFAULT '',
      shipping_fee NUMERIC(10, 2) DEFAULT 4.00,
      free_shipping_threshold NUMERIC(10, 2) DEFAULT 25.00,
      site_announcement_url TEXT,
      auction_qr_url TEXT,
      auto_updates_enabled BOOLEAN DEFAULT false
    );
  `);
  await client.query(`INSERT INTO store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);
  console.log('- store_settings table OK');

  await client.query(`
    CREATE TABLE IF NOT EXISTS trade_offers (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      buyer_name TEXT NOT NULL,
      buyer_email TEXT NOT NULL,
      offer_text TEXT,
      target_items JSONB,
      attached_image_url TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('- trade_offers table OK');

  await client.query(`
    CREATE TABLE IF NOT EXISTS coin_requests (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      item_id UUID,
      buyer_email TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('- coin_requests table OK');

  await client.query(`
    CREATE TABLE IF NOT EXISTS auction_bids (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      item_id UUID NOT NULL,
      bidder_email TEXT NOT NULL,
      bid_amount NUMERIC(12, 2) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('- auction_bids table OK');

  await client.query(`
    CREATE TABLE IF NOT EXISTS scan_staging (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      player_name TEXT DEFAULT '',
      team_name TEXT DEFAULT '',
      card_set TEXT DEFAULT '',
      card_number TEXT DEFAULT '',
      insert_name TEXT DEFAULT '',
      parallel_name TEXT DEFAULT '',
      print_run TEXT,
      raw_front_url TEXT,
      raw_back_url TEXT,
      image_url TEXT,
      back_image_url TEXT,
      listed_price NUMERIC(10, 2) DEFAULT 0,
      market_price NUMERIC(10, 2) DEFAULT 0,
      upload_kind TEXT DEFAULT 'single_pair',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('- scan_staging table OK');

  await client.query(`
    CREATE TABLE IF NOT EXISTS draft_cards (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      player_name TEXT NOT NULL,
      card_set TEXT,
      insert_name TEXT,
      parallel_name TEXT,
      side_a_url TEXT,
      side_b_url TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('- draft_cards table OK');

  await client.query(`
    CREATE TABLE IF NOT EXISTS stored_images (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      data BYTEA NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'image/jpeg',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('- stored_images table OK');

  await client.query(`
    CREATE TABLE IF NOT EXISTS store_updates (
      id INT PRIMARY KEY,
      deploy_hook_url TEXT,
      last_update_triggered_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await client.query(`INSERT INTO store_updates (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);
  console.log('- store_updates table OK');

  await runIdempotentAlters(client);
  console.log('- Column upgrades applied (IF NOT EXISTS)');

  // If the API key is set as an env var, clear the legacy DB copy.
  if (process.env.PLAYERINDEX_API_KEY && configRow.playerindex_api_key) {
    await client.query(
      'UPDATE shop_config SET playerindex_api_key = NULL WHERE id = $1',
      [configRow.id]
    );
    console.log('[init_db] Cleared legacy playerindex_api_key from shop_config (env var takes precedence).');
  }

  await client.end();
  console.log('Database schema initialized successfully.');
}

init().catch((err) => {
  console.error('DB init warning (non-fatal):', err.message || err);
});
