"use server";

import { getOracleGatewayBaseUrl } from '@/lib/oracle-gateway-url';
import { getShopOracleApiKey } from '@/lib/shop-oracle-credentials';

export async function uploadImagesToScanner(
  formData: FormData,
  opts?: { chroma?: 'green' | 'blue'; shave_px?: number },
) {
  const apiKey = await getShopOracleApiKey();
  const base = await getOracleGatewayBaseUrl();
  if (opts?.chroma) {
    formData.append('chroma', opts.chroma);
  }
  if (opts?.shave_px != null) {
    formData.append('shave_px', String(opts.shave_px));
  }
  const response = await fetch(`${base}/scan/upload`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body: formData,
  });

  if (response.status === 402) {
    throw new Error('credits_exhausted');
  }
  if (!response.ok) {
    console.error(`Debug [uploadImagesToScanner] Base: ${base}, Status: ${response.status} ${response.statusText}`);
    console.error(`Debug [uploadImagesToScanner] Headers:`, Object.fromEntries(response.headers.entries()));
    const text = await response.text().catch(() => 'no body');
    console.error(`Debug [uploadImagesToScanner] Body:`, text);
    throw new Error(`Scanner upload failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.job_id as string;
}

export async function pollScannerResult(jobId: string): Promise<{
  status: string;
  total_pairs: number;
  cards: { card_index: number; side_a_url: string | null; side_b_url: string | null }[];
  error?: string;
}> {
  const apiKey = await getShopOracleApiKey();
  const base = await getOracleGatewayBaseUrl();
  const response = await fetch(`${base}/scan/result/${jobId}`, {
    headers: { 'X-API-Key': apiKey },
  });

  if (!response.ok) {
    throw new Error(`Scanner poll failed: ${response.statusText}`);
  }

  return response.json();
}

export async function requestPricingAction(imageUrl: string): Promise<{
  player_name: string;
  card_set: string;
  insert_name: string;
  parallel_name: string;
  card_number: string;
  confidence: number;
  status: string;
  pricing: {
    afv: number;
    trend_points: number[];
    player_index_url: string;
    ebay_comp_urls: string[];
  };
}> {
  const apiKey = await getShopOracleApiKey();
  const base = await getOracleGatewayBaseUrl();
  const response = await fetch(`${base}/orchestrator/process-asset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ image_url: imageUrl, shop_id: 'local_shop' }),
  });

  if (response.status === 402) {
    throw new Error('credits_exhausted');
  }

  if (!response.ok) {
    throw new Error(`Pricing request failed: ${response.statusText}`);
  }

  return response.json();
}

// Team-name provenance surfaced by the identifier's OCR-preferred resolver.
// "ocr_back"             — OCR found it on the card back (DB agreed or silent)
// "ocr_with_db_conflict" — OCR and DB disagreed; OCR kept as primary
// "catalog_db"           — OCR missed it; DB catalog supplied it
// "none"                 — neither OCR nor DB produced a team
export type TeamNameSource =
  | 'ocr_back'
  | 'ocr_with_db_conflict'
  | 'catalog_db'
  | 'none';

// Normalised flat shape returned by both identify helpers
export interface IdentifyCardResult {
  status: string;
  confidence: number;
  player_name: string | null;
  card_set: string | null;
  card_number: string | null;
  insert_name: string | null;
  parallel_name: string | null; // mapped from card_details.parallel_type
  team_name: string | null;     // OCR-first; DB catalog as verification/fallback
  team_name_source: TeamNameSource | null;
  team_name_confidence: number | null; // 0.0 - 1.0
  team_name_verified: boolean | null;  // true when OCR agrees with DB
  print_run: number | null;
}

function normalizeIdentifyResponse(raw: any): IdentifyCardResult {
  const cd = raw?.card_details ?? {};
  const source = cd.team_name_source;
  const validSources: TeamNameSource[] = [
    'ocr_back',
    'ocr_with_db_conflict',
    'catalog_db',
    'none',
  ];
  const team_name_source: TeamNameSource | null =
    typeof source === 'string' && (validSources as string[]).includes(source)
      ? (source as TeamNameSource)
      : null;

  const rawConfidence = cd.team_name_confidence;
  const team_name_confidence =
    typeof rawConfidence === 'number' && Number.isFinite(rawConfidence)
      ? rawConfidence
      : null;

  const rawVerified = cd.team_name_verified;
  const team_name_verified =
    typeof rawVerified === 'boolean' ? rawVerified : null;

  let print_run: number | null = null;
  const rawPr = cd.print_run ?? raw?.print_run;
  if (typeof rawPr === 'number' && Number.isFinite(rawPr)) {
    print_run = Math.trunc(rawPr);
  } else if (rawPr != null && String(rawPr).trim() !== '') {
    const digits = String(rawPr).replace(/\D/g, '');
    if (digits) {
      const n = parseInt(digits, 10);
      if (Number.isFinite(n)) print_run = n;
    }
  }

  return {
    status:       raw?.status        ?? 'unknown',
    confidence:   raw?.confidence    ?? 0,
    player_name:  cd.player_name     ?? null,
    card_set:     cd.card_set        ?? null,
    card_number:  cd.card_number     ?? null,
    insert_name:  cd.insert_name     ?? null,
    parallel_name: cd.parallel_type  ?? null,
    team_name:    cd.team_name       ?? null,
    team_name_source,
    team_name_confidence,
    team_name_verified,
    print_run,
  };
}

export async function identifyCardPair(payload: {
  queue_id: string;
  side_a_url: string;
  side_b_url: string;
}): Promise<IdentifyCardResult> {
  const apiKey = await getShopOracleApiKey();
  const base = await getOracleGatewayBaseUrl();
  const response = await fetch(`${base}/identify/card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(payload),
  });

  if (response.status === 402) throw new Error('credits_exhausted');
  if (!response.ok) throw new Error(`Identity API failed: ${response.statusText}`);

  return normalizeIdentifyResponse(await response.json());
}

export async function identifyCardDirectAction(
  queue_id: string,
  side_a_url: string,
  side_b_url?: string | null,
): Promise<IdentifyCardResult> {
  const apiKey = await getShopOracleApiKey();
  const base = await getOracleGatewayBaseUrl();
  const response = await fetch(`${base}/identify/card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ queue_id, side_a_url, side_b_url: side_b_url || null }),
  });

  if (response.status === 402) throw new Error('credits_exhausted');
  if (!response.ok) throw new Error(`Card identification failed: ${response.statusText}`);

  return normalizeIdentifyResponse(await response.json());
}

// ── Batch identification (1 token for up to 9 cards) ─────────────────────────

export interface BatchIdentifyResultItem {
  queue_id: string;
  status: string;
  confidence: number;
  card_details?: Record<string, unknown>;
  back_metadata?: Record<string, unknown>;
  top_matches?: unknown[];
  error?: string;
}

export interface BatchIdentifyResponse {
  batch_status: string;
  total: number;
  succeeded: number;
  failed: number;
  results: BatchIdentifyResultItem[];
}

/**
 * Identify up to 9 card pairs in a single API call (burns 1 token).
 * Returns per-item results with partial failure support.
 */
export async function identifyCardBatchAction(items: {
  queue_id: string;
  side_a_url: string;
  side_b_url: string | null;
}[]): Promise<BatchIdentifyResponse> {
  const apiKey = await getShopOracleApiKey();
  const base = await getOracleGatewayBaseUrl();
  const response = await fetch(`${base}/identify/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ items }),
    signal: AbortSignal.timeout(115_000),
  });

  if (response.status === 402) throw new Error('credits_exhausted');
  if (!response.ok) throw new Error(`Batch identify failed: ${response.statusText}`);

  return response.json();
}
