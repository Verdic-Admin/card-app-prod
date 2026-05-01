const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  const fs = require('fs');
  const envFile = fs.readFileSync('.env.local', 'utf8');
  for (const line of envFile.split('\n')) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, '');
  }
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT DISTINCT print_run FROM inventory WHERE print_run > 1 ORDER BY print_run').then(res => {
  console.log(res.rows.map(r => r.print_run));
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
