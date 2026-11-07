CREATE TABLE IF NOT EXISTS agent_wallets (
  id                    TEXT PRIMARY KEY,
  agent_id              TEXT NOT NULL UNIQUE,
  owner_address         TEXT NOT NULL,
  address               TEXT NOT NULL UNIQUE,
  chain_type            TEXT NOT NULL DEFAULT 'EVM',
  encrypted_private_key TEXT,
  key_iv                TEXT,
  key_tag               TEXT,
  key_version           INTEGER NOT NULL DEFAULT 1,
  status                TEXT NOT NULL DEFAULT 'active',
  label                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT agent_wallets_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS agent_wallets_owner_address_idx ON agent_wallets (owner_address);
CREATE INDEX IF NOT EXISTS agent_wallets_status_idx ON agent_wallets (status);
