-- User Cards table for Rain Card integration
CREATE TABLE IF NOT EXISTS user_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  rain_card_id TEXT UNIQUE, -- External Rain Card ID
  card_type TEXT NOT NULL CHECK (card_type IN ('virtual', 'physical')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'frozen', 'cancelled')),
  last_four TEXT NOT NULL,
  expiry_month TEXT NOT NULL,
  expiry_year TEXT NOT NULL,
  cardholder_name TEXT NOT NULL,
  billing_address JSONB,
  spending_limit DECIMAL(18, 2) DEFAULT 5000,
  balance DECIMAL(18, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Card Transactions table
CREATE TABLE IF NOT EXISTS card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES user_cards(id) ON DELETE CASCADE,
  rain_tx_id TEXT UNIQUE, -- External Rain Transaction ID
  type TEXT NOT NULL CHECK (type IN ('purchase', 'refund', 'topup', 'withdrawal')),
  amount DECIMAL(18, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  merchant_name TEXT,
  merchant_category TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'declined', 'reversed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_cards_wallet ON user_cards(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_cards_status ON user_cards(status);
CREATE INDEX IF NOT EXISTS idx_card_transactions_card_id ON card_transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_card_transactions_status ON card_transactions(status);

-- Enable RLS
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_cards
DROP POLICY IF EXISTS "Users can view own cards" ON user_cards;
CREATE POLICY "Users can view own cards" ON user_cards
  FOR SELECT USING (wallet_address = current_setting('app.current_user_address', true));

DROP POLICY IF EXISTS "Users can insert own cards" ON user_cards;
CREATE POLICY "Users can insert own cards" ON user_cards
  FOR INSERT WITH CHECK (wallet_address = current_setting('app.current_user_address', true));

DROP POLICY IF EXISTS "Users can update own cards" ON user_cards;
CREATE POLICY "Users can update own cards" ON user_cards
  FOR UPDATE USING (wallet_address = current_setting('app.current_user_address', true));

-- Service role access for webhooks
DROP POLICY IF EXISTS "Service role full access to cards" ON user_cards;
CREATE POLICY "Service role full access to cards" ON user_cards
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for card_transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON card_transactions;
CREATE POLICY "Users can view own transactions" ON card_transactions
  FOR SELECT USING (
    card_id IN (
      SELECT id FROM user_cards 
      WHERE wallet_address = current_setting('app.current_user_address', true)
    )
  );

DROP POLICY IF EXISTS "Service role full access to transactions" ON card_transactions;
CREATE POLICY "Service role full access to transactions" ON card_transactions
  FOR ALL USING (auth.role() = 'service_role');
