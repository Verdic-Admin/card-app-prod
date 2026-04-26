/**
 * Public HTTPS origin for this deployment (no trailing slash).
 * Used so uploaded asset URLs are absolute for server-to-server fetches.
 */
export function getAppOrigin(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  // Railway injects RAILWAY_PUBLIC_DOMAIN (without https://).
  const railway = (process.env.RAILWAY_PUBLIC_DOMAIN || '').trim();
  if (railway) {
    const host = railway.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (host) return `https://${host}`;
  }

  // Local dev fallback
  const port = process.env.PORT || '3000';
  if (process.env.NODE_ENV === 'development') {
    return `http://localhost:${port}`;
  }

  return '';
}
