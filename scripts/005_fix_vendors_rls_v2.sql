-- Fix RLS policies for vendors table to allow Web3 wallet interactions
-- This script drops all known previous policies and applies a permissive policy for the Web3 app

-- Drop policies from 002_enable_rls.sql
DROP POLICY IF EXISTS "Users can view their own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can insert their own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can update their own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can delete their own vendors" ON vendors;

-- Drop policies from 004_fix_rls_policies.sql (if they exist)
DROP POLICY IF EXISTS "Enable read access for all users" ON vendors;
DROP POLICY IF EXISTS "Enable insert access for all users" ON vendors;
DROP POLICY IF EXISTS "Enable update access for all users" ON vendors;
DROP POLICY IF EXISTS "Enable delete access for all users" ON vendors;

-- Ensure RLS is enabled
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Create simple, permissive policies for the Web3 app
-- Since we don't have a backend auth server, we allow the client to manage data
-- The application logic (frontend) handles the "created_by" filtering

CREATE POLICY "Allow all access to vendors"
ON vendors
FOR ALL
USING (true)
WITH CHECK (true);
