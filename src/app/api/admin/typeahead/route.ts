import { NextRequest, NextResponse } from 'next/server';
import pool from '@/utils/db';

/**
 * GET /api/admin/typeahead?field=player_name&q=Jeter
 * GET /api/admin/typeahead?field=card_set&player=Derek+Jeter&q=Topps
 * GET /api/admin/typeahead?field=insert_name&player=Derek+Jeter&set=2023+Topps&q=Gold
 * GET /api/admin/typeahead?field=parallel_name&set=2026+Topps+Series+1&q=Chro
 *
 * Query priority:
 *   1. catalog_sets / catalog_parallels  (seeded by seed_catalog.js at every deploy)
 *   2. inventory table                   (grows as shop owner adds cards)
 *
 * Returns: { results: string[], source: string }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const field  = searchParams.get('field')  ?? '';
  const q      = searchParams.get('q')      ?? '';
  const player = searchParams.get('player') ?? '';
  const set    = searchParams.get('set')    ?? '';

  if (!field) return NextResponse.json({ results: [] });

  try {
    let rows: any[] = [];

    // ── card_set ─────────────────────────────────────────────────────────────
    if (field === 'card_set') {
      if (!q && !player) return NextResponse.json({ results: [] });

      // 1. Try catalog_sets
      const catalogSql = q
        ? `SELECT card_set FROM catalog_sets WHERE card_set ILIKE $1 ORDER BY card_set LIMIT 30`
        : `SELECT card_set FROM catalog_sets ORDER BY card_set LIMIT 30`;
      const catalogParams = q ? [`%${q}%`] : [];
      const catalogResult = await pool.query(catalogSql, catalogParams).catch(() => ({ rows: [] }));

      // 2. Also search inventory (drilled down by player if available)
      let invRows: any[] = [];
      if (player && q) {
        const r = await pool.query(
          `SELECT DISTINCT card_set FROM inventory WHERE player_name ILIKE $1 AND card_set ILIKE $2 AND card_set IS NOT NULL ORDER BY card_set LIMIT 20`,
          [`%${player}%`, `%${q}%`]
        ).catch(() => ({ rows: [] }));
        invRows = r.rows;
      } else if (player) {
        const r = await pool.query(
          `SELECT DISTINCT card_set FROM inventory WHERE player_name ILIKE $1 AND card_set IS NOT NULL ORDER BY card_set LIMIT 20`,
          [`%${player}%`]
        ).catch(() => ({ rows: [] }));
        invRows = r.rows;
      } else if (q) {
        const r = await pool.query(
          `SELECT DISTINCT card_set FROM inventory WHERE card_set ILIKE $1 AND card_set IS NOT NULL ORDER BY card_set LIMIT 20`,
          [`%${q}%`]
        ).catch(() => ({ rows: [] }));
        invRows = r.rows;
      }

      // Merge, deduplicate
      const seen = new Set<string>();
      const merged: string[] = [];
      for (const r of [...catalogResult.rows, ...invRows]) {
        const v: string = r.card_set;
        if (v && !seen.has(v)) { seen.add(v); merged.push(v); }
      }
      return NextResponse.json({ results: merged.sort((a, b) => a.localeCompare(b)), source: 'catalog+inventory' });
    }

    // ── parallel_name ─────────────────────────────────────────────────────────
    if (field === 'parallel_name') {
      if (!set && q.length < 1) return NextResponse.json({ results: [] });

      // 1. catalog_parallels (with set filter if provided)
      let catalogRows: any[] = [];
      if (set && q) {
        const r = await pool.query(
          `SELECT parallel_name FROM catalog_parallels WHERE card_set ILIKE $1 AND parallel_name ILIKE $2 ORDER BY parallel_name LIMIT 30`,
          [set, `%${q}%`]
        ).catch(() => ({ rows: [] }));
        catalogRows = r.rows;
      } else if (set) {
        const r = await pool.query(
          `SELECT parallel_name FROM catalog_parallels WHERE card_set ILIKE $1 ORDER BY parallel_name LIMIT 30`,
          [set]
        ).catch(() => ({ rows: [] }));
        catalogRows = r.rows;
      } else if (q) {
        const r = await pool.query(
          `SELECT parallel_name FROM catalog_parallels WHERE parallel_name ILIKE $1 ORDER BY parallel_name LIMIT 30`,
          [`%${q}%`]
        ).catch(() => ({ rows: [] }));
        catalogRows = r.rows;
      }

      // 2. inventory parallels
      let invRows: any[] = [];
      if (set) {
        const r = await pool.query(
          `SELECT DISTINCT parallel_name FROM inventory WHERE card_set ILIKE $1 AND parallel_name IS NOT NULL AND parallel_name != '' ORDER BY parallel_name LIMIT 20`,
          [set]
        ).catch(() => ({ rows: [] }));
        invRows = r.rows;
      } else if (q) {
        const r = await pool.query(
          `SELECT DISTINCT parallel_name FROM inventory WHERE parallel_name ILIKE $1 AND parallel_name IS NOT NULL AND parallel_name != '' ORDER BY parallel_name LIMIT 20`,
          [`%${q}%`]
        ).catch(() => ({ rows: [] }));
        invRows = r.rows;
      }

      const seen = new Set<string>();
      const merged: string[] = [];
      for (const r of [...catalogRows, ...invRows]) {
        const v: string = r.parallel_name;
        if (v && !seen.has(v)) { seen.add(v); merged.push(v); }
      }
      return NextResponse.json({ results: merged.sort((a, b) => a.localeCompare(b)), source: 'catalog+inventory' });
    }

    // ── insert_name ───────────────────────────────────────────────────────────
    if (field === 'insert_name') {
      if (!player && !set && q.length < 2) return NextResponse.json({ results: [] });
      let sql = '';
      const params: string[] = [];
      if (player && set) {
        sql = `SELECT DISTINCT insert_name FROM inventory WHERE player_name ILIKE $1 AND card_set ILIKE $2 AND insert_name IS NOT NULL AND insert_name != '' ORDER BY insert_name LIMIT 20`;
        params.push(`%${player}%`, `%${set}%`);
      } else if (q) {
        sql = `SELECT DISTINCT insert_name FROM inventory WHERE insert_name ILIKE $1 AND insert_name IS NOT NULL AND insert_name != '' ORDER BY insert_name LIMIT 20`;
        params.push(`%${q}%`);
      }
      if (!sql) return NextResponse.json({ results: [] });
      rows = (await pool.query(sql, params).catch(() => ({ rows: [] }))).rows;
      return NextResponse.json({ results: rows.map((r: any) => r.insert_name).filter(Boolean), source: 'inventory' });
    }

    // ── player_name ───────────────────────────────────────────────────────────
    if (field === 'player_name') {
      if (q.length < 2) return NextResponse.json({ results: [] });
      rows = (await pool.query(
        `SELECT DISTINCT player_name FROM inventory WHERE player_name ILIKE $1 AND player_name IS NOT NULL ORDER BY player_name LIMIT 20`,
        [`%${q}%`]
      ).catch(() => ({ rows: [] }))).rows;
      return NextResponse.json({ results: rows.map((r: any) => r.player_name).filter(Boolean), source: 'inventory' });
    }

    return NextResponse.json({ results: [] });

  } catch (err: any) {
    console.error('[typeahead API] error:', err.message);
    return NextResponse.json({ results: [], error: err.message }, { status: 500 });
  }
}
