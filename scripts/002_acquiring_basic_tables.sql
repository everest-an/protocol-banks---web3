-- Protocol Banks Acquiring Module Basic Tables
-- Created: 2026-01-24

-- 1. Merchants Table
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  wallet_address VARCHAR(42) NOT NULL,
  callback_url TEXT,
  status VARCHAR(20) DEFAULT 'active', -- active, suspended
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Merchant API Keys Table
CREATE TABLE IF NOT EXISTS merchant_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  key_id VARCHAR(32) UNIQUE NOT NULL,
  key_secret_hash VARCHAR(128) NOT NULL, -- Store hash value, not plaintext
  name VARCHAR(100),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Acquiring Orders Table
CREATE TABLE IF NOT EXISTS acquiring_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no VARCHAR(32) UNIQUE NOT NULL,
  merchant_id UUID NOT NULL,
  amount DECIMAL(20,8) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  token VARCHAR(20) DEFAULT 'USDC', -- USDC, USDT, DAI
  chain_id INTEGER DEFAULT 8453, -- Base chain
  payment_method VARCHAR(50), -- crypto_transfer, binance_pay, kucoin_pay
  status VARCHAR(20) DEFAULT 'pending', -- pending, paid, expired, cancelled
  payer_address VARCHAR(42),
  tx_hash VARCHAR(66),
  notify_url TEXT,
  return_url TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Merchant Balances Table (Simplified)
CREATE TABLE IF NOT EXISTS merchant_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  token VARCHAR(20) NOT NULL,
  balance DECIMAL(20,8) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_id, token)
);

ALTER TABLE merchants DROP CONSTRAINT IF EXISTS merchants_user_id_fkey;
ALTER TABLE merchant_api_keys DROP CONSTRAINT IF EXISTS merchant_api_keys_merchant_id_fkey;
ALTER TABLE acquiring_orders DROP CONSTRAINT IF EXISTS acquiring_orders_merchant_id_fkey;
ALTER TABLE merchant_balances DROP CONSTRAINT IF EXISTS merchant_balances_merchant_id_fkey;

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_merchants_user_id ON merchants(user_id);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);

CREATE INDEX IF NOT EXISTS idx_api_keys_merchant_id ON merchant_api_keys(merchant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON merchant_api_keys(key_id);

CREATE INDEX IF NOT EXISTS idx_orders_merchant_id ON acquiring_orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_no ON acquiring_orders(order_no);
CREATE INDEX IF NOT EXISTS idx_orders_status ON acquiring_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON acquiring_orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_balances_merchant_id ON merchant_balances(merchant_id);

-- Add Comments
COMMENT ON TABLE merchants IS 'Merchant information table';
COMMENT ON TABLE merchant_api_keys IS 'Merchant API keys table';
COMMENT ON TABLE acquiring_orders IS 'Acquiring orders table';
COMMENT ON TABLE merchant_balances IS 'Merchant balances table';
