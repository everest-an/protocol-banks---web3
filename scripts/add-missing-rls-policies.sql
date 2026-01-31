-- Add missing RLS policies for acquiring and merchant tables
-- This migration adds Row Level Security to protect sensitive business data

-- ============================================
-- 1. ACQUIRING_ORDERS - Enable RLS and add policies
-- ============================================
ALTER TABLE acquiring_orders ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own orders
CREATE POLICY "Merchants can view their orders"
ON acquiring_orders FOR SELECT
USING (
  merchant_id IN (
    SELECT id FROM merchants 
    WHERE user_id = auth.uid() 
    OR wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  )
);

-- Merchants can create orders for their merchant account
CREATE POLICY "Merchants can create orders"
ON acquiring_orders FOR INSERT
WITH CHECK (
  merchant_id IN (
    SELECT id FROM merchants 
    WHERE user_id = auth.uid() 
    OR wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  )
);

-- Merchants can update their own orders
CREATE POLICY "Merchants can update their orders"
ON acquiring_orders FOR UPDATE
USING (
  merchant_id IN (
    SELECT id FROM merchants 
    WHERE user_id = auth.uid() 
    OR wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  )
);

-- Service role bypass for system operations
CREATE POLICY "Service role full access to acquiring_orders"
ON acquiring_orders FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- 2. MERCHANTS - Enable RLS and add policies
-- ============================================
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

-- Users can view their own merchant accounts
CREATE POLICY "Users can view their merchants"
ON merchants FOR SELECT
USING (
  user_id = auth.uid() 
  OR wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
);

-- Users can create merchant accounts
CREATE POLICY "Users can create merchants"
ON merchants FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  OR wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
);

-- Users can update their own merchant accounts
CREATE POLICY "Users can update their merchants"
ON merchants FOR UPDATE
USING (
  user_id = auth.uid() 
  OR wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
);

-- Service role bypass for system operations
CREATE POLICY "Service role full access to merchants"
ON merchants FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- 3. MERCHANT_API_KEYS - Enable RLS and add policies
-- ============================================
ALTER TABLE merchant_api_keys ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own API keys
CREATE POLICY "Merchants can view their API keys"
ON merchant_api_keys FOR SELECT
USING (
  merchant_id IN (
    SELECT id FROM merchants 
    WHERE user_id = auth.uid() 
    OR wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  )
);

-- Merchants can create API keys
CREATE POLICY "Merchants can create API keys"
ON merchant_api_keys FOR INSERT
WITH CHECK (
  merchant_id IN (
    SELECT id FROM merchants 
    WHERE user_id = auth.uid() 
    OR wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  )
);

-- Merchants can delete their own API keys
CREATE POLICY "Merchants can delete API keys"
ON merchant_api_keys FOR DELETE
USING (
  merchant_id IN (
    SELECT id FROM merchants 
    WHERE user_id = auth.uid() 
    OR wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  )
);

-- Service role bypass
CREATE POLICY "Service role full access to merchant_api_keys"
ON merchant_api_keys FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- 4. MERCHANT_BALANCES - Enable RLS and add policies
-- ============================================
ALTER TABLE merchant_balances ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own balances
CREATE POLICY "Merchants can view their balances"
ON merchant_balances FOR SELECT
USING (
  merchant_id IN (
    SELECT id FROM merchants 
    WHERE user_id = auth.uid() 
    OR wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  )
);

-- Only service role can modify balances (for security)
CREATE POLICY "Service role can manage balances"
ON merchant_balances FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- 5. INVOICES - Add missing policies (RLS already enabled)
-- ============================================

-- Users can view invoices they created or are recipients of
CREATE POLICY "Users can view their invoices"
ON invoices FOR SELECT
USING (
  recipient_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  OR paid_by = current_setting('request.jwt.claims', true)::json->>'wallet_address'
);

-- Users can create invoices
CREATE POLICY "Users can create invoices"
ON invoices FOR INSERT
WITH CHECK (
  recipient_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
);

-- Users can update their own invoices (before paid)
CREATE POLICY "Users can update their invoices"
ON invoices FOR UPDATE
USING (
  recipient_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  AND status != 'paid'
);

-- Service role bypass
CREATE POLICY "Service role full access to invoices"
ON invoices FOR ALL
USING (auth.role() = 'service_role');

-- Public can view invoices by invoice_id (for payment links)
CREATE POLICY "Public can view invoice by id"
ON invoices FOR SELECT
USING (true);
