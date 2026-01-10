-- Create subscriptions table for personal payment management
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address TEXT NOT NULL,
  service_name TEXT NOT NULL,
  service_icon TEXT,
  wallet_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  token TEXT NOT NULL DEFAULT 'USDC',
  frequency TEXT NOT NULL DEFAULT 'monthly', -- weekly, monthly, yearly
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, cancelled
  category TEXT DEFAULT 'other', -- streaming, saas, membership, utility, other
  next_payment_date TIMESTAMP WITH TIME ZONE,
  last_payment_date TIMESTAMP WITH TIME ZONE,
  total_paid TEXT DEFAULT '0',
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  chain_id INTEGER DEFAULT 1,
  max_amount TEXT, -- Maximum allowed per payment (protection)
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create auto_payments table for enterprise recurring payments
CREATE TABLE IF NOT EXISTS auto_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address TEXT NOT NULL,
  vendor_id UUID REFERENCES vendors(id),
  vendor_name TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  token TEXT NOT NULL DEFAULT 'USDC',
  frequency TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'active',
  max_amount TEXT,
  next_payment_date TIMESTAMP WITH TIME ZONE,
  last_payment_date TIMESTAMP WITH TIME ZONE,
  total_paid TEXT DEFAULT '0',
  chain_id INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions
CREATE POLICY "Users can view their subscriptions"
  ON subscriptions FOR SELECT
  USING (owner_address = current_setting('request.jwt.claims', true)::json->>'sub' 
         OR owner_address = current_setting('app.current_user', true));

CREATE POLICY "Users can create subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (owner_address = current_setting('request.jwt.claims', true)::json->>'sub'
              OR owner_address = current_setting('app.current_user', true));

CREATE POLICY "Users can update their subscriptions"
  ON subscriptions FOR UPDATE
  USING (owner_address = current_setting('request.jwt.claims', true)::json->>'sub'
         OR owner_address = current_setting('app.current_user', true));

CREATE POLICY "Users can delete their subscriptions"
  ON subscriptions FOR DELETE
  USING (owner_address = current_setting('request.jwt.claims', true)::json->>'sub'
         OR owner_address = current_setting('app.current_user', true));

-- RLS Policies for auto_payments
CREATE POLICY "Users can view their auto payments"
  ON auto_payments FOR SELECT
  USING (owner_address = current_setting('request.jwt.claims', true)::json->>'sub'
         OR owner_address = current_setting('app.current_user', true));

CREATE POLICY "Users can create auto payments"
  ON auto_payments FOR INSERT
  WITH CHECK (owner_address = current_setting('request.jwt.claims', true)::json->>'sub'
              OR owner_address = current_setting('app.current_user', true));

CREATE POLICY "Users can update their auto payments"
  ON auto_payments FOR UPDATE
  USING (owner_address = current_setting('request.jwt.claims', true)::json->>'sub'
         OR owner_address = current_setting('app.current_user', true));

CREATE POLICY "Users can delete their auto payments"
  ON auto_payments FOR DELETE
  USING (owner_address = current_setting('request.jwt.claims', true)::json->>'sub'
         OR owner_address = current_setting('app.current_user', true));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_owner ON subscriptions(owner_address);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_auto_payments_owner ON auto_payments(owner_address);
CREATE INDEX IF NOT EXISTS idx_auto_payments_status ON auto_payments(status);
