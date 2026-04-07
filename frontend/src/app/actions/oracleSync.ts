'use server'

export async function getSingleOraclePrice(payload: { player_name: string; card_set: string; insert_name?: string; parallel_name?: string }) {
  try {
    const apiKey = process.env.PLAYERINDEX_API_KEY || '';
    const response = await fetch('https://api.playerindexdata.com/fintech/api/v1/b2b/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Oracle single calculate error:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data?.projected_target || null;
  } catch (error) {
    console.error('Oracle single calculate failed:', error);
    return null;
  }
}

export async function getBatchOraclePrices(cards: any[]) {
  try {
    const apiKey = process.env.PLAYERINDEX_API_KEY || '';
    const response = await fetch('https://api.playerindexdata.com/fintech/api/v1/b2b/calculate-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ cards }),
    });

    if (!response.ok) {
      console.error('Oracle batch calculate error:', response.statusText);
      return cards.map(() => null); // Return nulls if failed
    }

    const data = await response.json();
    return data?.prices || cards.map(() => null);
  } catch (error) {
    console.error('Oracle batch calculate failed:', error);
    return cards.map(() => null);
  }
}
