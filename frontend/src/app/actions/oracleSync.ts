'use server'

import { createClient } from '@/utils/supabase/server'

// Helper to fix ALL CAPS names from OCR since the API catalog matcher is case-sensitive
function toTitleCase(str: string) {
  if (!str) return "";
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

export async function syncInventoryWithOracle() {
  const supabase = await createClient()

  // 1. Fetch Settings from environment variables
  const oracle_api_url = process.env.PLAYERINDEX_API_URL || process.env.ORACLE_API_URL || 'https://api.playerindexdata.com/fintech'
  const oracle_api_key = process.env.PLAYERINDEX_API_KEY || process.env.ORACLE_API_KEY

  if (!oracle_api_url || !oracle_api_key) {
    throw new Error('Oracle API credentials not configured in settings (.env.local).')
  }

  // Fetch discount percentage
  const { data: settings } = await (supabase as any).from('store_settings').select('oracle_discount_percentage').eq('id', 1).single()
  const discountRate = settings?.oracle_discount_percentage || 0;

  // 2. Fetch Inventory
  console.log("-> Fetching active inventory...");
  const { data: inventory, error: inventoryError } = await supabase
    .from('inventory')
    .select('*')
    .eq('status', 'available')

  if (inventoryError) {
    throw new Error('Failed to fetch inventory: ' + inventoryError.message)
  }

  if (!inventory || inventory.length === 0) {
    console.log("-> 0 items found, aborting.");
    return { success: true, count: 0, message: 'No available inventory to sync.' }
  }

  console.log(`-> Found ${inventory.length} items to sync!`);
  let successCount = 0

  // 3. The Sync Loop
  for (const item of (inventory as any[])) {
    try {
      console.log(`-> Processing ${item.player_name}...`);
      const payload = {
        player_name: toTitleCase(String(item.player_name || "")),
        card_set: String(item.card_set || ""),
        card_number: String(item.card_number || ""),
        insert_name: String(item.insert_name || "Base"),
        parallel_name: String(item.parallel_name || "Base"),
        attributes: [item.insert_name, item.parallel_name, item.parallel_insert_type].filter(v => v && v.toLowerCase() !== 'base').join(' '),
        is_auto: Boolean(item.is_auto || false),
        is_relic: Boolean(item.is_relic || false),
        is_rookie: Boolean(item.is_rookie || false),
        print_run: item.print_run ? Number(item.print_run) : undefined,
        skip_fuzzy: true
      }
      
      console.log(`-> Sending payload to ${oracle_api_url}/api/v1/calculate:`, payload);

      const res = await fetch(`${oracle_api_url}/api/v1/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': oracle_api_key
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        console.error(`Oracle API returned ${res.status} for item ${item.id}`)
        continue
      }

      const data = await res.json()
      
      if (data.target_price && data.target_price > 0) {
        const new_price = data.target_price * (1 - (discountRate / 100))

        const { error: updateError } = await supabase
          .from('inventory')
          // @ts-ignore
          .update({ listed_price: new_price, oracle_projection: data.target_price, oracle_trend_percentage: data.trend_percentage || null })
          .eq('id', item.id)

        if (!updateError) {
          successCount++
        } else {
          console.error(`Failed to update item ${item.id} price in Supabase:`, updateError)
        }
      }

    } catch (err) {
      console.error(`Error processing item ${item.id}:`, err)
    }
  }

  return { success: true, count: successCount }
}

export async function syncSingleItemWithOracle(id: string) {
  const supabase = await createClient()

  const oracle_api_url = process.env.PLAYERINDEX_API_URL || process.env.ORACLE_API_URL || 'https://api.playerindexdata.com/fintech'
  const oracle_api_key = process.env.PLAYERINDEX_API_KEY || process.env.ORACLE_API_KEY

  if (!oracle_api_url || !oracle_api_key) {
    throw new Error('Oracle API credentials not configured in settings (.env.local).')
  }

  // Fetch discount percentage
  const { data: settings } = await (supabase as any).from('store_settings').select('oracle_discount_percentage').eq('id', 1).single()
  const discountRate = settings?.oracle_discount_percentage || 0;

  const { data: item, error: inventoryError } = await supabase
    .from('inventory')
    .select('*')
    .eq('id', id)
    .single()

  if (inventoryError || !item) {
    throw new Error('Failed to fetch item: ' + (inventoryError?.message || 'Item not found'))
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
      skip_fuzzy: true
    }

    const res = await fetch(`${oracle_api_url}/api/v1/calculate`, {
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

      const { error: updateError } = await supabase
        .from('inventory')
        // @ts-ignore
        .update({ listed_price: new_price, oracle_projection: data.target_price, oracle_trend_percentage: data.trend_percentage || null })
        .eq('id', (item as any).id)

      if (!updateError) {
        return { success: true, message: `Repriced to $${new_price.toFixed(2)}`, new_price }
      } else {
        return { success: false, message: `Failed to update price in Supabase.` }
      }
    } else {
      return { success: false, message: `Oracle returned invalid target_price.` }
    }

  } catch (err: any) {
    return { success: false, message: `Error processing item: ${err.message}` }
  }
}

export async function evaluateItemWithOracle(payload: any) {
  const supabase = await createClient()
  const oracle_api_url = process.env.ORACLE_API_URL || 'https://api.playerindexdata.com/fintech'
  const oracle_api_key = process.env.PLAYERINDEX_API_KEY || process.env.ORACLE_API_KEY

  if (!oracle_api_key) {
    throw new Error('Oracle API credentials not configured.')
  }

  // Fetch discount percentage
  const { data: settings } = await (supabase as any).from('store_settings').select('oracle_discount_percentage').eq('id', 1).single()
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
      skip_fuzzy: true
    }
    
    console.log(`-> Evaluate payload going to ${oracle_api_url}/api/v1/calculate:`, formattedPayload);

    const res = await fetch(`${oracle_api_url}/api/v1/calculate`, {
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

    const apiKey = process.env.PLAYERINDEX_API_KEY || '';
    const response = await fetch('https://api.playerindexdata.com/fintech/api/v1/calculate', {
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
    const apiKey = process.env.PLAYERINDEX_API_KEY || '';
    
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

    const response = await fetch('https://api.playerindexdata.com/fintech/api/v1/b2b/calculate-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
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
  return { success: true, new_price: 0 }
}

export async function applyOracleDiscountAll() {
  return { success: true, count: 0, discount: 0 }
}

export async function applyCorrection(id: string, item: any) {
  return { success: true }
}

export async function approvePriceOnly(id: string, item: any) {
  return { success: true }
}

export async function denyCorrection(id: string) {
  return { success: true }
}


