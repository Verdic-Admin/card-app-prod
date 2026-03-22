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

  const { error: dbError } = await (admin.from('inventory') as any)
    .insert({
      player_name: payload.player_name,
      team_name: payload.team_name,
      year: payload.year,
      card_set: payload.card_set,
      parallel_insert_type: payload.parallel_insert_type,
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
    })

  if (dbError) throw new Error(`Database insert failed: ${dbError.message}`)

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
