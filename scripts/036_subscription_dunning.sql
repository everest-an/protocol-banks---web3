-- Migration: 036_subscription_dunning.sql
-- Description: Track failed charge attempts so retries terminate.
-- Date: 2026-07-28
--
-- Context:
--   Failed charges were previously rescheduled 24 hours out with no attempt
--   counter, so a permanently broken subscription (revoked authorization, dead
--   mandate) was retried forever — burning relayer gas and never telling the
--   payer their subscription had stopped working.
--
--   These columns let the dunning schedule advance and terminate, matching the
--   convention used by card and direct-debit processors: a few retries on a
--   widening schedule, then stop.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ;

-- The scheduler sweeps subscriptions that are due and still retryable.
CREATE INDEX IF NOT EXISTS idx_subscriptions_dunning
  ON subscriptions(status, next_payment_date)
  WHERE failed_attempts > 0;
