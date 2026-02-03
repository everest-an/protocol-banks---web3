-- ============================================
-- 029: Payment Links & Asset Distribution Tables
-- ============================================

-- Payment Links table - for no-code payment link creation
CREATE TABLE IF NOT EXISTS payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id TEXT UNIQUE NOT NULL,
  merchant_id UUID REFERENCES merchants(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount DECIMAL(20,8),
  currency VARCHAR(10) DEFAULT 'USD',
  token VARCHAR(20) DEFAULT 'USDC',
  recipient_address VARCHAR(42) NOT NULL,
  amount_type VARCHAR(20) DEFAULT 'fixed', -- fixed, dynamic, customer_input
  min_amount DECIMAL(20,8),
  max_amount DECIMAL(20,8),
  expires_at TIMESTAMPTZ,
  redirect_url TEXT,
  signature TEXT,
  status VARCHAR(20) DEFAULT 'active', -- active, paused, expired
  metadata JSONB DEFAULT '{}',
  -- Branding
  brand_color VARCHAR(7),
  logo_url TEXT,
  -- Asset distribution
  distribute_asset BOOLEAN DEFAULT false,
  asset_type VARCHAR(10), -- nft, token, erc1155
  asset_contract_address VARCHAR(42),
  asset_token_id TEXT,
  asset_amount TEXT,
  -- Stats
  total_payments INTEGER DEFAULT 0,
  total_amount DECIMAL(20,8) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Asset Distribution tracking table
CREATE TABLE IF NOT EXISTS asset_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_tx_hash VARCHAR(66),
  distribution_tx_hash VARCHAR(66),
  recipient_address VARCHAR(42) NOT NULL,
  asset_type VARCHAR(10) NOT NULL, -- nft, token, erc1155
  contract_address VARCHAR(42) NOT NULL,
  chain_id INTEGER NOT NULL,
  token_id TEXT,
  amount TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
  error TEXT,
  link_id TEXT REFERENCES payment_links(link_id),
  invoice_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add dual-currency columns to invoices table (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'amount_fiat'
  ) THEN
    ALTER TABLE invoices ADD COLUMN amount_fiat DECIMAL(20,2);
    ALTER TABLE invoices ADD COLUMN fiat_currency VARCHAR(10);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_links_merchant ON payment_links(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_status ON payment_links(status);
CREATE INDEX IF NOT EXISTS idx_payment_links_link_id ON payment_links(link_id);
CREATE INDEX IF NOT EXISTS idx_asset_distributions_payment ON asset_distributions(payment_tx_hash);
CREATE INDEX IF NOT EXISTS idx_asset_distributions_link ON asset_distributions(link_id);

-- RLS Policies
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_distributions ENABLE ROW LEVEL SECURITY;

-- Payment links: authenticated users can manage
CREATE POLICY "payment_links_insert" ON payment_links
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "payment_links_select" ON payment_links
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "payment_links_update" ON payment_links
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "payment_links_delete" ON payment_links
  FOR DELETE TO authenticated
  USING (true);

-- Public can read active payment links (for payment flow)
CREATE POLICY "payment_links_public_read" ON payment_links
  FOR SELECT TO anon
  USING (status = 'active');

-- Asset distributions: authenticated users can manage
CREATE POLICY "asset_distributions_insert" ON asset_distributions
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "asset_distributions_select" ON asset_distributions
  FOR SELECT TO authenticated
  USING (true);

-- Service role can manage distributions (for API)
CREATE POLICY "asset_distributions_service" ON asset_distributions
  FOR ALL TO service_role
  USING (true);
