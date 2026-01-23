-- ============================================
-- Add vendor_id Column to Payments Table
-- ============================================
-- Links payments to vendors for payment history and statistics
-- Supports Requirement 12: Payment-to-Vendor Relationship Mapping

-- Add vendor_id column to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

-- Create index for efficient vendor payment lookups
CREATE INDEX IF NOT EXISTS idx_payments_vendor_id 
  ON payments(vendor_id);

-- Create composite index for vendor payment queries with date filtering
CREATE INDEX IF NOT EXISTS idx_payments_vendor_id_created_at 
  ON payments(vendor_id, created_at DESC);

-- Function to auto-link payment to vendor based on to_address
CREATE OR REPLACE FUNCTION auto_link_payment_to_vendor()
RETURNS TRIGGER AS $$
DECLARE
  matched_vendor_id UUID;
BEGIN
  -- Only process if vendor_id is not already set
  IF NEW.vendor_id IS NULL AND NEW.to_address IS NOT NULL THEN
    -- Find vendor with matching wallet_address (case-insensitive)
    SELECT id INTO matched_vendor_id
    FROM vendors
    WHERE LOWER(wallet_address) = LOWER(NEW.to_address)
      AND owner_address = NEW.from_address
    LIMIT 1;
    
    -- Set vendor_id if match found
    IF matched_vendor_id IS NOT NULL THEN
      NEW.vendor_id = matched_vendor_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-link payments to vendors on insert
DROP TRIGGER IF EXISTS trigger_auto_link_payment_to_vendor ON payments;
CREATE TRIGGER trigger_auto_link_payment_to_vendor
  BEFORE INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_payment_to_vendor();

-- Backfill existing payments with vendor_id where applicable
-- This updates existing payment records to link them to vendors
UPDATE payments p
SET vendor_id = v.id
FROM vendors v
WHERE LOWER(p.to_address) = LOWER(v.wallet_address)
  AND p.from_address = v.owner_address
  AND p.vendor_id IS NULL;

-- Add comment
COMMENT ON COLUMN payments.vendor_id IS 'Foreign key to vendors table, auto-populated based on to_address match';

-- Create view for vendor payment statistics
CREATE OR REPLACE VIEW vendor_payment_stats AS
SELECT 
  v.id AS vendor_id,
  v.name AS vendor_name,
  v.owner_address,
  COUNT(p.id) AS total_transactions,
  COALESCE(SUM(CAST(p.amount AS DECIMAL)), 0) AS total_volume,
  COUNT(CASE WHEN p.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) AS monthly_transactions,
  COALESCE(SUM(CASE WHEN p.created_at >= NOW() - INTERVAL '30 days' THEN CAST(p.amount AS DECIMAL) ELSE 0 END), 0) AS monthly_volume,
  MAX(p.created_at) AS last_payment_date
FROM vendors v
LEFT JOIN payments p ON p.vendor_id = v.id AND p.status = 'completed'
GROUP BY v.id, v.name, v.owner_address;

-- Grant access to the view
GRANT SELECT ON vendor_payment_stats TO authenticated;
GRANT SELECT ON vendor_payment_stats TO service_role;

COMMENT ON VIEW vendor_payment_stats IS 'Aggregated payment statistics per vendor for reporting';
