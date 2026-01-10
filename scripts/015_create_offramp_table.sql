-- Create off-ramp transactions table
CREATE TABLE IF NOT EXISTS offramp_transactions (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  provider TEXT NOT NULL,
  input_amount DECIMAL(20, 8) NOT NULL,
  input_token TEXT NOT NULL,
  output_amount DECIMAL(20, 2) NOT NULL,
  output_currency TEXT NOT NULL DEFAULT 'USD',
  chain_id INTEGER NOT NULL DEFAULT 8453,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  bank_reference TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_offramp_wallet ON offramp_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_offramp_status ON offramp_transactions(status);
CREATE INDEX IF NOT EXISTS idx_offramp_created ON offramp_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE offramp_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own transactions
CREATE POLICY "Users can view own offramp transactions"
  ON offramp_transactions FOR SELECT
  USING (true);

-- RLS Policy: Users can insert their own transactions
CREATE POLICY "Users can insert offramp transactions"
  ON offramp_transactions FOR INSERT
  WITH CHECK (true);
