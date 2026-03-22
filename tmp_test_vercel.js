require('dotenv').config({ path: 'frontend/.env.local' });

async function testFetch() {
  const query = "Shohei Ohtani Topps Chrome";
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    console.error('SerpApi credentials missing from environment.');
    return;
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set('engine', 'ebay');
  url.searchParams.set('_nkw', query);
  url.searchParams.set('show_only', 'Sold');
  url.searchParams.set('api_key', apiKey);

  console.log("Fetching url:", url.toString().replace(apiKey, "HIDDEN"));

  const response = await fetch(url.toString());

  if (!response.ok) {
     console.error(`SerpApi Error: ${await response.text()}`);
     return;
  }

  const data = await response.json();
  const prices = [];

  const organicResults = data.organic_results || [];
  const topResults = organicResults.slice(0, 10);
  
  for (const item of topResults) {
      if (item.price && item.price.extracted !== undefined) {
          const val = parseFloat(item.price.extracted);
          if (!isNaN(val) && val > 0) {
              prices.push(val);
          }
      } else {
        console.log("Item missing price.extracted:", JSON.stringify(item.price))
      }
  }
  
  if (data.error) {
      console.error(`SerpApi Application Error: ${JSON.stringify(data.error)}`);
      return;
  }

  console.log("Extracted prices array:", prices);
}

testFetch().catch(console.error);
