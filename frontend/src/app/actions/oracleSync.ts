'use server'

import { createClient } from '@/utils/supabase/server'

export async function syncInventoryWithOracle() {
  const supabase = await createClient()

  // 1. Fetch Settings from environment variables
  const oracle_api_url = process.env.ORACLE_API_URL
  const oracle_api_key = process.env.ORACLE_API_KEY

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
      const rawFuzzyString = [
        item.card_set, 
        item.card_number, 
        item.insert_name, 
        item.parallel_name, 
        item.grade, 
        item.attributes 
      ].filter(Boolean).join(" ");

      const payload = {
        player_name: item.player_name,
        card_number: item.card_number || "",
        attributes: rawFuzzyString,
        storefront_id: item.id
      }
      
      console.log(`-> Sending payload to ${oracle_api_url}/api/v1/b2b/calculate:`, payload);

      const res = await fetch(`${oracle_api_url}/api/v1/b2b/calculate`, {
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
      
      if (data.projected_target && data.projected_target > 0) {
        const new_price = data.projected_target * (1 - (discountRate / 100))

        const { error: updateError } = await supabase
          .from('inventory')
          // @ts-ignore
          .update({ listed_price: new_price, oracle_projection: data.projected_target })
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

  const oracle_api_url = process.env.ORACLE_API_URL
  const oracle_api_key = process.env.ORACLE_API_KEY

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
    const rawFuzzyString = [
      (item as any).card_set, 
      (item as any).card_number, 
      (item as any).insert_name, 
      (item as any).parallel_name, 
      (item as any).grade, 
      (item as any).attributes 
    ].filter(Boolean).join(" ");

    const payload = {
      player_name: (item as any).player_name,
      card_number: (item as any).card_number || "",
      attributes: rawFuzzyString,
      storefront_id: (item as any).id
    }

    const res = await fetch(`${oracle_api_url}/api/v1/b2b/calculate`, {
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
    
    if (data.projected_target && data.projected_target > 0) {
      const new_price = data.projected_target * (1 - (discountRate / 100))

      const { error: updateError } = await supabase
        .from('inventory')
        // @ts-ignore
        .update({ listed_price: new_price, oracle_projection: data.projected_target })
        .eq('id', (item as any).id)

      if (!updateError) {
        return { success: true, message: `Repriced to $${new_price.toFixed(2)}`, new_price }
      } else {
        return { success: false, message: `Failed to update price in Supabase.` }
      }
    } else {
      return { success: false, message: `Oracle returned invalid projected_target.` }
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
    const rawFuzzyString = [
      payload.card_set, 
      payload.card_number, 
      payload.insert_name, 
      payload.parallel_name, 
      payload.grade, 
      payload.attributes 
    ].filter(Boolean).join(" ");

    const formattedPayload = {
      player_name: payload.player_name,
      card_number: payload.card_number || "",
      attributes: rawFuzzyString,
      storefront_id: payload.id || "eval"
    }
    
    console.log(`-> Evaluate payload going to ${oracle_api_url}/api/v1/b2b/calculate:`, formattedPayload);

    const res = await fetch(`${oracle_api_url}/api/v1/b2b/calculate`, {
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
    
    if (data.projected_target && data.projected_target > 0) {
      const new_price = data.projected_target * (1 - (discountRate / 100))
      return { success: true, price: new_price }
    } else {
      return { success: false, message: `Oracle returned invalid projected_target.` }
    }

} catch (err: any) {
    return { success: false, message: `Error evaluating item: ${err.message}` }
  }
}

export async function getSingleOraclePrice(payload: { player_name: string; card_set: string; card_number?: string; insert_name?: string; parallel_name?: string; attributes?: string }) {
  try {
    const rawFuzzyString = [
      payload.card_set,
      payload.card_number,
      payload.insert_name,
      payload.parallel_name,
      payload.attributes
    ].filter(Boolean).join(" ");
    
    const formattedPayload = {
      player_name: payload.player_name || "",
      card_number: payload.card_number || "",
      attributes: rawFuzzyString,
      storefront_id: "single-eval"
    };

    const apiKey = process.env.PLAYERINDEX_API_KEY || '';
    const response = await fetch('https://api.playerindexdata.com/fintech/api/v1/b2b/calculate', {
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
    return data?.projected_target || null;
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
        player_name: c.player_name || "",
        card_set: c.card_set || "",
        card_number: c.card_number || "",
        attributes: rawFuzzyString,
        storefront_id: c.storefront_id || c.db_id || "batch-item"
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


