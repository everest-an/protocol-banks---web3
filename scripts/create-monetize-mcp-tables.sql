-- Create Monetize Config table for API monetization settings
CREATE TABLE IF NOT EXISTS monetize_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT false,
  tiers JSONB DEFAULT '[]'::jsonb,
  default_tier TEXT DEFAULT 'free',
  webhook_url TEXT,
  rate_limit_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create API Keys table for monetization
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tier TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  calls_used INTEGER DEFAULT 0,
  calls_limit INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Create API Usage tracking table
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  endpoint TEXT,
  calls INTEGER DEFAULT 0,
  revenue DECIMAL(18, 6) DEFAULT 0,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create MCP Subscriptions table
CREATE TABLE IF NOT EXISTS mcp_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  calls_used INTEGER DEFAULT 0,
  calls_limit INTEGER DEFAULT 100,
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_address, provider_id)
);

-- Enable RLS
ALTER TABLE monetize_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for monetize_configs
DROP POLICY IF EXISTS "Users can view their own monetize config" ON monetize_configs;
CREATE POLICY "Users can view their own monetize config" ON monetize_configs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own monetize config" ON monetize_configs;
CREATE POLICY "Users can insert their own monetize config" ON monetize_configs
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own monetize config" ON monetize_configs;
CREATE POLICY "Users can update their own monetize config" ON monetize_configs
  FOR UPDATE USING (true);

-- RLS Policies for api_keys
DROP POLICY IF EXISTS "Users can view their own api keys" ON api_keys;
CREATE POLICY "Users can view their own api keys" ON api_keys
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own api keys" ON api_keys;
CREATE POLICY "Users can insert their own api keys" ON api_keys
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own api keys" ON api_keys;
CREATE POLICY "Users can update their own api keys" ON api_keys
  FOR UPDATE USING (true);

-- RLS Policies for api_usage
DROP POLICY IF EXISTS "Users can view their own api usage" ON api_usage;
CREATE POLICY "Users can view their own api usage" ON api_usage
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert api usage" ON api_usage;
CREATE POLICY "Users can insert api usage" ON api_usage
  FOR INSERT WITH CHECK (true);

-- RLS Policies for mcp_subscriptions
DROP POLICY IF EXISTS "Users can view their own mcp subscriptions" ON mcp_subscriptions;
CREATE POLICY "Users can view their own mcp subscriptions" ON mcp_subscriptions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own mcp subscriptions" ON mcp_subscriptions;
CREATE POLICY "Users can insert their own mcp subscriptions" ON mcp_subscriptions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own mcp subscriptions" ON mcp_subscriptions;
CREATE POLICY "Users can update their own mcp subscriptions" ON mcp_subscriptions
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete their own mcp subscriptions" ON mcp_subscriptions;
CREATE POLICY "Users can delete their own mcp subscriptions" ON mcp_subscriptions
  FOR DELETE USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_monetize_configs_wallet ON monetize_configs(wallet_address);
CREATE INDEX IF NOT EXISTS idx_api_keys_wallet ON api_keys(wallet_address);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
CREATE INDEX IF NOT EXISTS idx_api_usage_wallet ON api_usage(wallet_address);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(date);
CREATE INDEX IF NOT EXISTS idx_mcp_subscriptions_wallet ON mcp_subscriptions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_mcp_subscriptions_provider ON mcp_subscriptions(provider_id);
