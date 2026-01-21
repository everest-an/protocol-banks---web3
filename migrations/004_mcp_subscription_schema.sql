-- MCP Server Subscription Schema
-- Creates tables for subscription plans, user subscriptions, and payment records

-- ============================================================================
-- Subscription Plans Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(18, 6) NOT NULL,
  token VARCHAR(10) DEFAULT 'USDC',
  interval VARCHAR(20) NOT NULL CHECK (interval IN ('monthly', 'yearly', 'one-time')),
  features JSONB DEFAULT '[]',
  max_api_calls INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- User Subscriptions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,  -- Wallet address
  plan_id UUID REFERENCES subscription_plans(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'active', 'cancelled', 'expired')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Subscription Payments Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  amount DECIMAL(18, 6) NOT NULL,
  token VARCHAR(10) DEFAULT 'USDC',
  tx_hash VARCHAR(66),
  network VARCHAR(20) DEFAULT 'base',
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id ON user_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription_id ON subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON subscription_payments(status);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- Subscription plans are readable by everyone
CREATE POLICY "Anyone can view active subscription plans" ON subscription_plans
  FOR SELECT USING (is_active = true);

-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
  FOR SELECT USING (
    user_id = current_setting('request.jwt.claims', true)::json->>'sub' 
    OR user_id = current_setting('app.current_user', true)
  );

-- Users can create subscriptions for themselves
CREATE POLICY "Users can create own subscriptions" ON user_subscriptions
  FOR INSERT WITH CHECK (
    user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    OR user_id = current_setting('app.current_user', true)
  );

-- Users can update their own subscriptions
CREATE POLICY "Users can update own subscriptions" ON user_subscriptions
  FOR UPDATE USING (
    user_id = current_setting('request.jwt.claims', true)::json->>'sub'
    OR user_id = current_setting('app.current_user', true)
  );

-- Users can view payments for their subscriptions
CREATE POLICY "Users can view own subscription payments" ON subscription_payments
  FOR SELECT USING (
    subscription_id IN (
      SELECT id FROM user_subscriptions 
      WHERE user_id = current_setting('request.jwt.claims', true)::json->>'sub'
         OR user_id = current_setting('app.current_user', true)
    )
  );

-- ============================================================================
-- Seed Data: Default Subscription Plans
-- ============================================================================

INSERT INTO subscription_plans (name, description, price, interval, features, max_api_calls, is_active)
VALUES 
  (
    'Basic',
    'Basic subscription with essential features',
    9.99,
    'monthly',
    '["Access to basic tools", "Email support", "100 API calls/month"]',
    100,
    true
  ),
  (
    'Pro',
    'Professional subscription with advanced features',
    29.99,
    'monthly',
    '["All Basic features", "Priority support", "1000 API calls/month", "Advanced analytics"]',
    1000,
    true
  ),
  (
    'Enterprise',
    'Enterprise subscription with unlimited access',
    99.99,
    'monthly',
    '["All Pro features", "Dedicated support", "Unlimited API calls", "Custom integrations", "SLA guarantee"]',
    NULL,
    true
  ),
  (
    'Basic Annual',
    'Basic subscription billed annually (2 months free)',
    99.99,
    'yearly',
    '["Access to basic tools", "Email support", "100 API calls/month"]',
    100,
    true
  ),
  (
    'Pro Annual',
    'Professional subscription billed annually (2 months free)',
    299.99,
    'yearly',
    '["All Basic features", "Priority support", "1000 API calls/month", "Advanced analytics"]',
    1000,
    true
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Updated At Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
