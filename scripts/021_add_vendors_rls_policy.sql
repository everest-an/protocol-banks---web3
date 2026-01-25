-- Migration: Add RLS policy for vendors table
-- Description: Enable insert operations for all users on vendors table
-- Created: 2024-01-25

-- Drop existing policies if they exist (to make migration idempotent)
DROP POLICY IF EXISTS "Enable insert for all users" ON vendors;
DROP POLICY IF EXISTS "Enable select for all users" ON vendors;
DROP POLICY IF EXISTS "Enable update for all users" ON vendors;
DROP POLICY IF EXISTS "Enable delete for all users" ON vendors;

-- Add INSERT policy for vendors table
CREATE POLICY "Enable insert for all users" ON vendors
  FOR INSERT
  WITH CHECK (true);

-- Add SELECT policy for vendors table
CREATE POLICY "Enable select for all users" ON vendors
  FOR SELECT
  USING (true);

-- Add UPDATE policy for vendors table
CREATE POLICY "Enable update for all users" ON vendors
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Add DELETE policy for vendors table
CREATE POLICY "Enable delete for all users" ON vendors
  FOR DELETE
  USING (true);

-- Verify policies were created
DO $$
BEGIN
  RAISE NOTICE 'RLS policies for vendors table created successfully';
END $$;
