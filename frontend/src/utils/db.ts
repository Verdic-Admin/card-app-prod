import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL is not defined during build. Ensure it is injected at runtime.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || '',
});

export default pool;
