CREATE TABLE IF NOT EXISTS "finance_sync_state" (
  "id" TEXT NOT NULL,
  "wallet_address" TEXT NOT NULL,
  "last_synced_at" TIMESTAMP(3),
  "last_error_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_sync_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "finance_sync_state_wallet_address_key"
  ON "finance_sync_state"("wallet_address");
