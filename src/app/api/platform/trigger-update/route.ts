import { NextRequest, NextResponse } from 'next/server';
import pool from '@/utils/db';

/**
 * POST /api/platform/trigger-update
 *
 * Called when the shop admin clicks "Update Now" in the dashboard.
 * Reads the stored Vercel Deploy Hook URL from store_updates table
 * and fires it to trigger a fresh deployment (which runs update_from_upstream.js).
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin auth (simple password check from cookie — same as other admin routes)
    const authCookie = req.cookies.get('admin_session')?.value;
    if (!authCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read the deploy hook URL from the database
    const { rows } = await pool.query(
      `SELECT deploy_hook_url FROM store_updates WHERE id = 1`
    );

    const hookUrl = rows[0]?.deploy_hook_url;

    if (!hookUrl) {
      return NextResponse.json({
        error: 'No deploy hook configured. Go to Settings → Platform Updates to paste your Vercel Deploy Hook URL.',
      }, { status: 400 });
    }

    // Fire the Vercel Deploy Hook (POST request to their webhook URL)
    const hookRes = await fetch(hookUrl, { method: 'POST' });

    if (!hookRes.ok) {
      const body = await hookRes.text().catch(() => hookRes.statusText);
      return NextResponse.json({
        error: `Deploy hook failed: ${body}`,
      }, { status: 502 });
    }

    // Mark the update as triggered
    await pool.query(
      `UPDATE store_updates SET last_update_triggered_at = NOW() WHERE id = 1`
    );

    return NextResponse.json({
      success: true,
      message: 'Deployment triggered! Your store will rebuild with the latest features in 2-3 minutes.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[trigger-update]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
