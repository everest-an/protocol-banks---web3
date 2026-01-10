-- System configuration table for production deployment
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_category TEXT NOT NULL,
  config_key TEXT NOT NULL,
  config_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  is_sensitive BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE(config_category, config_key)
);

-- Enable RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Only admins can view/modify system config
CREATE POLICY "Admins can view system config" ON system_config
  FOR SELECT USING (true);

CREATE POLICY "Admins can update system config" ON system_config
  FOR UPDATE USING (true);

CREATE POLICY "Admins can insert system config" ON system_config
  FOR INSERT WITH CHECK (true);

-- Contract deployments table
CREATE TABLE IF NOT EXISTS contract_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_name TEXT NOT NULL,
  contract_type TEXT NOT NULL, -- 'payment', 'swap', 'cctp', 'zetachain'
  chain_id INTEGER NOT NULL,
  chain_name TEXT NOT NULL,
  address TEXT NOT NULL,
  abi_hash TEXT,
  deployment_tx TEXT,
  deployer_address TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  version TEXT DEFAULT '1.0.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contract_name, chain_id)
);

-- Enable RLS
ALTER TABLE contract_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view contract deployments" ON contract_deployments
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage contract deployments" ON contract_deployments
  FOR ALL USING (true);

-- Domain whitelist table
CREATE TABLE IF NOT EXISTS domain_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  service_type TEXT NOT NULL, -- 'reown', 'stripe', 'resend', 'api'
  is_active BOOLEAN DEFAULT true,
  environment TEXT DEFAULT 'production', -- 'development', 'staging', 'production'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE domain_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view domain whitelist" ON domain_whitelist
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage domain whitelist" ON domain_whitelist
  FOR ALL USING (true);

-- Monitoring alerts table
CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL, -- 'error', 'warning', 'info', 'critical'
  service TEXT NOT NULL, -- 'payment', 'auth', 'database', 'api', 'security'
  message TEXT NOT NULL,
  details JSONB,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE monitoring_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view monitoring alerts" ON monitoring_alerts
  FOR SELECT USING (true);

CREATE POLICY "System can insert monitoring alerts" ON monitoring_alerts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update monitoring alerts" ON monitoring_alerts
  FOR UPDATE USING (true);

-- Insert default system configurations
INSERT INTO system_config (config_category, config_key, config_value, description) VALUES
  ('environment', 'mode', '"production"', 'Current environment mode'),
  ('environment', 'maintenance_mode', 'false', 'Enable maintenance mode'),
  ('fees', 'base_rate', '0.001', 'Base fee rate (0.1%)'),
  ('fees', 'min_fee_usd', '0.50', 'Minimum fee in USD'),
  ('fees', 'max_fee_usd', '500', 'Maximum fee in USD'),
  ('fees', 'treasury_address', '"0x..."', 'Treasury wallet address'),
  ('limits', 'daily_limit_usd', '50000', 'Default daily transaction limit'),
  ('limits', 'per_tx_limit_usd', '10000', 'Default per-transaction limit'),
  ('limits', 'batch_max_recipients', '100', 'Maximum recipients per batch'),
  ('security', 'require_2fa', 'false', 'Require 2FA for large transactions'),
  ('security', 'high_value_threshold', '5000', 'USD amount requiring extra verification'),
  ('notifications', 'email_enabled', 'true', 'Enable email notifications'),
  ('notifications', 'webhook_enabled', 'false', 'Enable webhook notifications')
ON CONFLICT (config_category, config_key) DO NOTHING;
