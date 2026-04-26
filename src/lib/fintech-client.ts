/**
 * Fintech API client for the Player Index master backend.
 *
 * Uses PLAYERINDEX_API_KEY (and optional FINTECH_API_URL / API_BASE_URL) from the host.
 */
import { getOracleGatewayBaseUrl } from '@/lib/oracle-gateway-url';
import { getShopOracleApiKey } from '@/lib/shop-oracle-credentials';

/**
 * Thrown when the shop is out of API tokens. The caller should surface
 * this to the admin UI and direct them to the refill dashboard.
 */
export class FintechPaymentRequiredError extends Error {
  constructor(message = 'API token balance exhausted.') {
    super(message);
    this.name = 'FintechPaymentRequiredError';
  }
}

/**
 * Thrown when the API key is missing, revoked, or rejected.
 */
export class FintechAuthError extends Error {
  constructor(message = 'Fintech API key invalid or missing.') {
    super(message);
    this.name = 'FintechAuthError';
  }
}

/** Load the shop gateway API key (server-only). Requires PLAYERINDEX_API_KEY set in Environment Variables. */
export async function getFintechApiKey(): Promise<string> {
  const key = await getShopOracleApiKey();
  if (!key) {
    throw new FintechAuthError(
      'Missing PLAYERINDEX_API_KEY. Add it in your hosting dashboard Environment Variables (from playerindexdata.com/claim or /developers).',
    );
  }
  return key;
}

/** Internal fetch helper with auth + typed error handling. */
async function fintechFetch<T>(
  path: string,
  init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {},
): Promise<T> {
  const apiKey = await getFintechApiKey();
  const base = await getOracleGatewayBaseUrl();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 402) {
    throw new FintechPaymentRequiredError(
      await res.text().catch(() => 'API token balance exhausted.'),
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new FintechAuthError(
      await res.text().catch(() => 'Fintech API key rejected.'),
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Fintech API ${res.status}: ${body}`);
  }

  return (await res.json()) as T;
}

// ──────────────────────────────────────────────────────────────────────────
// /shop-api — repricing and image/record operations
// ──────────────────────────────────────────────────────────────────────────

export interface BatchPriceItem {
  card_id: string;
  oracle_value: number;
  listed_price: number;
  trend_points: number[];
  player_index_url: string;
}

export interface BatchPriceResponse {
  discount_applied: number;
  items: BatchPriceItem[];
}

/** One row for POST /shop-api/batch-price (matches fintech-api CardBatchItem). */
export interface BatchPriceCardInput {
  card_id: string;
  player_name: string;
  card_set?: string;
  card_number?: string;
  insert_name?: string;
  parallel_name?: string;
  is_auto?: boolean;
  is_relic?: boolean;
  is_rookie?: boolean;
  print_run?: number | null;
}

/**
 * Reprice a batch of inventory cards through the Oracle with the shop's
 * configured discount rate. Replaces client-side pricing math.
 */
export async function batchPrice(
  cards: BatchPriceCardInput[],
  discountRate: number,
): Promise<BatchPriceResponse> {
  return fintechFetch<BatchPriceResponse>('/shop-api/batch-price', {
    method: 'POST',
    body: JSON.stringify({ cards, discount_rate: discountRate }),
  });
}

export interface NormalizedAsset {
  player_name: string;
  card_set: string;
  attributes: string;
  asset_status: string;
}

export async function normalizeDraftCard(payload: {
  player_name: string;
  card_set: string;
  attributes: string;
}): Promise<{ status: string; cleaned_asset: NormalizedAsset }> {
  return fintechFetch('/shop-api/draft-cards/normalize', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function rotateShopImage(
  imageUrl: string,
  degrees = 90,
): Promise<{ status: string; new_image_url: string; message: string }> {
  return fintechFetch('/shop-api/image/rotate', {
    method: 'POST',
    body: JSON.stringify({ image_url: imageUrl, degrees }),
  });
}

export async function bulkDeleteInventory(
  recordIds: string[],
): Promise<{ status: string; message: string }> {
  return fintechFetch('/shop-api/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ record_ids: recordIds }),
  });
}

// ──────────────────────────────────────────────────────────────────────────
// /orchestrator — AssetProcessor + BatchManager
// ──────────────────────────────────────────────────────────────────────────

export interface ProcessAssetResult {
  canonical_id: string;
  player_name: string;
  card_set: string;
  insert_name: string;
  parallel_name: string;
  confidence: number;
  status: 'High Confidence' | 'Manual Correction' | string;
  pricing: {
    afv: number;
    player_index_url: string;
    trend_points: number[];
  };
}

export async function processAsset(
  imageUrl: string,
  shopId: string,
): Promise<ProcessAssetResult> {
  return fintechFetch<ProcessAssetResult>('/orchestrator/process-asset', {
    method: 'POST',
    body: JSON.stringify({ image_url: imageUrl, shop_id: shopId }),
  });
}

export async function ingestBatch(
  images: string[],
  shopId: string,
): Promise<{ job_id: string; message: string }> {
  return fintechFetch('/orchestrator/ingest/batch', {
    method: 'POST',
    body: JSON.stringify({ images, shop_id: shopId }),
  });
}

export interface IngestStatusPending {
  job_id: string;
  status: 'processing';
  progress: string;
}

export interface IngestStatusComplete {
  job_id: string;
  status: 'completed';
  summary: {
    ready_to_publish: ProcessAssetResult[];
    manual_correction_required: ProcessAssetResult[];
  };
}

export type IngestStatus = IngestStatusPending | IngestStatusComplete;

export async function getIngestStatus(jobId: string): Promise<IngestStatus> {
  return fintechFetch<IngestStatus>(`/orchestrator/ingest/status/${jobId}`, {
    method: 'GET',
  });
}

export interface MarketRefreshUpdate {
  card_id: string;
  market_price: number;
  listed_price: number;
}

export async function syncMarketRefresh(
  cardIds: string[],
  shopId: string,
): Promise<{ batch_updates: MarketRefreshUpdate[] }> {
  return fintechFetch('/orchestrator/sync/market-refresh', {
    method: 'POST',
    body: JSON.stringify({ card_ids: cardIds, shop_id: shopId }),
  });
}
