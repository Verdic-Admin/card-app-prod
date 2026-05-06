import { NextRequest, NextResponse } from 'next/server';
import pool from '@/utils/db';

/**
 * GET /api/admin/typeahead?field=player_name&q=Jeter
 * GET /api/admin/typeahead?field=card_set&q=Topps&player=Derek+Jeter
 * GET /api/admin/typeahead?field=insert_name&q=Gold&player=Derek+Jeter&set=2023+Topps
 * GET /api/admin/typeahead?field=parallel_name&q=Chrome&set=2023+Topps
 *
 * Lightweight autocomplete endpoint. Hits the Postgres pool directly.
 * Returns: { results: string[] }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const field  = searchParams.get('field') ?? '';
  const q      = searchParams.get('q') ?? '';
  const player = searchParams.get('player') ?? '';
  const set    = searchParams.get('set') ?? '';

  if (q.length < 2 && !player) {
    return NextResponse.json({ results: [] });
  }

  try {
    let sql = '';
    const params: string[] = [];

    if (field === 'player_name') {
      sql = `
        SELECT DISTINCT player_name
        FROM player_metadata
        WHERE player_name ILIKE $1
        ORDER BY player_name
        LIMIT 20
      `;
      params.push(`%${q}%`);

    } else if (field === 'card_set') {
      if (player && q.length >= 1) {
        sql = `
          SELECT DISTINCT card_set
          FROM master_card_catalog
          WHERE player_name ILIKE $1
            AND card_set ILIKE $2
            AND card_set IS NOT NULL AND card_set != ''
          ORDER BY card_set
          LIMIT 30
        `;
        params.push(player, `%${q}%`);
      } else if (player) {
        sql = `
          SELECT DISTINCT card_set
          FROM master_card_catalog
          WHERE player_name ILIKE $1
            AND card_set IS NOT NULL AND card_set != ''
          ORDER BY card_set
          LIMIT 30
        `;
        params.push(player);
      } else {
        sql = `
          SELECT DISTINCT card_set
          FROM master_card_catalog
          WHERE card_set ILIKE $1
            AND card_set IS NOT NULL AND card_set != ''
          ORDER BY card_set
          LIMIT 30
        `;
        params.push(`%${q}%`);
      }

    } else if (field === 'insert_name') {
      if (player && set) {
        sql = `
          SELECT DISTINCT insert_name
          FROM master_card_catalog
          WHERE player_name ILIKE $1
            AND card_set ILIKE $2
            AND insert_name ILIKE $3
            AND insert_name IS NOT NULL AND insert_name != '' AND insert_name != 'Base'
          ORDER BY insert_name
          LIMIT 20
        `;
        params.push(player, set, `%${q}%`);
      } else {
        sql = `
          SELECT DISTINCT insert_name
          FROM master_card_catalog
          WHERE insert_name ILIKE $1
            AND insert_name IS NOT NULL AND insert_name != '' AND insert_name != 'Base'
          ORDER BY insert_name
          LIMIT 20
        `;
        params.push(`%${q}%`);
      }

    } else if (field === 'parallel_name') {
      if (set) {
        sql = `
          SELECT DISTINCT parallel_name
          FROM master_card_catalog
          WHERE card_set ILIKE $1
            AND parallel_name ILIKE $2
            AND parallel_name IS NOT NULL AND parallel_name != '' AND parallel_name != 'Base'
          ORDER BY parallel_name
          LIMIT 20
        `;
        params.push(set, `%${q}%`);
      } else {
        sql = `
          SELECT DISTINCT parallel_name
          FROM master_card_catalog
          WHERE parallel_name ILIKE $1
            AND parallel_name IS NOT NULL AND parallel_name != '' AND parallel_name != 'Base'
          ORDER BY parallel_name
          LIMIT 20
        `;
        params.push(`%${q}%`);
      }
    } else {
      return NextResponse.json({ results: [] });
    }

    const { rows } = await pool.query(sql, params);
    const results = rows.map((r: any) => r[field]).filter(Boolean);
    return NextResponse.json({ results });

  } catch (err: any) {
    console.error('[typeahead API]', err.message);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
