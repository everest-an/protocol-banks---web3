-- Migration: Remove UNIQUE constraint from payments.tx_hash
-- Description: Allow multiple payment records to share the same tx_hash (for batch payments)
-- Created: 2025-01-25

-- Drop the unique constraint on tx_hash
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_tx_hash_key;

-- Add a non-unique index for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_tx_hash ON payments(tx_hash);

-- Verify constraint was removed
DO $$
BEGIN
  RAISE NOTICE 'UNIQUE constraint removed from payments.tx_hash';
  RAISE NOTICE 'Non-unique index created for better performance';
END $$;
