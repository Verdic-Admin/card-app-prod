"use server";
import pool from '@/utils/db';
import { put } from '@/utils/storage';
import { getAppOrigin } from '@/utils/app-origin';
import { uploadImagesToScanner, requestPricingAction } from '@/app/actions/visionSync';
import { hasShopOracleApiKey } from '@/lib/shop-oracle-credentials';
import { calculatePricingAction, calculatePricingBatchAction } from '@/app/actions/oracleAPI';
import type { BatchPricingItem } from '@/app/actions/oracleAPI';

async function checkAuth() {
  if (!(await hasShopOracleApiKey())) {
    throw new Error('Unauthorized: complete Player Index provisioning for this store first.');
  }
}

function safeNumeric(v: unknown, fallback = 0): number {
  if (v == null || v === '') return fallback;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalise any print-run input to a clean integer (the denominator / edition size).
 * Rules:
 *   "45/99"  → 99   (take denominator — edition size, not serial #)
 *   "/99"    → 99
 *   "99"     → 99   (plain number)
 *   "Gold /99" → 99 (strip non-numeric prefix)
 *   "1/1"    → 1
 *   null/""  → null
 */
function parsePrintRun(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  // Extract digits after a slash (denominator/edition-size)
  const slashMatch = s.match(/\/\s*(\d+)/);
  if (slashMatch) {
    const n = parseInt(slashMatch[1], 10);
    return n > 0 ? n : null;
  }
  // Plain digits only
  const plainMatch = s.match(/^(\d+)$/);
  if (plainMatch) {
    const n = parseInt(plainMatch[1], 10);
    return n > 0 ? n : null;
  }
  return null;
}

function toTitleCase(str: string) {
  if (!str) return '';
  return str.replace(/\w\S*/g, (txt) => {
    const upper = txt.toUpperCase();
    if (['RC', 'SP', 'SSP', '1ST', 'TV'].includes(upper)) return upper;
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

async function getOracleDiscountRate(): Promise<number> {
  try {
    const { rows } = await pool.query(
      `SELECT oracle_discount_percentage FROM store_settings WHERE id = 1`,
    );
    return parseFloat(String(rows?.[0]?.oracle_discount_percentage ?? 0)) || 0;
  } catch {
    return 0;
  }
}

function parallelInsertType(insertName: string | null, parallelName: string | null): string {
  const parts = [insertName, parallelName].filter(
    (x) => x != null && String(x).trim() !== '' && String(x).toLowerCase() !== 'base',
  );
  return parts.length ? parts.join(' ') : 'Base';
}

/** First non-empty URL among row columns (staging may keep back only on raw_* until promote). */
function pickStagingUrl(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

/** DB row cell → string | null for typed helpers (Record<string, unknown> rows). */
function sqlNullableText(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

function sqlText(v: unknown, fallback = ''): string {
  if (v == null) return fallback;
  return String(v);
}

const ALLOWED_COLUMNS = [
  'player_name', 'team_name', 'card_set', 'card_number', 'insert_name',
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
    `INSERT INTO scan_staging (raw_front_url, raw_back_url, image_url, back_image_url, upload_kind)
     VALUES ($1, $2, NULL, NULL, $3)
     RETURNING id, player_name, team_name, card_set, card_number, insert_name,
               parallel_name, print_run, raw_front_url, raw_back_url,
               image_url, back_image_url, listed_price, market_price,
               is_rookie, is_auto, is_relic, grading_company, grade, upload_kind`,
    [rawFront, rawBack, kind]
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
    team_name: c.team_name || '',
    card_set: c.card_set || '',
    card_number: c.card_number || '',
    insert_name: c.insert_name || '',
    parallel_name: c.parallel_name || '',
    print_run: parsePrintRun(c.print_run),
    image_url: c.side_a_url,
    back_image_url: c.side_b_url,
    listed_price: c.price || 0,
    market_price: c.market_price || c.price || 0,
    is_rookie: c.is_rookie || false,
    is_1st: c.is_1st || false,
    is_short_print: c.is_short_print || false,
    is_ssp: c.is_ssp || false,
    is_auto: c.is_auto || false,
    is_relic: c.is_relic || false,
    grading_company: c.grading_company || null,
    grade: c.grade || null,
  }));
  
  const results = [];
  try {
     for (const item of payload) {
        const { rows } = await pool.query(`
            INSERT INTO scan_staging (player_name, team_name, card_set, card_number, insert_name, parallel_name, print_run, image_url, back_image_url, listed_price, market_price, is_rookie, is_1st, is_short_print, is_ssp, is_auto, is_relic, grading_company, grade, upload_kind)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'matrix')
            RETURNING id, player_name, team_name, card_set, card_number, insert_name, parallel_name, print_run, image_url, back_image_url, listed_price, market_price, is_rookie, is_1st, is_short_print, is_ssp, is_auto, is_relic, grading_company, grade, upload_kind
        `, [item.player_name, item.team_name, item.card_set, item.card_number, item.insert_name, item.parallel_name, item.print_run, item.image_url, item.back_image_url, item.listed_price, item.market_price, item.is_rookie, item.is_1st, item.is_short_print, item.is_ssp, item.is_auto, item.is_relic, item.grading_company, item.grade]);
        if (rows.length > 0) results.push(rows[0]);
     }
  } catch (error) {
    console.error("Staging insert error:", error)
    throw new Error("Failed to save drafts to staging")
  }

  return results
}

export async function listScanStagingAction(uploadKind?: 'single_pair' | 'matrix') {
  await checkAuth();
  // 'matrix' also includes legacy rows with NULL upload_kind (pre-track-split cards)
  // 'single_pair' is strict match only
  let filter = '';
  let params: string[] = [];
  if (uploadKind === 'matrix') {
    filter = `WHERE (upload_kind = 'matrix' OR upload_kind IS NULL)`;
  } else if (uploadKind === 'single_pair') {
    filter = `WHERE upload_kind = 'single_pair'`;
  }
  const { rows } = await pool.query(
    `SELECT id, player_name, team_name, card_set, card_number, insert_name,
            parallel_name, print_run, raw_front_url, raw_back_url,
            image_url, back_image_url, listed_price, market_price,
            trend_data, player_index_url, oracle_projection, oracle_trend_percentage, oracle_comps,
            is_rookie, is_1st, is_short_print, is_ssp, is_auto, is_relic, grading_company, grade, upload_kind
     FROM scan_staging
     ${filter}
     ORDER BY id DESC`,
    params
  );
  return rows;
}

export type ApplyStagingDraftPricingResult =
  | {
      success: true;
      listed_price: number;
      market_price: number;
      player_name: string;
      team_name: string;
      card_set: string;
      card_number: string;
      insert_name: string;
      parallel_name: string;
      confidence?: number;
      ai_status?: string;
      is_rookie?: boolean;
      is_1st?: boolean;
      is_short_print?: boolean;
      is_ssp?: boolean;
      p_bull?: number;
      p_bear?: number;
    }
  | { success: false; error: string };

/**
 * Price a staging draft from current row fields: one Oracle /v1/calculate call, then persist
 * listed_price (after store discount), market_price, trend_data, player_index_url, and oracle_* — same
 * shape as post-mint sync so users are not forced to re-sync for the same numbers.
 */
export async function applyStagingDraftFieldPricingAction(
  id: string,
): Promise<ApplyStagingDraftPricingResult> {
  await checkAuth();

  const { rows } = await pool.query(`SELECT * FROM scan_staging WHERE id = $1::uuid`, [id]);
  if (!rows.length) {
    return { success: false, error: 'Draft not found.' };
  }
  const row = rows[0] as Record<string, unknown>;
  const playerName = String(row.player_name ?? '').trim();
  if (!playerName) {
    return { success: false, error: 'Player name is required before pricing.' };
  }

  const discountRate = await getOracleDiscountRate();
  const gradeStr =
    row.grading_company && row.grade
      ? `${String(row.grading_company)} ${String(row.grade)}`
      : undefined;

  const printRaw = row.print_run;
  const printRun =
    printRaw != null && String(printRaw).trim() !== ''
      ? Number(String(printRaw).replace(/,/g, ''))
      : null;

  const res = await calculatePricingAction({
    player_name: toTitleCase(playerName),
    card_set: String(row.card_set ?? ''),
    insert_name: String(row.insert_name ?? ''),
    parallel_name: String(row.parallel_name ?? ''),
    card_number: String(row.card_number ?? ''),
    print_run: printRun != null && Number.isFinite(printRun) ? printRun : null,
    is_rookie: Boolean(row.is_rookie),
    is_1st: Boolean(row.is_1st),
    is_short_print: Boolean(row.is_short_print),
    is_auto: Boolean(row.is_auto),
    is_relic: Boolean(row.is_relic),
    grade: gradeStr,
  });

  if (res && typeof res === 'object' && 'error' in res && res.error === 'credits_exhausted') {
    return { success: false, error: 'credits_exhausted' };
  }
  if (!res || typeof res !== 'object' || !('success' in res) || !res.success) {
    const r = res as { status?: number; statusText?: string; detail?: string };
    const msg = [r.status && `HTTP ${r.status}`, r.statusText, r.detail].filter(Boolean).join(' — ');
    return { success: false, error: msg || 'Oracle pricing failed.' };
  }

  const data = res.data as Record<string, unknown>;
  const projection = Number(data.projected_target ?? data.target_price ?? 0);
  if (!Number.isFinite(projection) || projection <= 0) {
    return { success: false, error: 'Oracle returned an invalid projected price.' };
  }

  const marketBase = data.current_price != null && Number(data.current_price) > 0 ? Number(data.current_price) : projection;
  const listed = roundMoney(marketBase * (1 - discountRate / 100));
  const trend = data.trend_percentage != null ? Number(data.trend_percentage) : null;
  const trendPoints = Array.isArray(data.trend_points) ? data.trend_points : [];
  const playerIndexUrl = String(data.player_index_url || '');
  
  const pBull = data.p_bull != null ? Number(data.p_bull) : Math.round(projection * 1.15 * 100) / 100;
  const pBear = data.p_bear != null ? Number(data.p_bear) : Math.round(projection * 0.85 * 100) / 100;

  await pool.query(`ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS p_bull numeric, ADD COLUMN IF NOT EXISTS p_bear numeric`);

  await pool.query(
    `UPDATE scan_staging SET
       listed_price = $1,
       market_price = $2,
       oracle_projection = $3,
       oracle_trend_percentage = $4,
       trend_data = $5::jsonb,
       player_index_url = $6,
       p_bull = $7,
       p_bear = $8
     WHERE id = $9::uuid`,
    [listed, marketBase, projection, trend, JSON.stringify(trendPoints), playerIndexUrl || null, pBull, pBear, id],
  );

  return {
    success: true,
    listed_price: listed,
    market_price: marketBase,
    player_name: String(row.player_name ?? ''),
    team_name: String(row.team_name ?? ''),
    card_set: String(row.card_set ?? ''),
    card_number: String(row.card_number ?? ''),
    insert_name: String(row.insert_name ?? ''),
    parallel_name: String(row.parallel_name ?? ''),
    is_rookie: Boolean(row.is_rookie),
    is_1st: Boolean(row.is_1st),
    is_short_print: Boolean(row.is_short_print),
    is_ssp: Boolean(row.is_ssp),
    p_bull: pBull,
    p_bear: pBear,
  };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Vision + orchestrator pricing for a draft: one process-asset call, then persist the same
 * discounted listed / market / trend / URLs as field-based pricing.
 */
export async function applyStagingDraftImagePricingAction(
  id: string,
  imageUrl: string,
): Promise<ApplyStagingDraftPricingResult> {
  await checkAuth();

  const { rows } = await pool.query(`SELECT * FROM scan_staging WHERE id = $1::uuid`, [id]);
  if (!rows.length) {
    return { success: false, error: 'Draft not found.' };
  }
  const row = rows[0] as Record<string, unknown>;

  let result: Awaited<ReturnType<typeof requestPricingAction>>;
  try {
    result = await requestPricingAction(imageUrl);
  } catch (e) {
    if (e instanceof Error && e.message === 'credits_exhausted') {
      return { success: false, error: 'credits_exhausted' };
    }
    throw e;
  }
  const afv = Number(result.pricing?.afv ?? NaN);
  if (!Number.isFinite(afv) || afv < 0) {
    return { success: false, error: 'Pricing service returned no usable AFV.' };
  }

  const discountRate = await getOracleDiscountRate();
  const projection = afv;
  const marketBase = result.pricing?.current_price != null && Number(result.pricing?.current_price) > 0 ? Number(result.pricing.current_price) : projection;
  const listed = roundMoney(marketBase * (1 - discountRate / 100));
  const trendPoints = Array.isArray(result.pricing?.trend_points) ? result.pricing!.trend_points : [];
  const playerIndexUrl = String(result.pricing?.player_index_url || '');
  
  const pBull = result.pricing?.p_bull != null ? Number(result.pricing.p_bull) : Math.round(projection * 1.15 * 100) / 100;
  const pBear = result.pricing?.p_bear != null ? Number(result.pricing.p_bear) : Math.round(projection * 0.85 * 100) / 100;

  const pick = (v: string | undefined, fallback: string) =>
    (v != null && String(v).trim() !== '' ? String(v).trim() : fallback);

  const player_name = pick(result.player_name, String(row.player_name ?? ''));
  const card_set = pick(result.card_set, String(row.card_set ?? ''));
  const card_number = pick(result.card_number, String(row.card_number ?? ''));
  const insert_name = pick(result.insert_name, String(row.insert_name ?? ''));
  const parallel_name = pick(result.parallel_name, String(row.parallel_name ?? ''));

  await pool.query(`ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS p_bull numeric, ADD COLUMN IF NOT EXISTS p_bear numeric`);

  await pool.query(
    `UPDATE scan_staging SET
       player_name = $1,
       card_set = $2,
       card_number = $3,
       insert_name = $4,
       parallel_name = $5,
       listed_price = $6,
       market_price = $7,
       oracle_projection = $8,
       oracle_trend_percentage = NULL,
       trend_data = $9::jsonb,
       player_index_url = $10,
       is_rookie = $11,
       is_1st = $12,
       is_short_print = $13,
       is_ssp = $14,
       p_bull = $15,
       p_bear = $16
     WHERE id = $17::uuid`,
    [
      player_name,
      card_set,
      card_number,
      insert_name,
      parallel_name,
      listed,
      marketBase,
      projection,
      JSON.stringify(trendPoints),
      playerIndexUrl || null,
      Boolean(result.is_rookie),
      Boolean(result.is_1st),
      Boolean(result.is_short_print),
      Boolean(result.is_ssp),
      pBull,
      pBear,
      id,
    ],
  );

  return {
    success: true,
    listed_price: listed,
    market_price: marketBase,
    player_name,
    team_name: String(row.team_name ?? ''),
    card_set,
    card_number,
    insert_name,
    parallel_name,
    confidence: result.confidence,
    ai_status: result.status,
    is_rookie: Boolean(result.is_rookie),
    is_1st: Boolean(result.is_1st),
    is_short_print: Boolean(result.is_short_print),
    is_ssp: Boolean(result.is_ssp),
    p_bull: pBull,
    p_bear: pBear,
  };
}

/** Submit one raw-pair staging row to the platform scanner (burns 1 credit on upload). */
export async function submitStagingRowToScannerAction(
  rowId: string,
  opts?: { chroma?: 'green' | 'blue' },
): Promise<{ job_id: string }> {
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
  const job_id = await uploadImagesToScanner(fd, opts);
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
  if (!ids.length) return [];
  const res = await pool.query(
    `UPDATE scan_staging
     SET image_url = raw_front_url,
         back_image_url = raw_back_url,
         raw_front_url = NULL,
         raw_back_url = NULL
     WHERE id = ANY($1::uuid[])
       AND raw_front_url IS NOT NULL
       AND raw_back_url IS NOT NULL
       AND image_url IS NULL
     RETURNING *`,
    [ids]
  );
  return res.rows;
}

/**
 * Move free-track (single_pair) cards into the premium AI pipeline.
 * Promotes raw images to cropped if needed, flips upload_kind to 'matrix'.
 */
export async function promoteToPremiumTrackAction(ids: string[]) {
  await checkAuth();
  if (!ids.length) return [];
  // First promote raw → cropped for any that haven't been cropped
  await pool.query(
    `UPDATE scan_staging
     SET image_url = COALESCE(image_url, raw_front_url),
         back_image_url = COALESCE(back_image_url, raw_back_url)
     WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  // Then flip to matrix so premium track picks them up
  const { rows } = await pool.query(
    `UPDATE scan_staging
     SET upload_kind = 'matrix'
     WHERE id = ANY($1::uuid[])
     RETURNING *`,
    [ids]
  );
  return rows;
}

export async function updateDraftCardAction(id: string, updates: any) {
  const payload: any = {}
  if (updates.player_name !== undefined) payload.player_name = updates.player_name
  if (updates.team_name !== undefined) payload.team_name = updates.team_name == null ? '' : String(updates.team_name)
  if (updates.card_set !== undefined) payload.card_set = updates.card_set
  if (updates.card_number !== undefined) payload.card_number = updates.card_number
  if (updates.insert_name !== undefined) payload.insert_name = updates.insert_name
  if (updates.parallel_name !== undefined) payload.parallel_name = updates.parallel_name
  if (updates.print_run !== undefined) payload.print_run = parsePrintRun(updates.print_run)
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

export type PublishDraftCardsResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Mint staging rows into `inventory` and remove them from `scan_staging`.
 * Returns `{ success, error? }` instead of throwing so production clients always
 * get a readable message (Next.js strips thrown server-action messages in prod).
 */
export async function publishDraftCardsAction(ids: string[]): Promise<PublishDraftCardsResult> {
  if (!ids?.length) {
    return { success: false, error: 'No cards selected to publish.' };
  }

  if (!(await hasShopOracleApiKey())) {
    return {
      success: false,
      error:
        'Unauthorized: set PLAYERINDEX_API_KEY in your hosting Environment Variables for this service so the store can write to the database.',
    };
  }

  // 1. Read approved rows from staging
  let staged: Record<string, unknown>[] = [];
  try {
    // Ensure the table schema has p_bull and p_bear columns
    await pool.query(`ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS p_bull numeric, ADD COLUMN IF NOT EXISTS p_bear numeric`);
    await pool.query(`ALTER TABLE inventory ADD COLUMN IF NOT EXISTS p_bull numeric, ADD COLUMN IF NOT EXISTS p_bear numeric`);
    
    const { rows } = await pool.query(
      `SELECT player_name, team_name, card_set, card_number, insert_name, parallel_name, print_run,
              image_url, back_image_url, raw_front_url, raw_back_url,
              listed_price, market_price,
              trend_data, player_index_url, oracle_projection, oracle_trend_percentage,
              is_rookie, is_1st, is_short_print, is_ssp, is_auto, is_relic, grading_company, grade,
              p_bull, p_bear
       FROM scan_staging WHERE id = ANY($1::uuid[])`,
      [ids as string[]],
    );
    staged = rows;
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Failed to read staged cards from the database.' };
  }

  if (!staged?.length) {
    return {
      success: false,
      error: 'No matching staging rows found. They may already be published or the selection is out of date — refresh the page.',
    };
  }

  for (const s of staged) {
    const front = pickStagingUrl(s, 'image_url', 'raw_front_url');
    const back = pickStagingUrl(s, 'back_image_url', 'raw_back_url');
    if (!front) {
      return {
        success: false,
        error:
          'Cannot publish without a front image. Run the scanner or use "Use as-is (no crop)" first.',
      };
    }
    if (!back) {
      return {
        success: false,
        error:
          'Cannot publish without a back image. Upload a paired back (or use "Use as-is" so raw_front/raw_back are set), then try again.',
      };
    }
  }

  // 2–3: Insert inventory + delete staging in one transaction (all-or-nothing)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const s of staged) {
      const frontUrl = pickStagingUrl(s, 'image_url', 'raw_front_url')!;
      const backUrl = pickStagingUrl(s, 'back_image_url', 'raw_back_url')!;
      const listed = safeNumeric(s.listed_price, 0);
      const market = safeNumeric(s.market_price, listed);
      const printRun = parsePrintRun(s.print_run);
      const pit = parallelInsertType(
        sqlNullableText(s.insert_name),
        sqlNullableText(s.parallel_name),
      );
      const trendRaw = s.trend_data;
      const trendJson =
        trendRaw == null
          ? '[]'
          : typeof trendRaw === 'string'
            ? trendRaw
            : JSON.stringify(trendRaw);
      const playerIndexUrl = sqlText(s.player_index_url, '');
      const oracleProj =
        s.oracle_projection != null && String(s.oracle_projection).trim() !== ''
          ? safeNumeric(s.oracle_projection, market)
          : market;
      const oracleTrendParsed = parseFloat(String(s.oracle_trend_percentage ?? ''));
      const oracleTrend = Number.isFinite(oracleTrendParsed) ? oracleTrendParsed : null;
      
      const pBull = s.p_bull != null ? Number(s.p_bull) : Math.round(oracleProj * 1.15 * 100) / 100;
      const pBear = s.p_bear != null ? Number(s.p_bear) : Math.round(oracleProj * 0.85 * 100) / 100;

      await client.query(
        `
             INSERT INTO inventory (
               player_name, team_name, card_set, card_number, insert_name, parallel_name, parallel_insert_type,
               print_run, image_url, back_image_url, listed_price, market_price,
               trend_data, player_index_url, oracle_projection, oracle_trend_percentage,
               is_rookie, is_1st, is_short_print, is_ssp, is_auto, is_relic, grading_company, grade, status,
               p_bull, p_bear
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, 'available', $25, $26)
          `,
        [
          sqlText(s.player_name),
          sqlNullableText(s.team_name),
          sqlText(s.card_set),
          sqlText(s.card_number),
          sqlNullableText(s.insert_name),
          sqlNullableText(s.parallel_name),
          pit,
          printRun,
          frontUrl,
          backUrl,
          listed,
          market,
          trendJson,
          playerIndexUrl,
          oracleProj,
          oracleTrend,
          Boolean(s.is_rookie),
          Boolean(s.is_1st),
          Boolean(s.is_short_print),
          Boolean(s.is_ssp),
          Boolean(s.is_auto),
          Boolean(s.is_relic),
          sqlNullableText(s.grading_company),
          sqlNullableText(s.grade),
          pBull,
          pBear,
        ],
      );
    }
    await client.query(`DELETE FROM scan_staging WHERE id = ANY($1::uuid[])`, [ids as string[]]);
    await client.query('COMMIT');
  } catch (e: unknown) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    console.error(e);
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === 'object' && e != null && 'message' in e
          ? String((e as { message: unknown }).message)
          : String(e);
    return { success: false, error: `Publish failed: ${msg}` };
  } finally {
    client.release();
  }

  return { success: true };
}

// ── Batch pricing (1 token for up to 9 cards) ────────────────────────────────

export interface BatchPricingResult {
  id: string;
  success: boolean;
  listed_price?: number;
  market_price?: number;
  ebay_comps?: { price: number; url: string }[];
  player_index_url?: string | null;
  error?: string;
}

/**
 * Price up to 9 staging cards in a single API call (burns 1 token).
 * Reads all rows, sends them to the batch pricing endpoint, then
 * bulk-updates the database with the results.
 */
export async function applyStagingDraftBatchPricingAction(
  ids: string[],
): Promise<{ success: boolean; results: BatchPricingResult[]; error?: string }> {
  await checkAuth();
  if (!ids.length) return { success: false, results: [], error: 'No IDs provided.' };

  // 1. Read all staging rows
  const { rows } = await pool.query(
    `SELECT * FROM scan_staging WHERE id = ANY($1::uuid[])`,
    [ids],
  );

  if (!rows.length) return { success: false, results: [], error: 'No drafts found.' };

  const discountRate = await getOracleDiscountRate();

  // 2. Build batch payload
  const batchItems: BatchPricingItem[] = rows.map((row: Record<string, unknown>) => {
    const printRaw = row.print_run;
    const printRun =
      printRaw != null && String(printRaw).trim() !== ''
        ? Number(String(printRaw).replace(/,/g, ''))
        : null;
    const gradeStr =
      row.grading_company && row.grade
        ? `${String(row.grading_company)} ${String(row.grade)}`
        : undefined;
    return {
      id: String(row.id),
      player_name: String(row.player_name ?? ''),
      card_set: String(row.card_set ?? ''),
      insert_name: String(row.insert_name ?? ''),
      parallel_name: String(row.parallel_name ?? ''),
      card_number: String(row.card_number ?? ''),
      print_run: printRun != null && Number.isFinite(printRun) ? printRun : null,
      is_rookie: Boolean(row.is_rookie),
      is_auto: Boolean(row.is_auto),
      is_relic: Boolean(row.is_relic),
      grade: gradeStr || null,
    };
  });

  // 3. Call batch pricing (1 token)
  const batchRes = await calculatePricingBatchAction(batchItems);

  if (!batchRes.success) {
    return { success: false, results: [], error: batchRes.error };
  }

  // 4. Map results back and bulk-update the database
  const output: BatchPricingResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, unknown>;
    const id = String(row.id);
    const priceResult = batchRes.results[i];

    // The oracle /v1/b2b/calculate-batch response has no per-item `status` field —
    // only the top-level envelope has { status: "success" }. Per-item failures are
    // signalled by projected_target == 0 or the presence of an `error` key.
    if (!priceResult || priceResult.projected_target == null) {
      output.push({ id, success: false, error: priceResult?.message || 'No price returned.' });
      continue;
    }
    if ('error' in priceResult && priceResult.error) {
      output.push({ id, success: false, error: String(priceResult.error) });
      continue;
    }

    const projection = Number(priceResult.projected_target);
    if (!Number.isFinite(projection) || projection <= 0) {
      output.push({ id, success: false, error: 'Invalid projection returned.' });
      continue;
    }

    // Real market price from backend
    const comps = priceResult.ebay_comps || [];
    const marketBase = priceResult.current_price != null && Number(priceResult.current_price) > 0 ? Number(priceResult.current_price) : projection;

    const listed = roundMoney(marketBase * (1 - discountRate / 100));
    const trend = priceResult.trend_percentage != null ? Number(priceResult.trend_percentage) : null;
    const playerIndexUrl = priceResult.url || '';
    
    const pBull = priceResult.p_bull != null ? Number(priceResult.p_bull) : Math.round(projection * 1.15 * 100) / 100;
    const pBear = priceResult.p_bear != null ? Number(priceResult.p_bear) : Math.round(projection * 0.85 * 100) / 100;

    await pool.query(`ALTER TABLE scan_staging ADD COLUMN IF NOT EXISTS p_bull numeric, ADD COLUMN IF NOT EXISTS p_bear numeric`);

    try {
      await pool.query(
        `UPDATE scan_staging SET
           listed_price = $1,
           market_price = $2,
           oracle_projection = $3,
           oracle_trend_percentage = $4,
           player_index_url = $5,
           oracle_comps = $6::jsonb,
           p_bull = $7,
           p_bear = $8
         WHERE id = $9::uuid`,
        [listed, marketBase, projection, trend, playerIndexUrl || null, JSON.stringify(comps), pBull, pBear, id],
      );
      output.push({ id, success: true, listed_price: listed, market_price: marketBase, player_index_url: playerIndexUrl || null, ebay_comps: comps });
    } catch (e: unknown) {
      output.push({ id, success: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { success: true, results: output };
}
