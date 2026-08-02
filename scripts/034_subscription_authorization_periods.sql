-- Migration: 034_subscription_authorization_periods.sql
-- Description: Give subscription_authorizations the full ERC-3009 tuple and
--              per-period bookkeeping.
-- Date: 2026-07-28
--
-- Context:
--   An ERC-3009 signature commits to (from, to, value, validAfter, validBefore,
--   nonce) and its nonce is single-use. One signature therefore cannot authorise
--   a recurring charge. To stay non-custodial, the payer signs N authorizations
--   up front — one per billing period, each with its own nonce and a validity
--   window covering exactly that period. The scheduler then submits the
--   authorization whose window covers "now".
--
--   Submitting anything other than the exact tuple the payer signed makes
--   ecrecover return a different address and the transfer reverts, so every one
--   of these columns has to be stored alongside the signature.
--
-- Note on the starting shape:
--   scripts/030 describes this table with the full tuple, but the live database
--   was created from prisma/schema.prisma, where the model had only
--   id/subscription_id/status/signature/max_amount/expires_at/created_at. This
--   migration therefore adds the columns rather than assuming 030 ran. Every
--   statement is IF NOT EXISTS, so it is safe on either starting shape.
--
--   Types match the live database: ids are TEXT (Prisma String), not UUID.

-- ============================================
-- ERC-3009 authorization tuple
-- ============================================

ALTER TABLE subscription_authorizations
  ADD COLUMN IF NOT EXISTS user_address      TEXT,
  ADD COLUMN IF NOT EXISTS recipient_address TEXT,
  ADD COLUMN IF NOT EXISTS amount            TEXT,
  ADD COLUMN IF NOT EXISTS token_address     TEXT,
  ADD COLUMN IF NOT EXISTS chain_id          INTEGER,
  ADD COLUMN IF NOT EXISTS nonce             TEXT,
  ADD COLUMN IF NOT EXISTS valid_after       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS valid_before      TIMESTAMP,
  ADD COLUMN IF NOT EXISTS used_at           TIMESTAMP,
  ADD COLUMN IF NOT EXISTS tx_hash           TEXT,
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMP NOT NULL DEFAULT NOW();

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
  ON subscription_authorizations(nonce, chain_id, token_address)
  WHERE nonce IS NOT NULL;

-- Scheduler lookup: "the next unused authorization for this subscription whose
-- window covers now".
CREATE INDEX IF NOT EXISTS idx_sub_auth_lookup
  ON subscription_authorizations(subscription_id, status, valid_after, valid_before);

CREATE INDEX IF NOT EXISTS idx_sub_auth_user ON subscription_authorizations(user_address);
CREATE INDEX IF NOT EXISTS idx_sub_auth_status ON subscription_authorizations(status);
CREATE INDEX IF NOT EXISTS idx_sub_auth_valid_before ON subscription_authorizations(valid_before);
