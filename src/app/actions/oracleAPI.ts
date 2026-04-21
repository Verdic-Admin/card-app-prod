'use server'

import { getOracleGatewayBaseUrl } from '@/lib/oracle-gateway-url';
import { getShopOracleApiKey } from '@/lib/shop-oracle-credentials';

export async function submitOracleRequest(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});

  const apiKey = await getShopOracleApiKey();

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

  const response = await fetch(url, {
    ...options,
    headers,
  });

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
  const base = await getOracleGatewayBaseUrl();
  return await submitOracleRequest(`${base}/v1/taxonomy/search?q=${encodeURIComponent(query)}`);
}

export async function calculatePricingAction(fields: {
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
}) {
  const base = await getOracleGatewayBaseUrl();
  const raw = await submitOracleRequest(`${base}/v1/calculate`, {
    method: 'POST',
    body: JSON.stringify({
      player_name: fields.player_name,
      card_set: fields.card_set,
      insert_name: fields.insert_name || 'Base',
      parallel_name: fields.parallel_name || 'Base',
      card_number: fields.card_number || '',
      print_run: fields.print_run ?? null,
      is_rookie: fields.is_rookie ?? false,
      is_auto: fields.is_auto ?? false,
      is_relic: fields.is_relic ?? false,
      grade: fields.grade || null,
      skip_fuzzy: false,
    }),
  });

  if (!raw || typeof raw !== 'object' || !('success' in raw) || !raw.success) {
    return raw;
  }

  const d = raw.data as Record<string, unknown>;
  // Engine returns DerivativeResponse { target_price }; B2B uses projected_target.
  const target = Number(d.target_price ?? d.projected_target ?? 0);
  return {
    success: true,
    data: { ...d, projected_target: target, target_price: d.target_price ?? target },
  };
}
