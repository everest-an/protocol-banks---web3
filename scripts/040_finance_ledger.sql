CREATE TABLE IF NOT EXISTS "finance_accounts" (
  "id" TEXT NOT NULL,
  "owner_address" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'bank',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "external_id" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "balance" DOUBLE PRECISION,
  "metadata" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "finance_accounts_owner_address_source_external_id_key"
  ON "finance_accounts"("owner_address", "source", "external_id");
CREATE INDEX IF NOT EXISTS "finance_accounts_owner_address_idx"
  ON "finance_accounts"("owner_address");

CREATE TABLE IF NOT EXISTS "finance_transactions" (
  "id" TEXT NOT NULL,
  "owner_address" TEXT NOT NULL,
  "account_id" TEXT,
  "source" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'expense',
  "direction" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'Uncategorized',
  "counterparty" TEXT,
  "description" TEXT,
  "amount_usd" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_transactions_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "finance_accounts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "finance_transactions_owner_address_dedupe_key_key"
  ON "finance_transactions"("owner_address", "dedupe_key");
CREATE INDEX IF NOT EXISTS "finance_transactions_owner_address_occurred_at_idx"
  ON "finance_transactions"("owner_address", "occurred_at");
CREATE INDEX IF NOT EXISTS "finance_transactions_owner_address_category_idx"
  ON "finance_transactions"("owner_address", "category");
CREATE INDEX IF NOT EXISTS "finance_transactions_account_id_idx"
  ON "finance_transactions"("account_id");

ALTER TABLE "finance_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_accounts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_finance_accounts ON "finance_accounts";
CREATE POLICY rls_finance_accounts ON "finance_accounts"
  FOR ALL
  USING (lower("owner_address") = lower(current_setting('app.wallet', true)))
  WITH CHECK (lower("owner_address") = lower(current_setting('app.wallet', true)));

ALTER TABLE "finance_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_transactions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_finance_transactions ON "finance_transactions";
CREATE POLICY rls_finance_transactions ON "finance_transactions"
  FOR ALL
  USING (lower("owner_address") = lower(current_setting('app.wallet', true)))
  WITH CHECK (lower("owner_address") = lower(current_setting('app.wallet', true)));
