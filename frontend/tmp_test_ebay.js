const https = require('https');
require('dotenv').config({ path: 'd:/card-app-prod/frontend/.env.local' });

async function getEbayOAuthToken() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const authStr = `${clientId}:${clientSecret}`;
  const b64Auth = Buffer.from(authStr).toString('base64');

  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: 'POST',
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${b64Auth}`
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope"
  });
  const data = await response.json();
  return data.access_token;
}

async function run() {
  const token = await getEbayOAuthToken();
  const url = new URL("https://svcs.ebay.com/services/search/FindingService/v1");
  url.searchParams.set('OPERATION-NAME', 'findCompletedItems');
  url.searchParams.set('SERVICE-VERSION', '1.0.0');
  url.searchParams.set('SECURITY-APPNAME', process.env.EBAY_CLIENT_ID);
  url.searchParams.set('RESPONSE-DATA-FORMAT', 'JSON');
  url.searchParams.set('REST-PAYLOAD', 'true');
  url.searchParams.set('keywords', 'Shohei Ohtani Topps Chrome');
  url.searchParams.set('itemFilter(0).name', 'SoldItemsOnly');
  url.searchParams.set('itemFilter(0).value', 'true');

  const res = await fetch(url.toString()); // No headers, just query
  const text = await res.text();
  console.log("Query Params (App Auth):", text.substring(0, 300));

  // Try Header strategy but with OAuth token
  const url2 = new URL("https://svcs.ebay.com/services/search/FindingService/v1");
  url2.searchParams.set('OPERATION-NAME', 'findCompletedItems');
  url2.searchParams.set('REST-PAYLOAD', 'true');
  url2.searchParams.set('keywords', 'Shohei Ohtani Topps Chrome');
  url2.searchParams.set('itemFilter(0).name', 'SoldItemsOnly');
  url2.searchParams.set('itemFilter(0).value', 'true');

  const res2 = await fetch(url2.toString(), {
      headers: {
          "X-EBAY-SOA-GLOBAL-ID": "EBAY-US",
          "X-EBAY-SOA-SECURITY-IAFTOKEN": token,
          "X-EBAY-SOA-RESPONSE-DATA-FORMAT": "JSON",
      }
  });
  console.log("Query + Header (OAuth):", (await res2.text()).substring(0, 300));
}
run();
