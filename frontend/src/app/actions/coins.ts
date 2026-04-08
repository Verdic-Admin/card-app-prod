'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitCoinRequest(itemId: string, email: string) {
  const supabase = await createClient()

  // Allow anonymous submission for a coin request if needed, 
  // but let's just use the anon client.
  const { error } = await supabase.from('coin_requests').insert({
    item_id: itemId,
    buyer_email: email,
    status: 'pending'
  })

  if (error) {
    throw new Error(`Failed to submit coin request: ${error.message}`)
  }
}

export async function fulfillCoinRequest(requestId: string, itemId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const admin = createAdminClient()
  const file = formData.get('image') as File
  if (!file) throw new Error("Missing image file")

  const fileExt = file.name.split('.').pop()
  const fileName = `coin-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

  const { error: uploadError } = await admin.storage
    .from('card-images')
    .upload(fileName, file)

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  const { data: urlData } = admin.storage
    .from('card-images')
    .getPublicUrl(fileName)

  const coinedImageUrl = urlData.publicUrl

  // 1. Stamp inventory
  await admin.from('inventory').update({ coined_image_url: coinedImageUrl }).eq('id', itemId)

  // 2. Resolve request
  await admin.from('coin_requests').update({ status: 'fulfilled' }).eq('id', requestId)

  revalidatePath('/admin')
  revalidatePath(`/item/${itemId}`)
  return { success: true }
}
