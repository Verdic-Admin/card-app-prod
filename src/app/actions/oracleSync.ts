"use server";

import pool from '@/utils/db';
import { getOracleGatewayBaseUrl } from '@/lib/oracle-gateway-url';

async function getApiKey(): Promise<string> {
  if (process.env.PLAYERINDEX_API_KEY) return process.env.PLAYERINDEX_API_KEY;
  try {
    const { rows } = await pool.query('SELECT playerindex_api_key FROM shop_config LIMIT 1');
    if (rows.length > 0 && rows[0].playerindex_api_key) return rows[0].playerindex_api_key;
  } catch (e) {
    console.warn('Failed to retrieve API key from database:', e);
  }
  return '';
}
import { vercelBatchUpdatePrices } from '@/app/actions/inventory'

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
            is_auto, is_relic, is_rookie, print_run
     FROM inventory WHERE status = 'available'`
  );

  if (!inventory || inventory.length === 0) {
    console.log("-> 0 items found, aborting.");
    return { success: true, count: 0, message: 'No available inventory to sync.' };
  }

  // Fetch discount percentage from shop_config
  let discountRate = 0;
  try {
    const { rows: configRows } = await pool.query(`SELECT discount_rate FROM shop_config LIMIT 1`);
    if (configRows.length > 0) {
      discountRate = parseFloat(configRows[0].discount_rate) || 0;
    }
  } catch (e) {
    console.warn("Could not fetch discount_rate", e);
  }

  console.log(`-> Batching ${inventory.length} items to shop-api...`);

  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      success: false,
      message: 'No Player Index API key (PLAYERINDEX_API_KEY or shop_config).',
      count: 0,
    };
  }

  const cards = inventory.map((i: any) => ({
    card_id: i.id,
    player_name: i.player_name || '',
    card_set: i.card_set || '',
    card_number: i.card_number || '',
    insert_name: i.insert_name || 'Base',
    parallel_name: i.parallel_name || 'Base',
    is_auto: Boolean(i.is_auto),
    is_relic: Boolean(i.is_relic),
    is_rookie: Boolean(i.is_rookie),
    print_run: i.print_run ? Number(i.print_run) : null,
  }));

  const base = getOracleGatewayBaseUrl();
  const res = await fetch(`${base}/shop-api/batch-price`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ cards, discount_rate: discountRate }),
  });

  if (!res.ok) {
    if (res.status === 402) {
      console.error("Payment Required (402) - credits exhausted.");
      return { success: false, message: "API Credits exhausted. Please refill.", count: 0 };
    }
    throw new Error(`Failed to batch price items. Status: ${res.status}`);
  }

  const data = await res.json();
  if (!data.items) {
    throw new Error('Invalid response from shop-api batch-price endpoint.');
  }

  const updates = data.items.map((item: any) => ({
    id: item.card_id,
    listed_price: item.listed_price,
    market_price: item.oracle_value,
    trend_data: item.trend_points || [],
    player_index_url: item.player_index_url || ''
  }));

  console.log(`-> Performing single atomic DB update for ${updates.length} items...`);
  await vercelBatchUpdatePrices(updates);

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

  return { success: true, count: updates.length };
}

export async function syncSingleItemWithOracle(id: string) {


  const oracle_api_key = await getApiKey();

  if (!oracle_api_key) {
    throw new Error('API key not configured. Please complete store provisioning.');
  }

  // Fetch discount percentage
  const { rows: settingsRows } = await pool.query(`SELECT oracle_discount_percentage FROM store_settings WHERE id = 1`); const settings = settingsRows[0]
  const discountRate = settings?.oracle_discount_percentage || 0;

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
    const payload = {
      player_name: toTitleCase(String((item as any).player_name || "")),
      card_set: String((item as any).card_set || ""),
      card_number: String((item as any).card_number || ""),
      insert_name: String((item as any).insert_name || "Base"),
      parallel_name: String((item as any).parallel_name || "Base"),
      attributes: [(item as any).insert_name, (item as any).parallel_name, (item as any).parallel_insert_type].filter(v => v && v.toLowerCase() !== 'base').join(' '),
      is_auto: Boolean((item as any).is_auto || false),
      is_relic: Boolean((item as any).is_relic || false),
      is_rookie: Boolean((item as any).is_rookie || false),
      print_run: (item as any).print_run ? Number((item as any).print_run) : undefined,
      discount_rate: discountRate,
      skip_fuzzy: true
    }

    const res = await fetch(`${getOracleGatewayBaseUrl()}/v1/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': oracle_api_key
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      return { success: false, message: `Oracle API returned ${res.status} for item ${(item as any).id}` }
    }

    const data = await res.json()
    
    if (data.target_price && data.target_price > 0) {
      const new_price = data.target_price * (1 - (discountRate / 100))

      let updateError; try { await pool.query(`UPDATE inventory SET listed_price = $1, oracle_projection = $2, oracle_trend_percentage = $3 WHERE id = $4`, [new_price, data.target_price, data.trend_percentage || null, item.id]) } catch (err) { updateError = err }

      if (!updateError) {
        return { success: true, message: `Repriced to $${new_price.toFixed(2)}`, new_price }
      } else {
        return { success: false, message: `Failed to update price in Postgres database.` }
      }
    } else {
      return { success: false, message: `Oracle returned invalid target_price.` }
    }

  } catch (err: any) {
    return { success: false, message: `Error processing item: ${err.message}` }
  }
}

export async function evaluateItemWithOracle(payload: any) {

  const oracle_api_key = await getApiKey();

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
    
    const base = getOracleGatewayBaseUrl();
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

    const apiKey = await getApiKey();
    const response = await fetch(`${getOracleGatewayBaseUrl()}/v1/calculate`, {
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
    const apiKey = await getApiKey();

    // Map intuitive card props to Oracle B2B API payload shape
    const formattedItems = cards.map(c => {
      const rawFuzzyString = [
        c.card_set,
        c.card_number,
        c.insert_name,
        c.parallel_name,
        c.attributes
      ].filter(Boolean).join(" ");
      
      return {
        player_name: toTitleCase(String(c.player_name || "")),
        card_set: String(c.card_set || ""),
        card_number: String(c.card_number || ""),
        print_run: c.print_run ? Number(c.print_run) : undefined,
        attributes: String(rawFuzzyString),
        storefront_id: String(c.storefront_id || c.db_id || "batch-item")
      };
    });

    const response = await fetch(`${getOracleGatewayBaseUrl()}/v1/b2b/calculate-batch`, {
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
