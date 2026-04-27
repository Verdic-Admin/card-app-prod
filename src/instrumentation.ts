/**
 * Next.js Instrumentation Hook
 * Runs once on server startup (Node.js runtime only).
 * Registers this store's public URL with the Player Index Oracle fleet ledger.
 *
 * Required env vars:
 *   NEXTAUTH_URL          — the public URL of this store (e.g. https://xxx.up.railway.app)
 *   PLAYERINDEX_API_KEY   — the store's API key (injected by Railway wizard)
 *   API_BASE_URL          — Oracle base URL (e.g. https://playerindexdata.com)
 */

export async function register() {
  // Only run in Node.js, not in Edge runtime
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const storeUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : null);

  const apiKey = process.env.PLAYERINDEX_API_KEY;
  const oracleBase = process.env.API_BASE_URL;

  if (!storeUrl || !apiKey || !oracleBase) {
    console.log(
      `[fleet] Skipping Oracle registration — missing: ${[
        !storeUrl && 'NEXTAUTH_URL/RAILWAY_PUBLIC_DOMAIN',
        !apiKey && 'PLAYERINDEX_API_KEY',
        !oracleBase && 'API_BASE_URL',
      ]
        .filter(Boolean)
        .join(', ')}`,
    );
    return;
  }

  try {
    console.log(`[fleet] Registering store with Oracle: ${storeUrl}`);
    const res = await fetch(`${oracleBase}/api/fleet/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ store_url: storeUrl }),
    });

    if (res.ok) {
      console.log(`[fleet] Store registered successfully: ${storeUrl}`);
    } else {
      const body = await res.text();
      console.error(`[fleet] Registration failed (${res.status}): ${body}`);
    }
  } catch (err) {
    console.error('[fleet] Registration error (non-fatal):', err);
  }
}
