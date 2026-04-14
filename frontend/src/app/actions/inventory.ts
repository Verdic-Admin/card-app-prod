"use server";

import { revalidatePath } from 'next/cache'
import { sql } from '@vercel/postgres'
import { put, del } from '@vercel/blob'

// Authentication check
function checkAuth() {
  if (!process.env.PLAYERINDEX_API_KEY) {
    throw new Error("Unauthorized: Missing PLAYERINDEX_API_KEY");
  }
}

export async function uploadAssetAction(formData: FormData) {
  checkAuth();
  const file = formData.get('file') as File;
  if (!file) throw new Error("No file provided");
  
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `batch-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  
  const blob = await put(`scans/${fileName}`, file, {
    access: 'public',
  });
  
  return { url: blob.url };
}

export async function addCardAction(formData: FormData) {
  checkAuth();

  const file = formData.get('image') as File
  const backFile = formData.get('back_image') as File | null
  const payload = JSON.parse(formData.get('data') as string)

  if (!file) throw new Error("Missing primary image file")

  const fileExt = file.name.split('.').pop() || 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

  const blob = await put(`card-images/${fileName}`, file, {
    access: 'public',
  });
  
  let backImageUrl = null
  if (backFile) {
    const backExt = (backFile.name || '').split('.').pop() || 'jpg'
    const backFileName = `back-${Date.now()}-${Math.random().toString(36).substring(7)}.${backExt}`
    try {
        const backBlob = await put(`card-images/${backFileName}`, backFile, { access: 'public' });
        backImageUrl = backBlob.url;
    } catch { }
  }

  const { rows } = await sql`
    INSERT INTO inventory (
      player_name, team_name, card_set, insert_name, parallel_name, card_number, 
      high_price, low_price, avg_price, listed_price, cost_basis, accepts_offers, 
      image_url, back_image_url, status
    ) VALUES (
      ${payload.player_name}, ${payload.team_name}, ${payload.card_set}, ${payload.insert_name},
      ${payload.parallel_name}, ${payload.card_number}, ${payload.high_price}, ${payload.low_price},
      ${payload.avg_price}, ${payload.listed_price || payload.avg_price}, ${payload.cost_basis || 0}, ${payload.accepts_offers || false},
      ${blob.url}, ${backImageUrl}, 'available'
    ) RETURNING id
  `;
  const insertedRow = rows[0];


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
        image_url: blob.url,
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
  checkAuth();

  for (const item of items) {
    const parallel_insert_type = [item.insert_name, item.parallel_name].filter(v => v && String(v).toLowerCase() !== 'base').join(' ') || 'Base';
    try {
      const { rows } = await sql`
        INSERT INTO inventory (
          player_name, card_set, insert_name, parallel_name, parallel_insert_type,
          listed_price, avg_price, cost_basis, accepts_offers, image_url, back_image_url, status
        ) VALUES (
          ${item.player_name}, ${item.card_set}, ${item.insert_name}, ${item.parallel_name}, ${parallel_insert_type},
          ${item.price || 0}, ${item.price || 0}, 0, true, ${item.side_a_url}, ${item.side_b_url}, 'available'
        ) RETURNING id
      `;
      const insertedRow = rows[0];

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
          player_name: item.player_name,
          card_set: item.card_set,
          insert_name: item.insert_name,
          parallel_name: item.parallel_name,
          image_url: item.side_a_url,
          buy_url: fullUrl
        })
      })
    } catch (e) {
      console.warn("Syndication webhook failed:", e)
    }
    } catch (err) {
       console.error("Insertion failed:", err)
    }
  }

  revalidatePath('/')
  revalidatePath('/admin')
  return { success: true }
}

export async function vercelBatchInsertInventory(items: any[]) {
  // Directly insert finalized DB payload arrays
  for (const item of items) {
     const price = item.pricing?.listed_price || 0
     const status = String(item.status)
     const trend_data = JSON.stringify(item.pricing?.trend_points || [])
     const player_index_url = item.pricing?.player_index_url || ''
     await sql`
       INSERT INTO inventory 
         (player_name, card_set, listed_price, market_price, image_url, status, trend_data, player_index_url)
       VALUES 
         (${item.player_name}, ${item.card_set}, ${price}, ${price}, '', ${status}, ${trend_data}::jsonb, ${player_index_url})
     `;
  }
  revalidatePath('/')
  revalidatePath('/admin')
  return { success: true }
}

export async function vercelBatchUpdatePrices(updates: { id: string, listed_price: number, market_price: number, trend_data?: number[], player_index_url?: string }[]) {
  if (updates.length === 0) return { success: true };

  const ids = updates.map(u => u.id);
  const listedPrices = updates.map(u => u.listed_price);
  const marketPrices = updates.map(u => u.market_price);
  const trendData = updates.map(u => JSON.stringify(u.trend_data || []));
  const playerIndexUrls = updates.map(u => u.player_index_url || '');

  try {
    await sql`
      UPDATE inventory AS i
      SET 
        listed_price = u.listed_price,
        market_price = u.market_price,
        trend_data = u.trend_data,
        player_index_url = u.player_index_url
      FROM UNNEST(
        ${ids as any}::UUID[], 
        ${listedPrices as any}::NUMERIC[], 
        ${marketPrices as any}::NUMERIC[],
        ${trendData as any}::JSONB[],
        ${playerIndexUrls as any}::TEXT[]
      ) AS u(id, listed_price, market_price, trend_data, player_index_url)
      WHERE i.id = u.id;
    `;
    revalidatePath('/');
    revalidatePath('/admin');
    return { success: true };
  } catch (err) {
    console.error("Batch update error:", err);
    return { success: false, error: err };
  }
}

// ─── Lot / Bundle Actions ──────────────────────────────────────────────────

export async function createLotAction(
  itemIds: string[],
  lotTitle: string,
  lotPrice: number
) {
  checkAuth();
  
  // 1. Sum cost_basis of all child cards
  const { rows: children } = await sql`SELECT image_url, cost_basis FROM inventory WHERE id = ANY(${itemIds as any}::uuid[])`;

  const totalCostBasis = children.reduce(
    (sum: number, c: any) => sum + Number(c.cost_basis ?? 0),
    0
  )

  let finalImageUrl = '';

  // Auto-composite Logic
  if (children.length > 0) {
     try {
        const sharp = (await import('sharp')).default;
        const top4 = children.slice(0, 4).map(c => c.image_url).filter(u => u);
        const buffers = await Promise.all(top4.map(async url => {
           const res = await fetch(url);
           return res.arrayBuffer();
        }));
        
        if (buffers.length > 0) {
           // We will create a 400x400 collage and resize each into a 200x200 tile.
           const tileW = 200, tileH = 200;
           const composites: any[] = [];
           const resizePromises = buffers.map(async (buf, idx) => {
              const bgImg = await sharp(Buffer.from(buf)).resize(tileW, tileH, { fit: 'cover' }).toBuffer();
              const left = (idx % 2) * tileW;
              const top = Math.floor(idx / 2) * tileH;
              composites.push({ input: bgImg, left, top });
           });
           await Promise.all(resizePromises);
           
           const canvasW = composites.length > 1 ? tileW * 2 : tileW;
           const canvasH = composites.length > 2 ? tileH * 2 : tileH;
           
           const finalBuffer = await sharp({
              create: { width: canvasW, height: canvasH, channels: 4, background: { r:255, g:255, b:255, alpha: 1 } }
           })
           .composite(composites)
           .jpeg({ quality: 80 })
           .toBuffer();
           
           const blob = await put(`card-images/lot-${Date.now()}.jpg`, finalBuffer, { access: 'public', contentType: 'image/jpeg' });
           finalImageUrl = blob.url;
        }
     } catch (e: any) {
        console.warn("Soft fail composing lot image:", e.message);
     }
  }

  // 2. Insert the parent Lot row
  const { rows } = await sql`
      INSERT INTO inventory (player_name, listed_price, avg_price, cost_basis, is_lot, accepts_offers, status, image_url)
      VALUES (${lotTitle}, ${lotPrice}, ${lotPrice}, ${totalCostBasis}, true, false, 'available', ${finalImageUrl})
      RETURNING id
  `;
  const lotId = rows[0].id;

  // 3. Link child cards to this lot
  await sql`UPDATE inventory SET lot_id = ${lotId} WHERE id = ANY(${itemIds as any}::uuid[])`;

  revalidatePath('/')
  revalidatePath('/admin')
  return { success: true, lotId: lotId }
}

export async function updateLotChildren(lotId: string, itemIds: string[]) {
  checkAuth();

  // clear all linked
  await sql`UPDATE inventory SET lot_id = null WHERE lot_id = ${lotId}`;

  if (itemIds.length > 0) {
     // link new
     await sql`UPDATE inventory SET lot_id = ${lotId} WHERE id = ANY(${itemIds as any}::uuid[])`;
  
     // recalculate cost_basis
     const { rows: children } = await sql`SELECT sum(cost_basis) as total_basis FROM inventory WHERE lot_id = ${lotId}`;
     const totalBasis = children[0]?.total_basis || 0;
     await sql`UPDATE inventory SET cost_basis = ${totalBasis} WHERE id = ${lotId}`;
  } else {
     // If empty, cost_basis = 0
     await sql`UPDATE inventory SET cost_basis = 0 WHERE id = ${lotId}`;
  }

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true };
}

export async function breakLotAction(lotId: string) {
  checkAuth();

  
  // 1. Unlink all child cards
  await sql`UPDATE inventory SET lot_id = null WHERE lot_id = ${lotId}`;

  // 2. Delete the lot row itself
  await sql`DELETE FROM inventory WHERE id = ${lotId}`;

  revalidatePath('/')
  revalidatePath('/admin')
  return { success: true }
}

export async function toggleCardStatus(id: string, currentStatus: string) {
  checkAuth();

    const newStatus = currentStatus === 'available' ? 'sold' : 'available'
  const payload: any = { status: newStatus }
  if (newStatus === 'sold') {
    payload.sold_at = new Date().toISOString()
  } else {
    payload.sold_at = null
  }

  await sql`UPDATE inventory SET status = ${newStatus}, sold_at = ${payload.sold_at} WHERE id = ${id}`;

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/sold')
}

export async function editCardAction(id: string, payload: any) {
  checkAuth();

    
  // Manual generic update for now (or loop over keys)
  if(payload.listed_price) await sql`UPDATE inventory SET listed_price = ${payload.listed_price} WHERE id = ${id}`;

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/sold')
}

export async function deleteCardAction(id: string, imageUrl?: string | null) {
  checkAuth();

  
  if (imageUrl) {
    try {
      await del(imageUrl);
    } catch (e) {
      console.warn("Failed to delete blob from vercel:", e)
    }
  }
  await sql`DELETE FROM inventory WHERE id = ${id}`;

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/sold')
}

export async function bulkDeleteCardsAction(items: {id: string, image_url: string | null}[]) {
  checkAuth();

  
  // 1. Delete all images from vercel blob
  const urls = items.filter(i => i.image_url).map(i => i.image_url!);
  if (urls.length > 0) {
    try { await del(urls); } catch(e) {}
  }

  // 2. Delete all records from DB in a single ultra-fast operation
  if (items.length > 0) {
      const ids = items.map(i => i.id);
      await sql`DELETE FROM inventory WHERE id = ANY(${ids as any}::uuid[])`;
  }

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/sold')
}

export async function rotateCardImageAction(
  id: string,
  side: 'front' | 'back',
  formData: FormData
): Promise<{ newUrl: string }> {
  checkAuth();

    const newFile = formData.get('image') as File
  if (!newFile) throw new Error('Missing rotated image file')

  // Fetch the current record so we can delete the old storage file
  const { rows: records } = await sql`SELECT image_url, back_image_url FROM inventory WHERE id = ${id}`;
  const record = records[0];

  const oldUrl: string | null = side === 'front' ? record?.image_url : record?.back_image_url;

  // Delete old file from storage (best-effort)
  if (oldUrl) {
    try {
      await del(oldUrl);
    } catch (e: any) { console.error("Failed to cleanly delete rotated old image:", e.message) }
  }

  // Upload rotated file
  const ext = newFile.name.split('.').pop() || 'jpg';
  const prefix = side === 'back' ? 'back-rotated' : 'rotated';
  const newName = `card-images/${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
  
  const blob = await put(newName, newFile, { access: 'public' });
  const newUrl = blob.url;

  if (side === 'front') {
      await sql`UPDATE inventory SET image_url = ${newUrl} WHERE id = ${id}`;
  } else {
      await sql`UPDATE inventory SET back_image_url = ${newUrl} WHERE id = ${id}`;
  }

  revalidatePath('/')
  revalidatePath('/admin')
  return { newUrl }
}

export async function bulkUpdateMetricsAction(ids: string[], costBasis: number, acceptsOffers: boolean) {
  checkAuth();

  
  if (ids.length > 0) {
    await sql`UPDATE inventory SET cost_basis = ${costBasis}, accepts_offers = ${acceptsOffers} WHERE id = ANY(${ids as any}::uuid[])`;
  }

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/sold')
}

export async function updateLiveStreamUrl(url: string | null) {
  checkAuth();
    await sql`UPDATE store_settings SET live_stream_url = ${url} WHERE id = 1`;
  revalidatePath('/admin')
  revalidatePath('/auction')
}

export async function updateProjectionTimeframe(timeframe: string) {
  checkAuth();
    await sql`UPDATE store_settings SET projection_timeframe = ${timeframe} WHERE id = 1`;
  revalidatePath('/admin')
  revalidatePath('/auction')
}

export async function sendToAuctionBlock(ids: string[], formData?: FormData) {
  checkAuth();
  if (ids.length === 0) return;

  for (const id of ids) {
     const { rows: itemRows } = await sql`SELECT is_lot, lot_id FROM inventory WHERE id = ${id}`;
     if (itemRows.length === 0) continue;
     const item = itemRows[0];
     
     // Lot hardening check
     if (item.lot_id) {
         throw new Error(`Item ${id} is part of an active bundle (Lot ID: ${item.lot_id}). Please un-bundle or auction the lot instead.`);
     }

     let reservePrice = null;
     let endTime = null;
     let description = null;
     let coinedImageUrl = null;
     
     if (formData) {
         reservePrice = formData.get('reservePrice') ? Number(formData.get('reservePrice')) : null;
         endTime = formData.get('endTime') ? formData.get('endTime') as string : null;
         description = formData.get('description') ? formData.get('description') as string : null;
         const file = formData.get('coinedImage') as File;
         if (file && file.size > 0) {
            const fileName = `auction-coin-${Date.now()}.${file.name.split('.').pop()}`;
            const blob = await put(`card-images/${fileName}`, file, { access: 'public' });
            coinedImageUrl = blob.url;
         }
     }

     // Mark parent as auction
     await sql`
       UPDATE inventory 
       SET is_auction = true, 
           auction_status = 'pending',
           auction_reserve_price = COALESCE(${reservePrice}, auction_reserve_price),
           auction_end_time = COALESCE(${endTime}, auction_end_time),
           auction_description = COALESCE(${description}, auction_description),
           coined_image_url = COALESCE(${coinedImageUrl}, coined_image_url)
       WHERE id = ${id}
     `;

     // Child State Management
     if (item.is_lot) {
         await sql`UPDATE inventory SET status = 'auction_staged' WHERE lot_id = ${id}`;
     }
  }

  revalidatePath('/admin');
}

export async function placeBidAction(itemId: string, bidderEmail: string, bidAmount: number) {
  // Using an atomic transaction ensures no race conditions on read/write of current_bid
  // Vercel Postgres does NOT have transaction blocks directly via `sql`, we must use pooled client OR single raw query string with returning.
  // Actually, standard UPDATE ... RETURNING handles atomicity for single rows.

  const { rows } = await sql`
     UPDATE inventory 
     SET 
        current_bid = ${bidAmount},
        bidder_count = bidder_count + 1
     WHERE id = ${itemId} 
       AND (current_bid IS NULL OR current_bid < ${bidAmount})
       AND is_auction = true
       AND auction_status = 'live'
     RETURNING id
  `;

  if (rows.length === 0) {
     throw new Error("409 Conflict: Bid is too low or auction has ended.");
  }

  // Insert the bid log
  await sql`
     INSERT INTO auction_bids (item_id, bidder_email, bid_amount) 
     VALUES (${itemId}, ${bidderEmail}, ${bidAmount})
  `;

  revalidatePath('/auction');
  return { success: true };
}

export async function updateStagedAuction(itemId: string, formData: FormData) {
  checkAuth();
    
  const reservePrice = formData.get('reservePrice') as string;
  const endTime = formData.get('endTime') as string;
  const description = formData.get('description') as string;
  const file = formData.get('coinedImage') as File;
  
  if (reservePrice) await sql`UPDATE inventory SET auction_reserve_price = ${Number(reservePrice)} WHERE id = ${itemId}`;
  if (endTime) await sql`UPDATE inventory SET auction_end_time = ${endTime} WHERE id = ${itemId}`;
  if (description) await sql`UPDATE inventory SET auction_description = ${description} WHERE id = ${itemId}`;
  
  if (file && file.size > 0) {
    const fileExt = file.name.split('.').pop();
    const fileName = `auction-coin-${Date.now()}.${fileExt}`;
    const blob = await put(`card-images/${fileName}`, file, { access: 'public' });
    await sql`UPDATE inventory SET coined_image_url = ${blob.url} WHERE id = ${itemId}`;
  }
  
  revalidatePath('/admin')
}

export async function goLiveWithAuctions(itemIds: string[]) {
  checkAuth();
    if (itemIds.length > 0) {
    await sql`UPDATE inventory SET auction_status = 'live' WHERE id = ANY(${itemIds as any}::uuid[])`;
  }
  revalidatePath('/admin')
  revalidatePath('/auction')
}

export async function generateBatchCodes(ids: string[]) {
  checkAuth();
    for (const id of ids) {
    const code = `PI-${Math.floor(1000 + Math.random() * 9000)}`
    await sql`UPDATE inventory SET verification_code = ${code} WHERE id = ${id}`;
  }
  revalidatePath('/admin')
}

export async function uploadVerifiedFlipUI(id: string, formData: FormData) {
  checkAuth();
    
  const file = formData.get('video') as File
  if (!file) throw new Error("Missing video file")
  
  const fileExt = file.name.split('.').pop()
  const fileName = `video-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const blob = await put(`card-images/${fileName}`, file, { access: 'public' });
  await sql`UPDATE inventory SET video_url = ${blob.url}, is_verified_flip = true WHERE id = ${id}`;
  revalidatePath('/admin')
  revalidatePath('/auction')
}

export async function removeFromAuctionBlock(id: string) {
  checkAuth();
    await sql`UPDATE inventory SET is_auction = false, auction_status = 'pending' WHERE id = ${id}`;
  revalidatePath('/admin')
  revalidatePath('/auction')
}

export async function setAuctionStatus(id: string, status: 'pending' | 'live' | 'ended') {
  checkAuth();
    await sql`UPDATE inventory SET auction_status = ${status} WHERE id = ${id}`;
  revalidatePath('/admin')
  revalidatePath('/auction')
}
