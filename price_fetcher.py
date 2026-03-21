"""
price_fetcher.py — eBay Sold Price Fetcher using Official eBay API
-------------------------------------------------------
Reads scanned_cards.csv, queries eBay sold listings via the official
eBay Finding API (findCompletedItems) for each card, computes 
High / Low / Average sold prices from actual historical transactions, 
and writes enriched rows to priced_cards.csv progressively.
"""

import csv
import os
import sys
import pathlib
import base64
import requests

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
load_dotenv(".env.local")

EBAY_CLIENT_ID = os.getenv("EBAY_CLIENT_ID")
EBAY_CLIENT_SECRET = os.getenv("EBAY_CLIENT_SECRET")

if not EBAY_CLIENT_ID or not EBAY_CLIENT_SECRET:
    print("ERROR: EBAY_CLIENT_ID or EBAY_CLIENT_SECRET not found. Check your .env.local file.")
    sys.exit(1)

INPUT_CSV    = "scanned_cards.csv"
OUTPUT_CSV   = "priced_cards.csv"
MAX_ITEMS    = 5

INPUT_HEADERS = [
    "filename", "subfolder", "player_name", "team_name",
    "card_set", "parallel_insert_type", "raw_response",
]

OUTPUT_HEADERS = INPUT_HEADERS + ["high_price", "low_price", "avg_price"]

# ---------------------------------------------------------------------------
# eBay OAuth Authentication (Cached)
# ---------------------------------------------------------------------------
_OAUTH_TOKEN = None

def get_ebay_oauth_token() -> str:
    """
    Exchange Client ID and Secret for an Application Access Token via Client Credentials grant flow.
    Crucial: Caches the token in memory so we only authenticate once per script run.
    """
    global _OAUTH_TOKEN
    if _OAUTH_TOKEN:
        return _OAUTH_TOKEN

    auth_str = f"{EBAY_CLIENT_ID}:{EBAY_CLIENT_SECRET}"
    b64_auth = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")

    url = "https://api.ebay.com/identity/v1/oauth2/token"
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {b64_auth}"
    }
    data = {
        "grant_type": "client_credentials",
        "scope": "https://api.ebay.com/oauth/api_scope"
    }

    print("Fetching eBay OAuth 2.0 Application Access Token...")
    resp = requests.post(url, headers=headers, data=data)
    resp.raise_for_status()
    
    _OAUTH_TOKEN = resp.json().get("access_token")
    return _OAUTH_TOKEN

# ---------------------------------------------------------------------------
# CSV helpers
# ---------------------------------------------------------------------------

def load_input_csv(path: str) -> list[dict]:
    p = pathlib.Path(path)
    if not p.exists():
        print(f"ERROR: '{path}' not found. Run scan_cards.py first.")
        sys.exit(1)
    with open(p, "r", newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_completed_filenames(path: str) -> set[str]:
    """Return set of filenames already written to the output CSV."""
    p = pathlib.Path(path)
    if not p.exists():
        return set()
    with open(p, "r", newline="", encoding="utf-8") as f:
        return {row["filename"] for row in csv.DictReader(f) if row.get("filename")}


def init_output_csv(path: str) -> None:
    """Write header row only if the file is brand-new."""
    if not pathlib.Path(path).exists():
        with open(path, "w", newline="", encoding="utf-8") as f:
            csv.DictWriter(f, fieldnames=OUTPUT_HEADERS).writeheader()
        print(f"Created: {path}")


def append_row(path: str, row: dict) -> None:
    with open(path, "a", newline="", encoding="utf-8") as f:
        csv.DictWriter(f, fieldnames=OUTPUT_HEADERS).writerow(row)

# ---------------------------------------------------------------------------
# Search string builder
# ---------------------------------------------------------------------------

def build_search_query(row: dict) -> str:
    """
    Best-effort: extract a 4-digit year from card_set, then compose
    '{Year} {Player} {Team} {Set}' — or omit year if not found.
    """
    import re
    card_set   = row.get("card_set", "Unknown")
    player     = row.get("player_name", "Unknown")
    team       = row.get("team_name", "Unknown")

    year_match = re.search(r'\b(19|20)\d{2}\b', card_set)
    year       = year_match.group(0) if year_match else ""

    parts = [p for p in [year, player, team, card_set] if p and p != "Unknown"]
    return " ".join(parts)

# ---------------------------------------------------------------------------
# Pricing logic
# ---------------------------------------------------------------------------

def extract_prices(data: dict) -> list[float]:
    """
    Navigate the official eBay Finding API JSON response to extract the final sale prices.
    """
    prices = []
    try:
        responses = data.get("findCompletedItemsResponse", [])
        if not responses:
            return prices

        search_result = responses[0].get("searchResult", [])
        if not search_result:
            return prices

        items = search_result[0].get("item", [])
        for item in items:
            selling_status = item.get("sellingStatus", [])
            if selling_status:
                current_price = selling_status[0].get("currentPrice", [])
                if current_price:
                    val = current_price[0].get("__value__")
                    if val:
                        prices.append(float(val))
    except (IndexError, TypeError, ValueError):
        pass

    return [p for p in prices if p > 0]


def compute_pricing(prices: list[float]) -> tuple[float, float, float]:
    """Return (high, low, avg). Returns (0, 0, 0) if no prices found."""
    if not prices:
        return 0.0, 0.0, 0.0
    high = max(prices)
    low  = min(prices)
    avg  = round((high + low) / 2, 2)
    return high, low, avg

# ---------------------------------------------------------------------------
# eBay query
# ---------------------------------------------------------------------------

def fetch_ebay_prices(query: str) -> tuple[float, float, float]:
    """
    Run the official eBay findCompletedItems API and return (high, low, avg) prices.
    Uses SoldItemsOnly=true to guarantee historical sale completions.
    """
    token = get_ebay_oauth_token()
    
    url = "https://svcs.ebay.com/services/search/FindingService/v1"
    
    headers = {
        "X-EBAY-SOA-GLOBAL-ID": "EBAY-US",
        "X-EBAY-SOA-OPERATION-NAME": "findCompletedItems",
        "X-EBAY-SOA-SECURITY-IAFTOKEN": token,
        "X-EBAY-SOA-RESPONSE-DATA-FORMAT": "JSON",
    }
    
    params = {
        "keywords": query,
        "itemFilter(0).name": "SoldItemsOnly",
        "itemFilter(0).value": "true",
        "paginationInput.entriesPerPage": MAX_ITEMS,
    }
    
    resp = requests.get(url, headers=headers, params=params)
    resp.raise_for_status()
    
    prices = extract_prices(resp.json())
    return compute_pricing(prices)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    rows = load_input_csv(INPUT_CSV)
    completed = load_completed_filenames(OUTPUT_CSV)
    init_output_csv(OUTPUT_CSV)

    remaining = [r for r in rows if r.get("filename") not in completed]
    total     = len(rows)
    skipped   = total - len(remaining)

    print(f"Loaded {total} card(s) from {INPUT_CSV}.")
    print(f"Already priced: {skipped}  |  To process: {len(remaining)}\n")

    if not remaining:
        print("✅ All cards are already priced.")
        return

    success, errors = 0, 0

    for idx, row in enumerate(remaining, start=1):
        query = build_search_query(row)
        label = f"[{idx + skipped}/{total}]"
        print(f"{label} {row.get('player_name', '?')} | Query: \"{query}\" ...", end=" ", flush=True)

        high = low = avg = 0.0
        try:
            high, low, avg = fetch_ebay_prices(query)
            print(f"High=${high:.2f}  Low=${low:.2f}  Avg=${avg:.2f}")
            success += 1
        except Exception as exc:
            print(f"✗ Error: {exc}")
            errors += 1

        out_row = {**row, "high_price": high, "low_price": low, "avg_price": avg}
        append_row(OUTPUT_CSV, out_row)

    print(f"\n✅ Done!  Priced: {success}  |  Errors: {errors}")
    print(f"Results saved to: {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
