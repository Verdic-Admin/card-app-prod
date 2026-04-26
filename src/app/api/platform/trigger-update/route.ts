import { NextRequest, NextResponse } from 'next/server';
import pool from '@/utils/db';

/**
 * POST /api/platform/trigger-update
 *
 * Called when the shop admin clicks "Update Now" in the dashboard.
 * Sends a request to the Master Server using PLAYERINDEX_API_KEY to 
 * trigger a fresh redeployment.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin auth (simple password check from cookie — same as other admin routes)
    const authCookie = req.cookies.get('admin_session')?.value;
    if (!authCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.PLAYERINDEX_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'PLAYERINDEX_API_KEY is missing from environment variables. Cannot trigger update.',
      }, { status: 400 });
    }

    const masterUrl = process.env.API_BASE_URL || 'https://api.playerindexdata.com';
    const triggerRes = await fetch(`${masterUrl}/api/store/trigger-update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!triggerRes.ok) {
      const body = await triggerRes.text().catch(() => triggerRes.statusText);
      return NextResponse.json({
        error: `Master server update failed: ${body}`,
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
