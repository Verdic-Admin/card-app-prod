"use server";

import { revalidatePath } from 'next/cache'
import pool from '@/utils/db';
import { put, del } from '@/utils/storage';

interface BulkInventoryItem {
  player_name: string;
  card_set: string | null;
  insert_name?: string | null;
  parallel_name?: string | null;
  price?: number;
  side_a_url?: string | null;
  side_b_url?: string | null;
}

interface VercelInventoryItem {
  player_name: string;
  card_set: string | null;
  status: string;
  pricing?: {
    listed_price?: number;
    trend_points?: number[];
    player_index_url?: string;
  };
}

interface EditCardPayload {
  listed_price?: number;
}

interface SoldStatusPayload {
  status: string;
  sold_at: string | null;
}

interface SharpComposite {
  input: Buffer;
  left: number;
  top: number;
}

interface LotChildRow {
  image_url: string | null;
  cost_basis: number | string | null;
}

// Authentication check — env var or DB fallback (provisioned key lives in shop_config)
async function checkAuth() {
  if (process.env.PLAYERINDEX_API_KEY) return;
  const { rows } = await pool.query('SELECT playerindex_api_key FROM shop_config LIMIT 1');
  if (!rows[0]?.playerindex_api_key) {
    throw new Error("Unauthorized: No PLAYERINDEX_API_KEY available");
  }
}

export async function uploadAssetAction(formData: FormData) {
  await checkAuth();
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
  await checkAuth();

  const file = formData.get('image') as File
  const backFile = formData.get('back_image') as File | null
  const payload = JSON.parse(formData.get('data') as string)

  if (!file) throw new Error("Missing primary image file")
  if (!backFile || backFile.size === 0) {
    throw new Error('Back image is required — upload front and back for every card.')
  }
  const name = payload?.player_name != null ? String(payload.player_name).trim() : ''
  if (!name) throw new Error('Player name is required before saving to inventory')

  const fileExt = file.name.split('.').pop() || 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

  const blob = await put(`card-images/${fileName}`, file, {
    access: 'public',
  });

  const backExt = (backFile.name || '').split('.').pop() || 'jpg'
  const backFileName = `back-${Date.now()}-${Math.random().toString(36).substring(7)}.${backExt}`
  const backBlob = await put(`card-images/${backFileName}`, backFile, { access: 'public' })
  const backImageUrl = backBlob.url

  const { rows } = await pool.query(`
    INSERT INTO inventory (
      player_name, team_name, card_set, insert_name, parallel_name, card_number, 
      high_price, low_price, avg_price, listed_price, cost_basis, accepts_offers, 
      image_url, back_image_url, status
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8,
      $9, $10, $11, $12,
      $13, $14, 'available'
    ) RETURNING id
  `, [name, payload.team_name, payload.card_set, payload.insert_name, payload.parallel_name, payload.card_number, payload.high_price, payload.low_price, payload.avg_price, payload.listed_price || payload.avg_price, payload.cost_basis || 0, payload.accepts_offers || false, blob.url, backImageUrl]);
  const insertedRow = rows[0];


  try {
    const shopId = process.env.NEXT_PUBLIC_SHOP_ID
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (!shopId || !siteUrl) throw new Error("Syndication configuration missing")
    const fullUrl = `${siteUrl}/item/${insertedRow?.id || 'new'}`

    await fetch('https://api.playerindexdata.com/fintech/syndication/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop_id: shopId,
        player_name: name,
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

export async function batchCommitAction(items: BulkInventoryItem[]) {
  await checkAuth();

  for (const item of items) {
    const parallel_insert_type = [item.insert_name, item.parallel_name].filter(v => v && String(v).toLowerCase() !== 'base').join(' ') || 'Base';
    try {
      const { rows } = await pool.query(`
        INSERT INTO inventory (
          player_name, card_set, insert_name, parallel_name, parallel_insert_type,
          listed_price, avg_price, cost_basis, accepts_offers, image_url, back_image_url, status
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, 0, true, $8, $9, 'available'
        ) RETURNING id
      `, [item.player_name, item.card_set, item.insert_name, item.parallel_name, parallel_insert_type, item.price || 0, item.price || 0, item.side_a_url, item.side_b_url]);
      const insertedRow = rows[0];

    // Fire webhook
    try {
      const shopId = process.env.NEXT_PUBLIC_SHOP_ID
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
      if (!shopId || !siteUrl) throw new Error("Syndication configuration missing")
      const fullUrl = `${siteUrl}/item/${insertedRow.id}`
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

export async function vercelBatchInsertInventory(items: VercelInventoryItem[]) {
  // Directly insert finalized DB payload arrays
  for (const item of items) {
     const price = item.pricing?.listed_price || 0
     const status = String(item.status)
     const trend_data = JSON.stringify(item.pricing?.trend_points || [])
     const player_index_url = item.pricing?.player_index_url || ''
     await pool.query(`
       INSERT INTO inventory 
         (player_name, card_set, listed_price, market_price, image_url, status, trend_data, player_index_url)
       VALUES 
         ($1, $2, $3, $4, '', $5, $6::jsonb, $7)
     `, [item.player_name, item.card_set, price, price, status, trend_data, player_index_url]);
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
    await pool.query(`
      UPDATE inventory AS i
      SET 
        listed_price = u.listed_price,
        market_price = u.market_price,
        trend_data = u.trend_data,
        player_index_url = u.player_index_url
      FROM UNNEST(
        $1::UUID[], 
        $2::NUMERIC[], 
        $3::NUMERIC[],
        $4::JSONB[],
        $5::TEXT[]
      ) AS u(id, listed_price, market_price, trend_data, player_index_url)
      WHERE i.id = u.id;
    `, [ids, listedPrices, marketPrices, trendData, playerIndexUrls]);
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
  await checkAuth();
  
  // 1. Sum cost_basis of all child cards
  const { rows: children } = await pool.query(`SELECT image_url, cost_basis FROM inventory WHERE id = ANY($1::uuid[])`, [itemIds]);

  const totalCostBasis = children.reduce(
    (sum: number, c: LotChildRow) => sum + Number(c.cost_basis ?? 0),
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
           const composites: SharpComposite[] = [];
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
     } catch (e) {
        console.warn("Soft fail composing lot image:", (e as Error).message);
     }
  }

  // 2. Insert the parent Lot row
  const { rows } = await pool.query(`
      INSERT INTO inventory (player_name, listed_price, avg_price, cost_basis, is_lot, accepts_offers, status, image_url)
      VALUES ($1, $2, $3, $4, true, false, 'available', $5)
      RETURNING id
  `, [lotTitle, lotPrice, lotPrice, totalCostBasis, finalImageUrl]);
  const lotId = rows[0].id;

  // 3. Link child cards to this lot
  await pool.query(`UPDATE inventory SET lot_id = $1 WHERE id = ANY($2::uuid[])`, [lotId, itemIds]);

  revalidatePath('/')
  revalidatePath('/admin')
  return { success: true, lotId: lotId }
}

export async function updateLotChildren(lotId: string, itemIds: string[]) {
  await checkAuth();

  // clear all linked
  await pool.query(`UPDATE inventory SET lot_id = null WHERE lot_id = $1`, [lotId]);

  if (itemIds.length > 0) {
     // link new
     await pool.query(`UPDATE inventory SET lot_id = $1 WHERE id = ANY($2::uuid[])`, [lotId, itemIds]);
  
     // recalculate cost_basis
     const { rows: children } = await pool.query(`SELECT sum(cost_basis) as total_basis FROM inventory WHERE lot_id = $1`, [lotId]);
     const totalBasis = children[0]?.total_basis || 0;
     await pool.query(`UPDATE inventory SET cost_basis = $1 WHERE id = $2`, [totalBasis, lotId]);
  } else {
     // If empty, cost_basis = 0
     await pool.query(`UPDATE inventory SET cost_basis = 0 WHERE id = $1`, [lotId]);
  }

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true };
}

export async function breakLotAction(lotId: string) {
  await checkAuth();

  
  // 1. Unlink all child cards
  await pool.query(`UPDATE inventory SET lot_id = null WHERE lot_id = $1`, [lotId]);

  // 2. Delete the lot row itself
  await pool.query(`DELETE FROM inventory WHERE id = $1`, [lotId]);

  revalidatePath('/')
  revalidatePath('/admin')
  return { success: true }
}

export async function toggleCardStatus(id: string, currentStatus: string) {
  await checkAuth();

    const newStatus = currentStatus === 'available' ? 'sold' : 'available'
  const payload: SoldStatusPayload = {
    status: newStatus,
    sold_at: newStatus === 'sold' ? new Date().toISOString() : null,
  }

  await pool.query(`UPDATE inventory SET status = $1, sold_at = $2 WHERE id = $3`, [newStatus, payload.sold_at, id]);

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/sold')
}

export async function editCardAction(id: string, payload: EditCardPayload) {
  await checkAuth();

    
  // Manual generic update for now (or loop over keys)
  if(payload.listed_price) await pool.query(`UPDATE inventory SET listed_price = $1 WHERE id = $2`, [payload.listed_price, id]);

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/sold')
}

export async function deleteCardAction(id: string, imageUrl?: string | null) {
  await checkAuth();

  
  if (imageUrl) {
    try {
      await del(imageUrl);
    } catch (e) {
      console.warn("Failed to delete blob from vercel:", e)
    }
  }
  await pool.query(`DELETE FROM inventory WHERE id = $1`, [id]);

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/sold')
}

export async function bulkDeleteCardsAction(items: {id: string, image_url: string | null}[]) {
  await checkAuth();

  
  // 1. Delete all images from vercel blob
  const urls = items.filter(i => i.image_url).map(i => i.image_url!);
  if (urls.length > 0) {
    try { await del(urls); } catch {}
  }

  // 2. Delete all records from DB in a single ultra-fast operation
  if (items.length > 0) {
      const ids = items.map(i => i.id);
      await pool.query(`DELETE FROM inventory WHERE id = ANY($1::uuid[])`, [ids]);
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
  await checkAuth();

    const newFile = formData.get('image') as File
  if (!newFile) throw new Error('Missing rotated image file')

  // Fetch the current record so we can delete the old storage file
  const { rows: records } = await pool.query(`SELECT image_url, back_image_url FROM inventory WHERE id = $1`, [id]);
  const record = records[0];

  const oldUrl: string | null = side === 'front' ? record?.image_url : record?.back_image_url;

  // Delete old file from storage (best-effort)
  if (oldUrl) {
    try {
      await del(oldUrl);
    } catch (e) { console.error("Failed to cleanly delete rotated old image:", (e as Error).message) }
  }

  // Upload rotated file
  const ext = newFile.name.split('.').pop() || 'jpg';
  const prefix = side === 'back' ? 'back-rotated' : 'rotated';
  const newName = `card-images/${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
  
  const blob = await put(newName, newFile, { access: 'public' });
  const newUrl = blob.url;

  if (side === 'front') {
      await pool.query(`UPDATE inventory SET image_url = $1 WHERE id = $2`, [newUrl, id]);
  } else {
      await pool.query(`UPDATE inventory SET back_image_url = $1 WHERE id = $2`, [newUrl, id]);
  }

  revalidatePath('/')
  revalidatePath('/admin')
  return { newUrl }
}

export async function bulkUpdateMetricsAction(ids: string[], costBasis: number, acceptsOffers: boolean) {
  await checkAuth();

  
  if (ids.length > 0) {
    await pool.query(`UPDATE inventory SET cost_basis = $1, accepts_offers = $2 WHERE id = ANY($3::uuid[])`, [costBasis, acceptsOffers, ids]);
  }

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/sold')
}

export async function updateLiveStreamUrl(url: string | null) {
  await checkAuth();
    await pool.query(`UPDATE store_settings SET live_stream_url = $1 WHERE id = 1`, [url]);
  revalidatePath('/admin')
  revalidatePath('/auction')
}

export async function updateProjectionTimeframe(timeframe: string) {
  await checkAuth();
    await pool.query(`UPDATE store_settings SET projection_timeframe = $1 WHERE id = 1`, [timeframe]);
  revalidatePath('/admin')
  revalidatePath('/auction')
}

export async function sendToAuctionBlock(ids: string[], formData?: FormData) {
  await checkAuth();
  if (ids.length === 0) return;

  for (const id of ids) {
     const { rows: itemRows } = await pool.query(`SELECT is_lot, lot_id FROM inventory WHERE id = $1`, [id]);
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
     await pool.query(`
       UPDATE inventory 
       SET is_auction = true, 
           auction_status = 'pending',
           auction_reserve_price = COALESCE($1, auction_reserve_price),
           auction_end_time = COALESCE($2, auction_end_time),
           auction_description = COALESCE($3, auction_description),
           coined_image_url = COALESCE($4, coined_image_url)
       WHERE id = $5
     `, [reservePrice, endTime, description, coinedImageUrl, id]);

     // Child State Management
     if (item.is_lot) {
         await pool.query(`UPDATE inventory SET status = 'auction_staged' WHERE lot_id = $1`, [id]);
     }
  }

  revalidatePath('/admin');
}

export async function placeBidAction(itemId: string, bidderEmail: string, bidAmount: number) {
  // Using an atomic transaction ensures no race conditions on read/write of current_bid
  // Vercel Postgres does NOT have transaction blocks directly via `pool.query(`, we must use pooled client OR single raw query string with returning.
  // Actually, standard UPDATE ... RETURNING handles atomicity for single rows.

  const { rows } = await pool.query(`
     UPDATE inventory 
     SET 
        current_bid = $1,
        bidder_count = bidder_count + 1
     WHERE id = $2 
       AND (current_bid IS NULL OR current_bid < $1)
       AND is_auction = true
       AND auction_status = 'live'
     RETURNING id
  `, [bidAmount, itemId]);

  if (rows.length === 0) {
     throw new Error("409 Conflict: Bid is too low or auction has ended.");
  }

  // Insert the bid log
  await pool.query(`
     INSERT INTO auction_bids (item_id, bidder_email, bid_amount) 
     VALUES ($1, $2, $3)
  `, [itemId, bidderEmail, bidAmount]);

  revalidatePath('/auction');
  return { success: true };
}

export async function updateStagedAuction(itemId: string, formData: FormData) {
  await checkAuth();
    
  const reservePrice = formData.get('reservePrice') as string;
  const endTime = formData.get('endTime') as string;
  const description = formData.get('description') as string;
  const file = formData.get('coinedImage') as File;
  
  if (reservePrice) await pool.query(`UPDATE inventory SET auction_reserve_price = $1 WHERE id = $2`, [Number(reservePrice), itemId]);
  if (endTime) await pool.query(`UPDATE inventory SET auction_end_time = $1 WHERE id = $2`, [endTime, itemId]);
  if (description) await pool.query(`UPDATE inventory SET auction_description = $1 WHERE id = $2`, [description, itemId]);
  
  if (file && file.size > 0) {
    const fileExt = file.name.split('.').pop();
    const fileName = `auction-coin-${Date.now()}.${fileExt}`;
    const blob = await put(`card-images/${fileName}`, file, { access: 'public' });
    await pool.query(`UPDATE inventory SET coined_image_url = $1 WHERE id = $2`, [blob.url, itemId]);
  }
  
  revalidatePath('/admin')
}

export async function goLiveWithAuctions(itemIds: string[]) {
  await checkAuth();
    if (itemIds.length > 0) {
    await pool.query(`UPDATE inventory SET auction_status = 'live' WHERE id = ANY($1::uuid[])`, [itemIds]);
  }
  revalidatePath('/admin')
  revalidatePath('/auction')
}

export async function generateBatchCodes(ids: string[]) {
  await checkAuth();
    for (const id of ids) {
    const code = `PI-${Math.floor(1000 + Math.random() * 9000)}`
    await pool.query(`UPDATE inventory SET verification_code = $1 WHERE id = $2`, [code, id]);
  }
  revalidatePath('/admin')
}

export async function uploadVerifiedFlipUI(id: string, formData: FormData) {
  await checkAuth();
    
  const file = formData.get('video') as File
  if (!file) throw new Error("Missing video file")
  
  const fileExt = file.name.split('.').pop()
  const fileName = `video-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const blob = await put(`card-images/${fileName}`, file, { access: 'public' });
  await pool.query(`UPDATE inventory SET video_url = $1, is_verified_flip = true WHERE id = $2`, [blob.url, id]);
  revalidatePath('/admin')
  revalidatePath('/auction')
}

export async function removeFromAuctionBlock(id: string) {
  await checkAuth();
    await pool.query(`UPDATE inventory SET is_auction = false, auction_status = 'pending' WHERE id = $1`, [id]);
  revalidatePath('/admin')
  revalidatePath('/auction')
}

export async function setAuctionStatus(id: string, status: 'pending' | 'live' | 'ended') {
  await checkAuth();
    await pool.query(`UPDATE inventory SET auction_status = $1 WHERE id = $2`, [status, id]);
  revalidatePath('/admin')
  revalidatePath('/auction')
}

export async function deleteStagingCardsAction(ids: string[]) {
  await checkAuth();
  if (ids.length === 0) return { success: true };
  await pool.query(`DELETE FROM scan_staging WHERE id = ANY($1::uuid[])`, [ids]);
  return { success: true };
}
