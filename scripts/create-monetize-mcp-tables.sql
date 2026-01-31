-- Create Monetize Config table for API monetization settings
CREATE TABLE IF NOT EXISTS monetize_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT false,
  tiers JSONB DEFAULT '[]'::jsonb,
  default_tier TEXT DEFAULT 'free',
  webhook_url TEXT,
  rate_limit_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: api_keys table already exists with owner_address column
-- We'll use the existing api_keys table and add monetization fields if needed

-- Add monetization fields to existing api_keys table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'tier') THEN
    ALTER TABLE api_keys ADD COLUMN tier TEXT DEFAULT 'free';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'calls_limit') THEN
    ALTER TABLE api_keys ADD COLUMN calls_limit INTEGER DEFAULT 1000;
  END IF;
END $$;

-- Create API Usage tracking table using owner_address to match api_keys
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  owner_address TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_monetize_configs_owner ON monetize_configs(owner_address);
CREATE INDEX IF NOT EXISTS idx_api_usage_owner ON api_usage(owner_address);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(date);
CREATE INDEX IF NOT EXISTS idx_mcp_subscriptions_wallet ON mcp_subscriptions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_mcp_subscriptions_provider ON mcp_subscriptions(provider_id);
