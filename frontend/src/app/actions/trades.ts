'use server'

import { createAdminClient, createClient } from '@/utils/supabase/server'

// Executes the user-requested Pre-Flight check right before PayPal generated. 
// Protects the single-item cart model from ghost carts perfectly.
export async function validateCartCompleteness(itemIds: string[]) {
  const supabase = await createClient()
  
  if (itemIds.length === 0) return { valid: false, unavailableIds: [] }

  const { data, error } = await (supabase.from('inventory') as any)
    .select('id, status')
    .in('id', itemIds)

  if (error) throw new Error("Database validation failed")

  // Iterate checking if an item was completely deleted or sold in another session
  const missingOrSold = itemIds.filter(id => {
    const dbItem = data.find((d: any) => d.id === id)
    return !dbItem || dbItem.status !== 'available'
  })

  return { 
    valid: missingOrSold.length === 0, 
    unavailableIds: missingOrSold 
  }
}

export async function submitTradeOffer(formData: FormData) {
  const supabaseAdmin = createAdminClient()
  
  const buyer_name = formData.get('name') as string;
  const buyer_email = formData.get('email') as string;
  const offer_text = formData.get('offer') as string;
  const target_items = JSON.parse(formData.get('targetItems') as string);
  const imageFiles = formData.getAll('images') as File[];

  let attached_image_urls: string[] = [];

  for (const imageFile of imageFiles) {
    if (imageFile && imageFile.size > 0) {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `trade_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `trades/${fileName}`

      // Pumping trade images into the exact same public bucket
      const { error: uploadError } = await supabaseAdmin.storage
        .from('trade-images')
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error("Failed to upload trade image:", uploadError)
        throw new Error(`Execution error dropping payload into DB: ${uploadError.message}`)
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('trade-images')
        .getPublicUrl(filePath)

      attached_image_urls.push(publicUrl);
    }
  }
  
  const final_image_urls = attached_image_urls.length > 0 ? attached_image_urls.join(',') : null;

  const { error } = await (supabaseAdmin.from('trade_offers') as any)
    .insert({
      buyer_name,
      buyer_email,
      offer_text,
      target_items,
      attached_image_url: final_image_urls,
      status: 'pending'
    })

  if (error) {
    console.error("Supabase Error Data:", error)
    throw new Error(`Execution error dropping payload into DB: ${error.message}`)
  }

  // Instantly send a completely free email notification to your registered PayPal email!
  if (process.env.NEXT_PUBLIC_PAYPAL_EMAIL) {
    try {
      await fetch(`https://formsubmit.co/ajax/${process.env.NEXT_PUBLIC_PAYPAL_EMAIL}`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          _subject: `New Database Trade Offer from ${buyer_name}!`,
          Email: buyer_email,
          Offer: offer_text,
          Attached_Image: final_image_urls || "User did not attach an image",
          Message: "Login to your secure Supabase Dashboard to instantly review exactly what items they requested from your store!"
        })
      });
    } catch(e) {
      console.warn("Failed to dispatch free email notification:", e)
    }
  }

  return { success: true }
}

export async function clearTradeImageStorage(tradeOfferId: string, imageUrl: string) {
  const supabaseAdmin = createAdminClient()
  try {
    const path = imageUrl.split('/trade-images/')[1]
    if (path) {
      await supabaseAdmin.storage.from('trade-images').remove([path])
    }
    const { error } = await (supabaseAdmin.from('trade_offers') as any)
      .update({ attached_image_url: null })
      .eq('id', tradeOfferId)
      
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error("Failed to clear trade image storage:", error)
    throw new Error(error.message)
  }
}

export async function getAllTradeOffers() {
  const supabaseAdmin = createAdminClient()
  const { data, error } = await (supabaseAdmin.from('trade_offers') as any)
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw new Error(error.message)
  return data
}

export async function deleteTradeOfferRecord(id: string, imageUrl: string | null) {
  const supabaseAdmin = createAdminClient()
  try {
    if (imageUrl) {
      const path = imageUrl.split('/trade-images/')[1]
      if (path) {
        await supabaseAdmin.storage.from('trade-images').remove([path])
      }
    }
    const { error } = await (supabaseAdmin.from('trade_offers') as any)
      .delete()
      .eq('id', id)
      
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error("Failed to delete trade offer:", error)
    throw new Error(error.message)
  }
}
