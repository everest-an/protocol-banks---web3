-- Protocol Banks Security Migration
-- Adds audit logging, integrity hashes, and enhanced RLS policies

-- ============================================
-- 1. AUDIT LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor TEXT NOT NULL, -- wallet address or 'SYSTEM'
  target_type TEXT, -- 'vendor', 'payment', 'batch', etc.
  target_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by actor (wallet)
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs are append-only: users can only INSERT and SELECT their own logs
CREATE POLICY "Users can insert audit logs" ON audit_logs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their own audit logs" ON audit_logs
  FOR SELECT
  USING (
    actor = current_setting('request.jwt.claims', true)::json->>'wallet_address'
    OR actor = 'SYSTEM'
  );

-- ============================================
-- 2. VENDOR INTEGRITY HASH COLUMN
-- ============================================

-- Add integrity hash column to vendors for tamper detection
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS integrity_hash TEXT,
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- ============================================
-- 3. ENHANCED RLS POLICIES FOR VENDORS
-- ============================================

-- Drop existing permissive policy
DROP POLICY IF EXISTS "Allow all access to vendors" ON vendors;

-- Users can only SELECT vendors they created
CREATE POLICY "Users can view their own vendors" ON vendors
  FOR SELECT
  USING (
    created_by IS NULL 
    OR LOWER(created_by) = LOWER(current_setting('request.jwt.claims', true)::json->>'wallet_address')
  );

-- Users can only INSERT vendors with their own wallet as created_by
CREATE POLICY "Users can create vendors for themselves" ON vendors
  FOR INSERT
  WITH CHECK (
    LOWER(created_by) = LOWER(current_setting('request.jwt.claims', true)::json->>'wallet_address')
  );

-- Users can only UPDATE vendors they created
CREATE POLICY "Users can update their own vendors" ON vendors
  FOR UPDATE
  USING (
    LOWER(created_by) = LOWER(current_setting('request.jwt.claims', true)::json->>'wallet_address')
  )
  WITH CHECK (
    LOWER(created_by) = LOWER(current_setting('request.jwt.claims', true)::json->>'wallet_address')
  );

-- Users can only DELETE vendors they created
CREATE POLICY "Users can delete their own vendors" ON vendors
  FOR DELETE
  USING (
    LOWER(created_by) = LOWER(current_setting('request.jwt.claims', true)::json->>'wallet_address')
  );

-- ============================================
-- 4. ENHANCED RLS POLICIES FOR PAYMENTS
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON payments;
DROP POLICY IF EXISTS "Enable insert access for all users" ON payments;

-- Users can only view payments from their wallet
CREATE POLICY "Users can view their own payments" ON payments
  FOR SELECT
  USING (
    LOWER(from_address) = LOWER(current_setting('request.jwt.claims', true)::json->>'wallet_address')
  );

-- Users can only insert payments from their wallet
CREATE POLICY "Users can create payments from their wallet" ON payments
  FOR INSERT
  WITH CHECK (
    LOWER(from_address) = LOWER(current_setting('request.jwt.claims', true)::json->>'wallet_address')
  );

-- ============================================
-- 5. RATE LIMITING TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- wallet address or IP
  action_type TEXT NOT NULL, -- 'PAYMENT', 'BATCH', 'API', etc.
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier, action_type)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup 
  ON rate_limits(identifier, action_type, window_start);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Rate limits are managed by the system, but users can view their own
CREATE POLICY "Users can view their own rate limits" ON rate_limits
  FOR SELECT
  USING (
    identifier = current_setting('request.jwt.claims', true)::json->>'wallet_address'
  );

-- ============================================
-- 6. VENDOR ADDRESS CHANGE LOG
-- ============================================

CREATE TABLE IF NOT EXISTS address_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  previous_address TEXT NOT NULL,
  new_address TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_address_change_vendor ON address_change_log(vendor_id);
CREATE INDEX IF NOT EXISTS idx_address_change_time ON address_change_log(created_at DESC);

-- Enable RLS
ALTER TABLE address_change_log ENABLE ROW LEVEL SECURITY;

-- Users can view address changes for vendors they own
CREATE POLICY "Users can view their vendor address changes" ON address_change_log
  FOR SELECT
  USING (
    vendor_id IN (
      SELECT id FROM vendors 
      WHERE LOWER(created_by) = LOWER(current_setting('request.jwt.claims', true)::json->>'wallet_address')
    )
  );

-- ============================================
-- 7. PAYMENT INTEGRITY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS payment_integrity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  client_hash TEXT NOT NULL, -- Hash of client-submitted parameters
  server_hash TEXT NOT NULL, -- Hash of server-verified parameters
  match_status BOOLEAN DEFAULT true,
  discrepancies JSONB DEFAULT '[]',
  verified_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_integrity_payment ON payment_integrity(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_integrity_mismatch ON payment_integrity(match_status) WHERE match_status = false;

-- Enable RLS
ALTER TABLE payment_integrity ENABLE ROW LEVEL SECURITY;

-- Users can view integrity checks for their payments
CREATE POLICY "Users can view their payment integrity" ON payment_integrity
  FOR SELECT
  USING (
    payment_id IN (
      SELECT id FROM payments 
      WHERE LOWER(from_address) = LOWER(current_setting('request.jwt.claims', true)::json->>'wallet_address')
    )
  );

-- ============================================
-- 8. SECURITY ALERTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL, -- 'RATE_LIMIT', 'TAMPERING', 'INVALID_ADDRESS', etc.
  severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  actor TEXT NOT NULL,
  description TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_unresolved 
  ON security_alerts(resolved, created_at DESC) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);

-- Enable RLS - only system/admin can see all alerts
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

-- Users can see alerts about their own actions
CREATE POLICY "Users can view their own security alerts" ON security_alerts
  FOR SELECT
  USING (
    LOWER(actor) = LOWER(current_setting('request.jwt.claims', true)::json->>'wallet_address')
  );

-- ============================================
-- 9. TRIGGER FOR VENDOR ADDRESS CHANGES
-- ============================================

CREATE OR REPLACE FUNCTION log_vendor_address_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.wallet_address IS DISTINCT FROM NEW.wallet_address THEN
    INSERT INTO address_change_log (vendor_id, previous_address, new_address, changed_by)
    VALUES (NEW.id, OLD.wallet_address, NEW.wallet_address, NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_vendor_address_change ON vendors;
CREATE TRIGGER trigger_vendor_address_change
  AFTER UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION log_vendor_address_change();

-- ============================================
-- 10. FUNCTION TO VERIFY VENDOR INTEGRITY
-- ============================================

CREATE OR REPLACE FUNCTION verify_vendor_integrity(vendor_uuid UUID)
RETURNS TABLE(is_valid BOOLEAN, computed_hash TEXT, stored_hash TEXT) AS $$
DECLARE
  v_record RECORD;
  v_computed_hash TEXT;
BEGIN
  SELECT * INTO v_record FROM vendors WHERE id = vendor_uuid;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Compute hash (simplified - in production use proper crypto)
  v_computed_hash := encode(
    sha256(
      (v_record.id::TEXT || v_record.name || LOWER(v_record.wallet_address) || LOWER(COALESCE(v_record.created_by, '')))::BYTEA
    ),
    'hex'
  );
  
  RETURN QUERY SELECT 
    (v_computed_hash = v_record.integrity_hash) AS is_valid,
    v_computed_hash AS computed_hash,
    v_record.integrity_hash AS stored_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. GRANT NECESSARY PERMISSIONS
-- ============================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT SELECT ON rate_limits TO authenticated;
GRANT SELECT ON address_change_log TO authenticated;
GRANT SELECT ON payment_integrity TO authenticated;
GRANT SELECT ON security_alerts TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION verify_vendor_integrity TO authenticated;
