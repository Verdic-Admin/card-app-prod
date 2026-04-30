const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  const res = await pool.query("SELECT id, player_name, card_set, card_number, parallel_name, print_run, is_rookie, listed_price, market_price FROM inventory WHERE player_name ILIKE '%Tristan Peters%';");
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}
run().catch(e => { console.error(e); process.exit(1); });
