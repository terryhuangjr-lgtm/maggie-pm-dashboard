-- Auto-sync tenants/owners to contacts directory
-- When a tenant or owner is created in their respective table,
-- this trigger ensures they appear in the Contacts tab automatically.

-- 1. Function: Sync a tenant insert to contacts
CREATE OR REPLACE FUNCTION sync_tenant_to_contact()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO contacts (
    first_name,
    last_name,
    email,
    phone,
    role,
    company,
    property_id,
    language_preference,
    notes,
    status
  ) VALUES (
    NEW.first_name,
    NEW.last_name,
    NEW.email,
    NEW.phone,
    'tenant',
    NULL,
    NEW.property_id,
    COALESCE(NEW.language_preference, 'English'),
    CASE
      WHEN NEW.move_in_date IS NOT NULL THEN 'Move-in: ' || NEW.move_in_date::text
      ELSE NEW.notes
    END,
    'active'
  )
  ON CONFLICT DO NOTHING;  -- Avoids duplicates if contact already exists

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger: After INSERT on tenants
DROP TRIGGER IF EXISTS trigger_sync_tenant_to_contact ON tenants;
CREATE TRIGGER trigger_sync_tenant_to_contact
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION sync_tenant_to_contact();

-- 3. Function: Sync a tenant UPDATE to contacts (keep in sync)
CREATE OR REPLACE FUNCTION sync_tenant_update_to_contact()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contacts
  SET
    first_name = NEW.first_name,
    last_name = NEW.last_name,
    email = NEW.email,
    phone = NEW.phone,
    property_id = NEW.property_id,
    language_preference = COALESCE(NEW.language_preference, 'English'),
    notes = CASE
      WHEN NEW.move_in_date IS NOT NULL THEN 'Move-in: ' || NEW.move_in_date::text
      ELSE NEW.notes
    END,
    updated_at = NOW()
  WHERE
    first_name = OLD.first_name
    AND last_name = OLD.last_name
    AND role = 'tenant';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger: After UPDATE on tenants
DROP TRIGGER IF EXISTS trigger_sync_tenant_update_to_contact ON tenants;
CREATE TRIGGER trigger_sync_tenant_update_to_contact
  AFTER UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION sync_tenant_update_to_contact();

-- 5. Also sync existing tenants that are already in the system
-- (backfill existing tenants into contacts if not already there)
INSERT INTO contacts (first_name, last_name, email, phone, role, company, property_id, language_preference, notes, status)
SELECT
  t.first_name,
  t.last_name,
  t.email,
  t.phone,
  'tenant',
  NULL,
  t.property_id,
  COALESCE(t.language_preference, 'English'),
  CASE
    WHEN t.move_in_date IS NOT NULL THEN 'Move-in: ' || t.move_in_date::text
    ELSE t.notes
  END,
  'active'
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM contacts c
  WHERE c.first_name = t.first_name
    AND c.last_name = t.last_name
    AND c.role = 'tenant'
)
AND t.status = 'active';
