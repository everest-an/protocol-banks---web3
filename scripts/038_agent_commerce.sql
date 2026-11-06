CREATE TABLE IF NOT EXISTS "agent_services" (
  "id" TEXT NOT NULL,
  "owner_address" TEXT NOT NULL,
  "agent_id" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "endpoint" TEXT,
  "price_usd" DOUBLE PRECISION NOT NULL,
  "token" TEXT NOT NULL DEFAULT 'USDC',
  "chain" TEXT NOT NULL DEFAULT 'base',
  "terms" JSONB,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_services_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "agent_services_owner_address_active_idx" ON "agent_services"("owner_address", "active");
CREATE INDEX IF NOT EXISTS "agent_services_category_active_idx" ON "agent_services"("category", "active");

CREATE TABLE IF NOT EXISTS "agent_quotes" (
  "id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "seller_address" TEXT NOT NULL,
  "buyer_address" TEXT NOT NULL,
  "amount_usd" DOUBLE PRECISION NOT NULL,
  "token" TEXT NOT NULL,
  "chain" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "delivery_due" TIMESTAMP(3),
  "terms" JSONB NOT NULL,
  "terms_hash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_quotes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "agent_quotes_buyer_address_status_idx" ON "agent_quotes"("buyer_address", "status");
CREATE INDEX IF NOT EXISTS "agent_quotes_seller_address_status_idx" ON "agent_quotes"("seller_address", "status");
CREATE INDEX IF NOT EXISTS "agent_quotes_service_id_idx" ON "agent_quotes"("service_id");

CREATE TABLE IF NOT EXISTS "agent_orders" (
  "id" TEXT NOT NULL,
  "quote_id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "buyer_address" TEXT NOT NULL,
  "seller_address" TEXT NOT NULL,
  "amount_usd" DOUBLE PRECISION NOT NULL,
  "token" TEXT NOT NULL,
  "chain" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "terms_hash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'accepted',
  "payment_id" TEXT,
  "delivery_hash" TEXT,
  "delivery_uri" TEXT,
  "delivery_signature" TEXT,
  "dispute_reason" TEXT,
  "refund_tx_hash" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "delivered_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agent_orders_quote_id_key" UNIQUE ("quote_id")
);
CREATE INDEX IF NOT EXISTS "agent_orders_buyer_address_status_idx" ON "agent_orders"("buyer_address", "status");
CREATE INDEX IF NOT EXISTS "agent_orders_seller_address_status_idx" ON "agent_orders"("seller_address", "status");
CREATE INDEX IF NOT EXISTS "agent_orders_service_id_idx" ON "agent_orders"("service_id");

ALTER TABLE "agent_payments" ADD COLUMN IF NOT EXISTS "order_id" TEXT;
CREATE INDEX IF NOT EXISTS "agent_payments_order_id_idx" ON "agent_payments"("order_id");

ALTER TABLE "agent_orders" ADD COLUMN IF NOT EXISTS "delivery_signature" TEXT;
