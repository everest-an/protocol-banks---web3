-- Migration: Add RLS policies for payments table
-- Description: Enable CRUD operations for all users on payments table
-- Created: 2025-01-25

-- Drop existing policies if they exist (to make migration idempotent)
DROP POLICY IF EXISTS "Enable insert for all users" ON payments;
DROP POLICY IF EXISTS "Enable select for all users" ON payments;
DROP POLICY IF EXISTS "Enable update for all users" ON payments;
DROP POLICY IF EXISTS "Enable delete for all users" ON payments;

-- Add INSERT policy for payments table
CREATE POLICY "Enable insert for all users" ON payments
  FOR INSERT
  WITH CHECK (true);

-- Add SELECT policy for payments table
CREATE POLICY "Enable select for all users" ON payments
  FOR SELECT
  USING (true);

-- Add UPDATE policy for payments table
CREATE POLICY "Enable update for all users" ON payments
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Add DELETE policy for payments table
CREATE POLICY "Enable delete for all users" ON payments
  FOR DELETE
  USING (true);

-- Verify policies were created
DO $$
BEGIN
  RAISE NOTICE 'RLS policies for payments table created successfully';
END $$;
