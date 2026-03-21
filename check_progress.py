import csv, json
from dotenv import load_dotenv; import os; load_dotenv()
from apify_client import ApifyClient

# --- Check priced_cards.csv progress ---
rows = list(csv.DictReader(open("priced_cards.csv", encoding="utf-8")))
print(f"\n=== priced_cards.csv: {len(rows)} rows written so far ===")
for r in rows[-10:]:
    print(f"  {r['player_name']:<30} High=${r['high_price']}  Low=${r['low_price']}  Avg=${r['avg_price']}")

# --- Inspect live item schema from actor ---
print("\n=== Live schema check: '2023 Topps Mike Trout Angels' ===")
client = ApifyClient(os.getenv("APIFY_API_TOKEN"))
run = client.actor("consummate_mandala/ebay-sold-items-scraper").call(
    run_input={"query": "2023 Topps Mike Trout Angels", "maxItems": 2}
)
items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
print(f"Items returned: {len(items)}")
if items:
    print("Keys:", list(items[0].keys()))
    print("Full item[0]:", json.dumps(items[0], indent=2, default=str))
