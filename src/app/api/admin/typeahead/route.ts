import { NextRequest, NextResponse } from 'next/server';
import pool from '@/utils/db';

/**
 * GET /api/admin/typeahead?field=player_name&q=Jeter
 * GET /api/admin/typeahead?field=card_set&q=Topps&player=Derek+Jeter
 * GET /api/admin/typeahead?field=insert_name&q=Gold&player=Derek+Jeter&set=2023+Topps
 * GET /api/admin/typeahead?field=parallel_name&q=Chrome&set=2023+Topps
 *
 * Queries catalog_* reference tables (populated by sync_catalog.js at deploy time).
 * Falls back to querying the inventory table if catalog tables don't exist yet.
 * Returns: { results: string[], source: 'catalog' | 'inventory' }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const field  = searchParams.get('field') ?? '';
  const q      = searchParams.get('q') ?? '';
  const player = searchParams.get('player') ?? '';
  const set    = searchParams.get('set') ?? '';

  if (!field) return NextResponse.json({ results: [] });
  if (q.length < 1 && !player && !set) return NextResponse.json({ results: [] });

  try {
    // Check if catalog tables exist
    const { rows: tableCheck } = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'catalog_%'
      LIMIT 1
    `);
    const hasCatalog = tableCheck.length > 0;

    let sql = '';
    const params: string[] = [];

    if (field === 'player_name') {
      if (hasCatalog) {
        sql = `SELECT DISTINCT player_name FROM catalog_players WHERE player_name ILIKE $1 ORDER BY player_name LIMIT 20`;
        params.push(`%${q}%`);
      } else {
        sql = `SELECT DISTINCT player_name FROM inventory WHERE player_name ILIKE $1 AND player_name IS NOT NULL ORDER BY player_name LIMIT 20`;
        params.push(`%${q}%`);
      }

    } else if (field === 'card_set') {
      if (hasCatalog) {
        if (player && q) {
          sql = `SELECT DISTINCT card_set FROM catalog_sets WHERE player_name ILIKE $1 AND card_set ILIKE $2 ORDER BY card_set LIMIT 30`;
          params.push(player, `%${q}%`);
        } else if (player) {
          sql = `SELECT DISTINCT card_set FROM catalog_sets WHERE player_name ILIKE $1 AND card_set IS NOT NULL ORDER BY card_set LIMIT 30`;
          params.push(player);
        } else {
          sql = `SELECT DISTINCT card_set FROM catalog_sets WHERE card_set ILIKE $1 ORDER BY card_set LIMIT 30`;
          params.push(`%${q}%`);
        }
      } else {
        // Fallback: inventory
        if (player && q) {
          sql = `SELECT DISTINCT card_set FROM inventory WHERE player_name ILIKE $1 AND card_set ILIKE $2 AND card_set IS NOT NULL ORDER BY card_set LIMIT 30`;
          params.push(player, `%${q}%`);
        } else if (player) {
          sql = `SELECT DISTINCT card_set FROM inventory WHERE player_name ILIKE $1 AND card_set IS NOT NULL ORDER BY card_set LIMIT 30`;
          params.push(player);
        } else {
          sql = `SELECT DISTINCT card_set FROM inventory WHERE card_set ILIKE $1 AND card_set IS NOT NULL ORDER BY card_set LIMIT 30`;
          params.push(`%${q}%`);
        }
      }

    } else if (field === 'insert_name') {
      if (hasCatalog) {
        if (player && set && q) {
          sql = `SELECT DISTINCT insert_name FROM catalog_inserts WHERE player_name ILIKE $1 AND card_set ILIKE $2 AND insert_name ILIKE $3 ORDER BY insert_name LIMIT 20`;
          params.push(player, set, `%${q}%`);
        } else if (player && set) {
          sql = `SELECT DISTINCT insert_name FROM catalog_inserts WHERE player_name ILIKE $1 AND card_set ILIKE $2 ORDER BY insert_name LIMIT 20`;
          params.push(player, set);
        } else if (q) {
          sql = `SELECT DISTINCT insert_name FROM catalog_inserts WHERE insert_name ILIKE $1 ORDER BY insert_name LIMIT 20`;
          params.push(`%${q}%`);
        }
      } else {
        // Fallback: inventory
        if (player && set) {
          sql = `SELECT DISTINCT insert_name FROM inventory WHERE player_name ILIKE $1 AND card_set ILIKE $2 AND insert_name IS NOT NULL AND insert_name != '' ORDER BY insert_name LIMIT 20`;
          params.push(player, set);
        } else {
          sql = `SELECT DISTINCT insert_name FROM inventory WHERE insert_name ILIKE $1 AND insert_name IS NOT NULL AND insert_name != '' ORDER BY insert_name LIMIT 20`;
          params.push(`%${q}%`);
        }
      }

    } else if (field === 'parallel_name') {
      if (hasCatalog) {
        if (set && q) {
          sql = `SELECT DISTINCT parallel_name FROM catalog_parallels WHERE card_set ILIKE $1 AND parallel_name ILIKE $2 ORDER BY parallel_name LIMIT 20`;
          params.push(set, `%${q}%`);
        } else if (set) {
          sql = `SELECT DISTINCT parallel_name FROM catalog_parallels WHERE card_set ILIKE $1 ORDER BY parallel_name LIMIT 20`;
          params.push(set);
        } else if (q) {
          sql = `SELECT DISTINCT parallel_name FROM catalog_parallels WHERE parallel_name ILIKE $1 ORDER BY parallel_name LIMIT 20`;
          params.push(`%${q}%`);
        }
      } else {
        if (set) {
          sql = `SELECT DISTINCT parallel_name FROM inventory WHERE card_set ILIKE $1 AND parallel_name IS NOT NULL AND parallel_name != '' ORDER BY parallel_name LIMIT 20`;
          params.push(set);
        } else {
          sql = `SELECT DISTINCT parallel_name FROM inventory WHERE parallel_name ILIKE $1 AND parallel_name IS NOT NULL AND parallel_name != '' ORDER BY parallel_name LIMIT 20`;
          params.push(`%${q}%`);
        }
      }
    } else {
      return NextResponse.json({ results: [] });
    }

    if (!sql) return NextResponse.json({ results: [] });

    const { rows } = await pool.query(sql, params);
    const results = rows.map((r: any) => r[field]).filter(Boolean);
    return NextResponse.json({ results, source: hasCatalog ? 'catalog' : 'inventory' });

  } catch (err: any) {
    console.error('[typeahead API]', err.message);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
