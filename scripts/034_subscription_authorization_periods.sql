-- Migration: 034_subscription_authorization_periods.sql
-- Description: Support pre-signed multi-period subscription authorizations.
-- Date: 2026-07-28
--
-- Context:
--   An ERC-3009 signature commits to (from, to, value, validAfter, validBefore,
--   nonce) and its nonce is single-use. One signature therefore cannot authorise
--   a recurring charge. To stay non-custodial, the user signs N authorizations
--   up front — one per billing period, each with its own nonce and a validity
--   window covering exactly that period. The scheduler then submits the
--   authorization whose window covers "now".
--
--   subscription_authorizations already stores the full six-tuple (see
--   030_additional_tables.sql); this migration only adds the period bookkeeping
--   needed to issue and consume them in order.

-- ============================================
-- Period tracking
-- ============================================

ALTER TABLE subscription_authorizations
  ADD COLUMN IF NOT EXISTS period_index INTEGER;

-- One authorization per billing period per subscription. Prevents issuing two
-- signatures for the same period, which would let a period be charged twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_auth_subscription_period
  ON subscription_authorizations(subscription_id, period_index)
  WHERE period_index IS NOT NULL;

-- An ERC-3009 nonce is single-use per token contract. A duplicate here means a
-- replayed or mis-generated signature, so reject it at write time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_auth_nonce_chain_token
  ON subscription_authorizations(nonce, chain_id, token_address);

-- Scheduler lookup: "the next unused authorization for this subscription whose
-- window covers now".
CREATE INDEX IF NOT EXISTS idx_sub_auth_lookup
  ON subscription_authorizations(subscription_id, status, valid_after, valid_before);
