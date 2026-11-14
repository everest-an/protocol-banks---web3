CREATE TABLE IF NOT EXISTS "finance_budgets" (
  "id" TEXT NOT NULL,
  "owner_address" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "amount_usd" DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_budgets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "finance_budgets_owner_address_category_month_key"
  ON "finance_budgets"("owner_address", "category", "month");
CREATE INDEX IF NOT EXISTS "finance_budgets_owner_address_month_idx"
  ON "finance_budgets"("owner_address", "month");

ALTER TABLE "finance_budgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_budgets" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_finance_budgets ON "finance_budgets";
CREATE POLICY rls_finance_budgets ON "finance_budgets"
  FOR ALL
  USING (lower("owner_address") = lower(current_setting('app.wallet', true)))
  WITH CHECK (lower("owner_address") = lower(current_setting('app.wallet', true)));
