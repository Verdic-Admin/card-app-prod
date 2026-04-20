"use server";
import pool from '@/utils/db';
import { put } from '@/utils/storage';


const ALLOWED_COLUMNS = [
  'player_name', 'card_set', 'card_number', 'insert_name', 
  'parallel_name', 'print_run', 'listed_price', 'market_price',
  'image_url', 'back_image_url'
];

/**
 * Free path — no scanner, no credit burn.
 * Uploads front + back directly to S3 and creates a single scan_staging row.
 * Used by the "Single Pair" mode in BulkIngestionWizard.
 */
export async function stageSingleCardAction(formData: FormData) {
  const front = formData.get('front') as File | null;
  const back  = formData.get('back')  as File | null;
  if (!front) throw new Error('No front image provided');

  const ts   = Date.now();
  const rand = () => Math.random().toString(36).substring(2, 8);

  const frontExt = (front.name || '').split('.').pop() || 'jpg';
  const { url: frontUrl } = await put(`scans/single-${ts}-${rand()}.${frontExt}`, front);

  let backUrl: string | null = null;
  if (back && back.size > 0) {
    const backExt = (back.name || '').split('.').pop() || 'jpg';
    const { url } = await put(`scans/single-back-${ts}-${rand()}.${backExt}`, back);
    backUrl = url;
  }

  const { rows } = await pool.query(
    `INSERT INTO scan_staging (image_url, back_image_url)
     VALUES ($1, $2)
     RETURNING id, player_name, card_set, card_number, insert_name,
               parallel_name, print_run, image_url, back_image_url,
               listed_price, market_price`,
    [frontUrl, backUrl]
  );

  return rows[0];
}

export async function createDraftCardsAction(cards: any[]) {
  const payload = cards.map(c => ({
    player_name: c.player_name || '',
    card_set: c.card_set || '',
    card_number: c.card_number || '',
    insert_name: c.insert_name || '',
    parallel_name: c.parallel_name || '',
    print_run: c.print_run || null,
    image_url: c.side_a_url,
    back_image_url: c.side_b_url,
    listed_price: c.price || 0,
    market_price: c.market_price || c.price || 0,
  }));
  
  const results = [];
  try {
     for (const item of payload) {
        const { rows } = await pool.query(`
           INSERT INTO scan_staging (player_name, card_set, card_number, insert_name, parallel_name, print_run, image_url, back_image_url, listed_price, market_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, player_name, card_set, card_number, insert_name, parallel_name, print_run, image_url, back_image_url, listed_price, market_price
        `, [item.player_name, item.card_set, item.card_number, item.insert_name, item.parallel_name, item.print_run, item.image_url, item.back_image_url, item.listed_price, item.market_price]);
        if (rows.length > 0) results.push(rows[0]);
     }
  } catch (error) {
    console.error("Staging insert error:", error)
    throw new Error("Failed to save drafts to staging")
  }

  return results
}

export async function updateDraftCardAction(id: string, updates: any) {
  const payload: any = {}
  if (updates.player_name !== undefined) payload.player_name = updates.player_name
  if (updates.card_set !== undefined) payload.card_set = updates.card_set
  if (updates.card_number !== undefined) payload.card_number = updates.card_number
  if (updates.insert_name !== undefined) payload.insert_name = updates.insert_name
  if (updates.parallel_name !== undefined) payload.parallel_name = updates.parallel_name
  if (updates.print_run !== undefined) payload.print_run = updates.print_run
  if (updates.price !== undefined) {
    payload.listed_price = parseFloat(updates.price) || 0
  }
  if (updates.market_price !== undefined) {
    payload.market_price = parseFloat(updates.market_price) || 0
  }
  
  try {
     const keys = Object.keys(payload);
     if (keys.length > 0) {
        for (const k of keys) {
           if (!ALLOWED_COLUMNS.includes(k)) {
              throw new Error(`Security Violation: Unauthorized column update detected - ${k}`);
           }
        }
        for (const [k, v] of Object.entries(payload)) {
           await pool.query(`UPDATE scan_staging SET ${k} = $1 WHERE id = $2`, [v, id]);
        }
     }
  } catch (error) {
     console.error(error);
     throw new Error("Failed to update staging draft");
  }

  return { success: true }
}

export async function publishDraftCardsAction(ids: string[]) {
  // 1. Read approved rows from staging
  let staged = [];
  try {
     const { rows } = await pool.query(`SELECT player_name, card_set, card_number, insert_name, parallel_name, print_run, image_url, back_image_url, listed_price, market_price FROM scan_staging WHERE id = ANY($1::uuid[])`, [ids as any]);
     staged = rows;
  } catch (error) {
     console.error(error);
     throw new Error("Failed to read staged cards");
  }

  if (!staged?.length) {
    throw new Error("Failed to read staged cards")
  }

  // 2. Insert into live inventory
  try {
      for (const s of staged) {
          await pool.query(`
             INSERT INTO inventory (player_name, card_set, card_number, insert_name, parallel_name, print_run, image_url, back_image_url, listed_price, market_price, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'available')
          `, [s.player_name, s.card_set, s.card_number, s.insert_name, s.parallel_name, s.print_run, s.image_url, s.back_image_url, s.listed_price, s.market_price]);
      }
  } catch (insertError) {
      console.error(insertError);
      throw new Error("Failed to mint cards to inventory")
  }

  // 3. Remove from staging
  try {
      await pool.query(`DELETE FROM scan_staging WHERE id = ANY($1::uuid[])`, [ids as any]);
  } catch (deleteError) {
      console.error("Warning: cards minted but staging cleanup failed:", deleteError)
      throw new Error("Failed to clean up staging area after publishing")
  }

  return { success: true }
}
