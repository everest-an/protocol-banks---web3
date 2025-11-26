-- Protocol Banks - Enhanced Security Constraints
-- This migration adds additional database-level security measures

-- ============================================
-- 1. ADD IMMUTABLE AUDIT COLUMNS
-- ============================================

-- Add created_at that cannot be modified
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS created_at_immutable TIMESTAMPTZ DEFAULT NOW();

-- Create trigger to prevent modification of immutable columns
CREATE OR REPLACE FUNCTION prevent_immutable_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.created_at_immutable IS NOT NULL AND 
     NEW.created_at_immutable != OLD.created_at_immutable THEN
    RAISE EXCEPTION 'Cannot modify immutable column created_at_immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_immutable_update_trigger ON transactions;
CREATE TRIGGER prevent_immutable_update_trigger
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_immutable_update();

-- ============================================
-- 2. ADD CHECKSUM COLUMN TO VENDORS
-- ============================================

ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS address_checksum TEXT;

-- Function to compute address checksum
CREATE OR REPLACE FUNCTION compute_vendor_checksum(
  p_id UUID,
  p_name TEXT,
  p_wallet TEXT,
  p_created_by TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN encode(
    sha256(
      (COALESCE(p_id::TEXT, '') || 
       COALESCE(p_name, '') || 
       COALESCE(LOWER(p_wallet), '') || 
       COALESCE(LOWER(p_created_by), ''))::bytea
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-compute checksum on insert/update
CREATE OR REPLACE FUNCTION update_vendor_checksum()
RETURNS TRIGGER AS $$
BEGIN
  NEW.address_checksum := compute_vendor_checksum(
    NEW.id,
    NEW.name,
    NEW.wallet_address,
    NEW.created_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vendor_checksum_trigger ON vendors;
CREATE TRIGGER vendor_checksum_trigger
  BEFORE INSERT OR UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_vendor_checksum();

-- ============================================
-- 3. ADD ADDRESS CHANGE PREVENTION
-- ============================================

-- Create a table to store address change requests (require approval)
CREATE TABLE IF NOT EXISTS address_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id),
  old_address TEXT NOT NULL,
  new_address TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT
);

-- Function to require approval for address changes
CREATE OR REPLACE FUNCTION require_address_change_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- If wallet_address is being changed
  IF OLD.wallet_address IS DISTINCT FROM NEW.wallet_address THEN
    -- Check if there's an approved change request
    IF NOT EXISTS (
      SELECT 1 FROM address_change_requests
      WHERE vendor_id = NEW.id
        AND new_address = NEW.wallet_address
        AND status = 'approved'
        AND approved_at > NOW() - INTERVAL '1 hour'
    ) THEN
      RAISE EXCEPTION 'Address change requires approval. Please submit a change request first.';
    END IF;
    
    -- Log the address change
    INSERT INTO address_change_log (
      vendor_id, 
      old_address, 
      new_address, 
      changed_by,
      change_source
    ) VALUES (
      NEW.id,
      OLD.wallet_address,
      NEW.wallet_address,
      COALESCE(current_setting('app.current_user', TRUE), 'system'),
      'approved_request'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Uncomment below to enable strict address change approval
-- DROP TRIGGER IF EXISTS require_address_approval_trigger ON vendors;
-- CREATE TRIGGER require_address_approval_trigger
--   BEFORE UPDATE ON vendors
--   FOR EACH ROW
--   EXECUTE FUNCTION require_address_change_approval();

-- ============================================
-- 4. RATE LIMITING AT DATABASE LEVEL
-- ============================================

CREATE TABLE IF NOT EXISTS db_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- wallet address or IP
  action_type TEXT NOT NULL, -- 'payment', 'vendor_update', etc.
  window_start TIMESTAMPTZ DEFAULT NOW(),
  request_count INTEGER DEFAULT 1,
  UNIQUE(identifier, action_type, window_start)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup 
ON db_rate_limits(identifier, action_type, window_start);

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_db_rate_limit(
  p_identifier TEXT,
  p_action_type TEXT,
  p_max_requests INTEGER,
  p_window_minutes INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := date_trunc('minute', NOW() - (NOW()::TIME % (p_window_minutes * INTERVAL '1 minute')));
  
  SELECT COALESCE(SUM(request_count), 0) INTO v_count
  FROM db_rate_limits
  WHERE identifier = p_identifier
    AND action_type = p_action_type
    AND window_start >= v_window_start;
  
  IF v_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;
  
  -- Increment counter
  INSERT INTO db_rate_limits (identifier, action_type, window_start, request_count)
  VALUES (p_identifier, p_action_type, v_window_start, 1)
  ON CONFLICT (identifier, action_type, window_start)
  DO UPDATE SET request_count = db_rate_limits.request_count + 1;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. TRANSACTION AMOUNT LIMITS
-- ============================================

CREATE TABLE IF NOT EXISTS spending_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  daily_limit_usd NUMERIC(20, 2) DEFAULT 100000,
  single_tx_limit_usd NUMERIC(20, 2) DEFAULT 10000,
  requires_approval_above NUMERIC(20, 2) DEFAULT 50000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to check spending limits
CREATE OR REPLACE FUNCTION check_spending_limit(
  p_wallet TEXT,
  p_amount_usd NUMERIC
) RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT,
  daily_spent NUMERIC,
  daily_remaining NUMERIC
) AS $$
DECLARE
  v_limit RECORD;
  v_daily_spent NUMERIC;
BEGIN
  -- Get wallet limits (or defaults)
  SELECT 
    COALESCE(sl.daily_limit_usd, 100000) as daily_limit_usd,
    COALESCE(sl.single_tx_limit_usd, 10000) as single_tx_limit_usd,
    COALESCE(sl.requires_approval_above, 50000) as requires_approval_above
  INTO v_limit
  FROM spending_limits sl
  WHERE sl.wallet_address = LOWER(p_wallet);
  
  IF v_limit IS NULL THEN
    v_limit := ROW(100000, 10000, 50000);
  END IF;
  
  -- Calculate daily spending
  SELECT COALESCE(SUM(amount_usd), 0) INTO v_daily_spent
  FROM transactions
  WHERE LOWER(from_address) = LOWER(p_wallet)
    AND created_at > NOW() - INTERVAL '24 hours'
    AND status = 'completed';
  
  -- Check single transaction limit
  IF p_amount_usd > v_limit.single_tx_limit_usd THEN
    RETURN QUERY SELECT FALSE, 
      'Amount exceeds single transaction limit of $' || v_limit.single_tx_limit_usd,
      v_daily_spent,
      v_limit.daily_limit_usd - v_daily_spent;
    RETURN;
  END IF;
  
  -- Check daily limit
  IF (v_daily_spent + p_amount_usd) > v_limit.daily_limit_usd THEN
    RETURN QUERY SELECT FALSE,
      'Amount would exceed daily limit. Remaining: $' || (v_limit.daily_limit_usd - v_daily_spent),
      v_daily_spent,
      v_limit.daily_limit_usd - v_daily_spent;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT TRUE, NULL::TEXT, v_daily_spent, v_limit.daily_limit_usd - v_daily_spent;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. CLEANUP OLD DATA (for rate limit tables)
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM db_rate_limits WHERE window_start < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. RLS POLICIES FOR NEW TABLES
-- ============================================

ALTER TABLE address_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE spending_limits ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own requests
CREATE POLICY "Users can view own change requests"
  ON address_change_requests FOR SELECT
  USING (requested_by = current_setting('app.current_user', TRUE));

-- Allow authenticated users to create requests
CREATE POLICY "Users can create change requests"
  ON address_change_requests FOR INSERT
  WITH CHECK (requested_by = current_setting('app.current_user', TRUE));

-- Only admins can approve/reject
-- (In production, implement proper admin role checking)
