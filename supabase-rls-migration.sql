-- ============================================================
-- MaggiePM: RLS + Security + Trigger Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. ENABLE RLS ON ALL TABLES
ALTER TABLE IF EXISTS properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activity_log ENABLE ROW LEVEL SECURITY;

-- 2. DROP LOOSE ANON POLICIES (previously allowed unauthenticated writes)
DROP POLICY IF EXISTS "anon_insert_expenses" ON expenses;
DROP POLICY IF EXISTS "anon_select_expenses" ON expenses;

-- 3. CREATE "authenticated_all" POLICIES — logged-in users can do everything
-- Properties
DROP POLICY IF EXISTS "authenticated_all" ON properties;
CREATE POLICY "authenticated_all" ON properties
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Tenants
DROP POLICY IF EXISTS "authenticated_all" ON tenants;
CREATE POLICY "authenticated_all" ON tenants
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Leases
DROP POLICY IF EXISTS "authenticated_all" ON leases;
CREATE POLICY "authenticated_all" ON leases
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Payments
DROP POLICY IF EXISTS "authenticated_all" ON payments;
CREATE POLICY "authenticated_all" ON payments
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Tasks
DROP POLICY IF EXISTS "authenticated_all" ON tasks;
CREATE POLICY "authenticated_all" ON tasks
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Contacts
DROP POLICY IF EXISTS "authenticated_all" ON contacts;
CREATE POLICY "authenticated_all" ON contacts
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Activity Log
DROP POLICY IF EXISTS "authenticated_all" ON activity_log;
CREATE POLICY "authenticated_all" ON activity_log
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Expenses (if exists)
DROP POLICY IF EXISTS "authenticated_all" ON expenses;
CREATE POLICY "authenticated_all" ON expenses
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 4. AUTO-CREATE PROFILE ON SIGNUP
-- This ensures every new user gets a row in the profiles table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    'basic',
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop trigger if exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. MANUALLY SET MAGGIE'S ROLE TO ADMIN
-- Replace 'maggie-email@example.com' with Maggie's actual email
-- Run this AFTER finding Maggie's user ID:
-- SELECT id, email FROM auth.users WHERE email = 'maggie-email@example.com';
-- UPDATE public.profiles SET role = 'admin' WHERE id = '<user-id-from-above>';
