const DEFAULT_ORACLE_GATEWAY = 'https://api.playerindexdata.com';

/**
 * Ensure the gateway URL goes directly to Cloud Run (api.playerindexdata.com)
 * and NOT through Vercel (playerindexdata.com without `api.` prefix).
 *
 * Vercel's WAF intercepts server-to-server multipart uploads and returns 429
 * "Vercel Security Checkpoint" challenge pages that cannot be solved by a
 * headless backend. The `api.` subdomain resolves directly to Cloud Run,
 * bypassing Vercel entirely.
 */
function normalizeGatewayUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '');
  // Fix: https://playerindexdata.com → https://api.playerindexdata.com
  url = url.replace(
    /^(https?:\/\/)(?:www\.)?playerindexdata\.com/,
    '$1api.playerindexdata.com'
  );
  return url;
}

/**
 * Edge routes (no Postgres): use Railway env if you override the public API host.
 * After provisioning, the shop still mirrors URL into env here on redeploy if you set
 * API_BASE_URL / FINTECH_API_URL; otherwise rely on the default LB hostname.
 */
export function getOracleGatewayBaseUrlFromEnv(): string {
  const raw =
    process.env.FINTECH_API_URL ||
    process.env.API_BASE_URL ||
    DEFAULT_ORACLE_GATEWAY;
  return normalizeGatewayUrl(raw);
}

/**
 * Node server actions: prefer `shop_config.playerindex_api_base_url` (saved by
 * `init_db.js` from the provisioning exchange response), then the env chain above.
 */
export async function getOracleGatewayBaseUrl(): Promise<string> {
  try {
    const pool = (await import('@/utils/db')).default;
    const { rows } = await pool.query<{ playerindex_api_base_url: string | null }>(
      'SELECT playerindex_api_base_url FROM shop_config LIMIT 1'
    );
    const u = rows[0]?.playerindex_api_base_url;
    if (u != null && String(u).trim() !== '') {
      return normalizeGatewayUrl(String(u));
    }
  } catch {
    /* e.g. build without DATABASE_URL */
  }
  return getOracleGatewayBaseUrlFromEnv();
}

