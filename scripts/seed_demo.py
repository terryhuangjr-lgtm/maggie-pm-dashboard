#!/usr/bin/env python3
"""
Seed demo data for Maggie PM Dashboard
Uses subprocess to call curl (bypasses Python urllib 1010 bug with Supabase Mgmt API)
"""
import subprocess, json, sys

MGMT_TOKEN = os.environ.get("SUPABASE_MGMT_TOKEN", "")
PROJECT_REF = "yzmqgldiidpmzritdxfj"
BASE_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"

def run_sql(label, stmt):
    """Execute SQL via curl subprocess."""
    payload = json.dumps({"query": stmt})
    cmd = [
        "curl", "-s", "-w", "\n%{http_code}",
        "-X", "POST", BASE_URL,
        "-H", f"Authorization: Bearer {MGMT_TOKEN}",
        "-H", "Content-Type: application/json",
        "-d", payload
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    output = result.stdout.strip()
    
    # Split body and status code
    parts = output.rsplit("\n", 1)
    if len(parts) == 2:
        body, http_code = parts
    else:
        body, http_code = output, "000"
    
    if http_code in ("201", "200"):
        print(f"✅ {label}")
        if body:
            try: return json.loads(body)
            except: return []
        return []
    else:
        print(f"❌ {label} (HTTP {http_code})")
        if body:
            print(f"   {body[:150]}")
        return []

def q(stmt):
    """Query and return results."""
    payload = json.dumps({"query": stmt})
    cmd = [
        "curl", "-s",
        "-X", "POST", BASE_URL,
        "-H", f"Authorization: Bearer {MGMT_TOKEN}",
        "-H", "Content-Type: application/json",
        "-d", payload
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    output = result.stdout.strip()
    if output:
        try: return json.loads(output)
        except: return []
    return []

print("=" * 50)
print("Seeding Maggie PM Demo Data")
print("=" * 50)

# ── Clear existing data in order ──────────────────────────
print("\n--- Clearing existing data ---")
for t in ['payments', 'tasks', 'leases', 'activity_log', 'tenants', 'properties']:
    run_sql(f"clear {t}", f"DELETE FROM {t};")

# ── PROPERTIES ────────────────────────────────────────────
print("\n--- Properties ---")
props_sql = [
    ("45 Park Ave, 3B", 
     "INSERT INTO properties (address,unit_number,city,state,zip_code,property_type,bedrooms,bathrooms,square_footage,owner_name,owner_email,owner_phone,owner_language,purchase_date,purchase_price,current_market_value,monthly_management_fee,building_management_company,building_management_contact,status,notes) VALUES "
     "('45 Park Avenue','3B','New York','NY','10016','condo',2,1.0,950,'Linda Chen','linda.chen@email.com','+886-2-2345-6789','Chinese','2022-03-15',1250000,1375000,250,'AKAM Associates','212-555-0101','active','Overseas owner prefers WeChat. Recent kitchen renovation.');"),
    
    ("123 W 72nd St",
     "INSERT INTO properties (address,city,state,zip_code,property_type,bedrooms,bathrooms,square_footage,owner_name,owner_email,owner_phone,purchase_date,purchase_price,current_market_value,monthly_management_fee,status,notes) VALUES "
     "('123 West 72nd Street','New York','NY','10023','co-op',3,2.0,1400,'David & Susan Wang','wang.family@gmail.com','+886-2-2876-5432','2020-08-01',1850000,2100000,350,'active','Upper West Side. Long-term hold.');"),
    
    ("200 West St, 12A",
     "INSERT INTO properties (address,unit_number,city,state,zip_code,property_type,bedrooms,bathrooms,square_footage,owner_name,owner_email,owner_phone,owner_language,purchase_date,purchase_price,current_market_value,monthly_management_fee,building_management_company,status,notes) VALUES "
     "('200 West Street','12A','New York','NY','10013','condo',2,2.0,1100,'Jennifer Wu','jwu@taiwan.com','+886-2-2700-1234','Chinese','2021-11-20',1500000,1625000,275,'FirstService Residential','active','Battery Park City waterfront views.');"),
    
    ("78 Broadway, PH",
     "INSERT INTO properties (address,unit_number,city,state,zip_code,property_type,bedrooms,bathrooms,square_footage,owner_name,owner_email,owner_phone,purchase_date,purchase_price,current_market_value,monthly_management_fee,status,notes) VALUES "
     "('78 Broadway','PH','New York','NY','10006','condo',1,1.0,650,'Michael Chang','mchang@msn.com','+886-2-2722-8888','2019-06-01',900000,1050000,200,'active','FiDi penthouse. Board application in progress.');"),
    
    ("30 E 31st St",
     "INSERT INTO properties (address,city,state,zip_code,property_type,bedrooms,bathrooms,square_footage,owner_name,owner_email,owner_phone,purchase_date,purchase_price,current_market_value,monthly_management_fee,status,notes) VALUES "
     "('30 East 31st Street','New York','NY','10016','townhouse',4,3.5,2400,'Grace Liu','graceliu@yahoo.com','+886-2-2579-1111','2018-04-10',3200000,3850000,500,'active','Full brownstone in NoMad. Duplex upper two floors.');"),
    
    ("150 E 61st St, 8C",
     "INSERT INTO properties (address,unit_number,city,state,zip_code,property_type,bedrooms,bathrooms,square_footage,owner_name,owner_email,owner_phone,purchase_date,purchase_price,current_market_value,monthly_management_fee,status,notes) VALUES "
     "('150 East 61st Street','8C','New York','NY','10065','condo',2,2.0,1050,'Sophia Huang','sophia.huang@gmail.com','+1-917-555-2345','2023-01-15',1650000,1700000,300,'vacant','UES. Renovations in progress — new flooring and paint.');")
]

for label, sql in props_sql:
    run_sql(label, sql)

# Get property IDs
props = q("SELECT id, address FROM properties ORDER BY created_at ASC;")
prop_ids = {}
for p in props:
    a = p['address'].replace('West 72nd Street', 'W 72nd St').replace('East 31st Street', 'E 31st St').replace('East 61st Street', 'E 61st St')
    prop_ids[a] = p['id']
    # Also store by partial match
    prop_ids[p['address'].split()[0]] = p['id']

if not prop_ids:
    print("❌ Failed to load properties — cannot continue")
    sys.exit(1)

print(f"Loaded {len(prop_ids)} property IDs")

# Get map by first word of address
P1 = prop_ids.get("45")
P2 = prop_ids.get("123")
P3 = prop_ids.get("200")
P4 = prop_ids.get("78")
P5 = prop_ids.get("30")
P6 = prop_ids.get("150")

if not all([P1, P2, P3, P4, P5, P6]):
    print(f"❌ Some properties missing from lookup. Full map: {prop_ids}")
    sys.exit(1)

print(f"  45 Park Ave: {P1}")
print(f"  123 W 72nd:  {P2}")
print(f"  200 West St: {P3}")
print(f"  78 Broadway: {P4}")
print(f"  30 E 31st:   {P5}")
print(f"  150 E 61st:  {P6}")

# ── TENANTS ────────────────────────────────────────────────
print("\n--- Tenants ---")
tenants_sql = [
    (P1, "John", "Chen", "john.chen@nyu.edu", "+1-646-555-1234", "active",
     "'Mary Chen','+1-917-555-4321','2022-04-01','PhD student at NYU. Always pays early.'"),
    (P2, "Sarah", "Wang", "sarah.wang@columbia.edu", "+1-212-555-7890", "active",
     "'James Wang','+1-917-555-7891','2021-09-01',NULL"),
    (P3, "Robert", "Kim", "rkim@bankofamerica.com", "+1-347-555-3456", "active",
     "'Lisa Kim','+1-646-555-3457','2022-02-01',NULL"),
    (P4, "Emily", "Rodriguez", "erodriguez@gmail.com", "+1-917-555-6789", "pending_approval",
     "NULL,NULL,NULL,'Board app submitted May 1. Strong application.'"),
    (P5, "Thomas", "Park", "thomas.park@metmuseum.org", "+1-212-555-1111", "active",
     "NULL,NULL,'2020-11-15',NULL")
]

for i, (pid, fn, ln, email, phone, status, extra) in enumerate(tenants_sql):
    sql = f"INSERT INTO tenants (property_id,first_name,last_name,email,phone,language_preference,status,emergency_contact_name,emergency_contact_phone,move_in_date,notes) VALUES ('{pid}','{fn}','{ln}','{email}','{phone}','English','{status}',{extra});"
    run_sql(f"tenant {i+1}: {fn} {ln}", sql)

# Get tenant IDs
tenants = q("SELECT id, first_name, property_id FROM tenants ORDER BY created_at ASC;")
T_map = {t['property_id']: t['id'] for t in tenants}
T1 = T_map.get(P1)
T2 = T_map.get(P2)
T3 = T_map.get(P3)
T4 = T_map.get(P4)
T5 = T_map.get(P5)
print(f"Loaded {len(tenants)} tenant IDs")

# ── LEASES ─────────────────────────────────────────────────
print("\n--- Leases ---")
lease_sql = [
    f"INSERT INTO leases (property_id,tenant_id,lease_start,lease_end,monthly_rent,security_deposit,rent_due_day,status,notes) VALUES ('{P1}','{T1}','2023-05-01','2026-06-10',4200,4200,1,'active','Expires June 10. John wants to renew at $4,500.');",
    f"INSERT INTO leases (property_id,tenant_id,lease_start,lease_end,monthly_rent,security_deposit,rent_due_day,status,notes) VALUES ('{P2}','{T2}','2024-01-01','2026-07-04',5800,5800,5,'active','Renewing for 3 years. Standard 1-year lease.');",
    f"INSERT INTO leases (property_id,tenant_id,lease_start,lease_end,monthly_rent,security_deposit,rent_due_day,status,notes) VALUES ('{P3}','{T3}','2025-01-01','2026-08-01',4800,4800,1,'active','Auto-renew clause active. Excellent tenant.');",
    f"INSERT INTO leases (property_id,tenant_id,lease_start,lease_end,monthly_rent,security_deposit,rent_due_day,status,notes) VALUES ('{P4}','{T4}','2026-06-15','2027-06-14',3800,3800,1,'pending_renewal','Awaiting board approval. Proposed start June 15.');",
    f"INSERT INTO leases (property_id,tenant_id,lease_start,lease_end,monthly_rent,security_deposit,rent_due_day,status,notes) VALUES ('{P5}','{T5}','2023-11-01','2026-06-02',7200,7200,1,'active','CRITICAL: Expires June 2. Thomas has not responded to renewal inquiries.');"
]

for i, sql in enumerate(lease_sql):
    labels = ["45 Park Ave - John Chen", "123 W 72nd - Sarah Wang", "200 West St - Robert Kim",
              "78 Broadway - Emily Rodriguez (pending)", "30 E 31st - Thomas Park"]
    run_sql(f"lease {i+1}: {labels[i]}", sql)

# Get lease IDs
leases = q("SELECT id, property_id FROM leases ORDER BY created_at ASC;")
L_map = {l['property_id']: l['id'] for l in leases}

# ── PAYMENTS ───────────────────────────────────────────────
print("\n--- Payments ---")

payments = [
    (L_map[P1], P1, T1, 4200, '2026-05-01', 'received', 'ACH'),
    (L_map[P2], P2, T2, 5800, '2026-05-05', 'received', 'ACH'),
    (L_map[P3], P3, T3, 4800, '2026-05-01', 'received', 'check'),
    (L_map[P5], P5, T5, 7200, '2026-05-01', 'late', None),  # OVERDUE
]

for i, (lid, pid, tid, amt, due, status, method) in enumerate(payments):
    method_part = f"'{method}'" if method else "NULL"
    sql = f"INSERT INTO payments (lease_id,property_id,tenant_id,amount,payment_type,due_date,status,payment_method) VALUES ('{lid}','{pid}','{tid}',{amt},'rent','{due}','{status}',{method_part});"
    run_sql(f"payment {i+1}", sql)

# ── TASKS ──────────────────────────────────────────────────
print("\n--- Tasks ---")

tasks = [
    (P5, T5, "Follow up on Thomas Park lease renewal",
     "Lease expires June 2. Tenant has not responded to two emails. Call tenant and owner Grace Liu immediately.",
     "lease_renewal", "urgent", "2026-05-15", "pending"),
    (P6, "NULL", "Complete renovation at 150 E 61st St 8C",
     "New flooring May 12-15. Paint May 16-18. Final inspection needed before listing.",
     "general", "high", "2026-05-18", "in_progress"),
    (P1, T1, "Prepare 45 Park Ave lease renewal",
     "John Chen lease expires June 10. Draft renewal at $4,500/mo. Must get owner Linda Chen approval.",
     "lease_renewal", "high", "2026-05-20", "pending"),
    (P4, T4, "Follow up on 78 Broadway board application",
     "Emily Rodriguez board application submitted May 1. Check status with management.",
     "board_application", "medium", "2026-05-22", "pending"),
    (P2, T2, "Send Sarah Wang renewal notice",
     "Lease expires July 4. Standard renewal with 3%% increase to $5,974/month. Send by May 15.",
     "lease_renewal", "medium", "2026-05-15", "pending"),
    (P3, T3, "Prepare Robert Kim lease auto-renewal",
     "Auto-renewal triggers August 1. New rate $5,000/month. Prepare notice for owner.",
     "lease_renewal", "medium", "2026-06-01", "pending"),
    (P5, T5, "Collect May rent from Thomas Park (OVERDUE)",
     "May rent of $7,200 overdue past 5-day grace period. Escalate to owner Grace Liu.",
     "rent_collection", "urgent", "2026-05-11", "in_progress"),
    (P6, "NULL", "List 150 E 61st St 8C for rent",
     "After renovations complete, list at market rate $4,500-$5,000/month. Take new photos.",
     "general", "medium", "2026-05-25", "pending"),
    (P4, T4, "Schedule 78 Broadway PH pre-move-in inspection",
     "Before Emily moves in (expected June 15), schedule full inspection with management.",
     "inspection", "low", "2026-06-01", "pending")
]

for i, (pid, tid, title, desc, ttype, priority, due, status) in enumerate(tasks):
    sql = f"INSERT INTO tasks (property_id,tenant_id,title,description,task_type,priority,due_date,status) VALUES ('{pid}',{tid},'{title}','{desc}','{ttype}','{priority}','{due}','{status}');"
    run_sql(f"task {i+1}: {title[:40]}", sql)

# ── ACTIVITY LOG ───────────────────────────────────────────
print("\n--- Activity Log ---")
activities = [
    "INSERT INTO activity_log (action,details,source) VALUES ('System initialized','Demo data seed complete - 6 properties imported','system');",
    "INSERT INTO activity_log (action,details,source) VALUES ('Rent received','May rent collected: 45 Park Ave ($4,200), 123 W 72nd ($5,800), 200 West St ($4,800)','system');",
    "INSERT INTO activity_log (action,details,source) VALUES ('Payment overdue','30 E 31st St - May rent of $7,200 overdue past grace period','system');",
    "INSERT INTO activity_log (action,details,source) VALUES ('Lease expiring','30 E 31st St - lease expires June 2 (20 days). Thomas Park unresponsive to renewal.','system');",
    "INSERT INTO activity_log (action,details,source) VALUES ('Renovation in progress','150 E 61st St 8C - flooring installation started. Est completion mid-June.','system');",
    "INSERT INTO activity_log (action,details,source) VALUES ('Board application submitted','78 Broadway PH - Emily Rodriguez application submitted via management','system');",
    "INSERT INTO activity_log (action,details,source) VALUES ('Lease renewal pending','45 Park Ave Unit 3B - John Chen renewal awaiting owner Linda Chen approval','system');",
    "INSERT INTO activity_log (action,details,source) VALUES ('Owner notified','Grace Liu notified about Thomas Park lease non-renewal and overdue rent','telegram');",
]

for i, sql in enumerate(activities):
    run_sql(f"activity {i+1}", sql)

# ── VERIFICATION ──────────────────────────────────────────
print("\n" + "=" * 50)
print("VERIFICATION")
print("=" * 50)

for table in ['properties', 'tenants', 'leases', 'payments', 'tasks', 'activity_log']:
    result = q(f"SELECT COUNT(*) AS count FROM {table};")
    if result:
        print(f"  {table}: {result[0]['count']} rows")
    else:
        print(f"  {table}: ERROR")

print("\n✅ Demo data seeded successfully!")
