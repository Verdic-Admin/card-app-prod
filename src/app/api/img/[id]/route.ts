import { NextRequest, NextResponse } from 'next/server';
import pool from '@/utils/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Basic UUID format check to prevent injection
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const { rows } = await pool.query<{ data: Buffer; content_type: string }>(
      `SELECT data, content_type FROM stored_images WHERE id = $1::uuid`,
      [id],
    );

    if (!rows.length) {
      return new NextResponse('Not found', { status: 404 });
    }

    const { data, content_type } = rows[0];

    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': content_type || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (e) {
    console.error('[api/img] query error:', e);
    return new NextResponse('Server error', { status: 500 });
  }
}
