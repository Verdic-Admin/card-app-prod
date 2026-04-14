"use server";
import { sql } from '@vercel/postgres';

import { put, del } from '@vercel/blob';

// Executes the user-requested Pre-Flight check right before PayPal generated. 
// Protects the single-item cart model from ghost carts perfectly.
export async function validateCartCompleteness(itemIds: string[]) {
  const { rows: updatedData } = await sql`
      UPDATE inventory 
      SET status = 'pending_checkout', checkout_expires_at = ${new Date(Date.now() + 10 * 60000).toISOString()}
      WHERE id = ANY(${itemIds as any}::uuid[]) AND status = 'available'
      RETURNING id
  `;

  const lockedIds = updatedData?.map((d: any) => d.id) || []
  const missingOrSold = itemIds.filter(id => !lockedIds.includes(id))

  return { 
    valid: missingOrSold.length === 0, 
    unavailableIds: missingOrSold 
  }
}

export async function submitTradeOffer(formData: FormData) {

  
  const buyer_name = formData.get('name') as string;
  const buyer_email = formData.get('email') as string;
  const offer_text = formData.get('offer') as string;
  let target_items = JSON.parse(formData.get('targetItems') as string) || [];
  
  if (Array.isArray(target_items) && target_items.length > 0) {
    const itemIds = target_items.map((i: any) => i.id || i);
    const { rows } = await sql`SELECT id, listed_price, market_price FROM inventory WHERE id = ANY(${itemIds as any}::uuid[])`;
    target_items = target_items.map((t: any) => {
       const itemId = t.id || t;
       const dbItem = rows.find(r => r.id === itemId);
       if (dbItem) {
          return {
             ...(typeof t === 'object' ? t : { id: t }),
             snapshot_listed_price: dbItem.listed_price,
             snapshot_market_price: dbItem.market_price
          };
       }
       return t;
    });
  }

  const imageFiles = formData.getAll('images') as File[];
  let attached_image_urls: string[] = [];

  for (const imageFile of imageFiles) {
    if (imageFile && imageFile.size > 0) {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `trade_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `trades/${fileName}`

      const { url } = await put(filePath, imageFile, { access: 'public' });
      attached_image_urls.push(url);
    }
  }
  
  const final_image_urls = attached_image_urls.length > 0 ? attached_image_urls.join(',') : null;

  try {
     await sql`
        INSERT INTO trade_offers (buyer_name, buyer_email, offer_text, target_items, attached_image_url, status)
        VALUES (${buyer_name}, ${buyer_email}, ${offer_text}, ${JSON.stringify(target_items)}, ${final_image_urls}, 'pending')
     `;
  } catch (error: any) {
    console.error("PG Error Data:", error)
    return { success: false, error: `Database Insert Fault: ${error.message}. Is your attached_image_url column properly created as type Text?` }
  }

  // Instantly send a Discord notification via webhook
  if (process.env.DISCORD_WEBHOOK_URL) {
    try {
      const embed: any = {
        title: `New Trade Offer from ${buyer_name}`,
        color: 3447003, // Blue embed color
        description: `**Email:** ${buyer_email}\n**Offer:** ${offer_text || "*No offer text provided*"}\n\n**Action Required:** Login to your secure Vercel Admin Dashboard to instantly review exactly what items they requested from your store!`,
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
  try {
    if (imageUrl) {
      const urls = imageUrl.split(',');
      await del(urls);
    }
    await sql`UPDATE trade_offers SET attached_image_url = null WHERE id = ${tradeOfferId}`;
    return { success: true }
  } catch (error: any) {
    console.error("Failed to clear trade image storage:", error)
    throw new Error(error.message)
  }
}

export async function getAllTradeOffers() {
  const { rows } = await sql`SELECT * FROM trade_offers ORDER BY created_at DESC`;
  return rows;
}

export async function deleteTradeOfferRecord(id: string, imageUrl: string | null) {
  try {
    if (imageUrl) {
      await del(imageUrl);
    }
    await sql`DELETE FROM trade_offers WHERE id = ${id}`;
    return { success: true }
  } catch (error: any) {
    console.error("Failed to delete trade offer:", error)
    throw new Error(error.message)
  }
}
