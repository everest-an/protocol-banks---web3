-- Protocol Banks Database Verification Script
-- This script verifies the database is correctly set up
-- All tables and functions were created via Supabase migrations

-- Verify core tables exist
DO $$
BEGIN
  -- Check core payment tables
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendors') THEN
    RAISE EXCEPTION 'Missing table: vendors';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    RAISE EXCEPTION 'Missing table: payments';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_payments') THEN
    RAISE EXCEPTION 'Missing table: batch_payments';
  END IF;
  
  -- Check security tables
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    RAISE EXCEPTION 'Missing table: audit_logs';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'spending_limits') THEN
    RAISE EXCEPTION 'Missing table: spending_limits';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'session_bindings') THEN
    RAISE EXCEPTION 'Missing table: session_bindings';
  END IF;
  
  -- Check fee tables
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fee_config') THEN
    RAISE EXCEPTION 'Missing table: fee_config';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'protocol_fees') THEN
    RAISE EXCEPTION 'Missing table: protocol_fees';
  END IF;
  
  RAISE NOTICE 'All required tables exist!';
END $$;

-- Display current fee configuration
SELECT config_key, config_value, description 
FROM fee_config 
ORDER BY config_key;

-- Display table counts
SELECT 
  'vendors' as table_name, COUNT(*) as row_count FROM vendors
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'batch_payments', COUNT(*) FROM batch_payments
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL
SELECT 'protocol_fees', COUNT(*) FROM protocol_fees
UNION ALL
SELECT 'spending_limits', COUNT(*) FROM spending_limits
UNION ALL
SELECT 'session_bindings', COUNT(*) FROM session_bindings;
