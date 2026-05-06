import { NextRequest, NextResponse } from 'next/server';
import pool from '@/utils/db';

/**
 * GET /api/admin/typeahead?field=player_name&q=Judge
 * GET /api/admin/typeahead?field=card_set&q=Heritage&player=Aaron+Judge
 * GET /api/admin/typeahead?field=card_number&set=2026+Topps+Series+1+Baseball&player=Aaron+Judge
 * GET /api/admin/typeahead?field=insert_name&set=2026+Topps+Heritage+Baseball&q=League
 * GET /api/admin/typeahead?field=parallel_name&set=2026+Topps+Heritage+Baseball&q=Bordered
 *
 * Query priority:
 *   1. catalog_cards / catalog_parallels  (synced from Player Index by sync_catalog.js)
 *   2. inventory table fallback
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const field  = searchParams.get('field')  ?? '';
  const q      = searchParams.get('q')      ?? '';
  const player = searchParams.get('player') ?? '';
  const set    = searchParams.get('set')    ?? '';

  if (!field) return NextResponse.json({ results: [] });

  // Check if catalog_cards table exists (sync may not have run yet)
  const hasCatalog = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='catalog_cards' LIMIT 1`
  ).then(r => r.rows.length > 0).catch(() => false);

  try {
    // ── player_name ───────────────────────────────────────────────────────────
    if (field === 'player_name') {
      if (q.length < 2) return NextResponse.json({ results: [] });

      const seen = new Set<string>();
      const results: string[] = [];

      if (hasCatalog) {
        const r = await pool.query(
          `SELECT DISTINCT player_name FROM catalog_cards WHERE player_name ILIKE $1 AND player_name IS NOT NULL ORDER BY player_name LIMIT 30`,
          [`%${q}%`]
        );
        for (const row of r.rows) if (row.player_name && !seen.has(row.player_name)) { seen.add(row.player_name); results.push(row.player_name); }
      }

      // Also check inventory
      const inv = await pool.query(
        `SELECT DISTINCT player_name FROM inventory WHERE player_name ILIKE $1 AND player_name IS NOT NULL ORDER BY player_name LIMIT 20`,
        [`%${q}%`]
      ).catch(() => ({ rows: [] }));
      for (const row of inv.rows) if (row.player_name && !seen.has(row.player_name)) { seen.add(row.player_name); results.push(row.player_name); }

      return NextResponse.json({ results: results.sort((a, b) => a.localeCompare(b)).slice(0, 30) });
    }

    // ── card_set ──────────────────────────────────────────────────────────────
    if (field === 'card_set') {
      if (!q && !player) return NextResponse.json({ results: [] });

      const seen = new Set<string>();
      const results: string[] = [];

      if (hasCatalog) {
        let sql = '';
        const params: string[] = [];
        if (player && q) {
          sql = `SELECT DISTINCT card_set FROM catalog_cards WHERE player_name ILIKE $1 AND card_set ILIKE $2 AND card_set IS NOT NULL ORDER BY card_set LIMIT 20`;
          params.push(`%${player}%`, `%${q}%`);
        } else if (player) {
          sql = `SELECT DISTINCT card_set FROM catalog_cards WHERE player_name ILIKE $1 AND card_set IS NOT NULL ORDER BY card_set LIMIT 20`;
          params.push(`%${player}%`);
        } else {
          sql = `SELECT DISTINCT card_set FROM catalog_cards WHERE card_set ILIKE $1 AND card_set IS NOT NULL ORDER BY card_set LIMIT 20`;
          params.push(`%${q}%`);
        }
        const r = await pool.query(sql, params).catch(() => ({ rows: [] }));
        for (const row of r.rows) if (row.card_set && !seen.has(row.card_set)) { seen.add(row.card_set); results.push(row.card_set); }
      }

      // Inventory fallback
      const inv = await pool.query(
        player
          ? `SELECT DISTINCT card_set FROM inventory WHERE player_name ILIKE $1 AND card_set IS NOT NULL ORDER BY card_set LIMIT 20`
          : `SELECT DISTINCT card_set FROM inventory WHERE card_set ILIKE $1 AND card_set IS NOT NULL ORDER BY card_set LIMIT 20`,
        player ? [`%${player}%`] : [`%${q}%`]
      ).catch(() => ({ rows: [] }));
      for (const row of inv.rows) if (row.card_set && !seen.has(row.card_set)) { seen.add(row.card_set); results.push(row.card_set); }

      return NextResponse.json({ results: results.sort((a, b) => a.localeCompare(b)) });
    }

    // ── card_number ───────────────────────────────────────────────────────────
    if (field === 'card_number') {
      if (!set && !player) return NextResponse.json({ results: [] });
      if (!hasCatalog) return NextResponse.json({ results: [] });

      let sql = '';
      const params: string[] = [];
      if (player && set) {
        sql = `SELECT DISTINCT card_number FROM catalog_cards WHERE player_name ILIKE $1 AND card_set ILIKE $2 AND card_number IS NOT NULL ORDER BY card_number LIMIT 10`;
        params.push(`%${player}%`, set);
      } else if (set) {
        sql = `SELECT DISTINCT card_number FROM catalog_cards WHERE card_set ILIKE $1 AND card_number IS NOT NULL ORDER BY card_number LIMIT 20`;
        params.push(set);
      }
      if (!sql) return NextResponse.json({ results: [] });
      const r = await pool.query(sql, params).catch(() => ({ rows: [] }));
      return NextResponse.json({ results: r.rows.map((row: any) => row.card_number).filter(Boolean) });
    }

    // ── insert_name ───────────────────────────────────────────────────────────
    if (field === 'insert_name') {
      if (!player && !set && q.length < 2) return NextResponse.json({ results: [] });

      const seen = new Set<string>();
      const results: string[] = [];

      if (hasCatalog) {
        const filters: string[] = ['insert_name IS NOT NULL'];
        const params: string[] = [];
        let i = 1;
        if (player) { filters.push(`player_name ILIKE $${i++}`); params.push(`%${player}%`); }
        if (set)    { filters.push(`card_set ILIKE $${i++}`);    params.push(`%${set}%`); }
        if (q)      { filters.push(`insert_name ILIKE $${i++}`); params.push(`%${q}%`); }
        const r = await pool.query(
          `SELECT DISTINCT insert_name FROM catalog_cards WHERE ${filters.join(' AND ')} ORDER BY insert_name LIMIT 20`,
          params
        ).catch(() => ({ rows: [] }));
        for (const row of r.rows) if (row.insert_name && !seen.has(row.insert_name)) { seen.add(row.insert_name); results.push(row.insert_name); }
      }

      // Inventory fallback
      const inv = await pool.query(
        `SELECT DISTINCT insert_name FROM inventory WHERE insert_name ILIKE $1 AND insert_name IS NOT NULL AND insert_name != '' ORDER BY insert_name LIMIT 20`,
        [`%${q || ''}%`]
      ).catch(() => ({ rows: [] }));
      for (const row of inv.rows) if (row.insert_name && !seen.has(row.insert_name)) { seen.add(row.insert_name); results.push(row.insert_name); }

      return NextResponse.json({ results: results.sort((a, b) => a.localeCompare(b)) });
    }

    // ── parallel_name ─────────────────────────────────────────────────────────
    if (field === 'parallel_name') {
      if (!set && q.length < 1) return NextResponse.json({ results: [] });

      const seen = new Set<string>();
      const results: string[] = [];

      // 1. catalog_parallels (set-specific)
      if (hasCatalog) {
        let sql = '';
        const params: string[] = [];
        if (set && q) {
          sql = `SELECT parallel_name FROM catalog_parallels WHERE card_set ILIKE $1 AND parallel_name ILIKE $2 ORDER BY parallel_name LIMIT 30`;
          params.push(set, `%${q}%`);
        } else if (set) {
          sql = `SELECT parallel_name FROM catalog_parallels WHERE card_set ILIKE $1 ORDER BY parallel_name LIMIT 30`;
          params.push(set);
        } else if (q) {
          sql = `SELECT parallel_name FROM catalog_parallels WHERE parallel_name ILIKE $1 ORDER BY parallel_name LIMIT 30`;
          params.push(`%${q}%`);
        }
        if (sql) {
          const r = await pool.query(sql, params).catch(() => ({ rows: [] }));
          for (const row of r.rows) if (row.parallel_name && !seen.has(row.parallel_name)) { seen.add(row.parallel_name); results.push(row.parallel_name); }
        }
      }

      // 2. Inventory fallback
      const invSql = set
        ? `SELECT DISTINCT parallel_name FROM inventory WHERE card_set ILIKE $1 AND parallel_name IS NOT NULL AND parallel_name != '' ORDER BY parallel_name LIMIT 20`
        : `SELECT DISTINCT parallel_name FROM inventory WHERE parallel_name ILIKE $1 AND parallel_name IS NOT NULL AND parallel_name != '' ORDER BY parallel_name LIMIT 20`;
      const inv = await pool.query(invSql, set ? [set] : [`%${q}%`]).catch(() => ({ rows: [] }));
      for (const row of inv.rows) if (row.parallel_name && !seen.has(row.parallel_name)) { seen.add(row.parallel_name); results.push(row.parallel_name); }

      return NextResponse.json({ results: results.sort((a, b) => a.localeCompare(b)) });
    }

    return NextResponse.json({ results: [] });

  } catch (err: any) {
    console.error('[typeahead API] error:', err.message);
    return NextResponse.json({ results: [], error: err.message }, { status: 500 });
  }
}
