"""
physical_rename_only.py — Safe Year Fix for Physical Image Files
-----------------------------------------------------------------
ONLY changes '2023' or '2024' to '2025' in the filename.
Everything else (Player, Team, Set, extension) stays untouched.
CSV files are never touched.
"""

import os
import pathlib

# ---------------------------------------------------------------------------
# Config — point this at your cards folder
# ---------------------------------------------------------------------------
TARGET_DIR = pathlib.Path(r"C:\Users\quija\Desktop\Cards")
IMAGE_EXTS = {".jpg", ".jpeg", ".png"}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def fix_year(name: str) -> str:
    """Replace only '2023' or '2024' with '2025'. Nothing else changes."""
    name = name.replace("2024", "2025")
    name = name.replace("2023", "2025")
    return name


def main():
    if not TARGET_DIR.is_dir():
        print(f"ERROR: Directory not found: {TARGET_DIR}")
        return

    print(f"Scanning: {TARGET_DIR}\n")
    renamed = 0
    skipped = 0

    # rglob walks every subfolder recursively
    for img in sorted(TARGET_DIR.rglob("*")):
        if not img.is_file() or img.suffix.lower() not in IMAGE_EXTS:
            continue

        old_name = img.name
        new_name = fix_year(old_name)

        if new_name == old_name:
            skipped += 1
            continue

        new_path = img.parent / new_name

        # Safety: never clobber an existing file
        if new_path.exists():
            print(f"⚠  SKIPPED (dest exists): {old_name}")
            skipped += 1
            continue

        os.rename(img, new_path)
        print(f"✓  OLD: {old_name}")
        print(f"   NEW: {new_name}\n")
        renamed += 1

    print(f"─────────────────────────────────")
    print(f"  Renamed : {renamed}")
    print(f"  Skipped : {skipped} (already correct or dest conflict)")
    print(f"  Done ✅")


if __name__ == "__main__":
    main()
