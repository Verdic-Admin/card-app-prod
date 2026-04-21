/**
 * Server-only: API key used to call the Player Index gateway (fintech / identify / scan).
 * Prefer PLAYERINDEX_API_KEY on the host (Railway variables or /tmp/shop-oracle.env from init_db).
 * `shop_config.playerindex_api_key` is not written by provisioning anymore; a non-null value
 * is only read for legacy shops until migrated to host env.
 */
import pool from '@/utils/db';

let cachedKey: string | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

export async function getShopOracleApiKey(): Promise<string> {
  const envKey = process.env.PLAYERINDEX_API_KEY;
  if (envKey) return envKey;

  const now = Date.now();
  if (cachedKey && now - cachedAt < CACHE_TTL_MS) {
    return cachedKey;
  }

  const { rows } = await pool.query<{ playerindex_api_key: string | null }>(
    'SELECT playerindex_api_key FROM shop_config LIMIT 1'
  );
  const key = rows[0]?.playerindex_api_key ?? '';
  cachedKey = key || null;
  cachedAt = now;
  return key;
}

export async function hasShopOracleApiKey(): Promise<boolean> {
  const k = await getShopOracleApiKey();
  return k.length > 0;
}
