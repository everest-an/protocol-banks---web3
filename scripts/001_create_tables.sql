-- Create vendors table to store supplier wallet addresses and metadata
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payments table to store all payment transactions
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash TEXT UNIQUE,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  token_symbol TEXT NOT NULL,
  token_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  amount_usd NUMERIC(20, 2),
  status TEXT NOT NULL DEFAULT 'pending',
  block_number BIGINT,
  gas_used TEXT,
  gas_price TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create batch_payments table to group multiple payments together
CREATE TABLE IF NOT EXISTS batch_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name TEXT,
  wallet_address TEXT NOT NULL,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  total_amount_usd NUMERIC(20, 2),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create batch_payment_items to link payments to batches
CREATE TABLE IF NOT EXISTS batch_payment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES batch_payments(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vendors_wallet ON vendors(wallet_address);
CREATE INDEX IF NOT EXISTS idx_vendors_created_by ON vendors(created_by);
CREATE INDEX IF NOT EXISTS idx_payments_from ON payments(from_address);
CREATE INDEX IF NOT EXISTS idx_payments_to ON payments(to_address);
CREATE INDEX IF NOT EXISTS idx_payments_vendor ON payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payments_timestamp ON payments(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_batch_payments_wallet ON batch_payments(wallet_address);
CREATE INDEX IF NOT EXISTS idx_batch_payment_items_batch ON batch_payment_items(batch_id);
