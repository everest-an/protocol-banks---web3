-- ============================================
-- Push Subscriptions Table Migration
-- ============================================
-- This table stores Web Push notification subscriptions for users
-- Supports real-time payment notifications (Requirement 14)

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique subscription per user per endpoint
  UNIQUE(user_address, endpoint)
);

-- Create index for efficient user lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_address 
  ON push_subscriptions(user_address);

-- Create index for endpoint lookups (for cleanup)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint 
  ON push_subscriptions(endpoint);

-- Enable Row Level Security
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own push subscriptions
CREATE POLICY "Users can view own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (
    user_address = current_setting('app.current_user_address', true)
    OR user_address = auth.jwt() ->> 'wallet_address'
  );

-- RLS Policy: Users can insert their own push subscriptions
CREATE POLICY "Users can insert own push subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (
    user_address = current_setting('app.current_user_address', true)
    OR user_address = auth.jwt() ->> 'wallet_address'
  );

-- RLS Policy: Users can update their own push subscriptions
CREATE POLICY "Users can update own push subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (
    user_address = current_setting('app.current_user_address', true)
    OR user_address = auth.jwt() ->> 'wallet_address'
  );

-- RLS Policy: Users can delete their own push subscriptions
CREATE POLICY "Users can delete own push subscriptions"
  ON push_subscriptions FOR DELETE
  USING (
    user_address = current_setting('app.current_user_address', true)
    OR user_address = auth.jwt() ->> 'wallet_address'
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_push_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_push_subscriptions_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON push_subscriptions TO service_role;

-- Add comment
COMMENT ON TABLE push_subscriptions IS 'Stores Web Push notification subscriptions for real-time payment alerts';
