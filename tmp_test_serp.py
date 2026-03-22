import os
import requests
import json
from dotenv import load_dotenv

load_dotenv("frontend/.env.local")

key = os.getenv("SERPAPI_KEY")
url = "https://serpapi.com/search.json"
params = {
    "engine": "ebay",
    "_nkw": "Shohei Ohtani Topps Chrome",
    "show_only": "Sold",
    "api_key": key
}

res = requests.get(url, params=params)
data = res.json()
organic = data.get("organic_results", [])
for item in organic[:3]:
    print(json.dumps(item.get("price", {}), indent=2))
    print(item.get("extracted_price"))
