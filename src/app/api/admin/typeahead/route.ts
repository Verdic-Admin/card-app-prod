import { NextRequest, NextResponse } from 'next/server';
import pool from '@/utils/db';

/**
 * GET /api/admin/typeahead?field=player_name&q=Jeter
 * GET /api/admin/typeahead?field=card_set&player=Derek+Jeter&q=Topps
 * GET /api/admin/typeahead?field=insert_name&player=Derek+Jeter&set=2023+Topps&q=Gold
 * GET /api/admin/typeahead?field=parallel_name&set=2023+Topps&q=Chrome
 *
 * Data source priority:
 *   1. Supabase (if CATALOG_SUPABASE_URL + CATALOG_SUPABASE_ANON_KEY are set)
 *   2. Local inventory table (fallback)
 */

// NOTE: env vars are read INSIDE the handler (not module-level) so Railway
// runtime env vars are picked up without requiring a rebuild.
async function querySupabase(
  supabaseUrl: string,
  supabaseKey: string,
  table: string,
  select: string,
  filters: string
): Promise<any[]> {
  const url = `${supabaseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}&${filters}&limit=30`;
  const res = await fetch(url, {
    headers: {
      'apikey':        supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Accept':        'application/json',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${body}`);
  }
  return res.json();
}

function dedupe(rows: any[], col: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const v: string = r[col];
    if (v && !seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export async function GET(req: NextRequest) {
  // Read env vars at request time — works with Railway runtime env vars.
  // Falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY if the catalog-specific key isn't set.
  const SUPABASE_URL = (process.env.CATALOG_SUPABASE_URL      || '').trim().replace(/\/+$/, '');
  const SUPABASE_KEY = (
    process.env.CATALOG_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  const hasSupabase  = Boolean(SUPABASE_URL && SUPABASE_KEY);

  const { searchParams } = req.nextUrl;
  const field  = searchParams.get('field')  ?? '';
  const q      = searchParams.get('q')      ?? '';
  const player = searchParams.get('player') ?? '';
  const set    = searchParams.get('set')    ?? '';

  if (!field) return NextResponse.json({ results: [] });

  try {
    // ── Supabase path ──────────────────────────────────────────────────────
    if (hasSupabase) {
      let results: string[] = [];

      if (field === 'player_name') {
        if (q.length < 2) return NextResponse.json({ results: [] });
        const rows = await querySupabase(
          SUPABASE_URL, SUPABASE_KEY,
          'player_metadata',
          'player_name',
          `player_name=ilike.*${encodeURIComponent(q)}*`
        );
        results = dedupe(rows, 'player_name');

      } else if (field === 'card_set') {
        if (!player && !q) return NextResponse.json({ results: [] });
        const filters: string[] = ['card_set=not.is.null'];
        if (player) filters.push(`player_name=ilike.*${encodeURIComponent(player)}*`);
        if (q)      filters.push(`card_set=ilike.*${encodeURIComponent(q)}*`);
        const rows = await querySupabase(SUPABASE_URL, SUPABASE_KEY, 'master_card_catalog', 'card_set', filters.join('&'));
        results = dedupe(rows, 'card_set');

      } else if (field === 'insert_name') {
        if (!player && !set && q.length < 2) return NextResponse.json({ results: [] });
        const filters: string[] = ['insert_name=not.is.null', 'insert_name=neq.Base'];
        if (player) filters.push(`player_name=ilike.*${encodeURIComponent(player)}*`);
        if (set)    filters.push(`card_set=ilike.*${encodeURIComponent(set)}*`);
        if (q)      filters.push(`insert_name=ilike.*${encodeURIComponent(q)}*`);
        const rows = await querySupabase(SUPABASE_URL, SUPABASE_KEY, 'master_card_catalog', 'insert_name', filters.join('&'));
        results = dedupe(rows, 'insert_name');

      } else if (field === 'parallel_name') {
        if (!set && q.length < 2) return NextResponse.json({ results: [] });
        const filters: string[] = ['parallel_name=not.is.null', 'parallel_name=neq.Base'];
        if (set) filters.push(`card_set=ilike.*${encodeURIComponent(set)}*`);
        if (q)   filters.push(`parallel_name=ilike.*${encodeURIComponent(q)}*`);
        const rows = await querySupabase(SUPABASE_URL, SUPABASE_KEY, 'master_card_catalog', 'parallel_name', filters.join('&'));
        results = dedupe(rows, 'parallel_name');
      }

      return NextResponse.json({ results, source: 'supabase' });
    }

    // ── Inventory fallback (no Supabase creds) ─────────────────────────────
    let sql   = '';
    const params: string[] = [];

    if (field === 'player_name' && q.length >= 2) {
      sql = `SELECT DISTINCT player_name FROM inventory WHERE player_name ILIKE $1 AND player_name IS NOT NULL ORDER BY player_name LIMIT 20`;
      params.push(`%${q}%`);

    } else if (field === 'card_set') {
      if (player && q) {
        sql = `SELECT DISTINCT card_set FROM inventory WHERE player_name ILIKE $1 AND card_set ILIKE $2 AND card_set IS NOT NULL ORDER BY card_set LIMIT 30`;
        params.push(`%${player}%`, `%${q}%`);
      } else if (player) {
        sql = `SELECT DISTINCT card_set FROM inventory WHERE player_name ILIKE $1 AND card_set IS NOT NULL ORDER BY card_set LIMIT 30`;
        params.push(`%${player}%`);
      } else if (q) {
        sql = `SELECT DISTINCT card_set FROM inventory WHERE card_set ILIKE $1 AND card_set IS NOT NULL ORDER BY card_set LIMIT 30`;
        params.push(`%${q}%`);
      }

    } else if (field === 'insert_name') {
      if (player && set) {
        sql = `SELECT DISTINCT insert_name FROM inventory WHERE player_name ILIKE $1 AND card_set ILIKE $2 AND insert_name IS NOT NULL AND insert_name != '' ORDER BY insert_name LIMIT 20`;
        params.push(`%${player}%`, `%${set}%`);
      } else if (q) {
        sql = `SELECT DISTINCT insert_name FROM inventory WHERE insert_name ILIKE $1 AND insert_name IS NOT NULL AND insert_name != '' ORDER BY insert_name LIMIT 20`;
        params.push(`%${q}%`);
      }

    } else if (field === 'parallel_name') {
      if (set) {
        sql = `SELECT DISTINCT parallel_name FROM inventory WHERE card_set ILIKE $1 AND parallel_name IS NOT NULL AND parallel_name != '' ORDER BY parallel_name LIMIT 20`;
        params.push(`%${set}%`);
      } else if (q) {
        sql = `SELECT DISTINCT parallel_name FROM inventory WHERE parallel_name ILIKE $1 AND parallel_name IS NOT NULL AND parallel_name != '' ORDER BY parallel_name LIMIT 20`;
        params.push(`%${q}%`);
      }
    }

    if (!sql) return NextResponse.json({ results: [] });

    const { rows } = await pool.query(sql, params);
    const results  = rows.map((r: any) => r[field]).filter(Boolean);
    return NextResponse.json({ results, source: 'inventory' });

  } catch (err: any) {
    console.error('[typeahead API] error:', err.message);
    return NextResponse.json({ results: [], error: err.message }, { status: 500 });
  }
}
