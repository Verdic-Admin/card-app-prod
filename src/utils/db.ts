/**
 * Postgres connection pool — standard `pg` driver over TCP.
 * Works with Railway Postgres, Neon (TCP mode), Supabase, or any standard Postgres.
 */
import { Pool } from 'pg';

const connectionString = (
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  ''
).trim();

function hasResolvableHost(cs: string): boolean {
  if (!cs) return false;
  try {
    const parsed = new URL(cs);
    return Boolean(parsed.hostname) && parsed.hostname !== 'base';
  } catch {
    return false;
  }
}

export const hasUsableDatabaseUrl = hasResolvableHost(connectionString);

export const pool = new Pool({ connectionString });

export default pool;
