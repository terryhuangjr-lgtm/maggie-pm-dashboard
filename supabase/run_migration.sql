DO $$
BEGIN
  -- Tenants: add columns
  BEGIN
    ALTER TABLE tenants ADD COLUMN move_out_date DATE;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE tenants ADD COLUMN guarantor_name TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE tenants ADD COLUMN guarantor_phone TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE tenants ADD COLUMN guarantor_email TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE tenants ADD COLUMN guarantor_relationship TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;

  -- Leases: deposit fields
  BEGIN
    ALTER TABLE leases ADD COLUMN deposit_returned_date DATE;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE leases ADD COLUMN deposit_returned_amount NUMERIC(10,2);
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE leases ADD COLUMN deposit_deductions NUMERIC(10,2);
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE leases ADD COLUMN deposit_deduction_notes TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;

  -- Properties: extras
  BEGIN
    ALTER TABLE properties ADD COLUMN parking_spot TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE properties ADD COLUMN monthly_parking_fee NUMERIC(10,2);
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE properties ADD COLUMN storage_unit TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE properties ADD COLUMN pet_policy TEXT DEFAULT 'Not Allowed';
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE properties ADD COLUMN pet_deposit NUMERIC(10,2);
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
END $$;

-- Expenses table
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

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read expenses" ON expenses FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert expenses" ON expenses FOR INSERT TO anon WITH CHECK (true);

-- Recreate monthly_pnl view
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
lease_expected AS (
  SELECT
    property_id,
    monthly_rent
  FROM leases
  WHERE status = 'active'
),
lease_mgmt_fees AS (
  SELECT
    p.id AS property_id,
    TO_CHAR(m.month_date, 'YYYY-MM') AS month_key,
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
  COALESCE(ri.total_income, le.monthly_rent, 0) AS rental_income,
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
LEFT JOIN lease_expected le ON le.property_id = p.id
LEFT JOIN lease_mgmt_fees lmf ON lmf.property_id = p.id AND lmf.month_date = m.month_date
LEFT JOIN expense_data ed ON ed.property_id = p.id AND ed.month_date = m.month_date
WHERE p.status = 'active'
ORDER BY p.address, m.month_date;
