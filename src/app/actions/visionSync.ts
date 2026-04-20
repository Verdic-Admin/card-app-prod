"use server";

import pool from '@/utils/db';

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.playerindexdata.com';

async function getApiKey(): Promise<string> {
  if (process.env.PLAYERINDEX_API_KEY) return process.env.PLAYERINDEX_API_KEY;
  try {
    const { rows } = await pool.query('SELECT playerindex_api_key FROM shop_config LIMIT 1');
    if (rows.length > 0 && rows[0].playerindex_api_key) return rows[0].playerindex_api_key;
  } catch (e) {
    console.warn('Failed to retrieve API key from database:', e);
  }
  return '';
}

export async function uploadImagesToScanner(formData: FormData) {
  const apiKey = await getApiKey();
  const response = await fetch(`${API_BASE_URL}/scan/scanner/upload`, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey },
    body: formData,
  });

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
  const apiKey = await getApiKey();
  const response = await fetch(`${API_BASE_URL}/scan/scanner/result/${jobId}`, {
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
  const apiKey = await getApiKey();
  const response = await fetch(`${API_BASE_URL}/fintech/orchestrator/process-asset`, {
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

export async function identifyCardPair(payload: { queue_id: string; side_a_url: string; side_b_url: string }) {
  const apiKey = await getApiKey();
  const response = await fetch(`${API_BASE_URL}/identify/identify/card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Identity API failed: ${response.statusText}`);
  }

  return await response.json();
}
