-- Fix monthly_pnl view: only show rows with actual activity
-- Old behavior: generated a row for every property-month combination with mgmt fee always populated
-- New behavior: only show rows where there's rental income OR operating expenses OR it's the current month

CREATE OR REPLACE VIEW monthly_pnl AS
WITH months AS (
  SELECT DISTINCT
    date_trunc('month', d.d)::date AS month_date,
    to_char(d.d, 'YYYY-MM') AS month_key
  FROM generate_series(
    (SELECT min(lease_start) FROM leases)::timestamp,
    CURRENT_DATE + INTERVAL '1 year',
    '1 month'
  ) d(d)
),
rental_income AS (
  SELECT
    l.property_id,
    date_trunc('month', p.payment_date)::date AS month_date,
    SUM(p.amount) AS total_income
  FROM payments p
  JOIN leases l ON p.lease_id = l.id
  WHERE p.status = 'received'
  GROUP BY l.property_id, date_trunc('month', p.payment_date)
),
lease_expected AS (
  SELECT DISTINCT ON (property_id)
    property_id,
    monthly_rent
  FROM leases
  WHERE status = 'active'
  ORDER BY property_id, created_at DESC
),
lease_mgmt_fees AS (
  SELECT
    p.id AS property_id,
    to_char(m.month_date::timestamptz, 'YYYY-MM') AS month_key,
    m.month_date,
    COALESCE(p.monthly_management_fee, 0) AS mgmt_fee
  FROM properties p
  CROSS JOIN months m
  WHERE p.status = 'active'
),
expense_data AS (
  SELECT
    e.property_id,
    date_trunc('month', e.date)::date AS month_date,
    COALESCE(SUM(CASE WHEN e.category IN ('maintenance', 'Maintenance & Repairs') THEN e.amount ELSE 0 END), 0) AS maintenance_cost,
    COALESCE(SUM(CASE WHEN e.category = 'taxes' THEN e.amount ELSE 0 END), 0) AS tax_expense,
    COALESCE(SUM(CASE WHEN e.category = 'insurance' THEN e.amount ELSE 0 END), 0) AS insurance_cost,
    COALESCE(SUM(CASE WHEN e.category = 'utilities' THEN e.amount ELSE 0 END), 0) AS utilities_cost,
    COALESCE(SUM(CASE WHEN e.category = 'common_charges' THEN e.amount ELSE 0 END), 0) AS cc_expense,
    COALESCE(SUM(CASE WHEN e.category NOT IN ('maintenance', 'Maintenance & Repairs', 'taxes', 'insurance', 'utilities', 'common_charges') THEN e.amount ELSE 0 END), 0) AS other_expense
  FROM expenses e
  GROUP BY e.property_id, date_trunc('month', e.date)
)
SELECT
  p.id AS property_id,
  p.address,
  p.unit_number,
  m.month_key,
  m.month_date,
  COALESCE(ri.total_income,
    CASE
      WHEN m.month_date = date_trunc('month', CURRENT_DATE) THEN le.monthly_rent
      ELSE 0
    END, 0
  ) AS rental_income,
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
  -- Only show rows with actual activity:
  AND (
    COALESCE(ri.total_income, 0) > 0                    -- has rental income
    OR COALESCE(ed.maintenance_cost, 0) > 0               -- has maintenance
    OR COALESCE(ed.tax_expense, 0) > 0                    -- has taxes
    OR COALESCE(ed.insurance_cost, 0) > 0                 -- has insurance
    OR COALESCE(ed.utilities_cost, 0) > 0                 -- has utilities
    OR COALESCE(ed.cc_expense, 0) > 0                     -- has common charges
    OR COALESCE(ed.other_expense, 0) > 0                  -- has other expenses
    OR m.month_date = date_trunc('month', CURRENT_DATE)   -- current month (shows expected rent)
  )
ORDER BY p.address, m.month_date;
