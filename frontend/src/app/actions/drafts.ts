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
    status: 'draft'
  }))

  const { data, error } = await (admin.from('inventory') as any)
    .insert(payload)
    .select('id, player_name, card_set, card_number, insert_name, parallel_name, image_url, back_image_url, listed_price')

  if (error) {
    console.error("Draft insert error:", error)
    throw new Error("Failed to save drafts to database")
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

  const { error } = await (admin.from('inventory') as any)
    .update(payload)
    .eq('id', id)

  if (error) throw new Error("Failed to update draft in database")
  return { success: true }
}

export async function publishDraftCardsAction(ids: string[]) {
  const admin = createAdminClient()
  
  const { error } = await (admin.from('inventory') as any)
    .update({ status: 'available' })
    .in('id', ids)

  if (error) throw new Error("Failed to mint drafts to live inventory")
  return { success: true }
}
