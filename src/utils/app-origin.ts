/**
 * Public HTTPS origin for this deployment (no trailing slash).
 * Used so uploaded asset URLs are absolute for server-to-server fetches
 * (scanner, card identifier) when NEXT_PUBLIC_SITE_URL was not wired in the dashboard.
 */
export function getAppOrigin(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  // Vercel injects VERCEL_URL (without https://) on every deployment.
  const vercel = (process.env.VERCEL_URL || '').trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (host) return `https://${host}`;
  }

  return '';
}
