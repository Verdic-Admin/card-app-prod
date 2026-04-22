import { redirect } from 'next/navigation';
import pool from '@/utils/db';

// Stable short URL for printed QR codes / signage. Always works and can be
// redirected to a custom URL via `store_settings.auction_qr_url` without
// reprinting any physical QR assets.
export const dynamic = 'force-dynamic';

export default async function BidRedirectPage() {
  let target = '/auction';
  try {
    const { rows } = await pool.query(
      `SELECT auction_qr_url FROM store_settings WHERE id = 1`,
    );
    const configured = rows[0]?.auction_qr_url;
    if (typeof configured === 'string' && configured.trim().length > 0) {
      target = configured.trim();
    }
  } catch {
    // Fall through to /auction default.
  }
  redirect(target);
}
