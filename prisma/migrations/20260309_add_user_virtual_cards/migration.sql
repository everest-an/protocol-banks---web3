-- CreateTable: user_virtual_cards
-- Migration: 20260309_add_user_virtual_cards
-- Description: Add UserVirtualCard model for Yativo-powered virtual Visa card issuance

CREATE TABLE "user_virtual_cards" (
    "id"               TEXT NOT NULL,
    "owner_address"    TEXT NOT NULL,
    "card_provider"    TEXT NOT NULL DEFAULT 'YATIVO',
    "provider_card_id" TEXT NOT NULL,
    "last4"            TEXT,
    "status"           TEXT NOT NULL DEFAULT 'PENDING',
    "balance"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency"         TEXT NOT NULL DEFAULT 'USD',
    "label"            TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_virtual_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_virtual_cards_provider_card_id_key" ON "user_virtual_cards"("provider_card_id");
CREATE INDEX "user_virtual_cards_owner_address_idx" ON "user_virtual_cards"("owner_address");
CREATE INDEX "user_virtual_cards_status_idx" ON "user_virtual_cards"("status");
CREATE INDEX "user_virtual_cards_provider_card_id_idx" ON "user_virtual_cards"("provider_card_id");

-- CreateTable: agent_virtual_cards
CREATE TABLE "agent_virtual_cards" (
    "id"               TEXT NOT NULL,
    "agent_id"         TEXT NOT NULL,
    "owner_address"    TEXT NOT NULL,
    "card_provider"    TEXT NOT NULL DEFAULT 'YATIVO',
    "provider_card_id" TEXT NOT NULL,
    "last4"            TEXT,
    "status"           TEXT NOT NULL DEFAULT 'PENDING',
    "balance"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency"         TEXT NOT NULL DEFAULT 'USD',
    "label"            TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_virtual_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_virtual_cards_agent_id_key" ON "agent_virtual_cards"("agent_id");
CREATE UNIQUE INDEX "agent_virtual_cards_provider_card_id_key" ON "agent_virtual_cards"("provider_card_id");
CREATE INDEX "agent_virtual_cards_owner_address_idx" ON "agent_virtual_cards"("owner_address");
CREATE INDEX "agent_virtual_cards_status_idx" ON "agent_virtual_cards"("status");

-- AddForeignKey
ALTER TABLE "agent_virtual_cards" ADD CONSTRAINT "agent_virtual_cards_agent_id_fkey"
    FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
