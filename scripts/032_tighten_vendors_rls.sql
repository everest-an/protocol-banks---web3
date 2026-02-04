-- Migration 032: Tighten vendors RLS to restrict by ownership
-- Replaces the wide-open policies from script 021 with ownership-based restrictions
-- Created: 2025-01-25

-- ============================================================
-- 1. Drop all existing permissive policies from script 021
-- ============================================================
DROP POLICY IF EXISTS "Enable insert for all users" ON vendors;
DROP POLICY IF EXISTS "Enable select for all users" ON vendors;
DROP POLICY IF EXISTS "Enable update for all users" ON vendors;
DROP POLICY IF EXISTS "Enable delete for all users" ON vendors;

-- Also drop any leftover policies from script 008
DROP POLICY IF EXISTS "Users can view their own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can create vendors for themselves" ON vendors;
DROP POLICY IF EXISTS "Users can update their own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can delete their own vendors" ON vendors;

-- ============================================================
-- 2. Ensure RLS is enabled
-- ============================================================
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Create ownership-based RLS policies
--    Uses current_setting('app.current_user_address') for session context
--    Falls back to checking auth.uid() JWT claims
-- ============================================================

-- SELECT: Users can only see vendors they created or own
CREATE POLICY "vendors_select_own" ON vendors
  FOR SELECT
  USING (
    LOWER(created_by) = LOWER(COALESCE(
      current_setting('app.current_user_address', true),
      (current_setting('request.jwt.claims', true)::json->>'wallet_address')
    ))
    OR LOWER(owner_address) = LOWER(COALESCE(
      current_setting('app.current_user_address', true),
      (current_setting('request.jwt.claims', true)::json->>'wallet_address')
    ))
  );

-- INSERT: created_by must match the session user
CREATE POLICY "vendors_insert_own" ON vendors
  FOR INSERT
  WITH CHECK (
    LOWER(created_by) = LOWER(COALESCE(
      current_setting('app.current_user_address', true),
      (current_setting('request.jwt.claims', true)::json->>'wallet_address')
    ))
  );

-- UPDATE: only the creator can update their vendors
CREATE POLICY "vendors_update_own" ON vendors
  FOR UPDATE
  USING (
    LOWER(created_by) = LOWER(COALESCE(
      current_setting('app.current_user_address', true),
      (current_setting('request.jwt.claims', true)::json->>'wallet_address')
    ))
  )
  WITH CHECK (
    LOWER(created_by) = LOWER(COALESCE(
      current_setting('app.current_user_address', true),
      (current_setting('request.jwt.claims', true)::json->>'wallet_address')
    ))
  );

-- DELETE: only the creator can delete their vendors
CREATE POLICY "vendors_delete_own" ON vendors
  FOR DELETE
  USING (
    LOWER(created_by) = LOWER(COALESCE(
      current_setting('app.current_user_address', true),
      (current_setting('request.jwt.claims', true)::json->>'wallet_address')
    ))
  );

-- ============================================================
-- 4. Add new columns for address change tracking
-- ============================================================
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address_changed_at TIMESTAMPTZ;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address_change_signature TEXT;

-- ============================================================
-- 5. Verify
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 032: Vendors RLS tightened to ownership-based policies';
  RAISE NOTICE 'Added columns: address_changed_at, address_change_signature';
END $$;
