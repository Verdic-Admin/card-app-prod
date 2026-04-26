"use server";

import { revalidatePath } from 'next/cache'
import pool from '@/utils/db';
import { put, del } from '@/utils/storage';
import { hasShopOracleApiKey } from '@/lib/shop-oracle-credentials';
import { calculatePricingAction } from '@/app/actions/oracleAPI';
import { price } from '@/utils/math';
import { normalizeCardNumberForPlayerIndex } from '@/lib/player-index-deeplink';

interface BulkInventoryItem {
  player_name: string;
  card_set: string | null;
  insert_name?: string | null;
  parallel_name?: string | null;
  price?: number;
  side_a_url?: string | null;
  side_b_url?: string | null;
}

interface InventoryItem {
  player_name: string;
  card_set: string | null;
  status: string;
  pricing?: {
    listed_price?: number;
    trend_points?: number[];
    player_index_url?: string;
  };
}

/** Fields the admin inventory editor may persist (whitelist — ignores stale Oracle fields on the row). */
const EDITABLE_INVENTORY_FIELDS = [
  'player_name',
  'team_name',
  'card_set',
  'card_number',
  'print_run',
  'insert_name',
  'parallel_name',
  'parallel_insert_type',
  'cost_basis',
  'accepts_offers',
  'is_rookie',
  'is_auto',
  'is_relic',
  'grading_company',
  'grade',
] as const;

export type EditCardPayload = Partial<
  Record<(typeof EDITABLE_INVENTORY_FIELDS)[number] | 'listed_price', unknown>
>;

export type EditCardActionResult = { success: true; patch: Record<string, unknown> };

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

async function checkAuth() {
  if (!(await hasShopOracleApiKey())) {
    throw new Error('Unauthorized: complete Player Index provisioning for this store first.');
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

export type AddCardResult =
  | { success: true }
  | { success: false; error: string };

export async function addCardAction(formData: FormData): Promise<AddCardResult> {
  function errMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === 'object' && e != null && 'message' in e) {
      return String((e as { message: unknown }).message);
    }
    return String(e);
  }

  function n(v: unknown, fallback = 0): number {
    if (v == null || v === '') return fallback;
    const x = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    return Number.isFinite(x) ? x : fallback;
  }

  try {
    await checkAuth();

    const file = formData.get('image') as File;
    const backFile = formData.get('back_image') as File | null;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(String(formData.get('data') ?? '{}')) as Record<string, unknown>;
    } catch {
      return { success: false, error: 'Invalid card data (could not parse JSON).' };
    }

    if (!file) return { success: false, error: 'Missing primary image file.' };
    if (!backFile || backFile.size === 0) {
      return {
        success: false,
        error: 'Back image is required — upload front and back for every card.',
      };
    }
    const name = payload?.player_name != null ? String(payload.player_name).trim() : '';
    if (!name) {
      return { success: false, error: 'Player name is required before saving to inventory.' };
    }

    const teamRaw = payload.team_name;
    const teamName =
      teamRaw != null && String(teamRaw).trim() !== '' ? String(teamRaw).trim() : null;

    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const blob = await put(`card-images/${fileName}`, file, {
      access: 'public',
    });

    const backExt = (backFile.name || '').split('.').pop() || 'jpg';
    const backFileName = `back-${Date.now()}-${Math.random().toString(36).substring(7)}.${backExt}`;
    const backBlob = await put(`card-images/${backFileName}`, backFile, { access: 'public' });
    const backImageUrl = backBlob.url;

    const avg = n(payload.avg_price);
    const listed = n(payload.listed_price, avg);

    await pool.query(
      `
    INSERT INTO inventory (
      player_name, team_name, card_set, insert_name, parallel_name, card_number, 
      high_price, low_price, avg_price, listed_price, cost_basis, accepts_offers, 
      image_url, back_image_url,
      is_rookie, is_auto, is_relic, grading_company, grade,
      status
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8,
      $9, $10, $11, $12,
      $13, $14,
      $15, $16, $17, $18, $19,
      'available'
    )
  `,
      [
        name,
        teamName,
        payload.card_set,
        payload.insert_name,
        payload.parallel_name,
        payload.card_number,
        n(payload.high_price, avg),
        n(payload.low_price, avg),
        avg,
        listed,
        n(payload.cost_basis, 0),
        Boolean(payload.accepts_offers),
        blob.url,
        backImageUrl,
        Boolean(payload.is_rookie),
        Boolean(payload.is_auto),
        Boolean(payload.is_relic),
        payload.grading_company != null ? String(payload.grading_company) : null,
        payload.grade != null ? String(payload.grade) : null,
      ],
    );

    revalidatePath('/');
    revalidatePath('/admin');
    return { success: true };
  } catch (e) {
    console.error('[addCardAction]', e);
    return { success: false, error: errMessage(e) };
  }
}

export async function batchCommitAction(items: BulkInventoryItem[]) {
  await checkAuth();

  for (const item of items) {
    const parallel_insert_type = [item.insert_name, item.parallel_name].filter(v => v && String(v).toLowerCase() !== 'base').join(' ') || 'Base';
    try {
      await pool.query(`
        INSERT INTO inventory (
          player_name, card_set, insert_name, parallel_name, parallel_insert_type,
          listed_price, avg_price, cost_basis, accepts_offers, image_url, back_image_url, status
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, 0, true, $8, $9, 'available'
        )
      `, [item.player_name, item.card_set, item.insert_name, item.parallel_name, parallel_insert_type, item.price || 0, item.price || 0, item.side_a_url, item.side_b_url]);

    } catch (err) {
       console.error("Insertion failed:", err)
    }
  }

  revalidatePath('/')
  revalidatePath('/admin')
  return { success: true }
}

export async function batchInsertInventory(items: InventoryItem[]) {
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

export async function batchUpdatePrices(updates: { id: string, listed_price: number, market_price: number, trend_data?: number[], player_index_url?: string }[]) {
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
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
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

export async function editCardAction(id: string, payload: EditCardPayload): Promise<EditCardActionResult> {
  await checkAuth();

  const p = payload as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  const catalogUpdates: Record<string, unknown> = {};
  for (const key of EDITABLE_INVENTORY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(p, key)) {
      catalogUpdates[key] = p[key];
    }
  }

  if (typeof catalogUpdates.card_number === 'string') {
    const n = normalizeCardNumberForPlayerIndex(catalogUpdates.card_number as string);
    catalogUpdates.card_number = n || null;
  }

  if (Object.keys(catalogUpdates).length > 0) {
    const cols = Object.keys(catalogUpdates);
    const vals = Object.values(catalogUpdates);
    const setSql = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    await pool.query(
      `UPDATE inventory SET ${setSql} WHERE id = $${cols.length + 1}::uuid`,
      [...vals, id],
    );
    Object.assign(patch, catalogUpdates);
  }

  if (!('listed_price' in p)) {
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/sold');
    return { success: true, patch };
  }

  const newListed = parseFloat(String(p.listed_price ?? ''));
  if (!Number.isFinite(newListed) || newListed < 0) {
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/sold');
    return { success: true, patch };
  }

  const { rows } = await pool.query(
    `SELECT oracle_projection FROM inventory WHERE id = $1::uuid`,
    [id],
  );
  const oracleRaw = rows[0]?.oracle_projection;
  const oracle =
    oracleRaw != null && String(oracleRaw).trim() !== ''
      ? parseFloat(String(oracleRaw).replace(/,/g, ''))
      : NaN;

  let discountRate = 0;
  try {
    const { rows: dr } = await pool.query(
      `SELECT oracle_discount_percentage FROM store_settings WHERE id = 1`,
    );
    discountRate = parseFloat(String(dr?.[0]?.oracle_discount_percentage ?? 0)) || 0;
  } catch {
    discountRate = 0;
  }

  const hasOracle = Number.isFinite(oracle) && oracle > 0;
  const expectedStore = hasOracle ? oracle * (1 - discountRate / 100) : null;
  const manualBreak =
    hasOracle && expectedStore != null && Math.abs(newListed - expectedStore) > 0.01;

  if (manualBreak) {
    await pool.query(
      `UPDATE inventory SET
         listed_price = $1,
         oracle_projection = NULL,
         market_price = NULL,
         oracle_trend_percentage = NULL,
         trend_data = NULL,
         player_index_url = NULL
       WHERE id = $2::uuid`,
      [newListed, id],
    );
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/sold');
    return {
      success: true,
      patch: {
        ...patch,
        listed_price: newListed,
        oracle_projection: null,
        market_price: null,
        oracle_trend_percentage: null,
        trend_data: null,
        player_index_url: null,
      },
    };
  }

  await pool.query(`UPDATE inventory SET listed_price = $1 WHERE id = $2::uuid`, [newListed, id]);
  revalidatePath('/');
  revalidatePath('/admin');
  revalidatePath('/sold');
  return { success: true, patch: { ...patch, listed_price: newListed } };
}

export type DuplicateInventoryItemResult =
  | { success: true; newItem: Record<string, unknown> }
  | { success: false; error: string };

/** Clone catalog + media + pricing into a new available row (new id). Not allowed for lot parents or lot children. */
export async function duplicateInventoryItem(id: string): Promise<DuplicateInventoryItemResult> {
  await checkAuth();

  function errMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === 'object' && e != null && 'message' in e) {
      return String((e as { message: unknown }).message);
    }
    return String(e);
  }

  try {
    const { rows: meta } = await pool.query<{ is_lot: boolean; lot_id: string | null }>(
      `SELECT is_lot, lot_id FROM inventory WHERE id = $1::uuid`,
      [id],
    );
    if (!meta.length) {
      return { success: false, error: 'Item not found.' };
    }
    const m = meta[0];
    if (m.lot_id) {
      return {
        success: false,
        error: 'Cannot duplicate a card that is inside a bundle. Remove it from the lot first.',
      };
    }
    if (m.is_lot) {
      return {
        success: false,
        error: 'Cannot duplicate a bundle row. Break the lot or duplicate individual cards.',
      };
    }

    const { rows } = await pool.query(
      `
      INSERT INTO inventory (
        player_name, team_name, card_set, insert_name, parallel_name, parallel_insert_type, card_number, print_run,
        high_price, low_price, avg_price, listed_price, market_price, cost_basis, accepts_offers,
        is_lot, lot_id,
        image_url, back_image_url, coined_image_url,
        status, trend_data, player_index_url, oracle_projection, oracle_trend_percentage,
        needs_correction, needs_price_approval,
        sold_at, checkout_expires_at,
        is_auction, auction_status, auction_reserve_price, auction_end_time, auction_description,
        current_bid, bidder_count, verification_code,
        video_url, is_verified_flip,
        is_rookie, is_auto, is_relic, grading_company, grade,
        filename
      )
      SELECT
        player_name, team_name, card_set, insert_name, parallel_name, parallel_insert_type, card_number, print_run,
        high_price, low_price, avg_price, listed_price, market_price, cost_basis, accepts_offers,
        false, NULL,
        image_url, back_image_url, coined_image_url,
        'available', trend_data, player_index_url, oracle_projection, oracle_trend_percentage,
        false, false,
        NULL, NULL,
        false, 'pending', NULL, NULL, NULL,
        NULL, 0, NULL,
        video_url, is_verified_flip,
        is_rookie, is_auto, is_relic, grading_company, grade,
        filename
      FROM inventory WHERE id = $1::uuid
      RETURNING *
      `,
      [id],
    );

    if (!rows.length) {
      return { success: false, error: 'Duplicate failed (source row missing).' };
    }

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/sold');

    return { success: true, newItem: rows[0] as Record<string, unknown> };
  } catch (e) {
    return { success: false, error: errMessage(e) };
  }
}

export async function deleteCardAction(id: string, imageUrl?: string | null) {
  await checkAuth();


  if (imageUrl) {
    try {
      await del(imageUrl);
    } catch (e) {
      console.warn("Failed to delete blob from storage:", e)
    }
  }
  await pool.query(`DELETE FROM inventory WHERE id = $1`, [id]);

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/sold')
}

export async function bulkDeleteCardsAction(items: {id: string, image_url: string | null}[]) {
  await checkAuth();

  
  // 1. Delete all images from object storage
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
         const file = formData.get('coinedImage');
         if (file instanceof Blob && file.size > 0) {
            const ext =
              file instanceof File && file.name
                ? file.name.split('.').pop()
                : 'jpg';
            const fileName = `auction-coin-${Date.now()}.${ext || 'jpg'}`;
            const contentType =
              file instanceof File && file.type
                ? file.type
                : 'image/jpeg';
            const upload = await put(`card-images/${fileName}`, file, { access: 'public', contentType });
            coinedImageUrl = upload.url;
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

export interface AuctionStageItemInput {
  id: string;
  reservePrice?: number | null;
  endTime?: string | null;
  description?: string | null;
}

export interface AuctionStageGlobals {
  endTime?: string | null;
  description?: string | null;
}

export type StageAuctionItemsResult =
  | { success: true; count: number }
  | { success: false; error: string };

/**
 * Stage one or more cards into the auction block with per-item values and optional
 * session-wide defaults. Per-item values always win over globals; missing values
 * fall through to globals, then to whatever is already stored (via COALESCE).
 */
export async function stageAuctionItems(
  items: AuctionStageItemInput[],
  globals?: AuctionStageGlobals,
): Promise<StageAuctionItemsResult> {
  try {
    await checkAuth();
    if (!items || items.length === 0) return { success: true, count: 0 };

    const globalEnd = globals?.endTime ? String(globals.endTime) : null;
    const globalDesc = globals?.description ? String(globals.description) : null;

    for (const raw of items) {
      if (!raw || !raw.id) continue;

      const { rows: itemRows } = await pool.query(
        `SELECT is_lot, lot_id FROM inventory WHERE id = $1`,
        [raw.id],
      );
      if (itemRows.length === 0) continue;
      const item = itemRows[0];

      if (item.lot_id) {
        return {
          success: false,
          error: `Item ${raw.id} is part of an active bundle (Lot ID: ${item.lot_id}). Un-bundle it or auction the lot instead.`,
        };
      }

      const reservePrice =
        raw.reservePrice != null && !Number.isNaN(Number(raw.reservePrice))
          ? Number(raw.reservePrice)
          : null;
      const endTime = raw.endTime ? String(raw.endTime) : globalEnd;
      const description =
        raw.description != null && raw.description !== ''
          ? String(raw.description)
          : globalDesc;

      await pool.query(
        `
        UPDATE inventory
        SET is_auction = true,
            auction_status = 'pending',
            auction_reserve_price = COALESCE($1, auction_reserve_price),
            auction_end_time = COALESCE($2, auction_end_time),
            auction_description = COALESCE($3, auction_description)
        WHERE id = $4
      `,
        [reservePrice, endTime, description, raw.id],
      );

      if (item.is_lot) {
        await pool.query(
          `UPDATE inventory SET status = 'auction_staged' WHERE lot_id = $1`,
          [raw.id],
        );
      }
    }

    revalidatePath('/admin');
    revalidatePath('/admin/auction-studio');
    revalidatePath('/auction');

    return { success: true, count: items.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

export type LiveAuctionMacroResult =
  | {
      success: true;
      text: string;
      projection: number;
      trend: number | null;
      discountedFair: number;
      currentBid: number;
    }
  | { success: false; error: string };

/**
 * Fetches a fresh Player Index valuation for a live auction card and returns
 * copy-ready lines for stream / social broadcast (does not mutate inventory).
 */
export async function getLiveAuctionBroadcastMacro(
  itemId: string,
): Promise<LiveAuctionMacroResult> {
  try {
    if (!(await hasShopOracleApiKey())) {
      return { success: false, error: 'Store Oracle API is not provisioned.' };
    }

    const { rows: settingsRows } = await pool.query(
      `SELECT oracle_discount_percentage FROM store_settings WHERE id = 1`,
    );
    const discountRate = Number(settingsRows[0]?.oracle_discount_percentage ?? 0);

    const { rows } = await pool.query(`SELECT * FROM inventory WHERE id = $1`, [itemId]);
    const item = rows[0];
    if (!item) return { success: false, error: 'Item not found.' };
    if (!item.is_auction || item.auction_status !== 'live') {
      return { success: false, error: 'Item is not a live auction listing.' };
    }

    const gradeStr =
      item.grading_company && item.grade
        ? `${item.grading_company} ${item.grade}`
        : undefined;

    const res = await calculatePricingAction({
      player_name: String(item.player_name || ''),
      card_set: String(item.card_set || ''),
      insert_name: String(item.insert_name || 'Base'),
      parallel_name: String(item.parallel_name || 'Base'),
      card_number: String(item.card_number || ''),
      print_run: item.print_run != null ? Number(item.print_run) : null,
      is_rookie: Boolean(item.is_rookie),
      is_auto: Boolean(item.is_auto),
      is_relic: Boolean(item.is_relic),
      grade: gradeStr,
    });

    if (!res || typeof res !== 'object' || !('success' in res) || !res.success) {
      const exhausted =
        res && typeof res === 'object' && 'error' in res && (res as { error?: string }).error === 'credits_exhausted';
      return {
        success: false,
        error: exhausted ? 'Player Index credits exhausted.' : 'Unable to fetch Player Index macro for this card.',
      };
    }

    const data = (res as { data?: Record<string, unknown> }).data || {};
    const projection = Number(data.projected_target ?? data.target_price ?? 0);
    if (!Number.isFinite(projection) || projection <= 0) {
      return {
        success: false,
        error: 'Player Index did not return a fair value for this card.',
      };
    }

    const trendRaw = data.trend_percentage;
    const trend =
      trendRaw != null && Number.isFinite(Number(trendRaw)) ? Number(trendRaw) : null;
    const discountedFair = projection * (1 - Math.max(0, discountRate) / 100);
    const currentBid = price(item.current_bid, 0);
    const delta = discountedFair - currentBid;
    let verdict: string;
    if (currentBid <= 0) {
      verdict =
        'No bids yet — opening is still below the configured Player Index discount target.';
    } else if (delta > 0.02) {
      verdict = `Bid is about $${delta.toFixed(2)} under the discount target vs catalog (reads undervalued vs fair).`;
    } else if (delta < -0.02) {
      verdict = `Bid is about $${Math.abs(delta).toFixed(2)} over the discount target vs catalog (heated / above fair marker).`;
    } else {
      verdict = 'Bid is roughly on the discount target vs catalog.';
    }

    const header = `${String(item.player_name || '').trim()} — ${String(item.card_set || 'Unknown set').trim()}${item.card_number ? ` #${item.card_number}` : ''}`.trim();

    const lines = [
      header,
      `Player Index catalog fair: $${projection.toFixed(2)}`,
      discountRate > 0
        ? `Configured storefront discount (${discountRate}% off PI): $${discountedFair.toFixed(2)}`
        : null,
      trend != null
        ? `Catalog trend vs prior window: ${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`
        : null,
      currentBid > 0 ? `Live high bid: $${currentBid.toFixed(2)}` : 'Live high bid: (none yet)',
      verdict,
      '',
      'Tap the macro button again after bids move to refresh this blurb.',
    ].filter((line): line is string => Boolean(line));

    return {
      success: true,
      text: lines.join('\n'),
      projection,
      trend,
      discountedFair,
      currentBid,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

export async function placeBidAction(itemId: string, bidderEmail: string, bidAmount: number) {
  // Using an atomic transaction ensures no race conditions on read/write of current_bid
  // Standard Postgres atomicity: UPDATE ... RETURNING handles single-row consistency.
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

export type AuctionBidHistoryRow = {
  id: string;
  bidder_email: string;
  bid_amount: number;
  created_at: string;
};

/** Full bid log for an auction row (admin). Source: `auction_bids` written by `placeBidAction`. */
export async function getAuctionBidHistoryForAdmin(
  itemId: string,
): Promise<{ success: true; bids: AuctionBidHistoryRow[] } | { success: false; error: string }> {
  try {
    await checkAuth();
    const { rows } = await pool.query<{
      id: string;
      bidder_email: string;
      bid_amount: string | number;
      created_at: Date;
    }>(
      `SELECT id, bidder_email, bid_amount, created_at
       FROM auction_bids
       WHERE item_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 200`,
      [itemId],
    );
    const bids: AuctionBidHistoryRow[] = rows.map((r) => ({
      id: r.id,
      bidder_email: r.bidder_email,
      bid_amount: price(r.bid_amount),
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
    return { success: true, bids };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

export type UpdateStagedAuctionResult = {
  success: true;
  coined_image_url: string | null;
};

export async function updateStagedAuction(
  itemId: string,
  formData: FormData,
): Promise<UpdateStagedAuctionResult> {
  await checkAuth();

  const reservePrice = formData.get('reservePrice') as string;
  const endTime = formData.get('endTime') as string;
  const description = formData.get('description') as string;
  // Next.js can supply File, Blob, or a string for empty file inputs; accept any Blob.
  const file = formData.get('coinedImage');
  if (reservePrice) {
    await pool.query(`UPDATE inventory SET auction_reserve_price = $1 WHERE id = $2::uuid`, [
      Number(reservePrice),
      itemId,
    ]);
  }
  if (endTime) {
    await pool.query(`UPDATE inventory SET auction_end_time = $1 WHERE id = $2::uuid`, [endTime, itemId]);
  }
  if (description) {
    await pool.query(`UPDATE inventory SET auction_description = $1 WHERE id = $2::uuid`, [
      description,
      itemId,
    ]);
  }

  if (file instanceof Blob && file.size > 0) {
    const fileExt = file instanceof File && file.name ? file.name.split('.').pop() : 'jpg';
    const fileName = `auction-coin-${Date.now()}.${fileExt || 'jpg'}`;
    const contentType =
      file instanceof File && file.type
        ? file.type
        : 'image/jpeg';
    const blob = await put(`card-images/${fileName}`, file, { access: 'public', contentType });
    await pool.query(`UPDATE inventory SET coined_image_url = $1 WHERE id = $2::uuid`, [
      blob.url,
      itemId,
    ]);
  }

  revalidatePath('/admin');
  revalidatePath('/admin/auction-studio');
  revalidatePath('/auction');

  const { rows } = await pool.query<{ coined_image_url: string | null }>(
    `SELECT coined_image_url FROM inventory WHERE id = $1::uuid`,
    [itemId],
  );
  return { success: true, coined_image_url: rows[0]?.coined_image_url ?? null };
}

export async function goLiveWithAuctions(itemIds: string[]) {
  await checkAuth();
  if (itemIds.length > 0) {
    await pool.query(`UPDATE inventory SET auction_status = 'live' WHERE id = ANY($1::uuid[])`, [itemIds]);
  }
  revalidatePath('/admin');
  revalidatePath('/admin/auction-studio');
  revalidatePath('/auction');
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

export type DeleteStagingCardsResult =
  | { success: true }
  | { success: false; error: string };

/** Returns a result object instead of throwing so prod UIs get a real error string. */
export async function deleteStagingCardsAction(
  ids: string[],
): Promise<DeleteStagingCardsResult> {
  try {
    if (!(await hasShopOracleApiKey())) {
      return {
        success: false,
        error:
          'Unauthorized: set PLAYERINDEX_API_KEY in your hosting Environment Variables for this service.',
      };
    }
    if (ids.length === 0) return { success: true };
    await pool.query(`DELETE FROM scan_staging WHERE id = ANY($1::uuid[])`, [ids]);
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}
