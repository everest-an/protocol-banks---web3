-- AgentBudget integer units + ledger, and an atomic audit chain head.
-- Safe to run on a populated database: the string columns are kept as display
-- caches and existing balances are backfilled into 6-decimal minor units.

ALTER TABLE "agent_budgets" ADD COLUMN IF NOT EXISTS "amount_units" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "agent_budgets" ADD COLUMN IF NOT EXISTS "used_units" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "agent_budgets" ADD COLUMN IF NOT EXISTS "balance_units" BIGINT NOT NULL DEFAULT 0;

UPDATE "agent_budgets"
SET "amount_units" = ROUND("amount"::numeric * 1000000)::bigint,
    "used_units" = ROUND("used_amount"::numeric * 1000000)::bigint,
    "balance_units" = ROUND("remaining_amount"::numeric * 1000000)::bigint
WHERE "amount_units" = 0
  AND "used_units" = 0
  AND "balance_units" = 0;

CREATE TABLE IF NOT EXISTS "agent_budget_ledger" (
  "id" TEXT NOT NULL,
  "budget_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount_units" BIGINT NOT NULL,
  "balance_after_units" BIGINT NOT NULL,
  "reference" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_budget_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_budget_ledger_budget_id_created_at_idx"
  ON "agent_budget_ledger"("budget_id", "created_at");

DO $$
BEGIN
  ALTER TABLE "agent_budget_ledger"
    ADD CONSTRAINT "agent_budget_ledger_budget_id_fkey"
    FOREIGN KEY ("budget_id") REFERENCES "agent_budgets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "agent_budget_ledger" ("id", "budget_id", "type", "amount_units", "balance_after_units", "reference", "created_at")
SELECT gen_random_uuid()::text, b."id", 'genesis', b."balance_units", b."balance_units", 'migration', b."created_at"
FROM "agent_budgets" b
WHERE NOT EXISTS (
  SELECT 1 FROM "agent_budget_ledger" l WHERE l."budget_id" = b."id"
);

CREATE TABLE IF NOT EXISTS "audit_chain_heads" (
  "actor" TEXT NOT NULL,
  "seq" INTEGER NOT NULL DEFAULT 0,
  "hash" TEXT NOT NULL DEFAULT 'genesis',
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "audit_chain_heads_pkey" PRIMARY KEY ("actor")
);
