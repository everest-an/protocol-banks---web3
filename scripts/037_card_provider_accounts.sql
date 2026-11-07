CREATE TABLE IF NOT EXISTS card_provider_accounts (
  id               TEXT PRIMARY KEY,
  owner_address    TEXT NOT NULL UNIQUE,
  provider         TEXT NOT NULL DEFAULT 'RAIN',
  provider_user_id TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  raw_status       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS card_provider_accounts_provider_idx
  ON card_provider_accounts (provider);
