import pool from './src/utils/db';

async function main() {
  try {
    const res = await pool.query('SELECT DISTINCT print_run FROM inventory WHERE print_run > 1 ORDER BY print_run');
    console.log(res.rows.map(r => r.print_run));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
main();
