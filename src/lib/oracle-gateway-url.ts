/**
 * Single public hostname for auth-gateway (fintech + identify + scan).
 * Railway/docs historically used both names — accept either so half the app
 * never points at the wrong host when only one var is set.
 */
export function getOracleGatewayBaseUrl(): string {
  const raw =
    process.env.FINTECH_API_URL ||
    process.env.API_BASE_URL ||
    'https://api.playerindexdata.com';
  return raw.replace(/\/+$/, '');
}
