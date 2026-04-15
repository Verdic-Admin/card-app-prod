"use server";
import pool from '@/utils/db';

import { put, del } from '@/utils/storage';

// Executes the user-requested Pre-Flight check right before PayPal generated. 
// Protects the single-item cart model from ghost carts perfectly.
export async function validateCartCompleteness(itemIds: string[]) {
  const { rows: updatedData } = await pool.query(`
      UPDATE inventory 
      SET status = 'pending_checkout', checkout_expires_at = $1
      WHERE id = ANY($2::uuid[]) AND status = 'available'
      RETURNING id
  `, [new Date(Date.now() + 10 * 60000).toISOString(), itemIds]);

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
    const { rows } = await pool.query(`SELECT id, listed_price, market_price FROM inventory WHERE id = ANY($1::uuid[])`, [itemIds]);
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
     await pool.query(`
        INSERT INTO trade_offers (buyer_name, buyer_email, offer_text, target_items, attached_image_url, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
     `, [buyer_name, buyer_email, offer_text, JSON.stringify(target_items), final_image_urls]);
  } catch (error: any) {
    console.error("PG Error Data:", error)
    return { success: false, error: `Database Insert Fault: ${error.message}. Is your attached_image_url column properly created as type Text?` }
  }



  return { success: true }
}

export async function clearTradeImageStorage(tradeOfferId: string, imageUrl: string) {
  try {
    if (imageUrl) {
      const urls = imageUrl.split(',');
      await del(urls);
    }
    await pool.query(`UPDATE trade_offers SET attached_image_url = null WHERE id = $1`, [tradeOfferId]);
    return { success: true }
  } catch (error: any) {
    console.error("Failed to clear trade image storage:", error)
    throw new Error(error.message)
  }
}

export async function getAllTradeOffers() {
  const { rows } = await pool.query(`SELECT * FROM trade_offers ORDER BY created_at DESC`);
  return rows;
}

export async function deleteTradeOfferRecord(id: string, imageUrl: string | null) {
  try {
    if (imageUrl) {
      await del(imageUrl);
    }
    await pool.query(`DELETE FROM trade_offers WHERE id = $1`, [id]);
    return { success: true }
  } catch (error: any) {
    console.error("Failed to delete trade offer:", error)
    throw new Error(error.message)
  }
}
export async function approveManualPayment(offerId: string) {
  try {
     const { rows } = await pool.query(`SELECT target_items FROM trade_offers WHERE id = $1 LIMIT 1`, [offerId]);
     if (!rows.length) throw new Error("Order not found.");
     
     const items = typeof rows[0].target_items === 'string' 
         ? JSON.parse(rows[0].target_items) 
         : rows[0].target_items;
         
     const itemIds = items.map((i: any) => i.id);
     
     // 1. Mark inventory as Sold
     if (itemIds.length > 0) {
        await pool.query(`UPDATE inventory SET status = 'sold', sold_at = NOW() WHERE id = ANY($1::uuid[])`, [itemIds]);
     }
     
     // 2. Mark order as confirmed and complete
     await pool.query(`UPDATE trade_offers SET status = 'completed' WHERE id = $1`, [offerId]);
     
     return { success: true };
  } catch (error: any) {
     console.error(error);
     return { success: false, error: error.message };
  }
}
