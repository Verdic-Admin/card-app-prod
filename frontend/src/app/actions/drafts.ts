'use server'

import { createAdminClient } from '@/utils/supabase/server'

export async function createDraftCardsAction(cards: any[]) {
  const admin = createAdminClient()
  
  const payload = cards.map(c => ({
    player_name: c.player_name || '',
    card_set: c.card_set || '',
    card_number: c.card_number || '',
    insert_name: c.insert_name || '',
    parallel_name: c.parallel_name || '',
    image_url: c.side_a_url,
    back_image_url: c.side_b_url,
    listed_price: c.price || 0,
  }))

  const { data, error } = await (admin.from('scan_staging') as any)
    .insert(payload)
    .select('id, player_name, card_set, card_number, insert_name, parallel_name, image_url, back_image_url, listed_price')

  if (error) {
    console.error("Staging insert error:", error)
    throw new Error("Failed to save drafts to staging")
  }

  return data
}

export async function updateDraftCardAction(id: string, updates: any) {
  const admin = createAdminClient()
  
  const payload: any = {}
  if (updates.player_name !== undefined) payload.player_name = updates.player_name
  if (updates.card_set !== undefined) payload.card_set = updates.card_set
  if (updates.card_number !== undefined) payload.card_number = updates.card_number
  if (updates.insert_name !== undefined) payload.insert_name = updates.insert_name
  if (updates.parallel_name !== undefined) payload.parallel_name = updates.parallel_name
  if (updates.price !== undefined) {
    payload.listed_price = parseFloat(updates.price) || 0
  }

  const { error } = await (admin.from('scan_staging') as any)
    .update(payload)
    .eq('id', id)

  if (error) throw new Error("Failed to update staging draft")
  return { success: true }
}

export async function publishDraftCardsAction(ids: string[]) {
  const admin = createAdminClient()
  
  // 1. Read approved rows from staging
  const { data: staged, error: readError } = await (admin.from('scan_staging') as any)
    .select('player_name, card_set, card_number, insert_name, parallel_name, image_url, back_image_url, listed_price')
    .in('id', ids)

  if (readError || !staged?.length) {
    throw new Error("Failed to read staged cards")
  }

  // 2. Insert into live inventory
  const inventoryPayload = staged.map((s: any) => ({
    player_name: s.player_name,
    card_set: s.card_set,
    card_number: s.card_number,
    insert_name: s.insert_name,
    parallel_name: s.parallel_name,
    image_url: s.image_url,
    back_image_url: s.back_image_url,
    listed_price: s.listed_price,
    status: 'available',
  }))

  const { error: insertError } = await (admin.from('inventory') as any)
    .insert(inventoryPayload)

  if (insertError) {
    throw new Error("Failed to mint cards to inventory")
  }

  // 3. Remove from staging
  const { error: deleteError } = await (admin.from('scan_staging') as any)
    .delete()
    .in('id', ids)

  if (deleteError) {
    console.error("Warning: cards minted but staging cleanup failed:", deleteError)
  }

  return { success: true }
}
