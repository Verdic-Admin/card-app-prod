"use server";

import { getOracleGatewayBaseUrl } from '@/lib/oracle-gateway-url';
import { getShopOracleApiKey } from '@/lib/shop-oracle-credentials';

export async function uploadImagesToScanner(formData: FormData) {
  const apiKey = await getShopOracleApiKey();
  const base = await getOracleGatewayBaseUrl();
  const response = await fetch(`${base}/scan/upload`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body: formData,
  });

  if (response.status === 402) {
    throw new Error('credits_exhausted');
  }
  if (!response.ok) {
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

// Normalised flat shape returned by both identify helpers
export interface IdentifyCardResult {
  status: string;
  confidence: number;
  player_name: string | null;
  card_set: string | null;
  card_number: string | null;
  insert_name: string | null;
  parallel_name: string | null; // mapped from card_details.parallel_type
  team_name: string | null;     // catalog-hit only; null for vector/vision paths
  print_run: number | null;
}

function normalizeIdentifyResponse(raw: any): IdentifyCardResult {
  const cd = raw?.card_details ?? {};
  return {
    status:       raw?.status        ?? 'unknown',
    confidence:   raw?.confidence    ?? 0,
    player_name:  cd.player_name     ?? null,
    card_set:     cd.card_set        ?? null,
    card_number:  cd.card_number     ?? null,
    insert_name:  cd.insert_name     ?? null,
    parallel_name: cd.parallel_type  ?? null,
    team_name:    cd.team_name       ?? null,
    print_run:    null, // always user-input; AI value intentionally ignored
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
