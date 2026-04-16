'use server'

export async function submitOracleRequest(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  
  // Attach API Key Securely on Server-side only
  const apiKey = process.env.PLAYERINDEX_API_KEY;
  if (apiKey) {
    headers.set("X-API-KEY", apiKey);
  }

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
    return { error: 'api_failed', status: response.status, statusText: response.statusText };
  }

  const data = await response.json();
  return { success: true, data };
}

export async function searchTaxonomyAction(query: string) {
  const baseUrl = process.env.FINTECH_API_URL || 'http://localhost:8000/fintech';
  return await submitOracleRequest(`${baseUrl}/v1/taxonomy/search?q=${encodeURIComponent(query)}`);
}

export async function submitBatchIngestAction(shopId: string, images: string[]) {
  const endpoint = process.env.BATCH_ENDPOINT || 'http://localhost:8000/fintech/orchestrator/ingest/batch';
  return await submitOracleRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({ shop_id: shopId, images })
  });
}

export async function checkBatchStatusAction(jobId: string) {
  const endpoint = process.env.STATUS_ENDPOINT || `http://localhost:8000/fintech/orchestrator/ingest/status/${jobId}`;
  return await submitOracleRequest(endpoint);
}
