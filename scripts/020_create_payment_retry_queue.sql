-- Create payment retry queue table for failed database writes
-- This ensures no payment data is lost even if initial DB write fails

CREATE TABLE IF NOT EXISTS payment_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash TEXT NOT NULL UNIQUE,
  payment_data JSONB NOT NULL,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  next_retry_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient retry processing (find pending retries)
CREATE INDEX IF NOT EXISTS idx_retry_queue_status_next_retry
  ON payment_retry_queue(status, next_retry_at)
  WHERE status = 'pending';

-- Index for transaction hash lookup
CREATE INDEX IF NOT EXISTS idx_retry_queue_tx_hash
  ON payment_retry_queue(tx_hash);

-- Index for monitoring failed retries
CREATE INDEX IF NOT EXISTS idx_retry_queue_failed
  ON payment_retry_queue(status, updated_at DESC)
  WHERE status = 'failed';

-- Enable RLS
ALTER TABLE payment_retry_queue ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage retry queue (bypasses RLS)
-- No user-facing policies needed since this is internal system table
CREATE POLICY "Service role can manage retry queue" ON payment_retry_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_retry_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_payment_retry_queue_timestamp ON payment_retry_queue;
CREATE TRIGGER trigger_update_payment_retry_queue_timestamp
  BEFORE UPDATE ON payment_retry_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_retry_queue_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON payment_retry_queue TO service_role;
