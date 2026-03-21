"""
Diagnostic: inspect the exact JSON shape returned by the eBay sold items actor.
Run: venv\Scripts\python inspect_actor.py
"""
import json, os
from dotenv import load_dotenv
from apify_client import ApifyClient

load_dotenv()
client = ApifyClient(os.getenv("APIFY_API_TOKEN"))

# Try different known input key variations
test_inputs = [
    {"searchQuery": "2023 Topps Mike Trout Angels", "maxItems": 2},
    {"keyword":     "2023 Topps Mike Trout Angels", "maxItems": 2},
    {"query":       "2023 Topps Mike Trout Angels", "maxItems": 2},
]

for inp in test_inputs:
    key = list(inp.keys())[0]
    print(f"\n--- Trying input key: '{key}' ---")
    try:
        run = client.actor("consummate_mandala/ebay-sold-items-scraper").call(run_input=inp)
        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
        print(f"Items: {len(items)}")
        if items:
            first = items[0]
            # Check if fallback
            if first.get("_fallback"):
                print(f"  FALLBACK — message: {first.get('message','')}")
            else:
                print(f"  REAL ITEM — keys: {list(first.keys())}")
                print(json.dumps(first, indent=2, default=str))
            break
        else:
            print("  No items returned.")
    except Exception as e:
        print(f"  Error: {e}")
