-- Migration: Add subscription retry fields
-- This adds fields needed for payment retry logic

-- Add failure tracking columns to subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_failure_reason TEXT;

-- Create subscription payment retries table for tracking
CREATE TABLE IF NOT EXISTS subscription_payment_retries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  error_message TEXT,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient retry queries
CREATE INDEX IF NOT EXISTS idx_subscription_retries_subscription_id 
ON subscription_payment_retries(subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscription_retries_next_retry 
ON subscription_payment_retries(next_retry_at) 
WHERE next_retry_at IS NOT NULL;

-- Create index for due subscriptions query optimization
CREATE INDEX IF NOT EXISTS idx_subscriptions_due 
ON subscriptions(next_payment_date, status) 
WHERE status = 'active';

-- Create index for retry due subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_retry_due 
ON subscriptions(next_payment_date, status, failure_count) 
WHERE status = 'payment_failed' AND failure_count < 3;

-- Enable RLS on new table
ALTER TABLE subscription_payment_retries ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only see their own subscription retries
CREATE POLICY "Users can view own subscription retries" ON subscription_payment_retries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM subscriptions s 
      WHERE s.id = subscription_payment_retries.subscription_id 
      AND s.owner_address = auth.jwt() ->> 'wallet_address'
    )
  );

-- Service role can manage all retries (for cron jobs)
CREATE POLICY "Service role can manage retries" ON subscription_payment_retries
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE subscription_payment_retries IS 'Tracks payment retry attempts for subscriptions';
COMMENT ON COLUMN subscriptions.failure_count IS 'Number of consecutive payment failures';
COMMENT ON COLUMN subscriptions.last_failure_reason IS 'Error message from last failed payment attempt';
