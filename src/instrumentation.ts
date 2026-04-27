/**
 * Next.js Instrumentation Hook
 * Runs once on server startup (Node.js runtime only).
 * Registers this store with the Player Index Oracle fleet ledger.
 *
 * Railway built-in env vars used (automatically set by Railway, no config needed):
 *   RAILWAY_PUBLIC_DOMAIN   — e.g. mystore.up.railway.app
 *   RAILWAY_SERVICE_ID      — UUID of this Railway service
 *   RAILWAY_PROJECT_ID      — UUID of this Railway project
 *
 * Injected by Player Index during deploy:
 *   PLAYERINDEX_API_KEY     — store's Oracle API key
 *   API_BASE_URL            — Oracle base URL
 */

export async function register() {
  // Only run in Node.js, not in Edge runtime
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const storeUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : null);

  const apiKey      = process.env.PLAYERINDEX_API_KEY;
  const oracleBase  = process.env.API_BASE_URL || 'https://playerindexdata.com';

  // Railway built-in IDs — always present on Railway deployments
  const serviceId   = process.env.RAILWAY_SERVICE_ID   || null;
  const projectId   = process.env.RAILWAY_PROJECT_ID   || null;

  if (!storeUrl || !apiKey) {
    console.log(
      `[fleet] Skipping Oracle registration — missing: ${[
        !storeUrl && 'NEXTAUTH_URL/RAILWAY_PUBLIC_DOMAIN',
        !apiKey   && 'PLAYERINDEX_API_KEY',
      ]
        .filter(Boolean)
        .join(', ')}`,
    );
    return;
  }

  try {
    console.log(`[fleet] Registering store with Oracle: ${storeUrl}`);
    if (serviceId) console.log(`[fleet] Railway service ID: ${serviceId}`);

    const res = await fetch(`${oracleBase}/api/fleet/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        store_url:          storeUrl,
        railway_service_id: serviceId,
        railway_project_id: projectId,
      }),
      signal: AbortSignal.timeout(5000),
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
