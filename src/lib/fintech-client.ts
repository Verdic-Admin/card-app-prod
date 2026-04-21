/**
 * Fintech API client for the Player Index master backend.
 *
 * Reads the per-shop `playerindex_api_key` provisioned during first boot
 * (see init_db.js → shop_config.playerindex_api_key) and attaches it as
 * X-API-Key on every request. The key is burned one token per request by
 * the backend's verify_client_api_key / burn_api_tokens RPC, so a 402
 * response means this shop needs a token refill.
 *
 * Base URL defaults to https://playerindexdata.com/fintech (root_path
 * configured in backend/main.py). Override with FINTECH_API_URL if the
 * storefront is pointed at a different deployment.
 */
import pool from '@/utils/db';

const FINTECH_BASE_URL =
  process.env.FINTECH_API_URL ?? 'https://api.playerindexdata.com';

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

let cachedApiKey: string | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

/**
 * Load the shop's fintech API key from shop_config. Prefers the env override
 * (PLAYERINDEX_API_KEY) so local/test deployments can skip provisioning.
 */
export async function getFintechApiKey(): Promise<string> {
  const envKey = process.env.PLAYERINDEX_API_KEY;
  if (envKey) return envKey;

  const now = Date.now();
  if (cachedApiKey && now - cachedAt < CACHE_TTL_MS) {
    return cachedApiKey;
  }

  const { rows } = await pool.query<{ playerindex_api_key: string | null }>(
    'SELECT playerindex_api_key FROM shop_config LIMIT 1',
  );
  const key = rows[0]?.playerindex_api_key ?? null;
  if (!key) {
    throw new FintechAuthError(
      'No PLAYERINDEX_API_KEY provisioned. Complete Railway setup first.',
    );
  }
  cachedApiKey = key;
  cachedAt = now;
  return key;
}

/** Internal fetch helper with auth + typed error handling. */
async function fintechFetch<T>(
  path: string,
  init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {},
): Promise<T> {
  const apiKey = await getFintechApiKey();
  const url = `${FINTECH_BASE_URL}${path}`;
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
  shop_id: string;
  discount_applied: number;
  items: BatchPriceItem[];
}

/**
 * Reprice a batch of inventory cards through the Oracle with the shop's
 * configured discount rate. Replaces client-side pricing math.
 */
export async function batchPrice(
  cardIds: string[],
  discountRate: number,
): Promise<BatchPriceResponse> {
  return fintechFetch<BatchPriceResponse>('/shop-api/batch-price', {
    method: 'POST',
    body: JSON.stringify({ card_ids: cardIds, discount_rate: discountRate }),
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
