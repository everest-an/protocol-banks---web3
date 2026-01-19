-- Email Login Flow Schema (Spec: .kiro/specs/email-login-flow)
-- Creates required tables and columns per requirements/design

BEGIN;

-- auth_users: add status + PIN + integrity fields
ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'pending_verification',
  ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_status ON auth_users(status);

-- auth_sessions: bind wallet + activity flag
ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_auth_sessions_wallet ON auth_sessions(wallet_address);

-- embedded_wallets: align with multi-chain + Shamir shares
ALTER TABLE embedded_wallets
  ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(42),
  ADD COLUMN IF NOT EXISTS public_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS chain_id INT,
  ADD COLUMN IF NOT EXISTS share_a_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS share_a_iv TEXT,
  ADD COLUMN IF NOT EXISTS share_b_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS share_b_iv TEXT,
  ADD COLUMN IF NOT EXISTS share_c_recovery TEXT,
  ADD COLUMN IF NOT EXISTS share_c_iv TEXT,
  ADD COLUMN IF NOT EXISTS recovery_phrase_hash TEXT;

UPDATE embedded_wallets SET wallet_address = address WHERE wallet_address IS NULL;

CREATE INDEX IF NOT EXISTS idx_embedded_wallets_wallet_address ON embedded_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_embedded_wallets_chain_id ON embedded_wallets(chain_id);

-- email_verifications: magic link tokens (hashed)
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

-- audit_logs: auth/audit trail
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

COMMIT;
