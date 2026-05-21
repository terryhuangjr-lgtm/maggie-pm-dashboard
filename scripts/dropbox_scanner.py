"""
Dropbox Scanner for MH Group.

This script scans Maggie's existing Dropbox for files related to MH Group properties,
identifies which property each file belongs to, and moves them into the organized
folder structure under /Apps/MH Group PM/MH Group/.

It uses fuzzy matching based on:
- Address matching (street names, numbers, unit numbers)
- Tenant name matching (from leases)
- File name patterns (addresses, dates, tenant names)

Usage:
    python3 scripts/dropbox_scanner.py [--dry-run]

Options:
    --dry-run    Report what would be moved without actually moving anything
    --scan-all   Scan the entire Dropbox (not just /Apps/MH Group PM/)
                 NOTE: Requires "Full Dropbox" app permissions
"""

import json
import subprocess
import sys
import re
import argparse
from datetime import datetime

DROPBOX_API = "https://api.dropboxapi.com/2"
CONTENT_API = "https://content.dropboxapi.com/2"
DROPBOX_ROOT = "/Apps/MH Group PM/MH Group"


def get_token():
    result = subprocess.run(
        ["bash", "-c", "source ~/.hermes/profiles/maggiepm/.env && echo $DROPBOX_ACCESS_TOKEN"],
        capture_output=True, text=True, timeout=10
    )
    token = result.stdout.strip()
    if not token or len(token) < 10:
        print("ERROR: DROPBOX_ACCESS_TOKEN not found")
        sys.exit(1)
    return token


TOKEN = get_token()


def get_env_var(name):
    """Read an env var from the maggiepm profile .env file."""
    result = subprocess.run(
        ["bash", "-c", f"source ~/.hermes/profiles/maggiepm/.env && echo ${name}"],
        capture_output=True, text=True, timeout=10
    )
    return result.stdout.strip()


def dbx(endpoint, payload, content_base=False):
    """Call Dropbox API."""
    base = CONTENT_API if content_base else DROPBOX_API
    headers = ["Content-Type: application/json"]
    if not content_base:
        headers.append("Content-Type: application/json")

    result = subprocess.run(
        ["curl", "-s", "-X", "POST",
         f"{base}/{endpoint}",
         "-H", f"Authorization: Bearer {TOKEN}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps(payload)],
        capture_output=True, text=True, timeout=30
    )
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"error": result.stdout[:200]}


def get_properties():
    """Fetch all MH Group properties from Supabase."""
    mgmt_token = get_env_var("SUPABASE_MGMT_TOKEN")
    result = subprocess.run(
        ["curl", "-s", "-X", "POST",
         "https://api.supabase.com/v1/projects/yzmqgldiidpmzritdxfj/database/query",
         "-H", f"Authorization: Bearer {mgmt_token}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps({"query": """
            SELECT p.id, p.address, p.unit_number,
                   t.first_name, t.last_name,
                   l.lease_start, l.lease_end
            FROM properties p
            LEFT JOIN leases l ON l.property_id = p.id AND l.status = 'active'
            LEFT JOIN tenants t ON t.id = l.tenant_id
            ORDER BY p.address
         """})],
        capture_output=True, text=True, timeout=15
    )
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"Error fetching properties: {result.stdout[:200]}")
        return []


def build_property_patterns(properties):
    """Build regex patterns for each property to match against file/folder names."""
    patterns = []
    for p in properties:
        addr = p.get("address", "").lower()
        unit = (p.get("unit_number") or "").strip().lower()
        tenant_first = (p.get("first_name") or "").lower()
        tenant_last = (p.get("last_name") or "").lower()

        # Extract street number and name for matching
        tokens = re.findall(r'[a-z0-9]+', addr)
        street_num = tokens[0] if tokens and tokens[0].isdigit() else ""
        street_name = " ".join(t for t in tokens[1:] if not t.isdigit()) if len(tokens) > 1 else addr

        folder_name = f"{addr} #{unit}" if unit else addr
        safe_folder = folder_name.replace("/", "_").replace(":", "_").title()

        patterns.append({
            "id": p["id"],
            "address": addr,
            "unit": unit,
            "folder_name": folder_name,
            "safe_folder": safe_folder,
            "patterns": [
                addr,                    # full address
                street_name,             # street name only
                tenant_last,             # tenant last name
                f"{tenant_first} {tenant_last}" if tenant_first else "",
                f"{street_num} {street_name}" if street_num else "",
            ],
            "tenant": f"{tenant_first} {tenant_last}".strip() if tenant_first else "",
        })
    return patterns


def list_recursive(path, max_results=200):
    """List files/folders recursively."""
    entries = []
    cursor = None

    while True:
        if cursor:
            result = dbx("files/list_folder/continue", {"cursor": cursor})
        else:
            result = dbx("files/list_folder", {"path": path, "recursive": True, "limit": max_results})

        entries.extend(result.get("entries", []))

        if result.get("has_more"):
            cursor = result.get("cursor")
        else:
            break

    return entries


def score_file(filename, parent_paths, patterns):
    """Score how well a file matches against property patterns (0-100)."""
    filename_lower = filename.lower()
    path_lower = " ".join(p.lower() for p in parent_paths)
    combined = f"{filename_lower} {path_lower}"

    best = {"score": 0, "property": None}

    for prop in patterns:
        score = 0
        for pat in prop["patterns"]:
            if not pat:
                continue
            if pat in combined:
                if pat == prop["address"]:
                    score += 80  # exact address match is strongest
                elif pat == prop["unit"] and prop["unit"]:
                    score += 60  # unit number match
                elif len(pat) > 5 and pat in combined:
                    score += 30  # partial match (street name, tenant name)

        if score > best["score"]:
            best = {"score": score, "property": prop}

    return best


def scan_and_sort(properties, patterns, dry_run=False):
    """Scan existing Dropbox files and report sorting results."""
    print(f"\n{'='*60}")
    print(f"MH GROUP DROPBOX SCANNER")
    print(f"{'='*60}")
    print(f"Mode: {'DRY RUN (no changes)' if dry_run else 'LIVE (will move files)'}")
    print(f"Properties: {len(properties)}")
    print(f"{'='*60}\n")

    # Scan the organized folders first — see what's already there
    print("Scanning existing organized structure...")
    try:
        organized = list_recursive(DROPBOX_ROOT, max_results=500)
        organized_files = [e for e in organized if e.get(".tag") == "file"]
        print(f"  Found {len(organized_files)} files already organized\n")
    except Exception as e:
        print(f"  Warning: Could not scan organized folders: {e}\n")
        organized_files = []

    # Now try to scan the rest of the app folder for loose files
    print("Scanning app folder for loose files...")
    try:
        all_files = list_recursive("/Apps/MH Group PM", max_results=1000)
        loose_files = [
            e for e in all_files if e.get(".tag") == "file"
            and not e["path_lower"].startswith(DROPBOX_ROOT.lower())
        ]
        print(f"  Found {len(loose_files)} loose files to sort\n")
    except Exception as e:
        print(f"  Warning: Could not scan: {e}\n")
        loose_files = []

    # Also scan the Dropbox root if we have access
    print("Scanning root Dropbox (if accessible)...")
    try:
        root_files = list_recursive("", max_results=500)
        # Filter to non-app files that might be MH Group related
        candidate_files = [
            e for e in root_files if e.get(".tag") == "file"
            and not e["path_lower"].startswith("/apps/")
        ]
        print(f"  Found {len(candidate_files)} candidate files in root Dropbox\n")
    except Exception as e:
        print(f"  Note: Root Dropbox not accessible (app-folder only): {e}\n")
        candidate_files = []

    # Score and categorize all loose files
    all_candidates = loose_files + candidate_files
    if not all_candidates:
        print("No loose files found to sort. Your Dropbox is already tidy!")
        return

    matched = []
    unmatched = []
    already_sorted = {e["path_lower"] for e in organized_files}

    for entry in all_candidates:
        path = entry["path_lower"]
        name = entry.get("name", "")
        parent_paths = path.split("/")[:-1]

        # Skip if already in organized folders
        if path in already_sorted:
            continue

        result = score_file(name, parent_paths, patterns)

        if result["score"] >= 40:
            matched.append({
                "entry": entry,
                "property": result["property"],
                "score": result["score"],
            })
        else:
            unmatched.append(entry)

    # Print summary
    print(f"\n{'='*60}")
    print(f"SCAN RESULTS")
    print(f"{'='*60}")
    print(f"Files already organized: {len(organized_files)}")
    print(f"Files matched to properties: {len(matched)}")
    print(f"Unmatched files: {len(unmatched)}")
    print()

    # Print matched files
    if matched:
        print(f"\n{'─'*60}")
        print(f"MATCHED FILES (sorted by confidence)")
        print(f"{'─'*60}")
        for m in sorted(matched, key=lambda x: -x["score"]):
            prop = m["property"]
            target = f"{DROPBOX_ROOT}/{prop['safe_folder']}/Lease Documents/{m['entry']['name']}"
            print(f"  [{m['score']:2d}%] {m['entry']['name']}")
            print(f"        → {prop['address']} #{prop['unit'] if prop['unit'] else '(no unit)'}")
            print(f"        → {target}")

    # Print unmatched files
    if unmatched:
        print(f"\n{'─'*60}")
        print(f"UNMATCHED FILES")
        print(f"{'─'*60}")
        for u in unmatched[:20]:  # Show first 20
            size = u.get("size", 0)
            size_str = f"{size/1024:.0f} KB" if size < 1024*1024 else f"{size/(1024*1024):.1f} MB"
            print(f"  • {u['name']} ({size_str})")
            print(f"    Path: {u['path_lower']}")
        if len(unmatched) > 20:
            print(f"  ... and {len(unmatched) - 20} more")

    # Move matched files (if not dry run)
    if matched and not dry_run:
        print(f"\n{'─'*60}")
        print(f"MOVING FILES...")
        print(f"{'─'*60}")

        moved = 0
        errors = 0
        for m in matched:
            prop = m["property"]
            from_path = m["entry"]["path_lower"]

            # Determine best subfolder based on file name
            name_lower = m["entry"]["name"].lower()
            if any(word in name_lower for word in ["lease", "rental", "tenant"]):
                subfolder = "Lease Documents"
            elif any(word in name_lower for word in ["photo", "img", "pic", "image", "jpg", "jpeg", "png", "webp"]):
                subfolder = "Photos"
            elif any(word in name_lower for word in ["invoice", "receipt", "bill", "payment", "repair", "maintenance"]):
                subfolder = "Invoices & Receipts"
            elif any(word in name_lower for word in ["email", "letter", "notice", "correspondence"]):
                subfolder = "Correspondence"
            else:
                subfolder = "Documents"

            to_path = f"{DROPBOX_ROOT}/{prop['safe_folder']}/{subfolder}/{m['entry']['name']}"

            result = dbx("files/move_v2", {
                "from_path": from_path,
                "to_path": to_path,
                "autorename": True,
            })

            if "error" in result:
                print(f"  ✗ Failed: {m['entry']['name']} → {result['error']}")
                errors += 1
            else:
                print(f"  ✓ {m['entry']['name']} → {prop['address']}/{subfolder}/")
                moved += 1

        print(f"\n  Moved: {moved}, Errors: {errors}")

    return matched, unmatched


def main():
    parser = argparse.ArgumentParser(description="Scan and organize MH Group Dropbox files")
    parser.add_argument("--dry-run", action="store_true", help="Report without moving files")
    parser.add_argument("--scan-all", action="store_true", help="Scan full Dropbox (needs Full Dropbox permission)")
    args = parser.parse_args()

    properties = get_properties()
    if not properties:
        print("No properties found. Is Supabase accessible?")
        sys.exit(1)

    print(f"Loaded {len(properties)} properties from database")
    patterns = build_property_patterns(properties)

    matched, unmatched = scan_and_sort(properties, patterns, dry_run=args.dry_run)

    # Summary for agent consumption (machine-readable JSON at end)
    summary = {
        "timestamp": datetime.utcnow().isoformat(),
        "properties": len(properties),
        "matched": len(matched),
        "unmatched": len(unmatched),
        "dry_run": args.dry_run,
    }
    print(f"\n\n---JSON---\n{json.dumps(summary)}")

if __name__ == "__main__":
    main()
