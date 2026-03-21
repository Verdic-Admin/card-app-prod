"""
fix_years.py — Safe Year Replacement (2023/2024 → 2025)
---------------------------------------------------------
1. Walks C:\\Users\\quija\\Desktop\\Cards recursively, finds every image file
   whose name contains '2023' or '2024', and renames it replacing ONLY the
   year using a strict 4-digit boundary regex.
2. Reads priced_cards.csv and scanned_cards.csv, applies the same safe regex
   to the 'filename' column only, then overwrites each CSV.
"""

import re
import csv
import pathlib
import sys

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
CARDS_ROOT   = pathlib.Path(r"C:\Users\quija\Desktop\Cards")
CSV_FILES    = ["priced_cards.csv", "scanned_cards.csv"]  # update both
OLD_YEARS    = re.compile(r'\b(2023|2024)\b')             # word-boundary safe
NEW_YEAR     = "2025"

IMAGE_EXTS   = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def safe_replace(name: str) -> str:
    """Replace ONLY the year digits — nothing else in the string changes."""
    return OLD_YEARS.sub(NEW_YEAR, name)


def patch_csv(csv_path: str) -> None:
    """Update the 'filename' column in a CSV, rewrite in place."""
    p = pathlib.Path(csv_path)
    if not p.exists():
        print(f"  Skipping {csv_path} (not found)")
        return

    # Read everything into memory first, then close the file before writing
    with open(p, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    changed = 0
    for row in rows:
        old_fn = row.get("filename", "")
        new_fn = safe_replace(old_fn)
        if new_fn != old_fn:
            row["filename"] = new_fn
            changed += 1

    with open(p, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"  {csv_path}: {changed} filename(s) updated → saved.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if not CARDS_ROOT.is_dir():
        print(f"ERROR: Cards folder not found: {CARDS_ROOT}")
        sys.exit(1)

    # ------------------------------------------------------------------
    # Step 1 — Rename image files on disk
    # ------------------------------------------------------------------
    print(f"Step 1: Scanning '{CARDS_ROOT}' for year mismatches...\n")
    all_images = [
        f for f in CARDS_ROOT.rglob("*")
        if f.is_file() and f.suffix.lower() in IMAGE_EXTS
    ]

    renamed = 0
    skipped = 0
    for img in all_images:
        new_name = safe_replace(img.name)
        if new_name == img.name:
            skipped += 1
            continue

        dest = img.parent / new_name

        # Safety: don't clobber an existing file
        if dest.exists():
            print(f"  ⚠  Skipped (dest exists): {img.name} → {new_name}")
            skipped += 1
            continue

        img.rename(dest)
        print(f"  ✓ {img.name}  →  {new_name}")
        renamed += 1

    print(f"\n  Files renamed: {renamed}  |  Already correct / skipped: {skipped}\n")

    # ------------------------------------------------------------------
    # Step 2 — Patch CSV files
    # ------------------------------------------------------------------
    print("Step 2: Updating CSV filename columns...\n")
    for csv_file in CSV_FILES:
        patch_csv(csv_file)

    print("\n✅ Done! All years corrected.")


if __name__ == "__main__":
    main()
