require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('ALTER TABLE inventory ADD COLUMN IF NOT EXISTS p_bull numeric, ADD COLUMN IF NOT EXISTS p_bear numeric;')
  .then(() => { console.log('Migration OK'); process.exit(0); })
  .catch(e => { console.error('Error:', e.message); process.exit(1); });
