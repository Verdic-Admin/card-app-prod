'use server'

const API_BASE_URL = process.env.API_BASE_URL || 'https://api.playerindexdata.com';

export async function submitOracleRequest(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  
  let apiKey = process.env.PLAYERINDEX_API_KEY;
  
  if (!apiKey) {
    try {
      const pool = (await import('@/utils/db')).default;
      const { rows } = await pool.query('SELECT playerindex_api_key FROM shop_config LIMIT 1');
      if (rows.length > 0) {
        apiKey = rows[0].playerindex_api_key;
      }
    } catch (e) {
      console.warn("Failed to retrieve fallback API key from database", e);
    }
  }

  if (!apiKey) {
    return {
      error: 'api_failed',
      status: 401,
      statusText: 'No Player Index API key configured (PLAYERINDEX_API_KEY or shop_config).',
    };
  }

  // Match fintech-api APIKeyHeader name (headers are case-insensitive; use canonical form).
  headers.set('X-Api-Key', apiKey);

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
  return await submitOracleRequest(`${API_BASE_URL}/fintech/v1/taxonomy/search?q=${encodeURIComponent(query)}`);
}

export async function submitBatchIngestAction(shopId: string, images: string[]) {
  return await submitOracleRequest(`${API_BASE_URL}/fintech/orchestrator/ingest/batch`, {
    method: 'POST',
    body: JSON.stringify({ shop_id: shopId, images })
  });
}

export async function checkBatchStatusAction(jobId: string) {
  return await submitOracleRequest(`${API_BASE_URL}/fintech/orchestrator/ingest/status/${jobId}`);
}
