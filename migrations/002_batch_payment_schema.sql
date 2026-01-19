-- Batch Payment Flow Schema (Spec: .kiro/specs/batch-payment-flow)
-- Creates batch_payments, payment_items, batch_drafts, payment_audit_logs

BEGIN;

CREATE TABLE IF NOT EXISTS batch_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  batch_name VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  -- Status: draft, pending_confirmation, processing, completed, failed, cancelled
  total_amount DECIMAL(38, 18) NOT NULL DEFAULT 0,
  total_fee DECIMAL(38, 18) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'standard', -- 'standard' or 'x402'
  item_count INT NOT NULL DEFAULT 0,
  successful_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batch_payments_user_id ON batch_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_payments_status ON batch_payments(status);
CREATE INDEX IF NOT EXISTS idx_batch_payments_created_at ON batch_payments(created_at);

CREATE TABLE IF NOT EXISTS payment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batch_payments(id) ON DELETE CASCADE,
  recipient_address VARCHAR(42) NOT NULL,
  amount DECIMAL(38, 18) NOT NULL,
  token_symbol VARCHAR(20) NOT NULL,
  token_address VARCHAR(42),
  chain_id INT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  transaction_hash VARCHAR(255),
  error_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_items_batch_id ON payment_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_payment_items_status ON payment_items(status);
CREATE INDEX IF NOT EXISTS idx_payment_items_recipient ON payment_items(recipient_address);

CREATE TABLE IF NOT EXISTS batch_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  draft_name VARCHAR(255),
  file_data JSONB NOT NULL,
  validation_status JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_batch_drafts_user_id ON batch_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_drafts_expires_at ON batch_drafts(expires_at);

CREATE TABLE IF NOT EXISTS payment_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES batch_payments(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_batch_id ON payment_audit_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_user_id ON payment_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_action ON payment_audit_logs(action);

COMMIT;
