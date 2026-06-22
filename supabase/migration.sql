-- MaggiePM Database Migration
-- Adds: move_out_date + guarantor fields to tenants, deposit fields to leases,
-- property extras to properties, expenses table

BEGIN;

-- ==========================================
-- 1. Tenants: move_out_date and guarantor fields
-- ==========================================
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS move_out_date DATE,
  ADD COLUMN IF NOT EXISTS guarantor_name TEXT,
  ADD COLUMN IF NOT EXISTS guarantor_phone TEXT,
  ADD COLUMN IF NOT EXISTS guarantor_email TEXT,
  ADD COLUMN IF NOT EXISTS guarantor_relationship TEXT;

-- ==========================================
-- 2. Leases: security deposit return fields
-- ==========================================
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS deposit_returned_date DATE,
  ADD COLUMN IF NOT EXISTS deposit_returned_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS deposit_deductions NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS deposit_deduction_notes TEXT;

-- ==========================================
-- 3. Properties: extras (parking, storage, pet)
-- ==========================================
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS parking_spot TEXT,
  ADD COLUMN IF NOT EXISTS monthly_parking_fee NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS storage_unit TEXT,
  ADD COLUMN IF NOT EXISTS pet_policy TEXT DEFAULT 'Not Allowed',
  ADD COLUMN IF NOT EXISTS pet_deposit NUMERIC(10,2);

-- ==========================================
-- 4. Expenses table
-- ==========================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  vendor TEXT,
  description TEXT,
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- RLS: anon can read, service key can write
CREATE POLICY IF NOT EXISTS "Allow anon read expenses"
  ON expenses FOR SELECT
  TO anon
  USING (true);

CREATE POLICY IF NOT EXISTS "Allow anon insert expenses"
  ON expenses FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow anon delete expenses"
  ON expenses FOR DELETE
  TO anon
  USING (true);

-- ==========================================
-- 5. Update monthly_pnl view to include expenses
-- ==========================================
-- Drop and recreate to add expense totals
DROP VIEW IF EXISTS monthly_pnl;

CREATE VIEW monthly_pnl AS
WITH months AS (
  SELECT DISTINCT
    DATE_TRUNC('month', d)::DATE AS month_date,
    TO_CHAR(d, 'YYYY-MM') AS month_key
  FROM generate_series(
    (SELECT MIN(lease_start) FROM leases),
    CURRENT_DATE + INTERVAL '1 year',
    INTERVAL '1 month'
  ) AS d
),
rental_income AS (
  SELECT
    l.property_id,
    DATE_TRUNC('month', p.payment_date)::DATE AS month_date,
    SUM(p.amount) AS total_income
  FROM payments p
  JOIN leases l ON p.lease_id = l.id
  WHERE p.status = 'received'
  GROUP BY l.property_id, DATE_TRUNC('month', p.payment_date)
),
lease_mgmt_fees AS (
  SELECT
    p.id AS property_id,
    EXTRACT(YEAR FROM m.month_date)::INT || '-' || LPAD(EXTRACT(MONTH FROM m.month_date)::INT::TEXT, 2, '0') AS month_key,
    m.month_date,
    COALESCE(p.monthly_management_fee, 0) AS mgmt_fee
  FROM properties p
  CROSS JOIN months m
  WHERE p.status = 'active'
),
expense_data AS (
  SELECT
    e.property_id,
    DATE_TRUNC('month', e.date)::DATE AS month_date,
    COALESCE(SUM(CASE WHEN e.category IN ('maintenance', 'Maintenance & Repairs') THEN e.amount ELSE 0 END), 0) AS maintenance_cost,
    COALESCE(SUM(CASE WHEN e.category = 'taxes' THEN e.amount ELSE 0 END), 0) AS tax_expense,
    COALESCE(SUM(CASE WHEN e.category = 'insurance' THEN e.amount ELSE 0 END), 0) AS insurance_cost,
    COALESCE(SUM(CASE WHEN e.category = 'utilities' THEN e.amount ELSE 0 END), 0) AS utilities_cost,
    COALESCE(SUM(CASE WHEN e.category = 'common_charges' THEN e.amount ELSE 0 END), 0) AS cc_expense,
    COALESCE(SUM(CASE WHEN e.category NOT IN ('maintenance', 'Maintenance & Repairs', 'taxes', 'insurance', 'utilities', 'common_charges') THEN e.amount ELSE 0 END), 0) AS other_expense
  FROM expenses e
  GROUP BY e.property_id, DATE_TRUNC('month', e.date)
)
SELECT
  p.id AS property_id,
  p.address,
  p.unit_number,
  m.month_key,
  m.month_date,
  COALESCE(ri.total_income, 0) AS rental_income,
  COALESCE(lmf.mgmt_fee, 0) AS mgmt_fee_expense,
  COALESCE(ed.maintenance_cost, 0) AS maintenance_cost,
  COALESCE(ed.tax_expense, 0) AS tax_expense,
  COALESCE(ed.insurance_cost, 0) AS insurance_cost,
  COALESCE(ed.utilities_cost, 0) AS utilities_cost,
  COALESCE(ed.cc_expense, 0) AS cc_expense,
  COALESCE(ed.other_expense, 0) AS other_expense
FROM properties p
CROSS JOIN months m
LEFT JOIN rental_income ri ON ri.property_id = p.id AND ri.month_date = m.month_date
LEFT JOIN lease_mgmt_fees lmf ON lmf.property_id = p.id AND lmf.month_date = m.month_date
LEFT JOIN expense_data ed ON ed.property_id = p.id AND ed.month_date = m.month_date
WHERE p.status = 'active'
ORDER BY p.address, m.month_date;

COMMIT;
