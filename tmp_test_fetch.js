const fs = require('fs');
const envFile = fs.readFileSync('frontend/.env.local', 'utf8');
const key = envFile.split('SERPAPI_KEY=')[1].split('\n')[0].trim();

const url = new URL("https://serpapi.com/search.json");
url.searchParams.set('engine', 'ebay');
url.searchParams.set('_nkw', "Mike Trout Topps Chrome 2021");
url.searchParams.set('show_only', 'Sold');
url.searchParams.set('api_key', key);

fetch(url.toString())
  .then(r => r.json())
  .then(data => {
      const prices = [];
      const organicResults = data.organic_results || [];
      const topResults = organicResults.slice(0, 10);
      for (const item of topResults) {
          if (item.price && item.price.extracted !== undefined) {
              const val = parseFloat(item.price.extracted);
              if (!isNaN(val) && val > 0) {
                  prices.push(val);
              }
          }
      }
      console.log("Success! Prices parsed:", prices);
      process.exit(0);
  })
  .catch(err => {
      console.error(err);
      process.exit(1);
  });
