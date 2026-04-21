"use server";
import pool from '@/utils/db';
import { put } from '@/utils/storage';
import { getAppOrigin } from '@/utils/app-origin';
import { uploadImagesToScanner } from '@/app/actions/visionSync';

async function checkAuth() {
  if (process.env.PLAYERINDEX_API_KEY) return;
  const { rows } = await pool.query('SELECT playerindex_api_key FROM shop_config LIMIT 1');
  if (!rows[0]?.playerindex_api_key) {
    throw new Error('Unauthorized: No PLAYERINDEX_API_KEY available');
  }
}

const ALLOWED_COLUMNS = [
  'player_name', 'card_set', 'card_number', 'insert_name',
  'parallel_name', 'print_run', 'listed_price', 'market_price',
  'image_url', 'back_image_url',
  'is_rookie', 'is_auto', 'is_relic', 'grading_company', 'grade',
];

function absAssetUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = getAppOrigin();
  if (!base) return url;
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}

async function fetchImageAsFile(url: string, filename: string): Promise<File> {
  const res = await fetch(absAssetUrl(url), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch staged image (${res.status})`);
  const buf = await res.arrayBuffer();
  const type = res.headers.get('content-type') || 'image/jpeg';
  return new File([buf], filename, { type });
}

/**
 * Free — uploads a front+back pair to S3 and inserts a staging row with only raw_* set
 * (cropped image_url/back_image_url stay null until scanner or "use as-is").
 * kind: `matrix` = batch sheet pair, `single_pair` = one card front/back.
 * Back image is always required — the scanner pairs sheet/card fronts with backs.
 */
export async function stagePairedUploadAction(formData: FormData) {
  await checkAuth();
  const kind = (formData.get('kind') as string) || 'single_pair';
  const front = formData.get('front') as File | null;
  const back = formData.get('back') as File | null;
  if (!front) throw new Error('No front image provided');
  if (!back || back.size === 0) {
    throw new Error('Back image is required — upload a paired front and back (single card or full matrix).');
  }

  const ts = Date.now();
  const rand = () => Math.random().toString(36).substring(2, 8);
  const prefix = kind === 'matrix' ? 'matrix' : 'pair';

  const frontExt = (front.name || '').split('.').pop() || 'jpg';
  const { url: rawFront } = await put(`scans/${prefix}-front-${ts}-${rand()}.${frontExt}`, front);

  const backExt = (back.name || '').split('.').pop() || 'jpg';
  const { url: rawBack } = await put(`scans/${prefix}-back-${ts}-${rand()}.${backExt}`, back);

  const { rows } = await pool.query(
    `INSERT INTO scan_staging (raw_front_url, raw_back_url, image_url, back_image_url)
     VALUES ($1, $2, NULL, NULL)
     RETURNING id, player_name, card_set, card_number, insert_name,
               parallel_name, print_run, raw_front_url, raw_back_url,
               image_url, back_image_url, listed_price, market_price,
               is_rookie, is_auto, is_relic, grading_company, grade`,
    [rawFront, rawBack]
  );

  return rows[0];
}

/** Back-compat wrapper — same as stagePairedUploadAction with kind=single_pair */
export async function stageSingleCardAction(formData: FormData) {
  const fd = new FormData();
  const front = formData.get('front');
  const back = formData.get('back');
  if (front) fd.append('front', front as File);
  if (back) fd.append('back', back as File);
  fd.append('kind', 'single_pair');
  return stagePairedUploadAction(fd);
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
    is_rookie: c.is_rookie || false,
    is_auto: c.is_auto || false,
    is_relic: c.is_relic || false,
    grading_company: c.grading_company || null,
    grade: c.grade || null,
  }));
  
  const results = [];
  try {
     for (const item of payload) {
        const { rows } = await pool.query(`
           INSERT INTO scan_staging (player_name, card_set, card_number, insert_name, parallel_name, print_run, image_url, back_image_url, listed_price, market_price, is_rookie, is_auto, is_relic, grading_company, grade)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING id, player_name, card_set, card_number, insert_name, parallel_name, print_run, image_url, back_image_url, listed_price, market_price, is_rookie, is_auto, is_relic, grading_company, grade
        `, [item.player_name, item.card_set, item.card_number, item.insert_name, item.parallel_name, item.print_run, item.image_url, item.back_image_url, item.listed_price, item.market_price, item.is_rookie, item.is_auto, item.is_relic, item.grading_company, item.grade]);
        if (rows.length > 0) results.push(rows[0]);
     }
  } catch (error) {
    console.error("Staging insert error:", error)
    throw new Error("Failed to save drafts to staging")
  }

  return results
}

export async function listScanStagingAction() {
  await checkAuth();
  const { rows } = await pool.query(`
    SELECT id, player_name, card_set, card_number, insert_name, parallel_name, print_run,
           raw_front_url, raw_back_url, image_url, back_image_url, listed_price, market_price,
           is_rookie, is_auto, is_relic, grading_company, grade
    FROM scan_staging
    ORDER BY id DESC
  `);
  return rows;
}

/** Submit one raw-pair staging row to the platform scanner (burns 1 credit on upload). */
export async function submitStagingRowToScannerAction(rowId: string): Promise<{ job_id: string }> {
  await checkAuth();
  const { rows } = await pool.query(
    `SELECT raw_front_url, raw_back_url, image_url FROM scan_staging WHERE id = $1`,
    [rowId]
  );
  if (!rows.length) throw new Error('Staging row not found');
  const row = rows[0];
  if (!row.raw_front_url) throw new Error('Nothing to scan — missing raw front');
  if (row.image_url) throw new Error('This row is already cropped');
  if (!row.raw_back_url) throw new Error('Scanner requires a paired back image');

  const frontFile = await fetchImageAsFile(row.raw_front_url, 'fronts.jpg');
  const backFile = await fetchImageAsFile(row.raw_back_url, 'backs.jpg');
  const fd = new FormData();
  fd.append('fronts', frontFile);
  fd.append('backs', backFile);
  const job_id = await uploadImagesToScanner(fd);
  return { job_id };
}

/** Replace one raw-pair row with N cropped card rows returned by the scanner. */
export async function finalizeStagingScanAction(
  parentId: string,
  cards: { side_a_url: string | null; side_b_url: string | null }[]
) {
  await checkAuth();
  if (!cards.length) throw new Error('Scanner returned no card pairs');
  await pool.query(`DELETE FROM scan_staging WHERE id = $1`, [parentId]);
  return createDraftCardsAction(cards);
}

/** Copy raw URLs into cropped columns without calling the scanner (free). */
export async function promoteRawStagingToCroppedAction(ids: string[]) {
  await checkAuth();
  if (!ids.length) return { replaced: 0 };
  const res = await pool.query(
    `UPDATE scan_staging
     SET image_url = raw_front_url,
         back_image_url = raw_back_url,
         raw_front_url = NULL,
         raw_back_url = NULL
     WHERE id = ANY($1::uuid[])
       AND raw_front_url IS NOT NULL
       AND raw_back_url IS NOT NULL
       AND image_url IS NULL`,
    [ids]
  );
  return { replaced: res.rowCount ?? 0 };
}

export async function updateDraftCardAction(id: string, updates: any) {
  const payload: any = {}
  if (updates.player_name !== undefined) payload.player_name = updates.player_name
  if (updates.card_set !== undefined) payload.card_set = updates.card_set
  if (updates.card_number !== undefined) payload.card_number = updates.card_number
  if (updates.insert_name !== undefined) payload.insert_name = updates.insert_name
  if (updates.parallel_name !== undefined) payload.parallel_name = updates.parallel_name
  if (updates.print_run !== undefined) payload.print_run = updates.print_run
  if (updates.is_rookie !== undefined) payload.is_rookie = updates.is_rookie
  if (updates.is_auto !== undefined) payload.is_auto = updates.is_auto
  if (updates.is_relic !== undefined) payload.is_relic = updates.is_relic
  if (updates.grading_company !== undefined) payload.grading_company = updates.grading_company
  if (updates.grade !== undefined) payload.grade = updates.grade
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
     const { rows } = await pool.query(`SELECT player_name, card_set, card_number, insert_name, parallel_name, print_run, image_url, back_image_url, listed_price, market_price, is_rookie, is_auto, is_relic, grading_company, grade FROM scan_staging WHERE id = ANY($1::uuid[])`, [ids as any]);
     staged = rows;
  } catch (error) {
     console.error(error);
     throw new Error("Failed to read staged cards");
  }

  if (!staged?.length) {
    throw new Error("Failed to read staged cards")
  }

  for (const s of staged) {
    if (!s.image_url) {
      throw new Error(
        'Cannot publish rows without a front image. Run the scanner or use "Use as-is (no crop)" first.'
      );
    }
    if (!s.back_image_url) {
      throw new Error(
        'Cannot publish without a back image for every card. Stage paired front+back, then scan or promote.'
      );
    }
  }

  // 2. Insert into live inventory
  try {
      for (const s of staged) {
          await pool.query(`
             INSERT INTO inventory (player_name, card_set, card_number, insert_name, parallel_name, print_run, image_url, back_image_url, listed_price, market_price, is_rookie, is_auto, is_relic, grading_company, grade, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'available')
          `, [s.player_name, s.card_set, s.card_number, s.insert_name, s.parallel_name, s.print_run, s.image_url, s.back_image_url, s.listed_price, s.market_price, s.is_rookie || false, s.is_auto || false, s.is_relic || false, s.grading_company || null, s.grade || null]);
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
