-- Migration: 002_tech_debt_fixes
-- Description: Add fields for subscription retry logic and new tables for Transak/Rain
-- Date: 2026-02-01
-- Tech Debt Items: TD-001, TD-003, TD-005, TD-007, TD-008, TD-009, TD-010, TD-012

-- ============================================
-- 1. Subscription retry fields (TD-003)
-- ============================================
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Create index for retry processing
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_retry 
ON subscriptions(next_retry_at) 
WHERE status = 'payment_failed' AND next_retry_at IS NOT NULL;

-- ============================================
-- 2. Transak purchases table (TD-005)
-- ============================================
CREATE TABLE IF NOT EXISTS transak_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(255) UNIQUE NOT NULL,
    wallet_address VARCHAR(255) NOT NULL,
    fiat_amount DECIMAL(20, 8) NOT NULL,
    fiat_currency VARCHAR(10) NOT NULL,
    crypto_amount DECIMAL(20, 8) NOT NULL,
    crypto_currency VARCHAR(20) NOT NULL,
    network VARCHAR(50),
    tx_hash VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_transak_purchases_wallet ON transak_purchases(wallet_address);
CREATE INDEX IF NOT EXISTS idx_transak_purchases_status ON transak_purchases(status);

-- Enable RLS
ALTER TABLE transak_purchases ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Rain settlements table (TD-001)
-- ============================================
CREATE TABLE IF NOT EXISTS rain_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id VARCHAR(255) UNIQUE NOT NULL,
    card_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rain_settlements_card ON rain_settlements(card_id);
CREATE INDEX IF NOT EXISTS idx_rain_settlements_user ON rain_settlements(user_id);

-- Enable RLS
ALTER TABLE rain_settlements ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. Add status column to rain_cards if missing
-- ============================================
ALTER TABLE rain_cards 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- 5. Add updated_at to rain_transactions if missing
-- ============================================
ALTER TABLE rain_transactions 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Add unique constraint if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rain_transactions_transaction_id_key'
    ) THEN
        ALTER TABLE rain_transactions ADD CONSTRAINT rain_transactions_transaction_id_key UNIQUE (transaction_id);
    END IF;
END $$;

-- ============================================
-- 6. Notifications table enhancements
-- ============================================
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS data JSONB,
ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_address, read) 
WHERE read = false;

-- ============================================
-- End of migration
-- ============================================
