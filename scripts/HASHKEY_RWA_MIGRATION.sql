-- ============================================
-- HashKey & RWA Support Migration
-- Feature: Corporate Cards (Rain) & Fiat On-Ramp (Transak)
-- ============================================

-- 1. Corporate Cards Table
-- Stores the details of virtual/physical cards issued by Rain
CREATE TABLE IF NOT EXISTS corporate_cards (
  id TEXT PRIMARY KEY,               -- Internal UUID
  external_id TEXT UNIQUE NOT NULL,  -- Rain Card ID
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'INACTIVE',    -- ACTIVE, FROZEN, CLOSED
  last4 TEXT,
  currency TEXT DEFAULT 'USD',
  balance DOUBLE PRECISION DEFAULT 0.0,
  spending_limit DOUBLE PRECISION,
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3),

  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_corporate_cards_user_id ON corporate_cards(user_id);
CREATE INDEX idx_corporate_cards_external_id ON corporate_cards(external_id);


-- 2. Card Transactions Table
-- Records spending, refunds, and settlements on corporate cards
CREATE TABLE IF NOT EXISTS card_transactions (
  id TEXT PRIMARY KEY,               -- Internal UUID
  external_id TEXT UNIQUE NOT NULL,  -- Rain Transaction ID
  card_id TEXT NOT NULL,
  merchant_name TEXT,
  merchant_category TEXT,
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,              -- PENDING, COMPLETED, DECLINED
  type TEXT NOT NULL,                -- AUTHORIZATION, SETTLEMENT, REFUND
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3),

  FOREIGN KEY (card_id) REFERENCES corporate_cards(id) ON DELETE CASCADE
);

CREATE INDEX idx_card_transactions_card_id ON card_transactions(card_id);
CREATE INDEX idx_card_transactions_external_id ON card_transactions(external_id);


-- 3. Fiat Orders Table
-- Tracks on-ramp orders from Transak/MoonPay
CREATE TABLE IF NOT EXISTS fiat_orders (
  id TEXT PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL,     -- Provider Order ID
  user_id TEXT,
  provider TEXT DEFAULT 'TRANSAK',
  status TEXT NOT NULL,
  fiat_amount DOUBLE PRECISION NOT NULL,
  fiat_currency TEXT NOT NULL,
  crypto_amount DOUBLE PRECISION NOT NULL,
  crypto_currency TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  tx_hash TEXT,
  network TEXT,
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3),

  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_fiat_orders_user_id ON fiat_orders(user_id);
CREATE INDEX idx_fiat_orders_order_id ON fiat_orders(order_id);

-- 4. Audit Log Update (Optional Index)
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON security_audit_logs(created_at);
