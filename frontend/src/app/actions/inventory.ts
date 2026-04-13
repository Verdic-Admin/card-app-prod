'use server'

import { createAdminClient, createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addCardAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const admin = createAdminClient()

  const file = formData.get('image') as File
  const backFile = formData.get('back_image') as File | null
  const payload = JSON.parse(formData.get('data') as string)

  if (!file) throw new Error("Missing primary image file")

  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

  const { error: uploadError } = await admin.storage
    .from('card-images')
    .upload(fileName, file)

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  const { data: publicUrlData } = admin.storage
    .from('card-images')
    .getPublicUrl(fileName)

  let backImageUrl = null
  if (backFile) {
    const backExt = (backFile.name || '').split('.').pop()
    const backFileName = `back-${Date.now()}-${Math.random().toString(36).substring(7)}.${backExt}`
    const { error: backUploadError } = await admin.storage.from('card-images').upload(backFileName, backFile)
    if (!backUploadError) {
      const { data: backUrlData } = admin.storage.from('card-images').getPublicUrl(backFileName)
      backImageUrl = backUrlData.publicUrl
    }
  }

  const { data: insertedRow, error: dbError } = await (admin.from('inventory') as any)
    .insert({
      player_name: payload.player_name,
      team_name: payload.team_name,
      card_set: payload.card_set,
      insert_name: payload.insert_name,
      parallel_name: payload.parallel_name,
      card_number: payload.card_number,
      high_price: payload.high_price,
      low_price: payload.low_price,
      avg_price: payload.avg_price,
      listed_price: payload.listed_price || payload.avg_price,
      cost_basis: payload.cost_basis || 0,
      accepts_offers: payload.accepts_offers || false,
      image_url: publicUrlData.publicUrl,
      back_image_url: backImageUrl,
      status: 'available'
    }).select('id').single()

  if (dbError) throw new Error(`Database insert failed: ${dbError.message}`)

  try {
    const shopId = process.env.NEXT_PUBLIC_SHOP_ID
    const siteDomain = process.env.NEXT_PUBLIC_SITE_DOMAIN
    if (!shopId || !siteDomain) throw new Error("Syndication configuration missing")
    const fullUrl = `https://${siteDomain}/product/${insertedRow?.id || 'new'}`
    
    await fetch('https://api.playerindexdata.com/fintech/syndication/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop_id: shopId,
        player_name: payload.player_name,
        card_set: payload.card_set,
        insert_name: payload.insert_name || payload.parallel_insert_type,
        parallel_name: payload.parallel_name || payload.parallel_insert_type,
        price: payload.listed_price || payload.avg_price,
        image_url: publicUrlData.publicUrl,
        buy_url: fullUrl
      })
    })
  } catch (e) {
    console.warn("Syndication webhook failed:", e)
  }

  revalidatePath('/')
  revalidatePath('/admin')
  return { success: true }
}

export async function batchCommitAction(items: any[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const admin = createAdminClient()

  for (const item of items) {
    const payload = {
      player_name: item.player_name,
      card_set: item.card_set,
      insert_name: item.insert_name,
      parallel_name: item.parallel_name,
      parallel_insert_type: [item.insert_name, item.parallel_name].filter(v => v && String(v).toLowerCase() !== 'base').join(' ') || 'Base',
      listed_price: item.price || 0,
      avg_price: item.price || 0,
      cost_basis: 0,
      accepts_offers: true,
      image_url: item.side_a_url,
      back_image_url: item.side_b_url,
      status: 'available'
    }

    const { data: insertedRow, error } = await (admin.from('inventory') as any).insert(payload).select('id').single()
    if (error) {
      console.error("Batch insert error:", error)
      continue
    }

    // Fire webhook
    try {
      const shopId = process.env.NEXT_PUBLIC_SHOP_ID
      const siteDomain = process.env.NEXT_PUBLIC_SITE_DOMAIN
      if (!shopId || !siteDomain) throw new Error("Syndication configuration missing")
      const fullUrl = `https://${siteDomain}/product/${insertedRow.id}`
      await fetch('https://api.playerindexdata.com/fintech/syndication/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shopId,
          player_name: payload.player_name,
          card_set: payload.card_set,
          insert_name: item.insert_name,
          parallel_name: item.parallel_name,
          price: payload.listed_price,
          image_url: payload.image_url,
          buy_url: fullUrl
        })
      })
    } catch (e) {
      console.warn("Syndication webhook failed:", e)
    }
  }

  revalidatePath('/')
  revalidatePath('/admin')
  return { success: true }
}

// ─── Lot / Bundle Actions ──────────────────────────────────────────────────

export async function createLotAction(
  itemIds: string[],
  lotTitle: string,
  lotPrice: number
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()

  // 1. Sum cost_basis of all child cards
  const { data: children, error: fetchErr } = await (admin.from('inventory') as any)
    .select('cost_basis')
    .in('id', itemIds)
  if (fetchErr) throw new Error(`Failed to fetch children: ${fetchErr.message}`)

  const totalCostBasis = (children as any[]).reduce(
    (sum: number, c: any) => sum + Number(c.cost_basis ?? 0),
    0
  )

  // 2. Insert the parent Lot row
  const { data: lot, error: insertErr } = await (admin.from('inventory') as any)
    .insert({
      player_name: lotTitle,
      listed_price: lotPrice,
      avg_price: lotPrice,
      cost_basis: totalCostBasis,
      is_lot: true,
      accepts_offers: false,
      status: 'available',
    })
    .select('id')
    .single()

  if (insertErr || !lot) throw new Error(`Failed to create lot: ${insertErr?.message}`)

  // 3. Link child cards to this lot
  const { error: linkErr } = await (admin.from('inventory') as any)
    .update({ lot_id: lot.id })
    .in('id', itemIds)
  if (linkErr) throw new Error(`Failed to link children: ${linkErr.message}`)

  revalidatePath('/')
  revalidatePath('/admin')
  return { success: true, lotId: lot.id }
}

export async function breakLotAction(lotId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()

  // 1. Unlink all child cards
  const { error: unlinkErr } = await (admin.from('inventory') as any)
    .update({ lot_id: null })
    .eq('lot_id', lotId)
  if (unlinkErr) throw new Error(`Failed to unlink children: ${unlinkErr.message}`)

  // 2. Delete the lot row itself
  const { error: deleteErr } = await (admin.from('inventory') as any)
    .delete()
    .eq('id', lotId)
  if (deleteErr) throw new Error(`Failed to delete lot: ${deleteErr.message}`)

  revalidatePath('/')
  revalidatePath('/admin')
  return { success: true }
}

export async function toggleCardStatus(id: string, currentStatus: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const admin = createAdminClient()
  const newStatus = currentStatus === 'available' ? 'sold' : 'available'
  const payload: any = { status: newStatus }
  if (newStatus === 'sold') {
    payload.sold_at = new Date().toISOString()
  } else {
    payload.sold_at = null
  }

  const { error } = await (admin.from('inventory') as any).update(payload).eq('id', id)
  if (error) throw new Error(`Update failed: ${error.message}`)

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/sold')
}

export async function editCardAction(id: string, payload: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const admin = createAdminClient()
  
  const { error } = await (admin.from('inventory') as any).update(payload).eq('id', id)
  if (error) throw new Error(`Update failed: ${error.message}`)

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/sold')
}

export async function deleteCardAction(id: string, imageUrl?: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const admin = createAdminClient()

  if (imageUrl) {
    try {
      const urlObj = new URL(imageUrl)
      const pathParts = urlObj.pathname.split('/')
      const fileName = pathParts[pathParts.length - 1]
      
      if (fileName) {
        await admin.storage.from('card-images').remove([fileName])
      }
    } catch (e) {
      console.warn("Failed to delete image from storage:", e)
    }
  }

  const { error } = await admin.from('inventory').delete().eq('id', id)
  if (error) throw new Error(`Delete failed: ${error.message}`)

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/sold')
}

export async function bulkDeleteCardsAction(items: {id: string, image_url: string | null}[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const admin = createAdminClient()

  // 1. Delete all images from storage to prevent massive orphaned asset bills
  const fileNames = items
    .filter(i => i.image_url)
    .map(i => {
      try {
        const urlObj = new URL(i.image_url!)
        const pathParts = urlObj.pathname.split('/')
        return pathParts[pathParts.length - 1]
      } catch { return null }
    })
    .filter(Boolean) as string[]

  if (fileNames.length > 0) {
    await admin.storage.from('card-images').remove(fileNames)
  }

  // 2. Delete all records from DB in a single ultra-fast operation
  const ids = items.map(i => i.id)
  const { error } = await admin.from('inventory').delete().in('id', ids)
  
  if (error) throw new Error(`Bulk delete failed: ${error.message}`)

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/sold')
}

export async function rotateCardImageAction(
  id: string,
  side: 'front' | 'back',
  formData: FormData
): Promise<{ newUrl: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const newFile = formData.get('image') as File
  if (!newFile) throw new Error('Missing rotated image file')

  // Fetch the current record so we can delete the old storage file
  const { data: record } = await (admin.from('inventory') as any)
    .select('image_url, back_image_url')
    .eq('id', id)
    .single()

  const oldUrl: string | null = side === 'front' ? record?.image_url : record?.back_image_url

  // Delete old file from storage (best-effort)
  if (oldUrl) {
    try {
      const parts = new URL(oldUrl).pathname.split('/')
      const oldName = parts[parts.length - 1]
      if (oldName) {
         const { error: removeError } = await admin.storage.from('card-images').remove([oldName])
         if (removeError) console.error("Failed to cleanly delete rotated old image:", removeError.message)
      }
    } catch (e: any) { console.error("Failed to cleanly delete rotated old image:", e.message) }
  }

  // Upload rotated file
  const ext = newFile.name.split('.').pop() || 'jpg'
  const prefix = side === 'back' ? 'back-rotated' : 'rotated'
  const newName = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`
  const { error: uploadError } = await admin.storage.from('card-images').upload(newName, newFile)
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  const { data: urlData } = admin.storage.from('card-images').getPublicUrl(newName)
  const newUrl = urlData.publicUrl

  const field = side === 'front' ? 'image_url' : 'back_image_url'
  const { error: dbError } = await (admin.from('inventory') as any)
    .update({ [field]: newUrl })
    .eq('id', id)
  if (dbError) throw new Error(`DB update failed: ${dbError.message}`)

  revalidatePath('/')
  revalidatePath('/admin')
  return { newUrl }
}

export async function bulkUpdateMetricsAction(ids: string[], costBasis: number, acceptsOffers: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const admin = createAdminClient()

  const { error } = await admin.from('inventory').update({
    cost_basis: costBasis,
    accepts_offers: acceptsOffers
  }).in('id', ids)
  
  if (error) throw new Error(`Bulk update failed: ${error.message}`)

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/sold')
}

export async function updateLiveStreamUrl(url: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const admin = createAdminClient()
  await (admin.from('store_settings') as any).update({ live_stream_url: url }).eq('id', 1)
  revalidatePath('/admin')
  revalidatePath('/auction')
}

export async function updateProjectionTimeframe(timeframe: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const admin = createAdminClient()
  await (admin.from('store_settings') as any).update({ projection_timeframe: timeframe }).eq('id', 1)
  revalidatePath('/admin')
  revalidatePath('/auction')
}

export async function sendToAuctionBlock(ids: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const admin = createAdminClient()
  await (admin.from('inventory') as any).update({ is_auction: true, auction_status: 'pending' }).in('id', ids)
  revalidatePath('/admin')
}

export async function updateStagedAuction(itemId: string, reservePrice: number | null, endTime: string | null, description: string | null, coinedImageUrl?: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const admin = createAdminClient()
  const payload: any = {}
  if (reservePrice !== undefined) payload.auction_reserve_price = reservePrice
  if (endTime !== undefined) payload.auction_end_time = endTime
  if (description !== undefined) payload.auction_description = description
  if (coinedImageUrl !== undefined) payload.coined_image_url = coinedImageUrl
  
  await (admin.from('inventory') as any).update(payload).eq('id', itemId)
  revalidatePath('/admin')
}

export async function goLiveWithAuctions(itemIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const admin = createAdminClient()
  await (admin.from('inventory') as any).update({ auction_status: 'live' }).in('id', itemIds)
  revalidatePath('/admin')
  revalidatePath('/auction')
}

export async function generateBatchCodes(ids: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const admin = createAdminClient()
  for (const id of ids) {
    const code = `PI-${Math.floor(1000 + Math.random() * 9000)}`
    await (admin.from('inventory') as any).update({ verification_code: code }).eq('id', id)
  }
  revalidatePath('/admin')
}

export async function uploadVerifiedFlipUI(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const admin = createAdminClient()
  
  const file = formData.get('video') as File
  if (!file) throw new Error("Missing video file")
  
  const fileExt = file.name.split('.').pop()
  const fileName = `video-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const { error: uploadError } = await admin.storage.from('card-images').upload(fileName, file)
  if (uploadError) throw new Error('Upload failed')
  const { data: urlData } = admin.storage.from('card-images').getPublicUrl(fileName)
  
  await (admin.from('inventory') as any).update({
    video_url: urlData.publicUrl,
    is_verified_flip: true
  }).eq('id', id)
  revalidatePath('/admin')
  revalidatePath('/auction')
}

export async function removeFromAuctionBlock(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const admin = createAdminClient()
  await (admin.from('inventory') as any).update({ is_auction: false, auction_status: 'pending' }).eq('id', id)
  revalidatePath('/admin')
  revalidatePath('/auction')
}

export async function setAuctionStatus(id: string, status: 'pending' | 'live' | 'ended') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")
  const admin = createAdminClient()
  await (admin.from('inventory') as any).update({ auction_status: status }).eq('id', id)
  revalidatePath('/admin')
  revalidatePath('/auction')
}
