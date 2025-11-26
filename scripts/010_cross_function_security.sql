-- Cross-Function Security Enhancement Migration
-- Adds tables and functions to prevent mixed attacks across module boundaries

-- 1. Session binding table - ties wallet addresses to authenticated sessions
CREATE TABLE IF NOT EXISTS session_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL,
  binding_proof TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  transaction_count INTEGER DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  CONSTRAINT valid_wallet_address CHECK (wallet_address ~* '^0x[a-fA-F0-9]{40}$')
);

CREATE INDEX idx_session_bindings_wallet ON session_bindings(wallet_address);
CREATE INDEX idx_session_bindings_active ON session_bindings(is_active, last_activity);

-- 2. State snapshots table - for state consistency verification
CREATE TABLE IF NOT EXISTS state_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES session_bindings(session_id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  balances JSONB NOT NULL DEFAULT '{}',
  nonce TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes'
);

CREATE INDEX idx_state_snapshots_session ON state_snapshots(session_id);
CREATE INDEX idx_state_snapshots_nonce ON state_snapshots(nonce);
CREATE INDEX idx_state_snapshots_expires ON state_snapshots(expires_at);

-- 3. Transaction call chains - ensures security functions called in order
CREATE TABLE IF NOT EXISTS transaction_call_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL,
  function_name TEXT NOT NULL,
  function_params JSONB,
  result TEXT CHECK (result IN ('success', 'failure', 'pending')),
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  session_id TEXT REFERENCES session_bindings(session_id)
);

CREATE INDEX idx_call_chains_tx ON transaction_call_chains(transaction_id);
CREATE INDEX idx_call_chains_session ON transaction_call_chains(session_id);

-- 4. Provider fingerprints - track wallet provider authenticity
CREATE TABLE IF NOT EXISTS provider_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES session_bindings(session_id) ON DELETE CASCADE,
  is_metamask BOOLEAN,
  is_coinbase BOOLEAN,
  is_walletconnect BOOLEAN,
  provider_count INTEGER,
  suspicious_properties TEXT[],
  is_authentic BOOLEAN NOT NULL,
  warnings TEXT[],
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_provider_fingerprints_session ON provider_fingerprints(session_id);
CREATE INDEX idx_provider_fingerprints_suspicious ON provider_fingerprints(is_authentic) WHERE NOT is_authentic;

-- 5. Combined attack detection log
CREATE TABLE IF NOT EXISTS attack_detection_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  wallet_address TEXT,
  detected_patterns TEXT[] NOT NULL,
  indicators TEXT[] NOT NULL,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  recommendations TEXT[],
  action_taken TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_attack_detection_session ON attack_detection_log(session_id);
CREATE INDEX idx_attack_detection_risk ON attack_detection_log(risk_score DESC);
CREATE INDEX idx_attack_detection_time ON attack_detection_log(detected_at DESC);

-- 6. Balance freshness tracking
CREATE TABLE IF NOT EXISTS balance_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_address TEXT,
  chain_id INTEGER NOT NULL,
  balance TEXT NOT NULL,
  block_number BIGINT,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_address, token_symbol, chain_id)
);

CREATE INDEX idx_balance_cache_wallet ON balance_cache(wallet_address);
CREATE INDEX idx_balance_cache_freshness ON balance_cache(fetched_at DESC);

-- 7. Transaction dependency graph
CREATE TABLE IF NOT EXISTS transaction_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL UNIQUE,
  transaction_type TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'confirmed', 'failed')) DEFAULT 'pending',
  depends_on TEXT[] DEFAULT '{}',
  session_id TEXT REFERENCES session_bindings(session_id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT
);

CREATE INDEX idx_tx_deps_status ON transaction_dependencies(status);
CREATE INDEX idx_tx_deps_session ON transaction_dependencies(session_id);

-- 8. Cross-context validation failures
CREATE TABLE IF NOT EXISTS cross_context_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  wallet_address TEXT,
  inconsistency_type TEXT NOT NULL,
  expected_value TEXT,
  actual_value TEXT,
  context_source TEXT, -- 'web3' or 'database'
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_cross_context_session ON cross_context_failures(session_id);
CREATE INDEX idx_cross_context_unresolved ON cross_context_failures(resolved) WHERE NOT resolved;

-- 9. Function to verify session binding before transaction
CREATE OR REPLACE FUNCTION verify_session_for_transaction(
  p_session_id TEXT,
  p_wallet_address TEXT,
  p_transaction_type TEXT
) RETURNS TABLE(
  allowed BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_session session_bindings%ROWTYPE;
  v_max_age INTERVAL := INTERVAL '1 hour';
  v_max_transactions INTEGER := 50;
BEGIN
  -- Find the session
  SELECT * INTO v_session
  FROM session_bindings
  WHERE session_id = p_session_id AND is_active = TRUE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Session not found or inactive'::TEXT;
    RETURN;
  END IF;
  
  -- Verify wallet matches
  IF LOWER(v_session.wallet_address) != LOWER(p_wallet_address) THEN
    -- Log potential session hijacking
    INSERT INTO attack_detection_log (session_id, wallet_address, detected_patterns, indicators, risk_score, action_taken)
    VALUES (p_session_id, p_wallet_address, ARRAY['Session Hijacking'], ARRAY['wallet_mismatch'], 90, 'Transaction blocked');
    
    RETURN QUERY SELECT FALSE, 'Wallet address mismatch - potential session hijacking'::TEXT;
    RETURN;
  END IF;
  
  -- Check session age
  IF NOW() - v_session.created_at > v_max_age THEN
    UPDATE session_bindings SET is_active = FALSE WHERE session_id = p_session_id;
    RETURN QUERY SELECT FALSE, 'Session expired'::TEXT;
    RETURN;
  END IF;
  
  -- Check transaction count
  IF v_session.transaction_count >= v_max_transactions THEN
    RETURN QUERY SELECT FALSE, 'Session transaction limit reached'::TEXT;
    RETURN;
  END IF;
  
  -- Update session activity
  UPDATE session_bindings 
  SET last_activity = NOW(), transaction_count = transaction_count + 1
  WHERE session_id = p_session_id;
  
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Function to validate transaction call chain
CREATE OR REPLACE FUNCTION validate_call_chain(
  p_transaction_id TEXT,
  p_operation_type TEXT
) RETURNS TABLE(
  valid BOOLEAN,
  missing_steps TEXT[],
  out_of_order_steps TEXT[]
) AS $$
DECLARE
  v_required_sequence TEXT[];
  v_executed_functions TEXT[];
  v_missing TEXT[] := '{}';
  v_out_of_order TEXT[] := '{}';
  v_last_index INTEGER := -1;
  v_current_index INTEGER;
  v_func TEXT;
BEGIN
  -- Define required sequences for different operation types
  CASE p_operation_type
    WHEN 'executePayment' THEN
      v_required_sequence := ARRAY['validateAddress', 'validateAmount', 'checkRateLimit', 'verifyBalance', 'createAuditLog'];
    WHEN 'batchPayment' THEN
      v_required_sequence := ARRAY['validateAllAddresses', 'validateTotalAmount', 'checkBatchLimit', 'verifyTotalBalance', 'createBatchAudit'];
    WHEN 'approveToken' THEN
      v_required_sequence := ARRAY['checkExistingApproval', 'validateSpender', 'calculateSafeAmount', 'createApprovalAudit'];
    ELSE
      v_required_sequence := '{}';
  END CASE;
  
  -- Get executed functions in order
  SELECT ARRAY_AGG(function_name ORDER BY executed_at)
  INTO v_executed_functions
  FROM transaction_call_chains
  WHERE transaction_id = p_transaction_id AND result = 'success';
  
  IF v_executed_functions IS NULL THEN
    v_executed_functions := '{}';
  END IF;
  
  -- Check each required function
  FOREACH v_func IN ARRAY v_required_sequence LOOP
    v_current_index := array_position(v_executed_functions, v_func);
    
    IF v_current_index IS NULL THEN
      v_missing := array_append(v_missing, v_func);
    ELSIF v_current_index < v_last_index THEN
      v_out_of_order := array_append(v_out_of_order, v_func);
    END IF;
    
    IF v_current_index IS NOT NULL THEN
      v_last_index := GREATEST(v_last_index, v_current_index);
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT 
    (array_length(v_missing, 1) IS NULL AND array_length(v_out_of_order, 1) IS NULL),
    v_missing,
    v_out_of_order;
END;
$$ LANGUAGE plpgsql;

-- 11. Cleanup function for expired data
CREATE OR REPLACE FUNCTION cleanup_expired_security_data() RETURNS void AS $$
BEGIN
  -- Remove expired state snapshots
  DELETE FROM state_snapshots WHERE expires_at < NOW();
  
  -- Deactivate old sessions
  UPDATE session_bindings 
  SET is_active = FALSE 
  WHERE last_activity < NOW() - INTERVAL '1 hour';
  
  -- Remove old balance cache entries
  DELETE FROM balance_cache WHERE fetched_at < NOW() - INTERVAL '1 day';
  
  -- Archive old attack detection logs (keep 30 days)
  DELETE FROM attack_detection_log WHERE detected_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 12. RLS Policies for security tables
ALTER TABLE session_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_call_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE attack_detection_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_context_failures ENABLE ROW LEVEL SECURITY;

-- Service role can access all security data
CREATE POLICY "Service role full access to session_bindings" ON session_bindings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to state_snapshots" ON state_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to transaction_call_chains" ON transaction_call_chains
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to provider_fingerprints" ON provider_fingerprints
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to attack_detection_log" ON attack_detection_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to balance_cache" ON balance_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to transaction_dependencies" ON transaction_dependencies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to cross_context_failures" ON cross_context_failures
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add comments
COMMENT ON TABLE session_bindings IS 'Binds wallet addresses to authenticated sessions for security verification';
COMMENT ON TABLE state_snapshots IS 'Stores state snapshots for consistency verification between operations';
COMMENT ON TABLE transaction_call_chains IS 'Tracks security function call sequences for validation';
COMMENT ON TABLE provider_fingerprints IS 'Records wallet provider authenticity checks';
COMMENT ON TABLE attack_detection_log IS 'Logs detected attack patterns and responses';
COMMENT ON TABLE balance_cache IS 'Caches token balances with freshness tracking';
COMMENT ON TABLE transaction_dependencies IS 'Manages transaction dependency graph for ordered execution';
COMMENT ON TABLE cross_context_failures IS 'Records inconsistencies between Web3 and database contexts';
