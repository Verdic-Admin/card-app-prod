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

  // 2. Fetch Inventory
  const { data: inventory, error: inventoryError } = await supabase
    .from('inventory')
    .select('id, player_name, card_set, parallel_insert_type, print_run, is_auto, is_relic, is_rookie, is_one_of_one, grade')
    .eq('status', 'available')

  if (inventoryError) {
    throw new Error('Failed to fetch inventory: ' + inventoryError.message)
  }

  if (!inventory || inventory.length === 0) {
    return { success: true, count: 0, message: 'No available inventory to sync.' }
  }

  let successCount = 0

  // 3. The Sync Loop
  for (const item of (inventory as any[])) {
    try {
      const payload = {
        player_name: item.player_name,
        card_set: item.card_set,
        parallel_name: item.parallel_insert_type,
        print_run: item.print_run,
        is_auto: item.is_auto,
        is_relic: item.is_relic,
        is_rookie: item.is_rookie,
        is_one_of_one: item.is_one_of_one,
        grade: item.grade
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
        console.error(`Oracle API returned ${res.status} for item ${item.id}`)
        continue
      }

      const data = await res.json()
      
      if (data.projected_target && data.projected_target > 0) {
        const new_price = data.projected_target * 0.95

        const { error: updateError } = await supabase
          .from('inventory')
          // @ts-ignore
          .update({ listed_price: new_price })
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

  const { data: item, error: inventoryError } = await supabase
    .from('inventory')
    .select('id, player_name, card_set, parallel_insert_type, print_run, is_auto, is_relic, is_rookie, is_one_of_one, grade')
    .eq('id', id)
    .single()

  if (inventoryError || !item) {
    throw new Error('Failed to fetch item: ' + (inventoryError?.message || 'Item not found'))
  }

  try {
    const payload = {
      player_name: (item as any).player_name,
      card_set: (item as any).card_set,
      parallel_name: (item as any).parallel_insert_type,
      print_run: (item as any).print_run,
      is_auto: (item as any).is_auto,
      is_relic: (item as any).is_relic,
      is_rookie: (item as any).is_rookie,
      is_one_of_one: (item as any).is_one_of_one,
      grade: (item as any).grade
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
    
    if (data.projected_target && data.projected_target > 0) {
      const new_price = data.projected_target * 0.95

      const { error: updateError } = await supabase
        .from('inventory')
        // @ts-ignore
        .update({ listed_price: new_price })
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
  const oracle_api_url = process.env.ORACLE_API_URL
  const oracle_api_key = process.env.ORACLE_API_KEY

  if (!oracle_api_url || !oracle_api_key) {
    throw new Error('Oracle API credentials not configured.')
  }

  try {
    const formattedPayload = {
      player_name: payload.player_name,
      card_set: payload.card_set,
      parallel_name: payload.parallel_insert_type,
      print_run: payload.print_run,
      is_auto: payload.is_auto,
      is_relic: payload.is_relic,
      is_rookie: payload.is_rookie,
      is_one_of_one: payload.is_one_of_one,
      grade: payload.grade
    }

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
    
    if (data.projected_target && data.projected_target > 0) {
      const new_price = data.projected_target * 0.95
      return { success: true, price: new_price }
    } else {
      return { success: false, message: `Oracle returned invalid projected_target.` }
    }

  } catch (err: any) {
    return { success: false, message: `Error evaluating item: ${err.message}` }
  }
}

