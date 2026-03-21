"""
scan_cards.py — Baseball Card Scanner using Google Gemini API (Concurrent / Paid Tier)
---------------------------------------------------------------------------------------
Phase 1  : Read existing scanned_cards.csv, rename every tracked file on disk
           to a sanitized name, and rewrite the CSV with updated paths.
Phase 2  : Build a 'skip set' from the updated CSV filenames so we never
           re-process an already-scanned card.
Phase 3  : Scan all new/unprocessed images using a ThreadPoolExecutor
           (max_workers=10) for maximum throughput. A threading.Lock guards
           every CSV write so concurrent threads can't corrupt the file.
"""

import os
import re
import csv
import json
import pathlib
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

from dotenv import load_dotenv
from google import genai
from google.genai import types

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    print("ERROR: GEMINI_API_KEY not found. Check your .env file.")
    sys.exit(1)

MODEL_ID        = "gemini-2.5-flash"
OUTPUT_CSV      = "scanned_cards.csv"
MAX_WORKERS     = 10   # concurrent API calls

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}

CSV_HEADERS = [
    "filename",
    "subfolder",
    "player_name",
    "team_name",
    "card_set",
    "parallel_insert_type",
    "raw_response",
]

PROMPT = """
You are an expert baseball card analyst. Examine this baseball card image carefully and extract the following details.

Return ONLY a valid JSON object with exactly these keys (no markdown, no code fences, just raw JSON):
{
  "player_name": "Full name of the player on the card, or 'Unknown' if not visible",
  "team_name": "Name of the MLB team, or 'Unknown' if not visible",
  "card_set": "The card set or product name (e.g. '2023 Topps Series 1'), or 'Unknown' if not visible",
  "parallel_insert_type": "Parallel or insert type (e.g. 'Gold Refractor', 'Base', 'Chrome'), or 'Base' if it appears to be a standard base card"
}
""".strip()

# ---------------------------------------------------------------------------
# Filename Sanitization
# ---------------------------------------------------------------------------

def sanitize_name(text: str) -> str:
    """Strip illegal OS filename characters and normalise whitespace."""
    cleaned = re.sub(r'[\\/:*?"<>|]', '', text)
    cleaned = re.sub(r'\s+', '_', cleaned.strip())
    cleaned = cleaned.strip("._")
    return cleaned or "Unknown"


def build_new_filename(player: str, team: str, card_set: str,
                       ext: str, dest_dir: pathlib.Path) -> pathlib.Path:
    """
    Build a sanitized filename: Player_Name-Team-Set.jpg
    Appends _1, _2, … if a collision exists in dest_dir.
    """
    base = f"{sanitize_name(player)}-{sanitize_name(team)}-{sanitize_name(card_set)}"
    candidate = dest_dir / f"{base}{ext}"
    counter = 1
    while candidate.exists():
        candidate = dest_dir / f"{base}_{counter}{ext}"
        counter += 1
    return candidate

# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

def get_image_files(folder: str) -> list[pathlib.Path]:
    """Recursively collect all supported image files under folder."""
    p = pathlib.Path(folder)
    if not p.is_dir():
        print(f"ERROR: '{folder}' is not a valid directory.")
        sys.exit(1)
    return sorted(
        f for f in p.rglob("*")
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
    )

# ---------------------------------------------------------------------------
# CSV helpers
# ---------------------------------------------------------------------------

def load_csv(path: str) -> list[dict]:
    p = pathlib.Path(path)
    if not p.exists():
        return []
    with open(p, "r", newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_csv(path: str, rows: list[dict]) -> None:
    """Overwrite the CSV (called only in Phase 1 / single-threaded context)."""
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        writer.writeheader()
        writer.writerows(rows)


def init_csv_if_missing(path: str) -> None:
    if not pathlib.Path(path).exists():
        with open(path, "w", newline="", encoding="utf-8") as f:
            csv.DictWriter(f, fieldnames=CSV_HEADERS).writeheader()
        print(f"Created new CSV: {path}")

# ---------------------------------------------------------------------------
# Thread-safe CSV writer
# ---------------------------------------------------------------------------

class LockedCSVWriter:
    """Wraps a CSV file in append mode behind a threading.Lock."""

    def __init__(self, path: str):
        self._path = path
        self._lock = threading.Lock()

    def append(self, row: dict) -> None:
        with self._lock:
            with open(self._path, "a", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
                writer.writerow(row)

# ---------------------------------------------------------------------------
# Gemini API
# ---------------------------------------------------------------------------

def parse_gemini_response(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    return json.loads(cleaned)


def scan_image(client: genai.Client, image_path: pathlib.Path) -> dict:
    """Send a single image to Gemini; returns card-data dict."""
    mime_map = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png",  ".webp": "image/webp",
        ".gif": "image/gif",  ".bmp": "image/bmp",
    }
    mime_type = mime_map.get(image_path.suffix.lower(), "image/jpeg")

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    response = client.models.generate_content(
        model=MODEL_ID,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            types.Part.from_text(text=PROMPT),
        ],
    )

    raw_text = response.text
    try:
        card_data = parse_gemini_response(raw_text)
    except (json.JSONDecodeError, IndexError, KeyError) as exc:
        print(f"  ⚠  JSON parse error ({image_path.name}): {exc}")
        card_data = {
            "player_name": "PARSE_ERROR", "team_name": "PARSE_ERROR",
            "card_set": "PARSE_ERROR",    "parallel_insert_type": "PARSE_ERROR",
        }

    return {
        "player_name":        card_data.get("player_name", "Unknown"),
        "team_name":          card_data.get("team_name", "Unknown"),
        "card_set":           card_data.get("card_set", "Unknown"),
        "parallel_insert_type": card_data.get("parallel_insert_type", "Unknown"),
        "raw_response":       raw_text.replace("\n", " ").strip(),
    }

# ---------------------------------------------------------------------------
# Phase 1 — Retroactive renaming
# ---------------------------------------------------------------------------

def phase1_retroactive_rename(existing_rows: list[dict],
                               root_path: pathlib.Path) -> list[dict]:
    if not existing_rows:
        print("Phase 1: No existing rows — skipping retroactive rename.\n")
        return existing_rows

    print(f"Phase 1: Retroactively renaming {len(existing_rows)} tracked file(s)...")
    updated_rows, renamed, missing = [], 0, 0

    for row in existing_rows:
        sub = row.get("subfolder", ".")
        fname = row.get("filename", "")
        original = root_path / sub / fname if sub != "." else root_path / fname

        if not original.exists():
            print(f"  ⚠  Not found on disk: {original}")
            missing += 1
            updated_rows.append(row)
            continue

        new_path = build_new_filename(
            player=row.get("player_name", "Unknown"),
            team=row.get("team_name", "Unknown"),
            card_set=row.get("card_set", "Unknown"),
            ext=original.suffix.lower(),
            dest_dir=original.parent,
        )

        if original != new_path:
            original.rename(new_path)
            renamed += 1

        new_sub = str(new_path.parent.relative_to(root_path)) if new_path.parent != root_path else "."
        updated_row = dict(row)
        updated_row["filename"] = new_path.name
        updated_row["subfolder"] = new_sub
        updated_rows.append(updated_row)

    print(f"  ✓ Renamed: {renamed}  |  Not found / skipped: {missing}\n")
    return updated_rows

# ---------------------------------------------------------------------------
# Phase 3 worker — called by each thread
# ---------------------------------------------------------------------------

def process_one(
    index: int,
    total: int,
    image_path: pathlib.Path,
    root_path: pathlib.Path,
    client: genai.Client,
    csv_writer: LockedCSVWriter,
    rename_lock: threading.Lock,
) -> bool:
    """Scan one image, rename it, and append to CSV. Returns True on success."""
    rel_sub = str(image_path.parent.relative_to(root_path)) if image_path.parent != root_path else "."

    print(f"[{index}/{total}] {rel_sub}\\{image_path.name} ...", flush=True)

    try:
        card_data = scan_image(client, image_path)

        # Rename file — lock so two threads don't race on the same dest name
        with rename_lock:
            new_path = build_new_filename(
                player=card_data["player_name"],
                team=card_data["team_name"],
                card_set=card_data["card_set"],
                ext=image_path.suffix.lower(),
                dest_dir=image_path.parent,
            )
            if image_path.exists() and image_path != new_path:
                image_path.rename(new_path)
            elif not image_path.exists():
                # Another thread may have already renamed this file (edge case)
                new_path = image_path

        new_rel_sub = str(new_path.parent.relative_to(root_path)) if new_path.parent != root_path else "."

        row = {
            "filename":            new_path.name,
            "subfolder":           new_rel_sub,
            **card_data,
        }
        csv_writer.append(row)
        print(f"  ✓ [{index}/{total}] → {new_path.name}", flush=True)
        return True

    except Exception as exc:
        print(f"  ✗ [{index}/{total}] Error ({image_path.name}): {exc}", flush=True)
        csv_writer.append({
            "filename":            image_path.name,
            "subfolder":           rel_sub,
            "player_name":         "ERROR",
            "team_name":           "ERROR",
            "card_set":            "ERROR",
            "parallel_insert_type":"ERROR",
            "raw_response":        str(exc),
        })
        return False

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print("Usage: python scan_cards.py <path-to-image-folder>")
        sys.exit(1)

    folder    = sys.argv[1]
    root_path = pathlib.Path(folder).resolve()

    if not root_path.is_dir():
        print(f"ERROR: '{folder}' is not a valid directory.")
        sys.exit(1)

    # ------------------------------------------------------------------
    # Phase 1 — Retroactive renaming (single-threaded, safe)
    # ------------------------------------------------------------------
    existing_rows = load_csv(OUTPUT_CSV)
    existing_rows = phase1_retroactive_rename(existing_rows, root_path)
    init_csv_if_missing(OUTPUT_CSV)
    write_csv(OUTPUT_CSV, existing_rows)
    print(f"CSV rewritten with updated filenames ({len(existing_rows)} row(s)).\n")

    # ------------------------------------------------------------------
    # Phase 2 — Build skip set
    # ------------------------------------------------------------------
    processed: set[tuple[str, str]] = {
        (row.get("subfolder", "."), row.get("filename", ""))
        for row in existing_rows
    }
    print(f"Phase 2: {len(processed)} file(s) already processed — will skip.\n")

    # ------------------------------------------------------------------
    # Phase 3 — Concurrent scanning
    # ------------------------------------------------------------------
    all_images = get_image_files(folder)
    new_images = [
        img for img in all_images
        if (str(img.parent.relative_to(root_path)) if img.parent != root_path else ".", img.name)
        not in processed
    ]

    if not new_images:
        print("✅ All images are already processed. Nothing new to scan.")
        return

    total = len(new_images)
    print(f"Phase 3: {total} new image(s) — scanning with {MAX_WORKERS} concurrent workers.\n")

    client      = genai.Client(api_key=API_KEY)
    csv_writer  = LockedCSVWriter(OUTPUT_CSV)
    rename_lock = threading.Lock()

    success_count = 0
    error_count   = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(
                process_one,
                idx, total, img, root_path, client, csv_writer, rename_lock
            ): img
            for idx, img in enumerate(new_images, start=1)
        }

        for future in as_completed(futures):
            ok = future.result()   # propagate exceptions if any slipped through
            if ok:
                success_count += 1
            else:
                error_count += 1

    print(f"\n✅ Done!  Scanned: {success_count}  |  Errors: {error_count}")
    print(f"Results saved to: {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
