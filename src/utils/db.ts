import { Pool } from '@neondatabase/serverless';

// Neon reads POSTGRES_URL natively. Fall back to DATABASE_URL for local dev.
const connectionString = (
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  ''
).trim();

function hasResolvableHost(cs: string): boolean {
  if (!cs) return false;
  try {
    const parsed = new URL(cs);
    // Guard against placeholder values like "base" that fail DNS at build time.
    return Boolean(parsed.hostname) && parsed.hostname !== 'base';
  } catch {
    return false;
  }
}

export const hasUsableDatabaseUrl = hasResolvableHost(connectionString);

// @neondatabase/serverless Pool is a drop-in replacement for pg Pool.
// It uses WebSockets for serverless/edge environments and HTTP for Node.js.
export const pool = new Pool({ connectionString });

export default pool;
