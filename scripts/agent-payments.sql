-- Agent payments: durable state for pay execution, reconciliation and webhooks.
CREATE TABLE IF NOT EXISTS "agent_payments" (
  "id" TEXT NOT NULL,
  "owner_address" TEXT NOT NULL,
  "from_address" TEXT NOT NULL,
  "to_address" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "chain" TEXT NOT NULL,
  "chain_id" INTEGER NOT NULL,
  "amount_usd" DOUBLE PRECISION NOT NULL,
  "amount_units" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "tx_hash" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "error" TEXT,
  "memo" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "agent_payments_nonce_key" ON "agent_payments"("nonce");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_payments_tx_hash_key" ON "agent_payments"("tx_hash");
CREATE INDEX IF NOT EXISTS "agent_payments_owner_address_created_at_idx" ON "agent_payments"("owner_address", "created_at");
CREATE INDEX IF NOT EXISTS "agent_payments_status_created_at_idx" ON "agent_payments"("status", "created_at");
ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "secret_encrypted" TEXT;
