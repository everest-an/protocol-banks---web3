CREATE TABLE IF NOT EXISTS "strategy_revisions" (
  "id" TEXT NOT NULL,
  "wallet_address" TEXT NOT NULL,
  "preset" TEXT NOT NULL,
  "overrides" JSONB NOT NULL,
  "config" JSONB NOT NULL,
  "previous_config" JSONB,
  "applied_via" TEXT NOT NULL,
  "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "strategy_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "strategy_revisions_wallet_address_fkey"
    FOREIGN KEY ("wallet_address") REFERENCES "trading_accounts"("wallet_address")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "strategy_revisions_wallet_address_applied_at_idx"
  ON "strategy_revisions"("wallet_address", "applied_at");

ALTER TABLE "strategy_revisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "strategy_revisions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_strategy_revisions ON "strategy_revisions";
CREATE POLICY rls_strategy_revisions ON "strategy_revisions"
  FOR ALL
  USING (lower("wallet_address") = lower(current_setting('app.wallet', true)))
  WITH CHECK (lower("wallet_address") = lower(current_setting('app.wallet', true)));
