import { NextRequest, NextResponse } from 'next/server';
import pool from '@/utils/db';

/**
 * POST /api/platform/save-deploy-hook
 *
 * Saves the customer's Vercel Deploy Hook URL into the database.
 * Called from the admin settings page when they paste their hook.
 */
export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('admin_session')?.value;
    if (!authCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const hookUrl = (body.deploy_hook_url || '').trim();

    if (!hookUrl) {
      return NextResponse.json({ error: 'Deploy hook URL is required.' }, { status: 400 });
    }

    // Basic validation — Vercel deploy hooks look like: https://api.vercel.com/v1/integrations/deploy/...
    if (!hookUrl.startsWith('https://')) {
      return NextResponse.json({ error: 'Invalid URL. Must be an HTTPS URL.' }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO store_updates (id, deploy_hook_url)
       VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET deploy_hook_url = $1`,
      [hookUrl]
    );

    return NextResponse.json({ success: true, message: 'Deploy hook saved!' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[save-deploy-hook]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
