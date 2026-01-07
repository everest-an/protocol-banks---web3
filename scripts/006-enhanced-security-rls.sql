-- Enhanced Row Level Security for complete customer data isolation
-- ProtocolBanks can NEVER access or modify customer funds

-- =====================================================
-- 1. MULTI-SIG WALLETS - Customer isolation
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their multisig wallets" ON multisig_wallets;
DROP POLICY IF EXISTS "Users can create multisig wallets" ON multisig_wallets;
DROP POLICY IF EXISTS "Creators can update their multisig wallets" ON multisig_wallets;

-- Only wallet creators and signers can view their multisig wallets
CREATE POLICY "Isolated multisig wallet access" ON multisig_wallets
  FOR SELECT USING (
    created_by = current_setting('app.current_user_address', true)
    OR id IN (
      SELECT multisig_id FROM multisig_signers 
      WHERE signer_address = lower(current_setting('app.current_user_address', true))
      AND is_active = true
    )
  );

-- Only authenticated users can create wallets (for themselves)
CREATE POLICY "Create own multisig wallet" ON multisig_wallets
  FOR INSERT WITH CHECK (
    created_by = current_setting('app.current_user_address', true)
  );

-- Only creator can update their wallet settings
CREATE POLICY "Update own multisig wallet" ON multisig_wallets
  FOR UPDATE USING (
    created_by = current_setting('app.current_user_address', true)
  );

-- =====================================================
-- 2. MULTI-SIG SIGNERS - Only accessible by wallet members
-- =====================================================

DROP POLICY IF EXISTS "Users can view signers" ON multisig_signers;
DROP POLICY IF EXISTS "Users can add signers" ON multisig_signers;
DROP POLICY IF EXISTS "Users can update signers" ON multisig_signers;

CREATE POLICY "View signers of own wallets" ON multisig_signers
  FOR SELECT USING (
    multisig_id IN (
      SELECT id FROM multisig_wallets 
      WHERE created_by = current_setting('app.current_user_address', true)
    )
    OR signer_address = lower(current_setting('app.current_user_address', true))
  );

CREATE POLICY "Add signers to own wallets" ON multisig_signers
  FOR INSERT WITH CHECK (
    multisig_id IN (
      SELECT id FROM multisig_wallets 
      WHERE created_by = current_setting('app.current_user_address', true)
    )
  );

CREATE POLICY "Update signers in own wallets" ON multisig_signers
  FOR UPDATE USING (
    multisig_id IN (
      SELECT id FROM multisig_wallets 
      WHERE created_by = current_setting('app.current_user_address', true)
    )
  );

-- =====================================================
-- 3. MULTI-SIG TRANSACTIONS - Only wallet members
-- =====================================================

DROP POLICY IF EXISTS "Users can view multisig transactions" ON multisig_transactions;
DROP POLICY IF EXISTS "Users can create multisig transactions" ON multisig_transactions;
DROP POLICY IF EXISTS "Users can update multisig transactions" ON multisig_transactions;

CREATE POLICY "View transactions of member wallets" ON multisig_transactions
  FOR SELECT USING (
    multisig_id IN (
      SELECT id FROM multisig_wallets 
      WHERE created_by = current_setting('app.current_user_address', true)
    )
    OR multisig_id IN (
      SELECT multisig_id FROM multisig_signers 
      WHERE signer_address = lower(current_setting('app.current_user_address', true))
      AND is_active = true
    )
  );

CREATE POLICY "Create transactions as signer" ON multisig_transactions
  FOR INSERT WITH CHECK (
    created_by = current_setting('app.current_user_address', true)
    AND (
      multisig_id IN (
        SELECT id FROM multisig_wallets 
        WHERE created_by = current_setting('app.current_user_address', true)
      )
      OR multisig_id IN (
        SELECT multisig_id FROM multisig_signers 
        WHERE signer_address = lower(current_setting('app.current_user_address', true))
        AND is_active = true
      )
    )
  );

CREATE POLICY "Update transactions as member" ON multisig_transactions
  FOR UPDATE USING (
    multisig_id IN (
      SELECT id FROM multisig_wallets 
      WHERE created_by = current_setting('app.current_user_address', true)
    )
    OR multisig_id IN (
      SELECT multisig_id FROM multisig_signers 
      WHERE signer_address = lower(current_setting('app.current_user_address', true))
      AND is_active = true
    )
  );

-- =====================================================
-- 4. MULTI-SIG CONFIRMATIONS - Only signers can confirm
-- =====================================================

DROP POLICY IF EXISTS "Users can view confirmations" ON multisig_confirmations;
DROP POLICY IF EXISTS "Signers can add confirmations" ON multisig_confirmations;

CREATE POLICY "View confirmations of member transactions" ON multisig_confirmations
  FOR SELECT USING (
    transaction_id IN (
      SELECT id FROM multisig_transactions 
      WHERE multisig_id IN (
        SELECT id FROM multisig_wallets 
        WHERE created_by = current_setting('app.current_user_address', true)
      )
      OR multisig_id IN (
        SELECT multisig_id FROM multisig_signers 
        WHERE signer_address = lower(current_setting('app.current_user_address', true))
        AND is_active = true
      )
    )
  );

CREATE POLICY "Confirm as authorized signer only" ON multisig_confirmations
  FOR INSERT WITH CHECK (
    signer_address = lower(current_setting('app.current_user_address', true))
    AND transaction_id IN (
      SELECT t.id FROM multisig_transactions t
      JOIN multisig_signers s ON s.multisig_id = t.multisig_id
      WHERE s.signer_address = lower(current_setting('app.current_user_address', true))
      AND s.is_active = true
    )
  );

-- =====================================================
-- 5. BATCH PAYMENTS - Customer isolation
-- =====================================================

DROP POLICY IF EXISTS "Enable read access for all users" ON batch_payments;
DROP POLICY IF EXISTS "Enable insert access for all users" ON batch_payments;
DROP POLICY IF EXISTS "Enable update access for all users" ON batch_payments;

CREATE POLICY "View own batch payments" ON batch_payments
  FOR SELECT USING (
    wallet_address = lower(current_setting('app.current_user_address', true))
  );

CREATE POLICY "Create own batch payments" ON batch_payments
  FOR INSERT WITH CHECK (
    wallet_address = lower(current_setting('app.current_user_address', true))
  );

CREATE POLICY "Update own batch payments" ON batch_payments
  FOR UPDATE USING (
    wallet_address = lower(current_setting('app.current_user_address', true))
  );

-- =====================================================
-- 6. BATCH PAYMENT ITEMS - Linked to batch owner
-- =====================================================

DROP POLICY IF EXISTS "Enable read access for all users" ON batch_payment_items;
DROP POLICY IF EXISTS "Enable insert access for all users" ON batch_payment_items;

CREATE POLICY "View own batch payment items" ON batch_payment_items
  FOR SELECT USING (
    batch_id IN (
      SELECT id FROM batch_payments 
      WHERE wallet_address = lower(current_setting('app.current_user_address', true))
    )
  );

CREATE POLICY "Create own batch payment items" ON batch_payment_items
  FOR INSERT WITH CHECK (
    batch_id IN (
      SELECT id FROM batch_payments 
      WHERE wallet_address = lower(current_setting('app.current_user_address', true))
    )
  );

-- =====================================================
-- 7. EMBEDDED WALLETS - Strict user isolation
-- =====================================================

-- Ensure embedded wallets are strictly isolated
DROP POLICY IF EXISTS "Users can view their wallets" ON embedded_wallets;
DROP POLICY IF EXISTS "Users can create wallets" ON embedded_wallets;
DROP POLICY IF EXISTS "Users can update their wallets" ON embedded_wallets;

CREATE POLICY "Strict view own embedded wallets" ON embedded_wallets
  FOR SELECT USING (
    user_id::text = current_setting('app.current_user_id', true)
  );

CREATE POLICY "Strict create own embedded wallets" ON embedded_wallets
  FOR INSERT WITH CHECK (
    user_id::text = current_setting('app.current_user_id', true)
  );

CREATE POLICY "Strict update own embedded wallets" ON embedded_wallets
  FOR UPDATE USING (
    user_id::text = current_setting('app.current_user_id', true)
  );

-- =====================================================
-- 8. PAYMENTS - Strict sender/receiver isolation
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own payments" ON payments;
DROP POLICY IF EXISTS "Users can create payments from their wallet" ON payments;

CREATE POLICY "View payments involving own wallet" ON payments
  FOR SELECT USING (
    from_address = lower(current_setting('app.current_user_address', true))
    OR to_address = lower(current_setting('app.current_user_address', true))
  );

CREATE POLICY "Create payments from own wallet only" ON payments
  FOR INSERT WITH CHECK (
    from_address = lower(current_setting('app.current_user_address', true))
  );

-- =====================================================
-- 9. VENDORS - Owner isolation
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can create vendors for themselves" ON vendors;
DROP POLICY IF EXISTS "Users can update their own vendors" ON vendors;
DROP POLICY IF EXISTS "Users can delete their own vendors" ON vendors;

CREATE POLICY "View own vendors" ON vendors
  FOR SELECT USING (
    created_by = current_setting('app.current_user_address', true)
  );

CREATE POLICY "Create vendors for self" ON vendors
  FOR INSERT WITH CHECK (
    created_by = current_setting('app.current_user_address', true)
  );

CREATE POLICY "Update own vendors" ON vendors
  FOR UPDATE USING (
    created_by = current_setting('app.current_user_address', true)
  );

CREATE POLICY "Delete own vendors" ON vendors
  FOR DELETE USING (
    created_by = current_setting('app.current_user_address', true)
  );

-- =====================================================
-- 10. AUDIT LOG - Immutable, view own only
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own audit logs" ON audit_logs;

CREATE POLICY "View own audit logs only" ON audit_logs
  FOR SELECT USING (
    actor = current_setting('app.current_user_address', true)
    OR target_id::text IN (
      SELECT id::text FROM vendors 
      WHERE created_by = current_setting('app.current_user_address', true)
    )
  );

-- Prevent updates and deletes on audit logs (immutable)
CREATE POLICY "No updates to audit logs" ON audit_logs
  FOR UPDATE USING (false);

CREATE POLICY "No deletes from audit logs" ON audit_logs
  FOR DELETE USING (false);
