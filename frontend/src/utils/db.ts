import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default pool;
