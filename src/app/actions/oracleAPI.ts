'use server'

import { getOracleGatewayBaseUrl } from '@/lib/oracle-gateway-url';
import { getShopOracleApiKey } from '@/lib/shop-oracle-credentials';
import { dedupeAndCache } from '@/lib/oracle-request-cache';

const TAXONOMY_TTL_MS = 5 * 60_000;   // 5 min — taxonomy is near-static
const PRICING_TTL_MS  = 60_000;       // 1 min — pricing moves slowly intraday

export async function submitOracleRequest(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});

  let apiKey = '';
  try {
    apiKey = await getShopOracleApiKey();
  } catch (error) {
    console.error('[oracleAPI] failed to resolve API key:', error);
    return {
      error: 'api_failed',
      status: 500,
      statusText: 'Failed to load store credentials.',
    };
  }

  if (!apiKey) {
    return {
      error: 'api_failed',
      status: 401,
      statusText: 'Store is not provisioned yet. Use your Player Index one-time setup link to deploy.',
    };
  }

  headers.set('X-API-Key', apiKey);

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    console.error('[oracleAPI] request failed:', error);
    return {
      error: 'api_failed',
      status: 503,
      statusText: 'Oracle gateway unavailable.',
    };
  }

  if (response.status === 402) {
    return { error: 'credits_exhausted' };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return {
      error: 'api_failed',
      status: response.status,
      statusText: response.statusText,
      detail: detail.slice(0, 500),
    };
  }

  const data = await response.json();
  return { success: true, data };
}

export async function searchTaxonomyAction(query: string) {
  const normalized = (query || '').trim().toLowerCase();
  if (!normalized) {
    return { success: true, data: { results: [] } };
  }
  const base = await getOracleGatewayBaseUrl();
  const cacheKey = `taxonomy:${normalized}`;
  return dedupeAndCache(
    cacheKey,
    () => submitOracleRequest(`${base}/v1/taxonomy/search?q=${encodeURIComponent(query)}`),
    {
      ttlMs: TAXONOMY_TTL_MS,
      shouldCache: (v: any) => Boolean(v && v.success),
    },
  );
}

export async function calculatePricingAction(fields: {
  player_name: string;
  card_set: string;
  insert_name?: string;
  parallel_name?: string;
  card_number?: string;
  print_run?: number | null;
  is_rookie?: boolean;
  is_1st?: boolean;
  is_short_print?: boolean;
  is_ssp?: boolean;
  is_auto?: boolean;
  is_relic?: boolean;
  grade?: string | null;
}) {
  const base = await getOracleGatewayBaseUrl();
  const payload = {
    player_name: fields.player_name,
    card_set: fields.card_set,
    insert_name: fields.insert_name || 'Base',
    parallel_name: fields.parallel_name || 'Base',
    card_number: fields.card_number || '',
    print_run: fields.print_run ?? null,
    is_rookie: fields.is_rookie ?? false,
    is_1st: fields.is_1st ?? false,
    is_short_print: fields.is_short_print ?? false,
    is_ssp: fields.is_ssp ?? false,
    is_auto: fields.is_auto ?? false,
    is_relic: fields.is_relic ?? false,
    grade: fields.grade || null,
    skip_fuzzy: false,
  };

  // Identity-based cache key so repeated clicks / concurrent tabs on the same
  // card coalesce into a single upstream Oracle call. TTL is short so genuine
  // intraday re-pricing still flows through.
  const cacheKey = 'calc:' + [
    (payload.player_name || '').toLowerCase(),
    (payload.card_set || '').toLowerCase(),
    (payload.card_number || '').toLowerCase(),
    (payload.insert_name || '').toLowerCase(),
    (payload.parallel_name || '').toLowerCase(),
    payload.print_run ?? '',
    payload.is_rookie ? '1' : '0',
    fields.is_1st ? '1' : '0',
    fields.is_short_print ? '1' : '0',
    fields.is_ssp ? '1' : '0',
    payload.is_auto ? '1' : '0',
    payload.is_relic ? '1' : '0',
    payload.grade || '',
  ].join('|');

  return dedupeAndCache(
    cacheKey,
    async () => {
      const raw = await submitOracleRequest(`${base}/v1/calculate`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!raw || typeof raw !== 'object' || !('success' in raw) || !raw.success) {
        return raw;
      }
      const d = raw.data as Record<string, unknown>;
      const target = Number(d.target_price ?? d.projected_target ?? 0);
      return {
        success: true,
        data: { ...d, projected_target: target, target_price: d.target_price ?? target },
      };
    },
    {
      ttlMs: PRICING_TTL_MS,
      shouldCache: (v: any) => Boolean(v && v.success),
    },
  );
}

// ── Batch pricing (1 token for up to 9 cards) ───────────────────────────────

export interface BatchPricingItem {
  id: string;             // staging row UUID (for mapping results back)
  player_name: string;
  card_set: string;
  insert_name?: string;
  parallel_name?: string;
  card_number?: string;
  print_run?: number | null;
  is_rookie?: boolean;
  is_auto?: boolean;
  is_relic?: boolean;
  grade?: string | null;
}

export interface BatchPricingResultItem {
  storefront_id?: string;
  projected_target?: number;
  historical_target?: number | null;
  trend_percentage?: number;
  source?: string;
  url?: string | null;
  did_you_mean?: Record<string, string>;
  status?: string;
  message?: string;
}

/**
 * Price up to 9 cards in a single API call (burns 1 token).
 * Uses the existing /v1/b2b/calculate-batch endpoint.
 */
export async function calculatePricingBatchAction(
  items: BatchPricingItem[],
): Promise<{ success: boolean; results: BatchPricingResultItem[]; error?: string }> {
  const base = await getOracleGatewayBaseUrl();

  // Map to the shape the b2b batch endpoint expects
  const apiItems = items.map((f) => ({
    player_name: f.player_name,
    card_set: f.card_set,
    insert_name: f.insert_name || 'Base',
    parallel_name: f.parallel_name || 'Base',
    card_number: f.card_number || '',
    print_run: f.print_run ?? null,
    is_rookie: f.is_rookie ?? false,
    is_auto: f.is_auto ?? false,
    is_relic: f.is_relic ?? false,
    grade: f.grade || null,
    skip_fuzzy: false,
  }));

  const raw = await submitOracleRequest(`${base}/v1/b2b/calculate-batch`, {
    method: 'POST',
    body: JSON.stringify({ items: apiItems }),
  });

  if (raw && typeof raw === 'object' && 'error' in raw && raw.error === 'credits_exhausted') {
    return { success: false, results: [], error: 'credits_exhausted' };
  }

  if (!raw || typeof raw !== 'object' || !('success' in raw) || !raw.success) {
    const r = raw as { status?: number; statusText?: string; detail?: string };
    const msg = [r.status && `HTTP ${r.status}`, r.statusText, r.detail].filter(Boolean).join(' — ');
    return { success: false, results: [], error: msg || 'Batch pricing failed.' };
  }

  const data = raw.data as { results?: BatchPricingResultItem[] };
  return { success: true, results: data.results ?? [] };
}
