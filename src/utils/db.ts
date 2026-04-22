import { Pool } from 'pg';

const rawDatabaseUrl = (process.env.DATABASE_URL || '').trim();

function hasResolvableHost(connectionString: string): boolean {
  if (!connectionString) return false;
  try {
    const parsed = new URL(connectionString);
    // Guard against placeholder values like "base" that fail DNS at build time.
    return Boolean(parsed.hostname) && parsed.hostname !== 'base';
  } catch {
    return false;
  }
}

export const hasUsableDatabaseUrl = hasResolvableHost(rawDatabaseUrl);

export const pool = new Pool({
  connectionString: rawDatabaseUrl || '',
});

export default pool;
