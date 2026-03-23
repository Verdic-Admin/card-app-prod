'use server'

import { createAdminClient, createClient } from '@/utils/supabase/server'

// Executes the user-requested Pre-Flight check right before PayPal generated. 
// Protects the single-item cart model from ghost carts perfectly.
export async function validateCartCompleteness(itemIds: string[]) {
  const supabase = await createClient()
  
  if (!itemIds || itemIds.length === 0) return { valid: true, unavailableIds: [] }

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
        return { success: false, error: `Bucket Upload Fault: ${uploadError.message}. Make absolutely sure the 'trade-images' Storage Bucket exists and is Public!` }
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
    return { success: false, error: `Database Insert Fault: ${error.message}. Is your attached_image_url column properly created as type Text?` }
  }

  // Instantly send a Discord notification via webhook
  if (process.env.DISCORD_WEBHOOK_URL) {
    try {
      const embed: any = {
        title: `New Trade Offer from ${buyer_name}`,
        color: 3447003, // Blue embed color
        description: `**Email:** ${buyer_email}\n**Offer:** ${offer_text || "*No offer text provided*"}\n\n**Action Required:** Login to your secure Supabase Dashboard to instantly review exactly what items they requested from your store!`,
        timestamp: new Date().toISOString(),
      };

      if (final_image_urls) {
        const urls = final_image_urls.split(',');
        embed.image = { url: urls[0] }; // Display the first attached image
        if (urls.length > 1) {
          embed.description += `\n\n**Additional Images:**\n${urls.slice(1).map((u, i) => `[Image ${i + 2}](${u})`).join('\n')}`;
        }
      }

      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: null, embeds: [embed] })
      });
    } catch(e) {
      console.warn("Failed to dispatch Discord webhook notification:", e)
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
