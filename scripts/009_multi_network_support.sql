-- ============================================================================
-- Migration: 009 - Multi-Network Support (EVM + TRON)
-- Description: Adds support for multi-network addresses and transactions
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Create VendorAddress table for multi-network support
-- ============================================================================

CREATE TABLE IF NOT EXISTS "vendor_addresses" (
  "id" TEXT PRIMARY KEY,
  "vendor_id" TEXT NOT NULL,
  "network" TEXT NOT NULL, -- "ethereum" | "tron" | "arbitrum" | "base" | "bsc"
  "address" TEXT NOT NULL,
  "label" TEXT,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "verified_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "vendor_addresses_vendor_id_fkey" FOREIGN KEY ("vendor_id")
    REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "vendor_addresses_vendor_id_network_key" UNIQUE ("vendor_id", "network")
);

CREATE INDEX IF NOT EXISTS "vendor_addresses_vendor_id_idx" ON "vendor_addresses"("vendor_id");
CREATE INDEX IF NOT EXISTS "vendor_addresses_address_idx" ON "vendor_addresses"("address");

-- ============================================================================
-- 2. Migrate existing vendor addresses to new table
-- ============================================================================

-- Migrate existing vendors' primary addresses to the new VendorAddress table
-- Use chain field to determine network
INSERT INTO "vendor_addresses" (id, vendor_id, network, address, is_primary, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  id,
  CASE
    WHEN LOWER(COALESCE(chain, 'Ethereum')) LIKE '%tron%' THEN 'tron'
    WHEN LOWER(COALESCE(chain, 'Ethereum')) LIKE '%arbitrum%' THEN 'arbitrum'
    WHEN LOWER(COALESCE(chain, 'Ethereum')) LIKE '%base%' THEN 'base'
    WHEN LOWER(COALESCE(chain, 'Ethereum')) LIKE '%bsc%' OR LOWER(COALESCE(chain, 'Ethereum')) LIKE '%binance%' THEN 'bsc'
    ELSE 'ethereum'
  END,
  wallet_address,
  true,
  created_at,
  updated_at
FROM "vendors"
WHERE wallet_address IS NOT NULL
ON CONFLICT (vendor_id, network) DO NOTHING;

-- ============================================================================
-- 3. Update Payment table schema
-- ============================================================================

-- Add new columns to payments table
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "network_type" TEXT DEFAULT 'EVM';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "chain_id" INTEGER;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "energy_used" BIGINT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "bandwidth_used" BIGINT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "gas_used" BIGINT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "gas_price" BIGINT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "confirmations" INTEGER DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "block_number" BIGINT;

-- Update network_type based on chain
UPDATE "payments"
SET "network_type" = CASE
  WHEN LOWER(chain) LIKE '%tron%' THEN 'TRON'
  ELSE 'EVM'
END
WHERE "network_type" IS NULL OR "network_type" = 'EVM';

-- Set chain_id for EVM chains
UPDATE "payments"
SET "chain_id" = CASE
  WHEN LOWER(chain) = 'ethereum' OR LOWER(chain) = 'mainnet' THEN 1
  WHEN LOWER(chain) = 'sepolia' THEN 11155111
  WHEN LOWER(chain) = 'arbitrum' THEN 42161
  WHEN LOWER(chain) = 'base' THEN 8453
  WHEN LOWER(chain) = 'bsc' OR LOWER(chain) = 'binance' THEN 56
  ELSE NULL
END
WHERE "network_type" = 'EVM' AND "chain_id" IS NULL;

-- Normalize chain names
UPDATE "payments"
SET "chain" = CASE
  WHEN LOWER(chain) LIKE '%ethereum%' OR LOWER(chain) = 'mainnet' THEN 'ethereum'
  WHEN LOWER(chain) LIKE '%sepolia%' THEN 'sepolia'
  WHEN LOWER(chain) LIKE '%arbitrum%' THEN 'arbitrum'
  WHEN LOWER(chain) LIKE '%base%' THEN 'base'
  WHEN LOWER(chain) LIKE '%bsc%' OR LOWER(chain) LIKE '%binance%' THEN 'bsc'
  WHEN LOWER(chain) LIKE '%tron%' THEN 'tron'
  ELSE LOWER(chain)
END;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS "payments_chain_idx" ON "payments"("chain");
CREATE INDEX IF NOT EXISTS "payments_network_type_idx" ON "payments"("network_type");
CREATE INDEX IF NOT EXISTS "payments_tx_hash_idx" ON "payments"("tx_hash");

-- ============================================================================
-- 4. Update BatchPayment table schema
-- ============================================================================

-- Add new columns to batch_payments table
ALTER TABLE "batch_payments" ADD COLUMN IF NOT EXISTS "chain" TEXT DEFAULT 'base';
ALTER TABLE "batch_payments" ADD COLUMN IF NOT EXISTS "network_type" TEXT DEFAULT 'EVM';

-- Update chain from chain_id
UPDATE "batch_payments"
SET "chain" = CASE
  WHEN chain_id = 1 THEN 'ethereum'
  WHEN chain_id = 11155111 THEN 'sepolia'
  WHEN chain_id = 42161 THEN 'arbitrum'
  WHEN chain_id = 8453 THEN 'base'
  WHEN chain_id = 56 THEN 'bsc'
  ELSE 'base'
END
WHERE "chain" = 'base';

-- Make chain_id nullable for TRON support
ALTER TABLE "batch_payments" ALTER COLUMN "chain_id" DROP NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS "batch_payments_chain_idx" ON "batch_payments"("chain");
CREATE INDEX IF NOT EXISTS "batch_payments_network_type_idx" ON "batch_payments"("network_type");

-- ============================================================================
-- 5. Create views for easier multi-network querying
-- ============================================================================

-- View: All vendor addresses (including primary and additional)
CREATE OR REPLACE VIEW "vendor_all_addresses" AS
SELECT
  v.id as vendor_id,
  v.name as vendor_name,
  v.owner_address,
  va.network,
  va.address,
  va.is_primary,
  va.label,
  va.verified_at
FROM "vendors" v
LEFT JOIN "vendor_addresses" va ON v.id = va.vendor_id
ORDER BY v.name, va.is_primary DESC, va.network;

-- View: Payment statistics by network
CREATE OR REPLACE VIEW "payment_stats_by_network" AS
SELECT
  network_type,
  chain,
  status,
  COUNT(*) as transaction_count,
  SUM(CAST(amount AS DECIMAL)) as total_amount,
  AVG(CAST(amount AS DECIMAL)) as avg_amount,
  MIN(created_at) as first_transaction,
  MAX(created_at) as last_transaction
FROM "payments"
GROUP BY network_type, chain, status;

-- View: Network distribution summary
CREATE OR REPLACE VIEW "network_distribution_summary" AS
SELECT
  network,
  COUNT(DISTINCT vendor_id) as vendor_count,
  COUNT(*) as address_count,
  COUNT(CASE WHEN is_primary THEN 1 END) as primary_count
FROM "vendor_addresses"
GROUP BY network;

-- ============================================================================
-- 6. Add comments for documentation
-- ============================================================================

COMMENT ON TABLE "vendor_addresses" IS 'Multi-network addresses for vendors (EVM + TRON support)';
COMMENT ON COLUMN "vendor_addresses"."network" IS 'Network identifier: ethereum, tron, arbitrum, base, bsc';
COMMENT ON COLUMN "vendor_addresses"."is_primary" IS 'Primary address for this network (one per network per vendor)';

COMMENT ON COLUMN "payments"."network_type" IS 'Network type: EVM or TRON';
COMMENT ON COLUMN "payments"."chain_id" IS 'EVM chain ID (null for TRON)';
COMMENT ON COLUMN "payments"."energy_used" IS 'TRON energy consumption';
COMMENT ON COLUMN "payments"."bandwidth_used" IS 'TRON bandwidth consumption';

-- ============================================================================
-- 7. Create helper functions
-- ============================================================================

-- Function: Get primary address for a vendor on a specific network
CREATE OR REPLACE FUNCTION get_vendor_primary_address(p_vendor_id TEXT, p_network TEXT)
RETURNS TEXT AS $$
  SELECT address
  FROM "vendor_addresses"
  WHERE vendor_id = p_vendor_id
    AND network = p_network
    AND is_primary = true
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Function: Get all networks for a vendor
CREATE OR REPLACE FUNCTION get_vendor_networks(p_vendor_id TEXT)
RETURNS TEXT[] AS $$
  SELECT ARRAY_AGG(DISTINCT network ORDER BY network)
  FROM "vendor_addresses"
  WHERE vendor_id = p_vendor_id;
$$ LANGUAGE SQL STABLE;

-- Function: Check if vendor has address on network
CREATE OR REPLACE FUNCTION vendor_has_network(p_vendor_id TEXT, p_network TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM "vendor_addresses"
    WHERE vendor_id = p_vendor_id AND network = p_network
  );
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- 8. Data validation
-- ============================================================================

-- Ensure at least one primary address per vendor per network
CREATE OR REPLACE FUNCTION ensure_one_primary_address_per_network()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a new primary, unset others
  IF NEW.is_primary = true THEN
    UPDATE "vendor_addresses"
    SET is_primary = false
    WHERE vendor_id = NEW.vendor_id
      AND network = NEW.network
      AND id != NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_one_primary_per_network
BEFORE INSERT OR UPDATE ON "vendor_addresses"
FOR EACH ROW
EXECUTE FUNCTION ensure_one_primary_address_per_network();

-- ============================================================================
-- 9. Security: Row-Level Security (RLS) for new tables
-- ============================================================================

-- Enable RLS on vendor_addresses
ALTER TABLE "vendor_addresses" ENABLE ROW LEVEL SECURITY;

-- Create policies (users can only access their own vendor addresses)
CREATE POLICY "vendor_addresses_select_policy" ON "vendor_addresses"
  FOR SELECT
  USING (
    vendor_id IN (
      SELECT id FROM "vendors" WHERE owner_address = current_setting('app.current_user_address', true)
    )
  );

CREATE POLICY "vendor_addresses_insert_policy" ON "vendor_addresses"
  FOR INSERT
  WITH CHECK (
    vendor_id IN (
      SELECT id FROM "vendors" WHERE owner_address = current_setting('app.current_user_address', true)
    )
  );

CREATE POLICY "vendor_addresses_update_policy" ON "vendor_addresses"
  FOR UPDATE
  USING (
    vendor_id IN (
      SELECT id FROM "vendors" WHERE owner_address = current_setting('app.current_user_address', true)
    )
  );

CREATE POLICY "vendor_addresses_delete_policy" ON "vendor_addresses"
  FOR DELETE
  USING (
    vendor_id IN (
      SELECT id FROM "vendors" WHERE owner_address = current_setting('app.current_user_address', true)
    )
  );

-- ============================================================================
-- 10. Performance optimizations
-- ============================================================================

-- Analyze tables for query planner
ANALYZE "vendor_addresses";
ANALYZE "payments";
ANALYZE "batch_payments";

COMMIT;

-- ============================================================================
-- Migration complete
-- ============================================================================
--
-- Summary:
-- - Added VendorAddress table for multi-network support
-- - Migrated existing vendor addresses
-- - Extended Payment model with network-specific fields
-- - Extended BatchPayment model for multi-network
-- - Created views for easier querying
-- - Added helper functions
-- - Implemented data validation triggers
-- - Applied Row-Level Security
--
-- Next steps:
-- 1. Generate Prisma client: pnpm prisma generate
-- 2. Test API endpoints with new schema
-- 3. Update UI to use multi-network addresses
-- ============================================================================
