CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  anon_id TEXT,
  wallet TEXT,
  path TEXT,
  props JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_events_name_created_idx ON usage_events (name, created_at);
CREATE INDEX IF NOT EXISTS usage_events_wallet_created_idx ON usage_events (wallet, created_at);
