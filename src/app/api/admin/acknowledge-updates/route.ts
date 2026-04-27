import { NextResponse } from 'next/server';
import pool from '@/utils/db';

/**
 * POST /api/admin/acknowledge-updates
 * Sets auto_updates_enabled = true in store_settings.
 * Protected by the ADMIN_PASSWORD env var (same as all other admin routes).
 */
export async function POST(request: Request) {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const auth = request.headers.get('x-admin-password');

    if (adminPassword && auth !== adminPassword) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await pool.query(
      'UPDATE store_settings SET auto_updates_enabled = true WHERE id = 1'
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[acknowledge-updates]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/admin/acknowledge-updates
 * Returns the current auto_updates_enabled status.
 */
export async function GET() {
  try {
    const result = await pool.query(
      'SELECT auto_updates_enabled FROM store_settings WHERE id = 1'
    );
    const enabled = result.rows[0]?.auto_updates_enabled ?? false;
    return NextResponse.json({ auto_updates_enabled: enabled });
  } catch (err) {
    console.error('[acknowledge-updates GET]', err);
    return NextResponse.json({ auto_updates_enabled: false });
  }
}
