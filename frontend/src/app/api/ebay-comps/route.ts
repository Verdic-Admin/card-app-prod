import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    const apiKey = process.env.SERPAPI_KEY
    if (!apiKey) {
      throw new Error('SerpApi credentials missing from environment.')
    }

    const url = new URL("https://serpapi.com/search.json")
    url.searchParams.set('engine', 'ebay')
    url.searchParams.set('_nkw', query)
    url.searchParams.set('show_only', 'Sold')
    url.searchParams.set('api_key', apiKey)

    const response = await fetch(url.toString())

    if (!response.ok) {
       throw new Error(`SerpApi Error: ${await response.text()}`);
    }

    const data = await response.json()
    const prices: number[] = []

    const organicResults = data.organic_results || []
    
    // Only take top 10 items simulating old paginationInput.entriesPerPage=10
    const topResults = organicResults.slice(0, 10)
    
    for (const item of topResults) {
        if (item.price && item.price.extracted) {
            const val = parseFloat(item.price.extracted)
            if (!isNaN(val) && val > 0) {
                prices.push(val)
            }
        }
    }
    
    // Explicitly check for application level errors
    if (data.error) {
        throw new Error(`SerpApi Error: ${JSON.stringify(data.error)}`)
    }

    return NextResponse.json({ prices })
    
  } catch (error: any) {
    console.error('eBay Comps Fetch Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
