const { Client } = require('pg');

async function init() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();

  console.log("Connected to standard Postgres using DATABASE_URL");

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
  console.log("Created inventory table");

  await client.query(`
    CREATE TABLE IF NOT EXISTS shop_config (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                playerindex_api_key TEXT,
                discount_rate NUMERIC(5, 2) DEFAULT 0.0,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
  `);
  console.log("Created shop_config");

  await client.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                reset_token TEXT,
                reset_token_expires_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
  `);
  console.log("Created admin_users");

  // Bootstrap the initial Admin User if provided by the Master Orchestrator
  if (process.env.ADMIN_EMAIL && process.env.INITIAL_ADMIN_PASSWORD) {
    console.log("Bootstrapping initial admin user...");
    // Attempt to insert the admin user. If the email already exists, do nothing securely.
    await client.query(`
      INSERT INTO admin_users (email, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (email) DO NOTHING
    `, [process.env.ADMIN_EMAIL, process.env.INITIAL_ADMIN_PASSWORD]);
    console.log("Admin user bootstrapped successfully.");
  } else {
    console.log("No ADMIN_EMAIL or INITIAL_ADMIN_PASSWORD provided to bootstrap.");
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS store_settings (
                id INT PRIMARY KEY,
                oracle_discount_percentage NUMERIC(5, 2) DEFAULT 0.0,
                live_stream_url TEXT,
                projection_timeframe TEXT DEFAULT '90-Day'
            );
  `);
  await client.query(`INSERT INTO store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);
  console.log("Created store_settings");

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
  console.log("Created trade_offers");

  await client.query(`
    CREATE TABLE IF NOT EXISTS coin_requests (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                item_id UUID,
                buyer_email TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
  `);
  console.log("Created coin_requests");

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
  console.log("Created draft_cards");

  await client.end();
  console.log("Done!");
}

init().catch(console.error);
