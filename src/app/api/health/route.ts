import { NextResponse } from 'next/server';

/**
 * Liveness for Railway / load balancers. No DB, no session — must return 200 fast
 * so deploy health checks do not depend on the storefront home page (which hits DB
 * and heavy RSC work).
 */
export const runtime = 'nodejs';

export function GET() {
  return NextResponse.json(
    { ok: true, service: 'card-app' },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
