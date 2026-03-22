"""
price_fetcher.py — eBay Sold Price Fetcher using SerpApi
-------------------------------------------------------
Reads scanned_cards.csv, queries eBay sold listings via SerpApi
for each card, computes High / Low / Average sold prices from 
actual historical transactions, and writes enriched rows 
to priced_cards.csv progressively.
"""

import csv
import os
import sys
import pathlib
import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
load_dotenv(".env")
load_dotenv("frontend/.env.local")

SERPAPI_KEY = os.getenv("SERPAPI_KEY")

if not SERPAPI_KEY:
    print("ERROR: SERPAPI_KEY not found. Check your environment variables.")
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

def compute_pricing(prices: list[float]) -> tuple[float, float, float]:
    """Return (high, low, avg). Returns (0, 0, 0) if no prices found."""
    if not prices:
        return 0.0, 0.0, 0.0
    high = max(prices)
    low  = min(prices)
    avg  = round((high + low) / 2, 2)
    return high, low, avg

# ---------------------------------------------------------------------------
# SerpApi query
# ---------------------------------------------------------------------------

def fetch_ebay_prices(query: str) -> tuple[float, float, float]:
    """
    Run the SerpApi eBay search to fetch sold items and return (high, low, avg) prices.
    Uses show_only='Sold' to guarantee historical sale completions.
    """
    url = "https://serpapi.com/search.json"
    params = {
        "engine": "ebay",
        "_nkw": query,
        "show_only": "Sold",
        "api_key": SERPAPI_KEY
    }
    
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    data = resp.json()
    
    prices = []
    organic_results = data.get("organic_results", [])
    
    for item in organic_results[:MAX_ITEMS]:
        price_dict = item.get("price", {})
        extracted = price_dict.get("extracted")
        if extracted is not None:
            try:
                prices.append(float(extracted))
            except ValueError:
                pass

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
