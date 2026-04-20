/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require('pg');

async function init() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn("WARNING: DATABASE_URL is not defined. Skipping database initialization.");
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();

  console.log("Connected to Postgres. Initializing schema...");

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
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
  `);
  console.log("- Created inventory table");

  await client.query(`
    CREATE TABLE IF NOT EXISTS shop_config (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                playerindex_api_key TEXT,
                discount_rate NUMERIC(5, 2) DEFAULT 0.0,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
  `);
  console.log("- Created shop_config");

  // Manage ephemeral environment injection via persistent shop_config
  let configRowResult = await client.query('SELECT * FROM shop_config LIMIT 1');
  if (configRowResult.rows.length === 0) {
      await client.query('INSERT INTO shop_config (discount_rate) VALUES (0.0)');
      configRowResult = await client.query('SELECT * FROM shop_config LIMIT 1');
  }
  const configRow = configRowResult.rows[0];

  let playerIndexApiKey = process.env.PLAYERINDEX_API_KEY || configRow.playerindex_api_key;
  const provisioningToken = process.env.PROVISIONING_TOKEN;

  const apiBaseUrl = process.env.API_BASE_URL || 'https://api.playerindexdata.com';
  if (!playerIndexApiKey && provisioningToken) {
    console.log(`Found PROVISIONING_TOKEN. Exchanging with ${apiBaseUrl} for permanent API key...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const resp = await fetch(`${apiBaseUrl}/fintech/provisioning/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: provisioningToken }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const raw = await resp.text();
      let data = {};
      try { data = JSON.parse(raw); } catch { /* non-JSON response */ }

      if (resp.ok && data.api_key) {
        playerIndexApiKey = data.api_key;
        await client.query('UPDATE shop_config SET playerindex_api_key = $1 WHERE id = $2', [playerIndexApiKey, configRow.id]);
        console.log("Successfully exchanged Provisioning Token and saved securely to database.");
      } else {
        const msg = data.detail || data.error || raw.slice(0, 200) || `HTTP ${resp.status}`;
        console.error(`Failed to exchange Provisioning Token [${resp.status}]: ${msg}`);
      }
    } catch (e) {
      clearTimeout(timeoutId);
      console.error("Error during Provisioning Token exchange:", e.message);
    }
  }

  if (playerIndexApiKey) {
     console.log("Database initialized securely. API Key available internally.");
  }


  await client.query(`
    CREATE TABLE IF NOT EXISTS store_settings (
                id INT PRIMARY KEY,
                oracle_discount_percentage NUMERIC(5, 2) DEFAULT 0.0,
                live_stream_url TEXT,
                site_name TEXT DEFAULT 'The Gap Sportscards',
                store_description TEXT DEFAULT 'Zero-fee sports card storefront',
                site_theme TEXT DEFAULT 'dark',
                projection_timeframe TEXT DEFAULT '90-Day'
            );
  `);
  await client.query(`INSERT INTO store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);
  console.log("- Created store_settings");

  await client.query(`
    CREATE TABLE IF NOT EXISTS trade_offers (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                buyer_name TEXT NOT NULL,
                buyer_email TEXT NOT NULL,
                offer_text TEXT,
                target_items JSONB,
                attached_image_url TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
  `);
  console.log("- Created trade_offers");

  await client.query(`
    CREATE TABLE IF NOT EXISTS coin_requests (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                item_id UUID,
                buyer_email TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
  `);
  console.log("- Created coin_requests");

  await client.query(`
    CREATE TABLE IF NOT EXISTS draft_cards (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                player_name TEXT NOT NULL,
                card_set TEXT,
                insert_name TEXT,
                parallel_name TEXT,
                side_a_url TEXT,
                side_b_url TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
  `);
  console.log("- Created draft_cards");

  await client.end();
  console.log("Database schema initialized successfully!");
}

init().catch(err => {
    console.error("DB init warning (non-fatal):", err.message || err);
    // Do NOT exit - let Next.js start regardless of DB init errors
});
