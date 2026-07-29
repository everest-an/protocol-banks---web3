-- Migration: 035_subscription_onchain_link.sql
-- Description: Link a subscription to its on-chain SubscriptionManager record.
-- Date: 2026-07-28
--
-- Context:
--   Recurring charges can be settled two ways:
--     1. SubscriptionManager contract — the payer authorises once and the
--        contract enforces amount/interval/recipient on every pull.
--     2. Pre-signed ERC-3009 authorizations (scripts/034) — one signature per
--        period, used on chains where the contract is not deployed.
--
--   These columns record which contract instance owns a subscription and the id
--   it was assigned there. When they are null the subscription falls back to the
--   ERC-3009 path.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS onchain_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS manager_address TEXT;

-- The scheduler looks up due subscriptions by their on-chain id.
CREATE INDEX IF NOT EXISTS idx_subscriptions_onchain
  ON subscriptions(onchain_subscription_id)
  WHERE onchain_subscription_id IS NOT NULL;

-- A single manager instance assigns each id exactly once, so a duplicate means
-- two rows are pointing at the same on-chain subscription.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_onchain_unique
  ON subscriptions(manager_address, onchain_subscription_id)
  WHERE onchain_subscription_id IS NOT NULL;
