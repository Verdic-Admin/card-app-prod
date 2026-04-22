"use server";

import pool from '@/utils/db';
import { getOracleGatewayBaseUrl } from '@/lib/oracle-gateway-url';
import { getShopOracleApiKey } from '@/lib/shop-oracle-credentials';
import { vercelBatchUpdatePrices } from '@/app/actions/inventory'
import { calculatePricingAction } from '@/app/actions/oracleAPI'

const BATCH_PRICING_SIZE = 50;
const BATCH_CONCURRENCY  = 2;   // keep gateway fan-out bounded

const ALLOWED_COLUMNS = [
  'player_name', 'card_set', 'card_number', 'insert_name', 
  'parallel_name', 'print_run', 'listed_price', 'market_price',
  'image_url', 'back_image_url'
];
// Helper to fix ALL CAPS names from OCR since the API catalog matcher is case-sensitive
function toTitleCase(str: string) {
  if (!str) return "";
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

export async function syncInventoryWithOracle() {
  console.log("-> Fetching active inventory from Vercel Postgres...");
  const { rows: inventory } = await pool.query(
    `SELECT id, player_name, card_set, card_number, insert_name, parallel_name,
            parallel_insert_type,
            is_auto, is_relic, is_rookie, print_run
     FROM inventory WHERE status = 'available'`
  );

  if (!inventory || inventory.length === 0) {
    console.log("-> 0 items found, aborting.");
    return { success: true, count: 0, message: 'No available inventory to sync.' };
  }

  // Fetch discount percentage from canonical store_settings
  let discountRate = 0;
  try {
    const { rows } = await pool.query(`SELECT oracle_discount_percentage FROM store_settings WHERE id = 1`);
    discountRate = parseFloat(String(rows?.[0]?.oracle_discount_percentage ?? 0)) || 0;
  } catch (e) {
    console.warn("Could not fetch oracle_discount_percentage", e);
  }

  console.log(`-> Repricing ${inventory.length} items via Oracle calculate endpoint...`);

  const apiKey = await getShopOracleApiKey();
  if (!apiKey) {
    return {
      success: false,
      message: 'Store is not provisioned yet. Redeploy from Player Index with your one-time setup link.',
      count: 0,
    };
  }

  // Route through the batch pricing endpoint so we do not fan out one eBay-
  // adjacent request per card. Falls back to per-card calculate only for
  // cards the batch endpoint could not price.
  const baseUrl = await getOracleGatewayBaseUrl();
  const updates: Array<{
    id: string;
    listed_price: number;
    market_price: number;
    trend_data: number[];
    player_index_url: string;
    oracle_projection: number;
    oracle_trend_percentage: number | null;
  }> = [];
  let pricedCount = 0;

  const chunks: any[][] = [];
  for (let i = 0; i < inventory.length; i += BATCH_PRICING_SIZE) {
    chunks.push(inventory.slice(i, i + BATCH_PRICING_SIZE) as any[]);
  }

  const callBatch = async (chunk: any[]) => {
    const items = chunk.map((row) => {
      const rawFuzzy = [
        String(row.card_set || ''),
        String(row.card_number || ''),
        String(row.insert_name || ''),
        String(row.parallel_name || ''),
        String(row.parallel_insert_type || ''),
      ].filter(Boolean).join(' ');
      return {
        player_name: toTitleCase(String(row.player_name || '')),
        card_set:    String(row.card_set || ''),
        card_number: String(row.card_number || ''),
        print_run:   row.print_run ? Number(row.print_run) : undefined,
        attributes:  rawFuzzy,
        storefront_id: String(row.id),
        is_auto:   Boolean(row.is_auto),
        is_relic:  Boolean(row.is_relic),
        is_rookie: Boolean(row.is_rookie),
      };
    });

    const res = await fetch(`${baseUrl}/v1/b2b/calculate-batch`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body:    JSON.stringify({ items }),
    });

    if (res.status === 402) throw new Error('credits_exhausted');
    if (!res.ok) return chunk.map(() => null);

    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    return chunk.map((_row, idx) => results[idx] ?? null);
  };

  for (let c = 0; c < chunks.length; c += BATCH_CONCURRENCY) {
    const parallel = chunks.slice(c, c + BATCH_CONCURRENCY);
    const settled = await Promise.all(parallel.map((ch) => callBatch(ch).catch((e) => {
      if (String(e?.message || '').includes('credits_exhausted')) throw e;
      return ch.map(() => null);
    })));
    for (let pi = 0; pi < parallel.length; pi++) {
      const chunk = parallel[pi];
      const perItem = settled[pi] as any[];
      for (let i = 0; i < chunk.length; i++) {
        const row: any = chunk[i];
        const r: any = perItem[i];
        const projection = Number(r?.projected_target ?? r?.target_price ?? 0);
        if (!Number.isFinite(projection) || projection <= 0) continue;

        const listed = projection * (1 - discountRate / 100);
        updates.push({
          id: String(row.id),
          listed_price: listed,
          market_price: projection,
          trend_data: Array.isArray(r?.trend_points) ? r.trend_points : [],
          player_index_url: String(r?.player_index_url || ''),
          oracle_projection: projection,
          oracle_trend_percentage: r?.trend_percentage != null ? Number(r.trend_percentage) : null,
        });
        pricedCount++;
      }
    }
  }

  if (updates.length === 0) {
    return {
      success: false,
      message: 'Oracle did not return valid projected_target values for available inventory.',
      count: 0,
      total: inventory.length,
    };
  }

  try {
    console.log(`-> Performing single atomic DB update for ${updates.length} items...`);
    await vercelBatchUpdatePrices(updates.map(u => ({
      id: u.id,
      listed_price: u.listed_price,
      market_price: u.market_price,
      trend_data: u.trend_data,
      player_index_url: u.player_index_url,
    })));

    for (const u of updates) {
      await pool.query(
        `UPDATE inventory SET oracle_projection = $1, oracle_trend_percentage = $2 WHERE id = $3`,
        [u.oracle_projection, u.oracle_trend_percentage, u.id]
      );
    }
  } catch (err: any) {
    if (String(err?.message || '').includes('credits_exhausted')) {
      return { success: false, message: "API Credits exhausted. Please refill.", count: 0, total: inventory.length };
    }
    throw err;
  }

  console.log(`-> Checking Lot-Aware Pricing Validity...`);
  await pool.query(`
    UPDATE inventory i
    SET needs_price_approval = true
    FROM (
      SELECT parent.id as parent_id, parent.listed_price as parent_listed_price, COALESCE(SUM(c.market_price), 0) as children_sum
      FROM inventory parent
      JOIN inventory c ON c.lot_id = parent.id
      WHERE parent.is_lot = true
      GROUP BY parent.id, parent.listed_price
    ) as agg
    WHERE i.id = agg.parent_id AND agg.children_sum < agg.parent_listed_price;
  `);

  return { success: true, count: pricedCount, total: inventory.length, batches: chunks.length };
}

export async function syncSingleItemWithOracle(id: string) {

  if (!(await getShopOracleApiKey())) {
    throw new Error('API key not configured. Please complete store provisioning.');
  }

  // Fetch discount percentage
  const { rows: settingsRows } = await pool.query(`SELECT oracle_discount_percentage FROM store_settings WHERE id = 1`); const settings = settingsRows[0]
  const discountRate = parseFloat(String(settings?.oracle_discount_percentage ?? 0)) || 0;

  let item, inventoryError;
  try {
    const { rows } = await pool.query(`SELECT * FROM inventory WHERE id = $1`, [id])
    item = rows[0]
  } catch (err) {
    inventoryError = err
  }

  if (inventoryError || !item) {
    throw new Error('Failed to fetch item: ' + ((inventoryError as any)?.message || 'Item not found'))
  }

  try {
    const res = await calculatePricingAction({
      player_name: toTitleCase(String((item as any).player_name || "")),
      card_set: String((item as any).card_set || ""),
      card_number: String((item as any).card_number || ""),
      insert_name: String((item as any).insert_name || "Base"),
      parallel_name: String((item as any).parallel_name || "Base"),
      is_auto: Boolean((item as any).is_auto || false),
      is_relic: Boolean((item as any).is_relic || false),
      is_rookie: Boolean((item as any).is_rookie || false),
      print_run: (item as any).print_run ? Number((item as any).print_run) : null,
    });

    if (!res || typeof res !== 'object' || !('success' in res) || !res.success) {
      if (res && typeof res === 'object' && 'error' in res && res.error === 'credits_exhausted') {
        return { success: false, message: "API Credits exhausted. Please refill." };
      }
      return { success: false, message: `Oracle pricing failed for item ${(item as any).id}.` };
    }

    const data = (res as any).data || {};
    const projection = Number(data.projected_target ?? data.target_price ?? 0);
    if (!Number.isFinite(projection) || projection <= 0) {
      return { success: false, message: `Oracle returned invalid projected target for item ${(item as any).id}.` };
    }

    const new_price = projection * (1 - (discountRate / 100));
    const trend = data.trend_percentage != null ? Number(data.trend_percentage) : null;
    const trendPoints = Array.isArray(data.trend_points) ? data.trend_points : [];
    const playerIndexUrl = String(data.player_index_url || '');

    await pool.query(
      `UPDATE inventory
       SET listed_price = $1,
           market_price = $2,
           oracle_projection = $3,
           oracle_trend_percentage = $4,
           trend_data = $5::jsonb,
           player_index_url = $6
       WHERE id = $7`,
      [new_price, projection, projection, trend, JSON.stringify(trendPoints), playerIndexUrl, item.id]
    );

    return {
      success: true,
      message: `Repriced to $${new_price.toFixed(2)} (Player Index $${projection.toFixed(2)}${discountRate > 0 ? `, ${discountRate}% store discount applied to listed price` : ''}).`,
      new_price,
      listed_price: new_price,
      market_price: projection,
      oracle_projection: projection,
      oracle_trend_percentage: trend,
      trend_data: trendPoints,
      player_index_url: playerIndexUrl,
    };
  } catch (err: any) {
    return { success: false, message: `Error processing item: ${err.message}` };
  }
}

export async function evaluateItemWithOracle(payload: any) {

  const oracle_api_key = await getShopOracleApiKey();

  if (!oracle_api_key) {
    throw new Error('API key not configured. Please complete store provisioning.');
  }

  // Fetch discount percentage
  const { rows: settingsRows } = await pool.query(`SELECT oracle_discount_percentage FROM store_settings WHERE id = 1`); const settings = settingsRows[0]
  const discountRate = settings?.oracle_discount_percentage || 0;

  try {
    const formattedPayload = {
      player_name: toTitleCase(String(payload.player_name || "")),
      card_set: String(payload.card_set || ""),
      card_number: String(payload.card_number || ""),
      insert_name: String(payload.insert_name || "Base"),
      parallel_name: String(payload.parallel_name || "Base"),
      is_auto: Boolean(payload.is_auto || false),
      is_relic: Boolean(payload.is_relic || false),
      is_rookie: Boolean(payload.is_rookie || false),
      print_run: payload.print_run ? Number(payload.print_run) : undefined,
      discount_rate: discountRate,
      skip_fuzzy: true
    }
    
    const base = await getOracleGatewayBaseUrl();
    console.log(`-> Evaluate payload going to ${base}/v1/calculate:`, formattedPayload);

    const res = await fetch(`${base}/v1/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': oracle_api_key
      },
      body: JSON.stringify(formattedPayload)
    })

    if (!res.ok) {
      return { success: false, message: `Oracle API returned ${res.status}` }
    }

    const data = await res.json()
    
    if (data.target_price && data.target_price > 0) {
      const new_price = data.target_price * (1 - (discountRate / 100))
      return { success: true, price: new_price }
    } else {
      return { success: false, message: `Oracle returned invalid target_price.` }
    }

} catch (err: any) {
    return { success: false, message: `Error evaluating item: ${err.message}` }
  }
}

export async function getSingleOraclePrice(payload: { 
  player_name: string; 
  card_set: string; 
  card_number?: string; 
  insert_name?: string; 
  parallel_name?: string; 
  is_auto?: boolean; 
  is_relic?: boolean; 
  is_rookie?: boolean; 
  print_run?: number;
}) {
  try {
    const formattedPayload = {
      player_name: toTitleCase(String(payload.player_name || "")),
      card_set: String(payload.card_set || ""),
      card_number: String(payload.card_number || ""),
      insert_name: String(payload.insert_name || "Base"),
      parallel_name: String(payload.parallel_name || "Base"),
      is_auto: Boolean(payload.is_auto || false),
      is_relic: Boolean(payload.is_relic || false),
      is_rookie: Boolean(payload.is_rookie || false),
      print_run: payload.print_run ? Number(payload.print_run) : undefined,
      skip_fuzzy: true
    };

    const apiKey = await getShopOracleApiKey();
    const baseSingle = await getOracleGatewayBaseUrl();
    const response = await fetch(`${baseSingle}/v1/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(formattedPayload),
    });

    if (!response.ok) {
      console.error('Oracle single calculate error:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data?.target_price || null;
  } catch (error) {
    console.error('Oracle single calculate failed:', error);
    return null;
  }
}

export async function getBatchOraclePrices(cards: any[]) {
  try {
    const apiKey = await getShopOracleApiKey();

    // Map intuitive card props to Oracle B2B API payload shape
    const formattedItems = cards.map(c => {
      const rawFuzzyString = [
        c.card_set,
        c.card_number,
        c.insert_name,
        c.parallel_name,
        c.parallel_insert_type,
        c.attributes
      ].filter(Boolean).join(" ");
      
      return {
        player_name: toTitleCase(String(c.player_name || "")),
        card_set: String(c.card_set || ""),
        card_number: String(c.card_number || ""),
        print_run: c.print_run ? Number(c.print_run) : undefined,
        attributes: String(rawFuzzyString),
        storefront_id: String(c.storefront_id || c.db_id || "batch-item"),
        is_auto: Boolean(c.is_auto),
        is_relic: Boolean(c.is_relic),
        is_rookie: Boolean(c.is_rookie),
      };
    });

    const baseBatch = await getOracleGatewayBaseUrl();
    const response = await fetch(`${baseBatch}/v1/b2b/calculate-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      // Backend expects "items" payload
      body: JSON.stringify({ items: formattedItems }),
    });

    if (!response.ok) {
      console.error('Oracle batch calculate error:', response.statusText);
      return cards.map(() => null); 
    }

    const data = await response.json();
    
    // Backend returns { status: "success", results: [{ projected_target: 12.3 }, ... ] }
    if (data && data.results && Array.isArray(data.results)) {
      return data.results.map((r: any) => r.projected_target || 0);
    }
    
    return cards.map(() => null);
  } catch (error) {
    console.error('Oracle batch calculate failed:', error);
    return cards.map(() => null);
  }
}

export async function applyOracleDiscount(id: string) {

  const { rows: settingsRows } = await pool.query(`SELECT oracle_discount_percentage FROM store_settings WHERE id = 1`); const settings = settingsRows[0]
  const discountRate = settings?.oracle_discount_percentage || 0;
  
  const { rows } = await pool.query(`SELECT oracle_projection FROM inventory WHERE id = $1`, [id]); const item = rows[0];
  // @ts-ignore
  if (item?.oracle_projection) {
       const new_price = item.oracle_projection * (1 - (discountRate / 100))
       await pool.query(`UPDATE inventory SET listed_price = $1 WHERE id = $2`, [new_price, id])
       return { success: true, new_price }
  }
  return { success: false, message: 'No oracle projection' }
}

export async function applyOracleDiscountAll() {

  const { rows: settingsRows } = await pool.query(`SELECT oracle_discount_percentage FROM store_settings WHERE id = 1`); const settings = settingsRows[0]
  const discountRate = settings?.oracle_discount_percentage || 0;
  
  const { rows: items } = await pool.query(`SELECT id, oracle_projection FROM inventory WHERE oracle_projection IS NOT NULL`)
  let count = 0
  if (items) {
      for (const item of items) {
          if (item.oracle_projection) {
              const new_price = item.oracle_projection * (1 - (discountRate / 100))
              await pool.query(`UPDATE inventory SET listed_price = $1 WHERE id = $2`, [new_price, item.id])
              count++
          }
      }
  }
  return { success: true, count, discount: discountRate }
}

export async function applyCorrection(id: string, item: any) {
  const keys = Object.keys(item);
  if (keys.length > 0) {
    for (const k of keys) {
      if (!ALLOWED_COLUMNS.includes(k)) {
        throw new Error(`Security Violation: Unauthorized column update detected - ${k}`);
      }
    }
    for (const [k, v] of Object.entries(item)) {
      await pool.query(`UPDATE inventory SET ${k} = $1 WHERE id = $2`, [v, id]);
    }
  }
  await pool.query(`UPDATE inventory SET needs_correction = false WHERE id = $1`, [id]);
  return { success: true }
}

export async function approvePriceOnly(id: string, item: any) {
  await pool.query(`UPDATE inventory SET listed_price = $1, needs_price_approval = false WHERE id = $2`, [item.listed_price, id])
  return { success: true }
}

export async function denyCorrection(id: string) {
  await pool.query(`UPDATE inventory SET needs_correction = false, needs_price_approval = false WHERE id = $1`, [id])
  return { success: true }
}
