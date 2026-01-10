-- Multi-signature wallet support and API key management
-- Created: 2024

-- ===========================================
-- 1. Multi-sig Wallets Table
-- ===========================================
CREATE TABLE IF NOT EXISTS multisig_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 1,
  threshold INTEGER NOT NULL DEFAULT 2,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  safe_version TEXT DEFAULT '1.3.0',
  UNIQUE(wallet_address, chain_id)
);

-- ===========================================
-- 2. Multi-sig Signers Table
-- ===========================================
CREATE TABLE IF NOT EXISTS multisig_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  multisig_id UUID NOT NULL REFERENCES multisig_wallets(id) ON DELETE CASCADE,
  signer_address TEXT NOT NULL,
  signer_name TEXT,
  signer_email TEXT,
  added_by TEXT NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(multisig_id, signer_address)
);

-- ===========================================
-- 3. Multi-sig Transactions Table
-- ===========================================
CREATE TABLE IF NOT EXISTS multisig_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  multisig_id UUID NOT NULL REFERENCES multisig_wallets(id) ON DELETE CASCADE,
  safe_tx_hash TEXT UNIQUE,
  to_address TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '0',
  data TEXT,
  operation INTEGER DEFAULT 0,
  safe_nonce INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_at TIMESTAMP WITH TIME ZONE,
  execution_tx_hash TEXT,
  description TEXT,
  token_symbol TEXT,
  amount_usd NUMERIC
);

-- ===========================================
-- 4. Multi-sig Confirmations Table
-- ===========================================
CREATE TABLE IF NOT EXISTS multisig_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES multisig_transactions(id) ON DELETE CASCADE,
  signer_address TEXT NOT NULL,
  signature TEXT NOT NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(transaction_id, signer_address)
);

-- ===========================================
-- 5. API Keys Table
-- ===========================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '["read"]',
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER DEFAULT 10000,
  allowed_ips TEXT[],
  allowed_origins TEXT[],
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- 6. API Key Usage Logs Table
-- ===========================================
CREATE TABLE IF NOT EXISTS api_key_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  request_body_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- 7. Webhooks Table
-- ===========================================
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  retry_count INTEGER DEFAULT 3,
  timeout_ms INTEGER DEFAULT 30000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- 8. Webhook Deliveries Table
-- ===========================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- ===========================================
-- RLS Policies
-- ===========================================

-- Multisig wallets
ALTER TABLE multisig_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their multisig wallets" ON multisig_wallets
  FOR SELECT USING (true);
CREATE POLICY "Users can create multisig wallets" ON multisig_wallets
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Creators can update their multisig wallets" ON multisig_wallets
  FOR UPDATE USING (created_by = current_setting('request.jwt.claims', true)::json->>'sub');

-- Multisig signers
ALTER TABLE multisig_signers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view signers" ON multisig_signers
  FOR SELECT USING (true);
CREATE POLICY "Users can add signers" ON multisig_signers
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update signers" ON multisig_signers
  FOR UPDATE USING (true);

-- Multisig transactions
ALTER TABLE multisig_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view multisig transactions" ON multisig_transactions
  FOR SELECT USING (true);
CREATE POLICY "Users can create multisig transactions" ON multisig_transactions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update multisig transactions" ON multisig_transactions
  FOR UPDATE USING (true);

-- Multisig confirmations
ALTER TABLE multisig_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view confirmations" ON multisig_confirmations
  FOR SELECT USING (true);
CREATE POLICY "Signers can add confirmations" ON multisig_confirmations
  FOR INSERT WITH CHECK (true);

-- API keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their API keys" ON api_keys
  FOR SELECT USING (owner_address = current_setting('request.jwt.claims', true)::json->>'sub' OR owner_address = current_setting('app.current_user', true));
CREATE POLICY "Users can create API keys" ON api_keys
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their API keys" ON api_keys
  FOR UPDATE USING (owner_address = current_setting('request.jwt.claims', true)::json->>'sub' OR owner_address = current_setting('app.current_user', true));
CREATE POLICY "Users can delete their API keys" ON api_keys
  FOR DELETE USING (owner_address = current_setting('request.jwt.claims', true)::json->>'sub' OR owner_address = current_setting('app.current_user', true));

-- API key usage logs
ALTER TABLE api_key_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their API key logs" ON api_key_usage_logs
  FOR SELECT USING (true);
CREATE POLICY "System can insert API key logs" ON api_key_usage_logs
  FOR INSERT WITH CHECK (true);

-- Webhooks
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their webhooks" ON webhooks
  FOR SELECT USING (owner_address = current_setting('request.jwt.claims', true)::json->>'sub' OR owner_address = current_setting('app.current_user', true));
CREATE POLICY "Users can create webhooks" ON webhooks
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their webhooks" ON webhooks
  FOR UPDATE USING (owner_address = current_setting('request.jwt.claims', true)::json->>'sub' OR owner_address = current_setting('app.current_user', true));
CREATE POLICY "Users can delete their webhooks" ON webhooks
  FOR DELETE USING (owner_address = current_setting('request.jwt.claims', true)::json->>'sub' OR owner_address = current_setting('app.current_user', true));

-- Webhook deliveries
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view webhook deliveries" ON webhook_deliveries
  FOR SELECT USING (true);
CREATE POLICY "System can manage webhook deliveries" ON webhook_deliveries
  FOR ALL USING (true);

-- ===========================================
-- Indexes
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_multisig_wallets_created_by ON multisig_wallets(created_by);
CREATE INDEX IF NOT EXISTS idx_multisig_signers_address ON multisig_signers(signer_address);
CREATE INDEX IF NOT EXISTS idx_multisig_transactions_status ON multisig_transactions(status);
CREATE INDEX IF NOT EXISTS idx_api_keys_owner ON api_keys(owner_address);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_webhooks_owner ON webhooks(owner_address);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
