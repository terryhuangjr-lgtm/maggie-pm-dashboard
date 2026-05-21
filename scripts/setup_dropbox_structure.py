"""
Setup MH Group folder structure in Dropbox.

Run this once after setting DROPBOX_ACCESS_TOKEN in env.
Creates folder hierarchy:
  /Apps/MH Group PM/MH Group/
    ├── 15 East 30th Street #42E/
    │   ├── Lease Documents/
    │   ├── Photos/
    │   ├── Invoices & Receipts/
    │   └── Correspondence/
    ├── 555 West 22nd Street #3EW/
    │   └── ...
    └── Shared/
        ├── Insurance/
        ├── Tax Documents/
        └── Templates/

Usage:
    python3 setup_dropbox_structure.py
"""

import os
import subprocess
import sys
import json

DROPBOX_API = "https://api.dropboxapi.com/2"

ROOT = "/Apps/MH Group PM/MH Group"

SUB_FOLDERS = [
    "Lease Documents",
    "Photos",
    "Invoices & Receipts",
    "Correspondence",
]

SHARED_FOLDERS = [
    "Insurance",
    "Tax Documents",
    "Templates",
]


def get_token():
    result = subprocess.run(
        ["bash", "-c", "source ~/.hermes/profiles/maggiepm/.env && echo $DROPBOX_ACCESS_TOKEN"],
        capture_output=True, text=True, timeout=10
    )
    token = result.stdout.strip()
    if not token or len(token) < 10:
        print("ERROR: DROPBOX_ACCESS_TOKEN not found in maggiepm .env")
        sys.exit(1)
    return token


def get_env_var(name):
    """Read an env var from the maggiepm profile .env file."""
    result = subprocess.run(
        ["bash", "-c", f"source ~/.hermes/profiles/maggiepm/.env && echo ${name}"],
        capture_output=True, text=True, timeout=10
    )
    return result.stdout.strip()


def call_dropbox(endpoint, payload):
    """Call Dropbox API via curl (urllib has SSL/header issues with some setups)."""
    result = subprocess.run(
        ["curl", "-s", "-X", "POST",
         f"{DROPBOX_API}/{endpoint}",
         "-H", f"Authorization: Bearer {DROPBOX_TOKEN}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps(payload)],
        capture_output=True, text=True, timeout=15
    )
    return result.stdout


def create_folder(path):
    resp = call_dropbox("files/create_folder_v2", {"path": path, "autorename": False})
    try:
        data = json.loads(resp)
        if "error" in data:
            if data.get("error", {}).get(".tag") == "path" or "conflict" in str(data):
                print(f"  Already exists: {path}")
                return False
            print(f"  Error: {resp[:100]}")
            return False
        print(f"  Created: {path}")
        return True
    except json.JSONDecodeError:
        print(f"  Parse error: {resp[:100]}")
        return False


def get_properties():
    mgmt_token = get_env_var("SUPABASE_MGMT_TOKEN")
    result = subprocess.run(
        ["curl", "-s", "-X", "POST",
         "https://api.supabase.com/v1/projects/yzmqgldiidpmzritdxfj/database/query",
         "-H", f"Authorization: Bearer {mgmt_token}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps({"query": "SELECT id, address, unit_number FROM properties ORDER BY address"})],
        capture_output=True, text=True, timeout=15
    )
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"Error fetching properties: {result.stdout[:200]}")
        return []


def main():
    global DROPBOX_TOKEN
    DROPBOX_TOKEN = get_token()

    print(f"Creating folder structure under {ROOT}...\n")

    # Create root
    create_folder(ROOT)

    # Create shared folders
    print("\nShared folders:")
    for folder in SHARED_FOLDERS:
        create_folder(f"{ROOT}/Shared/{folder}")

    # Create property folders
    properties = get_properties()
    print(f"\nProperty folders ({len(properties)} total):")

    for p in properties:
        unit = p.get("unit_number") or ""
        folder_name = f"{p['address']} #{unit}".strip() if unit else p["address"]
        safe_name = folder_name.replace("/", "_").replace(":", "_")
        prop_root = f"{ROOT}/{safe_name}"

        create_folder(prop_root)
        for sub in SUB_FOLDERS:
            create_folder(f"{prop_root}/{sub}")

    print(f"\n✓ Done — {len(properties)} property folders + Shared set up")


if __name__ == "__main__":
    main()
