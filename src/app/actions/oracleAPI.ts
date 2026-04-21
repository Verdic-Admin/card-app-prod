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
  return await submitOracleRequest(`${API_BASE_URL}/fintech/v1/taxonomy/search?q=${encodeURIComponent(query)}`);
}

export async function calculatePricingAction(fields: {
  player_name: string;
  card_set: string;
  insert_name?: string;
  parallel_name?: string;
  card_number?: string;
}) {
  return await submitOracleRequest(`${API_BASE_URL}/fintech/api/v1/calculate`, {
    method: 'POST',
    body: JSON.stringify({
      player_name: fields.player_name,
      card_set: fields.card_set,
      insert_name: fields.insert_name || 'Base',
      parallel_name: fields.parallel_name || 'Base',
      card_number: fields.card_number || '',
      skip_fuzzy: false,
    }),
  });
}
