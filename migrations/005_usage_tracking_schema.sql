-- Migration: 005_usage_tracking_schema
-- Description: Create tables for API usage tracking and monetizer configurations
-- Created: 2026-01-22

-- ============================================================================
-- API Usage Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  amount_charged TEXT NOT NULL DEFAULT '0',
  payment_tx_hash TEXT,
  request_timestamp TIMESTAMPTZ DEFAULT NOW(),
  response_status INTEGER,
  latency_ms INTEGER,
  tokens_input INTEGER,
  tokens_output INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_api_usage_wallet ON api_usage(wallet_address);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage(request_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_wallet_timestamp ON api_usage(wallet_address, request_timestamp DESC);

-- ============================================================================
-- Monetizer Configurations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS monetizer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  upstream_url TEXT NOT NULL,
  upstream_headers JSONB,
  pricing_model TEXT NOT NULL CHECK (pricing_model IN ('perRequest', 'perToken', 'dynamic', 'tiered')),
  pricing_config JSONB NOT NULL,
  recipient_address TEXT NOT NULL,
  network TEXT DEFAULT 'base' CHECK (network IN ('base', 'ethereum', 'polygon', 'arbitrum')),
  token TEXT DEFAULT 'USDC' CHECK (token IN ('USDC', 'USDT')),
  rate_limit_config JSONB,
  allowlist TEXT[],
  blocklist TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for vendor lookup
CREATE INDEX IF NOT EXISTS idx_monetizer_configs_vendor ON monetizer_configs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_monetizer_configs_active ON monetizer_configs(is_active) WHERE is_active = true;

-- ============================================================================
-- Revenue Aggregation Functions
-- ============================================================================

-- Daily revenue aggregation
CREATE OR REPLACE FUNCTION get_daily_revenue(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  date TEXT,
  revenue TEXT,
  requests BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(DATE_TRUNC('day', request_timestamp), 'YYYY-MM-DD') as date,
    COALESCE(SUM(amount_charged::NUMERIC), 0)::TEXT as revenue,
    COUNT(*) as requests
  FROM api_usage
  WHERE request_timestamp >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY DATE_TRUNC('day', request_timestamp)
  ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql;

-- Weekly revenue aggregation
CREATE OR REPLACE FUNCTION get_weekly_revenue(weeks_back INTEGER DEFAULT 12)
RETURNS TABLE (
  week TEXT,
  revenue TEXT,
  requests BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(DATE_TRUNC('week', request_timestamp), 'YYYY-"W"IW') as week,
    COALESCE(SUM(amount_charged::NUMERIC), 0)::TEXT as revenue,
    COUNT(*) as requests
  FROM api_usage
  WHERE request_timestamp >= NOW() - (weeks_back || ' weeks')::INTERVAL
  GROUP BY DATE_TRUNC('week', request_timestamp)
  ORDER BY week DESC;
END;
$$ LANGUAGE plpgsql;

-- Monthly revenue aggregation
CREATE OR REPLACE FUNCTION get_monthly_revenue(months_back INTEGER DEFAULT 12)
RETURNS TABLE (
  month TEXT,
  revenue TEXT,
  requests BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(DATE_TRUNC('month', request_timestamp), 'YYYY-MM') as month,
    COALESCE(SUM(amount_charged::NUMERIC), 0)::TEXT as revenue,
    COUNT(*) as requests
  FROM api_usage
  WHERE request_timestamp >= NOW() - (months_back || ' months')::INTERVAL
  GROUP BY DATE_TRUNC('month', request_timestamp)
  ORDER BY month DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE monetizer_configs ENABLE ROW LEVEL SECURITY;

-- API usage: vendors can only see their own usage (via monetizer config)
CREATE POLICY api_usage_vendor_policy ON api_usage
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM monetizer_configs mc
      WHERE mc.recipient_address = api_usage.wallet_address
      AND mc.vendor_id = auth.uid()
    )
  );

-- Service role can do everything
CREATE POLICY api_usage_service_policy ON api_usage
  FOR ALL
  USING (auth.role() = 'service_role');

-- Monetizer configs: vendors can manage their own configs
CREATE POLICY monetizer_configs_vendor_select ON monetizer_configs
  FOR SELECT
  USING (vendor_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY monetizer_configs_vendor_insert ON monetizer_configs
  FOR INSERT
  WITH CHECK (vendor_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY monetizer_configs_vendor_update ON monetizer_configs
  FOR UPDATE
  USING (vendor_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY monetizer_configs_vendor_delete ON monetizer_configs
  FOR DELETE
  USING (vendor_id = auth.uid() OR auth.role() = 'service_role');

-- ============================================================================
-- Triggers
-- ============================================================================

-- Update timestamp trigger for monetizer_configs
CREATE OR REPLACE FUNCTION update_monetizer_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER monetizer_configs_updated_at
  BEFORE UPDATE ON monetizer_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_monetizer_config_timestamp();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE api_usage IS 'Tracks API usage for monetized endpoints';
COMMENT ON TABLE monetizer_configs IS 'Configuration for API monetization';
COMMENT ON COLUMN api_usage.wallet_address IS 'Wallet address that made the request';
COMMENT ON COLUMN api_usage.amount_charged IS 'Amount charged in USD';
COMMENT ON COLUMN api_usage.tokens_input IS 'Input tokens for AI API calls';
COMMENT ON COLUMN api_usage.tokens_output IS 'Output tokens for AI API calls';
COMMENT ON COLUMN monetizer_configs.pricing_model IS 'Pricing model: perRequest, perToken, dynamic, tiered';
COMMENT ON COLUMN monetizer_configs.pricing_config IS 'JSON configuration for the pricing model';
