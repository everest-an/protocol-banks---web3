-- Agent Link API Database Schema
-- Version: 1.0.0
-- Description: Creates tables for AI agent management, budgets, proposals, webhooks, and activities

-- ============================================
-- 1. AGENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_address TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'custom' CHECK (type IN ('trading', 'payroll', 'expense', 'subscription', 'custom')),
  avatar_url TEXT,
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL,
  webhook_url TEXT,
  webhook_secret_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'deactivated')),
  auto_execute_enabled BOOLEAN DEFAULT false,
  auto_execute_rules JSONB DEFAULT '{}',
  rate_limit_per_minute INTEGER DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(api_key_prefix)
);

-- Indexes for agents
CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_address);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
CREATE INDEX IF NOT EXISTS idx_agents_api_key_prefix ON agents(api_key_prefix);

-- ============================================
-- 2. AGENT BUDGETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agent_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  owner_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  token TEXT NOT NULL,
  chain_id INTEGER,
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'total')),
  used_amount TEXT NOT NULL DEFAULT '0',
  period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for agent_budgets
CREATE INDEX IF NOT EXISTS idx_agent_budgets_agent ON agent_budgets(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_budgets_owner ON agent_budgets(owner_address);
CREATE INDEX IF NOT EXISTS idx_agent_budgets_token ON agent_budgets(token);
CREATE INDEX IF NOT EXISTS idx_agent_budgets_period ON agent_budgets(period);

-- ============================================
-- 3. PAYMENT PROPOSALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payment_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  owner_address TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  token TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executing', 'executed', 'failed')),
  rejection_reason TEXT,
  budget_id UUID REFERENCES agent_budgets(id),
  x402_authorization_id TEXT,
  tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for payment_proposals
CREATE INDEX IF NOT EXISTS idx_payment_proposals_agent ON payment_proposals(agent_id);
CREATE INDEX IF NOT EXISTS idx_payment_proposals_owner ON payment_proposals(owner_address);
CREATE INDEX IF NOT EXISTS idx_payment_proposals_status ON payment_proposals(status);
CREATE INDEX IF NOT EXISTS idx_payment_proposals_created ON payment_proposals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_proposals_recipient ON payment_proposals(recipient_address);

-- ============================================
-- 4. AGENT WEBHOOK DELIVERIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agent_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for agent_webhook_deliveries
CREATE INDEX IF NOT EXISTS idx_agent_webhook_deliveries_agent ON agent_webhook_deliveries(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_webhook_deliveries_status ON agent_webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_agent_webhook_deliveries_event ON agent_webhook_deliveries(event_type);
CREATE INDEX IF NOT EXISTS idx_agent_webhook_deliveries_retry ON agent_webhook_deliveries(next_retry_at) WHERE status = 'pending';

-- ============================================
-- 5. AGENT ACTIVITIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agent_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  owner_address TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for agent_activities
CREATE INDEX IF NOT EXISTS idx_agent_activities_agent ON agent_activities(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_activities_owner ON agent_activities(owner_address);
CREATE INDEX IF NOT EXISTS idx_agent_activities_action ON agent_activities(action);
CREATE INDEX IF NOT EXISTS idx_agent_activities_created ON agent_activities(created_at DESC);

-- ============================================
-- 6. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activities ENABLE ROW LEVEL SECURITY;

-- Agents: Owner can manage their agents
DROP POLICY IF EXISTS agents_owner_policy ON agents;
CREATE POLICY agents_owner_policy ON agents
  FOR ALL USING (owner_address = current_setting('app.current_user_address', true));

-- Budgets: Owner can manage budgets for their agents
DROP POLICY IF EXISTS budgets_owner_policy ON agent_budgets;
CREATE POLICY budgets_owner_policy ON agent_budgets
  FOR ALL USING (owner_address = current_setting('app.current_user_address', true));

-- Proposals: Owner can view/manage proposals for their agents
DROP POLICY IF EXISTS proposals_owner_policy ON payment_proposals;
CREATE POLICY proposals_owner_policy ON payment_proposals
  FOR ALL USING (owner_address = current_setting('app.current_user_address', true));

-- Webhook deliveries: Owner can view deliveries for their agents
DROP POLICY IF EXISTS webhook_deliveries_owner_policy ON agent_webhook_deliveries;
CREATE POLICY webhook_deliveries_owner_policy ON agent_webhook_deliveries
  FOR ALL USING (agent_id IN (SELECT id FROM agents WHERE owner_address = current_setting('app.current_user_address', true)));

-- Activities: Owner can view activities for their agents
DROP POLICY IF EXISTS activities_owner_policy ON agent_activities;
CREATE POLICY activities_owner_policy ON agent_activities
  FOR ALL USING (owner_address = current_setting('app.current_user_address', true));

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Function to calculate remaining budget
CREATE OR REPLACE FUNCTION calculate_remaining_budget(budget_amount TEXT, used_amount TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN (CAST(budget_amount AS NUMERIC) - CAST(used_amount AS NUMERIC))::TEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if budget period needs reset
CREATE OR REPLACE FUNCTION should_reset_budget(period TEXT, period_start TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN AS $$
BEGIN
  CASE period
    WHEN 'daily' THEN
      RETURN period_start < DATE_TRUNC('day', NOW());
    WHEN 'weekly' THEN
      RETURN period_start < DATE_TRUNC('week', NOW());
    WHEN 'monthly' THEN
      RETURN period_start < DATE_TRUNC('month', NOW());
    WHEN 'total' THEN
      RETURN FALSE;
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get next period start
CREATE OR REPLACE FUNCTION get_next_period_start(period TEXT)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
  CASE period
    WHEN 'daily' THEN
      RETURN DATE_TRUNC('day', NOW());
    WHEN 'weekly' THEN
      RETURN DATE_TRUNC('week', NOW());
    WHEN 'monthly' THEN
      RETURN DATE_TRUNC('month', NOW());
    WHEN 'total' THEN
      RETURN NOW();
    ELSE
      RETURN NOW();
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 8. TRIGGERS
-- ============================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to agents
DROP TRIGGER IF EXISTS update_agents_updated_at ON agents;
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to agent_budgets
DROP TRIGGER IF EXISTS update_agent_budgets_updated_at ON agent_budgets;
CREATE TRIGGER update_agent_budgets_updated_at
  BEFORE UPDATE ON agent_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to payment_proposals
DROP TRIGGER IF EXISTS update_payment_proposals_updated_at ON payment_proposals;
CREATE TRIGGER update_payment_proposals_updated_at
  BEFORE UPDATE ON payment_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. COMMENTS
-- ============================================
COMMENT ON TABLE agents IS 'AI agents that can interact with Protocol Banks';
COMMENT ON TABLE agent_budgets IS 'Budget allocations for agents';
COMMENT ON TABLE payment_proposals IS 'Payment proposals created by agents';
COMMENT ON TABLE agent_webhook_deliveries IS 'Webhook delivery records for agent events';
COMMENT ON TABLE agent_activities IS 'Activity logs for agent operations';

COMMENT ON COLUMN agents.api_key_prefix IS 'First 12 characters of API key for identification (agent_xxxxxxxx)';
COMMENT ON COLUMN agents.auto_execute_rules IS 'JSON rules for auto-execution: max_single_amount, allowed_tokens, allowed_recipients, etc.';
COMMENT ON COLUMN agent_budgets.period IS 'Budget reset period: daily, weekly, monthly, or total (never resets)';
COMMENT ON COLUMN payment_proposals.status IS 'Proposal lifecycle: pending -> approved/rejected -> executing -> executed/failed';
