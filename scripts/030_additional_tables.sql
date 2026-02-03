-- ============================================
-- Protocol Bank - Additional Tables Migration
-- Version: 030
-- Description: Creates missing tables for ERC-3009, 
--              x402 protocol, and subscription features
-- ============================================

-- ============================================
-- 1. Subscription Authorizations Table
-- Stores pre-signed ERC-3009 authorizations for subscriptions
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_address TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  token_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  nonce TEXT NOT NULL,
  valid_after TIMESTAMPTZ NOT NULL,
  valid_before TIMESTAMPTZ NOT NULL,
  signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, used, expired, revoked
  used_at TIMESTAMPTZ,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sub_auth_subscription ON subscription_authorizations(subscription_id);
CREATE INDEX idx_sub_auth_user ON subscription_authorizations(user_address);
CREATE INDEX idx_sub_auth_status ON subscription_authorizations(status);
CREATE INDEX idx_sub_auth_valid_before ON subscription_authorizations(valid_before);

-- ============================================
-- 2. Failed Transactions Table
-- Tracks failed transactions for retry/recovery
-- ============================================

CREATE TABLE IF NOT EXISTS failed_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_type TEXT NOT NULL, -- subscription, x402, batch, transfer
  reference_id UUID, -- subscription_id, authorization_id, etc.
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  token TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_retry_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, retrying, recovered, abandoned
  recovered_tx_hash TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_failed_tx_type ON failed_transactions(tx_type);
CREATE INDEX idx_failed_tx_status ON failed_transactions(status);
CREATE INDEX idx_failed_tx_reference ON failed_transactions(reference_id);
CREATE INDEX idx_failed_tx_next_retry ON failed_transactions(next_retry_at) 
  WHERE status IN ('pending', 'retrying');

-- ============================================
-- 3. x402 Audit Logs Table
-- Comprehensive audit trail for x402 operations
-- ============================================

CREATE TABLE IF NOT EXISTS x402_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_id UUID REFERENCES x402_authorizations(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- created, signed, submitted, executed, failed, cancelled, expired
  actor TEXT, -- wallet address or system
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_x402_audit_auth ON x402_audit_logs(authorization_id);
CREATE INDEX idx_x402_audit_action ON x402_audit_logs(action);
CREATE INDEX idx_x402_audit_actor ON x402_audit_logs(actor);
CREATE INDEX idx_x402_audit_created ON x402_audit_logs(created_at DESC);

-- ============================================
-- 4. x402 Nonces Table
-- Manages nonces for ERC-3009 authorizations
-- ============================================

CREATE TABLE IF NOT EXISTS x402_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  current_nonce BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(address, chain_id)
);

CREATE INDEX idx_x402_nonces_address ON x402_nonces(address);
CREATE INDEX idx_x402_nonces_chain ON x402_nonces(chain_id);

-- ============================================
-- 5. x402 Used Nonces Table
-- Prevents nonce replay attacks
-- ============================================

CREATE TABLE IF NOT EXISTS x402_used_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  nonce TEXT NOT NULL,
  authorization_id UUID,
  tx_hash TEXT,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(address, chain_id, nonce)
);

CREATE INDEX idx_x402_used_nonces_address ON x402_used_nonces(address);
CREATE INDEX idx_x402_used_nonces_chain ON x402_used_nonces(chain_id);

-- ============================================
-- 6. Relayer Transactions Table
-- Tracks all relayed transactions
-- ============================================

CREATE TABLE IF NOT EXISTS relayer_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT, -- Gelato/Biconomy task ID
  provider TEXT NOT NULL, -- gelato, biconomy, defender, custom
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  function_name TEXT,
  function_data TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, submitted, confirmed, failed
  tx_hash TEXT,
  gas_used TEXT,
  gas_price TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_relayer_tx_task ON relayer_transactions(task_id);
CREATE INDEX idx_relayer_tx_provider ON relayer_transactions(provider);
CREATE INDEX idx_relayer_tx_status ON relayer_transactions(status);
CREATE INDEX idx_relayer_tx_from ON relayer_transactions(from_address);
CREATE INDEX idx_relayer_tx_created ON relayer_transactions(created_at DESC);

-- ============================================
-- 7. Cron Execution Logs Table
-- Tracks cron job executions
-- ============================================

CREATE TABLE IF NOT EXISTS cron_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL, -- subscriptions, cleanup, etc.
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed
  items_processed INTEGER DEFAULT 0,
  items_succeeded INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error_message TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cron_logs_job ON cron_execution_logs(job_name);
CREATE INDEX idx_cron_logs_status ON cron_execution_logs(status);
CREATE INDEX idx_cron_logs_started ON cron_execution_logs(started_at DESC);

-- ============================================
-- Row Level Security Policies
-- ============================================

-- Enable RLS on new tables
ALTER TABLE subscription_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE x402_used_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE relayer_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_execution_logs ENABLE ROW LEVEL SECURITY;

-- Subscription Authorizations Policies
CREATE POLICY "Users can view own subscription authorizations"
  ON subscription_authorizations FOR SELECT
  USING (lower(user_address) = lower(auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Service role full access to subscription_authorizations"
  ON subscription_authorizations FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Failed Transactions Policies
CREATE POLICY "Users can view own failed transactions"
  ON failed_transactions FOR SELECT
  USING (lower(from_address) = lower(auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Service role full access to failed_transactions"
  ON failed_transactions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- x402 Audit Logs Policies
CREATE POLICY "Users can view own audit logs"
  ON x402_audit_logs FOR SELECT
  USING (
    lower(actor) = lower(auth.jwt() ->> 'wallet_address')
    OR authorization_id IN (
      SELECT id FROM x402_authorizations 
      WHERE lower(from_address) = lower(auth.jwt() ->> 'wallet_address')
    )
  );

CREATE POLICY "Service role full access to x402_audit_logs"
  ON x402_audit_logs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- x402 Nonces Policies
CREATE POLICY "Users can view own nonces"
  ON x402_nonces FOR SELECT
  USING (lower(address) = lower(auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Users can update own nonces"
  ON x402_nonces FOR UPDATE
  USING (lower(address) = lower(auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Service role full access to x402_nonces"
  ON x402_nonces FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- x402 Used Nonces Policies
CREATE POLICY "Users can view own used nonces"
  ON x402_used_nonces FOR SELECT
  USING (lower(address) = lower(auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Service role full access to x402_used_nonces"
  ON x402_used_nonces FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Relayer Transactions Policies
CREATE POLICY "Users can view own relayer transactions"
  ON relayer_transactions FOR SELECT
  USING (lower(from_address) = lower(auth.jwt() ->> 'wallet_address'));

CREATE POLICY "Service role full access to relayer_transactions"
  ON relayer_transactions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Cron Execution Logs Policies (admin only)
CREATE POLICY "Service role full access to cron_execution_logs"
  ON cron_execution_logs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- Helper Functions
-- ============================================

-- Function to get or create nonce for an address
CREATE OR REPLACE FUNCTION get_next_nonce(
  p_address TEXT,
  p_chain_id INTEGER
) RETURNS TEXT AS $$
DECLARE
  v_nonce BIGINT;
BEGIN
  -- Try to get existing nonce
  SELECT current_nonce INTO v_nonce
  FROM x402_nonces
  WHERE lower(address) = lower(p_address) AND chain_id = p_chain_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    -- Create new entry
    INSERT INTO x402_nonces (address, chain_id, current_nonce)
    VALUES (lower(p_address), p_chain_id, 1)
    RETURNING current_nonce INTO v_nonce;
    RETURN '0';
  END IF;
  
  -- Increment and return old value
  UPDATE x402_nonces 
  SET current_nonce = current_nonce + 1, updated_at = NOW()
  WHERE lower(address) = lower(p_address) AND chain_id = p_chain_id;
  
  RETURN v_nonce::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to mark nonce as used
CREATE OR REPLACE FUNCTION mark_nonce_used(
  p_address TEXT,
  p_chain_id INTEGER,
  p_nonce TEXT,
  p_authorization_id UUID DEFAULT NULL,
  p_tx_hash TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO x402_used_nonces (address, chain_id, nonce, authorization_id, tx_hash)
  VALUES (lower(p_address), p_chain_id, p_nonce, p_authorization_id, p_tx_hash)
  ON CONFLICT (address, chain_id, nonce) DO NOTHING;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to check if nonce is used
CREATE OR REPLACE FUNCTION is_nonce_used(
  p_address TEXT,
  p_chain_id INTEGER,
  p_nonce TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM x402_used_nonces
    WHERE lower(address) = lower(p_address)
      AND chain_id = p_chain_id
      AND nonce = p_nonce
  );
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired authorizations
CREATE OR REPLACE FUNCTION cleanup_expired_subscription_authorizations()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE subscription_authorizations
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active'
    AND valid_before < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to log cron execution
CREATE OR REPLACE FUNCTION log_cron_start(p_job_name TEXT)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO cron_execution_logs (job_name, status)
  VALUES (p_job_name, 'running')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_cron_complete(
  p_id UUID,
  p_processed INTEGER,
  p_succeeded INTEGER,
  p_failed INTEGER,
  p_details JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
  UPDATE cron_execution_logs
  SET status = 'completed',
      completed_at = NOW(),
      items_processed = p_processed,
      items_succeeded = p_succeeded,
      items_failed = p_failed,
      details = p_details
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_cron_failed(
  p_id UUID,
  p_error TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE cron_execution_logs
  SET status = 'failed',
      completed_at = NOW(),
      error_message = p_error
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Triggers for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscription_authorizations_updated_at
  BEFORE UPDATE ON subscription_authorizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_failed_transactions_updated_at
  BEFORE UPDATE ON failed_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_x402_nonces_updated_at
  BEFORE UPDATE ON x402_nonces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_relayer_transactions_updated_at
  BEFORE UPDATE ON relayer_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Grants (if using Supabase with anon/authenticated)
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant access to functions
GRANT EXECUTE ON FUNCTION get_next_nonce TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mark_nonce_used TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_nonce_used TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_subscription_authorizations TO service_role;
GRANT EXECUTE ON FUNCTION log_cron_start TO service_role;
GRANT EXECUTE ON FUNCTION log_cron_complete TO service_role;
GRANT EXECUTE ON FUNCTION log_cron_failed TO service_role;

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE subscription_authorizations IS 'Pre-signed ERC-3009 authorizations for recurring subscription payments';
COMMENT ON TABLE failed_transactions IS 'Failed transactions queue for retry/recovery operations';
COMMENT ON TABLE x402_audit_logs IS 'Audit trail for all x402 protocol operations';
COMMENT ON TABLE x402_nonces IS 'Nonce management for ERC-3009 authorizations';
COMMENT ON TABLE x402_used_nonces IS 'Registry of used nonces to prevent replay attacks';
COMMENT ON TABLE relayer_transactions IS 'Tracks all gasless transactions sent via relayers';
COMMENT ON TABLE cron_execution_logs IS 'Execution logs for scheduled background jobs';

-- ============================================
-- Migration Complete
-- ============================================
