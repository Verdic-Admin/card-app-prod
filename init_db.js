/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Railway / template entrypoint: `node init_db.js && npm run start`
 * Idempotent schema + seed row for store_settings (id=1) and shop_config.
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
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_rookie BOOLEAN DEFAULT false;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_auto BOOLEAN DEFAULT false;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_relic BOOLEAN DEFAULT false;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS grading_company TEXT;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS grade TEXT;
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
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn('WARNING: DATABASE_URL is not defined. Skipping database initialization.');
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();

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
      discount_rate NUMERIC(5, 2) DEFAULT 0.0,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('- shop_config table OK');

  let configRowResult = await client.query('SELECT * FROM shop_config LIMIT 1');
  if (configRowResult.rows.length === 0) {
    await client.query('INSERT INTO shop_config (discount_rate) VALUES (0.0)');
    configRowResult = await client.query('SELECT * FROM shop_config LIMIT 1');
  }
  const configRow = configRowResult.rows[0];

  let playerIndexApiKey = process.env.PLAYERINDEX_API_KEY || configRow.playerindex_api_key;
  const provisioningToken = process.env.PROVISIONING_TOKEN;

  if (!playerIndexApiKey && provisioningToken) {
    // Provisioning exchange is handled by the Vercel-hosted player-index-oracle app.
    const provisioningUrl = 'https://playerindexdata.com/api/provisioning/exchange';
    console.log(`Found PROVISIONING_TOKEN. Exchanging with ${provisioningUrl} for permanent API key...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const resp = await fetch(provisioningUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: provisioningToken }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const raw = await resp.text();
      let data = {};
      try {
        data = JSON.parse(raw);
      } catch {
        /* non-JSON */
      }

      if (resp.ok && data.api_key) {
        playerIndexApiKey = data.api_key;
        await client.query('UPDATE shop_config SET playerindex_api_key = $1 WHERE id = $2', [
          playerIndexApiKey,
          configRow.id,
        ]);
        console.log('Successfully exchanged Provisioning Token and saved API key to shop_config.');
      } else {
        const msg = data.detail || data.error || raw.slice(0, 200) || `HTTP ${resp.status}`;
        console.error(`Failed to exchange Provisioning Token [${resp.status}]: ${msg}`);
      }
    } catch (e) {
      clearTimeout(timeoutId);
      console.error('Error during Provisioning Token exchange:', e.message);
    }
  }

  if (playerIndexApiKey) {
    console.log('API key available (env or shop_config).');
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS store_settings (
      id INT PRIMARY KEY,
      oracle_discount_percentage NUMERIC(5, 2) DEFAULT 0.0,
      live_stream_url TEXT,
      site_name TEXT DEFAULT 'The Gap Sportscards',
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
      free_shipping_threshold NUMERIC(10, 2) DEFAULT 25.00
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

  await runIdempotentAlters(client);
  console.log('- Column upgrades applied (IF NOT EXISTS)');

  await client.end();
  console.log('Database schema initialized successfully.');
}

init().catch((err) => {
  console.error('DB init warning (non-fatal):', err.message || err);
});
