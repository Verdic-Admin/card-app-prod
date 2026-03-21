import { NextResponse } from 'next/server'

let cachedOAuthToken: { token: string; expiresAt: number } | null = null;

async function getEbayOAuthToken() {
  if (cachedOAuthToken && Date.now() < cachedOAuthToken.expiresAt) {
    return cachedOAuthToken.token;
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('eBay API credentials missing from environment.');
  }

  const authStr = `${clientId}:${clientSecret}`;
  const b64Auth = Buffer.from(authStr).toString('base64');

  const url = "https://api.ebay.com/identity/v1/oauth2/token";
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${b64Auth}`
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope"
  });

  if (!response.ok) {
    throw new Error(`Failed to authenticate with eBay: ${await response.text()}`);
  }

  const data = await response.json();
  const expiresInMs = (data.expires_in || 7200) * 1000;
  
  cachedOAuthToken = {
    token: data.access_token,
    expiresAt: Date.now() + expiresInMs - 60000 // Buffer of 1 minute
  };

  return cachedOAuthToken.token;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    const token = await getEbayOAuthToken()
    const endpoint = "https://svcs.ebay.com/services/search/FindingService/v1"
    
    // Move all SOA configurations natively into the URL Query Params because Node fetch()
    // forcefully lowercases custom headers, which the legacy eBay SOA Router strictly rejects ("operation name not found")
    const url = new URL(endpoint)
    url.searchParams.set('OPERATION-NAME', 'findCompletedItems')
    url.searchParams.set('SERVICE-VERSION', '1.0.0')
    url.searchParams.set('SECURITY-IAFTOKEN', token)
    url.searchParams.set('GLOBAL-ID', 'EBAY-US')
    url.searchParams.set('RESPONSE-DATA-FORMAT', 'JSON')
    url.searchParams.set('REST-PAYLOAD', 'true')
    url.searchParams.set('keywords', query)
    url.searchParams.set('itemFilter(0).name', 'SoldItemsOnly')
    url.searchParams.set('itemFilter(0).value', 'true')
    url.searchParams.set('paginationInput.entriesPerPage', '10')

    const response = await fetch(url.toString())

    if (!response.ok) {
       throw new Error(`eBay API Error: ${await response.text()}`);
    }

    const data = await response.json()
    const prices: number[] = []

    try {
        const responses = data.findCompletedItemsResponse || []
        if (responses.length > 0) {
            const searchResult = responses[0].searchResult || []
            if (searchResult.length > 0) {
                const items = searchResult[0].item || []
                for (const item of items) {
                    const sellingStatus = item.sellingStatus || []
                    if (sellingStatus.length > 0) {
                        const currentPrice = sellingStatus[0].currentPrice || []
                        if (currentPrice.length > 0) {
                            const val = currentPrice[0].__value__
                            if (val) prices.push(parseFloat(val))
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error("Error parsing eBay response", e)
    }
    
    // Explicitly check for application level errors injected into the 200 JSON payload by eBay
    if (prices.length === 0 && data.errorMessage) {
        throw new Error(`eBay API Error: ${JSON.stringify(data.errorMessage)}`)
    }

    return NextResponse.json({ prices: prices.filter(p => !isNaN(p) && p > 0) })
    
  } catch (error: any) {
    console.error('eBay Comps Fetch Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
