-- x402 Protocol Schema (Spec: .kiro/specs/x402-protocol)
-- Tables: x402_authorizations, x402_nonces, x402_used_nonces, x402_executions, x402_audit_logs

BEGIN;

CREATE TABLE IF NOT EXISTS x402_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token_address VARCHAR(42) NOT NULL,
  chain_id INT NOT NULL,
  from_address VARCHAR(42) NOT NULL,
  to_address VARCHAR(42) NOT NULL,
  amount DECIMAL(38, 18) NOT NULL,
  nonce INT NOT NULL,
  valid_after TIMESTAMPTZ NOT NULL,
  valid_before TIMESTAMPTZ NOT NULL,
  signature TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, submitted, executed, failed, expired, cancelled
  transaction_hash VARCHAR(255),
  relayer_address VARCHAR(42),
  relayer_fee DECIMAL(38, 18),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  executed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_x402_authorizations_user_id ON x402_authorizations(user_id);
CREATE INDEX IF NOT EXISTS idx_x402_authorizations_status ON x402_authorizations(status);
CREATE INDEX IF NOT EXISTS idx_x402_authorizations_token ON x402_authorizations(token_address, chain_id);
CREATE INDEX IF NOT EXISTS idx_x402_authorizations_valid_before ON x402_authorizations(valid_before);

CREATE TABLE IF NOT EXISTS x402_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token_address VARCHAR(42) NOT NULL,
  chain_id INT NOT NULL,
  current_nonce INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, token_address, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_x402_nonces_user_id ON x402_nonces(user_id);

CREATE TABLE IF NOT EXISTS x402_used_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token_address VARCHAR(42) NOT NULL,
  chain_id INT NOT NULL,
  nonce INT NOT NULL,
  used_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, token_address, chain_id, nonce)
);

CREATE INDEX IF NOT EXISTS idx_x402_used_nonces_user_id ON x402_used_nonces(user_id);

CREATE TABLE IF NOT EXISTS x402_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_id UUID NOT NULL REFERENCES x402_authorizations(id) ON DELETE CASCADE,
  relayer_id UUID,
  transaction_hash VARCHAR(255) NOT NULL UNIQUE,
  block_number INT,
  gas_used INT,
  actual_fee DECIMAL(38, 18),
  status VARCHAR(50) NOT NULL, -- pending, confirmed, failed
  error_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_x402_executions_authorization_id ON x402_executions(authorization_id);
CREATE INDEX IF NOT EXISTS idx_x402_executions_tx_hash ON x402_executions(transaction_hash);

CREATE TABLE IF NOT EXISTS x402_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_id UUID REFERENCES x402_authorizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_x402_audit_logs_authorization_id ON x402_audit_logs(authorization_id);
CREATE INDEX IF NOT EXISTS idx_x402_audit_logs_user_id ON x402_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_x402_audit_logs_action ON x402_audit_logs(action);

COMMIT;
