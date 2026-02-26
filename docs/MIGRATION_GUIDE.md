# Multi-Network Support Migration Guide

## Overview

This guide explains how to migrate your database to support multi-network functionality (EVM + TRON).

## Migration Status

‚ú?**Completed:**
- Prisma schema updated with multi-network models
- Prisma client generated (v7.3.0)
- API routes created with multi-network support
- UI components created for address management

‚è?**Pending:**
- Database migration execution (requires running PostgreSQL server)
- End-to-end testing

## Prerequisites

1. **PostgreSQL Database Running**
   - Ensure your PostgreSQL server is running on `localhost:51214`
   - You can start it using:
     ```bash
     # If using Docker
     docker start <postgres-container>

     # If using local PostgreSQL
     pg_ctl start -D /path/to/data
     ```

2. **Database Connection Configured**
   - Verify `DATABASE_URL` is set in `.env` file
   - Current configuration: `prisma+postgres://localhost:51213/...`

## Migration Steps

### Option 1: Using Prisma (Recommended for Development)

This method will sync your schema to the database automatically:

```bash
# Navigate to project directory
cd "e:\Protocol Bank\Development\ÂéÜÂè≤ÁâàÊú¨\protocol-banks---web3-main"

# Push schema changes to database
pnpm prisma db push

# Generate Prisma client (already done)
pnpm prisma generate
```

**What this does:**
- Creates the `vendor_addresses` table
- Adds new columns to `payments` table (network_type, chain_id, energy_used, etc.)
- Adds new columns to `batch_payments` table (chain, network_type)
- Creates indexes for performance

**Limitations:**
- Does NOT create views, functions, or triggers (use Option 2 for those)
- Does NOT migrate existing data automatically

### Option 2: Using SQL Migration Script (Recommended for Production)

This method runs the comprehensive migration script with all features:

```bash
# 1. Start PostgreSQL server (if not running)
# 2. Extract database connection details from your DATABASE_URL
# 3. Run the migration script

# Using psql
psql -h localhost -p 51214 -U postgres -d template1 -f scripts/009_multi_network_support.sql

# Or using Prisma's executeRaw (create a script)
node scripts/run-migration.js
```

**What this does (in addition to Option 1):**
- ‚ú?Creates tables and indexes
- ‚ú?Migrates existing vendor addresses to new table
- ‚ú?Updates existing payment records with network_type and chain_id
- ‚ú?Normalizes chain names
- ‚ú?Creates database views for easier querying:
  - `vendor_all_addresses` - All vendor addresses with primary flag
  - `payment_stats_by_network` - Aggregated payment statistics
  - `network_distribution_summary` - Network usage summary
- ‚ú?Creates helper functions:
  - `get_vendor_primary_address(vendor_id, network)` - Get primary address
  - `get_vendor_networks(vendor_id)` - Get all networks for vendor
  - `vendor_has_network(vendor_id, network)` - Check network availability
- ‚ú?Creates database triggers:
  - `ensure_one_primary_address_per_network()` - Enforces single primary per network
- ‚ú?Applies Row-Level Security (RLS) policies
- ‚ú?Optimizes query planner with ANALYZE

## Data Migration Details

### Existing Vendors

The migration will automatically:
1. Create a `VendorAddress` entry for each existing vendor
2. Map the vendor's `wallet_address` and `chain` to the new multi-network structure
3. Mark the migrated address as primary for that network

Example mapping:
- Vendor with `wallet_address="0x123..."` and `chain="Ethereum"`
  ‚Ü?Creates VendorAddress with `network="ethereum"`, `address="0x123..."`, `is_primary=true`

### Existing Payments

The migration will:
1. Set `network_type` based on chain:
   - TRON chains ‚Ü?`network_type="TRON"`
   - All others ‚Ü?`network_type="EVM"`
2. Set `chain_id` for EVM networks:
   - Ethereum Mainnet ‚Ü?`chain_id=1`
   - Sepolia ‚Ü?`chain_id=11155111`
   - Arbitrum ‚Ü?`chain_id=42161`
   - Base ‚Ü?`chain_id=8453`
   - BSC ‚Ü?`chain_id=56`
3. Normalize chain names to lowercase (e.g., "Ethereum" ‚Ü?"ethereum")

## Verification Steps

After running the migration, verify it worked correctly:

```bash
# 1. Check that vendor_addresses table was created
pnpm prisma studio
# Navigate to "vendor_addresses" table

# 2. Verify existing vendors have addresses
# Run this query in Prisma Studio or psql:
SELECT v.name, va.network, va.address, va.is_primary
FROM vendors v
LEFT JOIN vendor_addresses va ON v.id = va.vendor_id
ORDER BY v.name;

# 3. Check payment network_type distribution
SELECT network_type, COUNT(*) as count
FROM payments
GROUP BY network_type;

# 4. Test the views
SELECT * FROM vendor_all_addresses LIMIT 10;
SELECT * FROM payment_stats_by_network;
SELECT * FROM network_distribution_summary;
```

## API Endpoints Ready

The following API endpoints are now ready to use:

### Vendor Multi-Network APIs

- `GET /api/vendors/multi-network` - List all vendors with addresses
- `POST /api/vendors/multi-network` - Create vendor with multi-network addresses
- `GET /api/vendors/:id/multi-network` - Get single vendor with all addresses
- `GET /api/vendors/:id/addresses` - List addresses for a vendor
- `POST /api/vendors/:id/addresses` - Add new address to vendor
- `PATCH /api/vendors/:id/addresses/:addressId` - Update address (label, primary)
- `DELETE /api/vendors/:id/addresses/:addressId` - Delete address

### Payment Multi-Network APIs

- `GET /api/payments` - List payments with network filtering
  - Query params: `network`, `network_type`, `status`, `start_date`, `end_date`, `limit`, `offset`
- `POST /api/payments` - Create payment with auto-network detection
- `GET /api/payments/stats` - Get aggregated payment statistics by network

### Batch Payment Multi-Network APIs

- `GET /api/batch-payment` - List batch payments with network filtering
- `POST /api/batch-payment` - Create batch with auto-network detection
- `GET /api/batch-payment/stats` - Get aggregated batch statistics

## UI Components Ready

The following React components are ready to integrate:

1. **VendorAddressManager** (`components/vendors/vendor-address-manager.tsx`)
   - Full CRUD interface for managing vendor addresses
   - Auto-detects network from address format
   - Supports adding, editing, deleting addresses
   - Primary address management per network

2. **VendorAddressList** (`components/vendors/vendor-address-list.tsx`)
   - Read-only display of vendor addresses
   - Compact and full view modes
   - Copy-to-clipboard functionality

3. **NetworkBadge** (`components/vendors/network-badge.tsx`)
   - Reusable network badge component
   - Color-coded by network type

4. **NetworkSelector** (`components/ui/network-selector.tsx`)
   - Dropdown selector for networks
   - Network type selector (EVM/TRON)
   - Used in filters and forms

5. **TransactionList** (`components/transactions/transaction-list.tsx`)
   - Complete transaction list with filtering
   - Network badges and status indicators
   - Pagination support
   - Block explorer links

## Rollback (If Needed)

If you need to rollback the migration:

```bash
# Option 1: Drop new tables and columns
psql -h localhost -p 51214 -U postgres -d template1 << EOF
BEGIN;

-- Drop new table
DROP TABLE IF EXISTS vendor_addresses CASCADE;

-- Remove new columns from payments
ALTER TABLE payments
  DROP COLUMN IF EXISTS network_type,
  DROP COLUMN IF EXISTS chain_id,
  DROP COLUMN IF EXISTS energy_used,
  DROP COLUMN IF EXISTS bandwidth_used,
  DROP COLUMN IF EXISTS gas_used,
  DROP COLUMN IF EXISTS gas_price,
  DROP COLUMN IF EXISTS confirmations,
  DROP COLUMN IF EXISTS block_number;

-- Remove new columns from batch_payments
ALTER TABLE batch_payments
  DROP COLUMN IF EXISTS chain,
  DROP COLUMN IF EXISTS network_type;

-- Drop views
DROP VIEW IF EXISTS vendor_all_addresses;
DROP VIEW IF EXISTS payment_stats_by_network;
DROP VIEW IF EXISTS network_distribution_summary;

-- Drop functions
DROP FUNCTION IF EXISTS get_vendor_primary_address(TEXT, TEXT);
DROP FUNCTION IF EXISTS get_vendor_networks(TEXT);
DROP FUNCTION IF EXISTS vendor_has_network(TEXT, TEXT);
DROP FUNCTION IF EXISTS ensure_one_primary_address_per_network();

COMMIT;
EOF
```

## Troubleshooting

### Issue: "Can't reach database server"

**Solution:**
1. Check if PostgreSQL is running: `pg_isready -h localhost -p 51214`
2. Start PostgreSQL if needed
3. Verify connection string in `.env`

### Issue: "Migration already applied"

**Solution:**
- If using `prisma db push`, it's safe to run multiple times (idempotent)
- If using SQL script, check if tables already exist:
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'vendor_addresses';
  ```

### Issue: "Unique constraint violation"

**Solution:**
- This may occur if you run the migration twice
- Check for duplicate entries:
  ```sql
  SELECT vendor_id, network, COUNT(*)
  FROM vendor_addresses
  GROUP BY vendor_id, network
  HAVING COUNT(*) > 1;
  ```
- Remove duplicates before re-running

## Next Steps After Migration

1. **Test API Endpoints**
   ```bash
   # Test vendor creation with multiple addresses
   curl -X POST http://localhost:3000/api/vendors/multi-network \
     -H "Content-Type: application/json" \
     -H "x-wallet-address: YOUR_ADDRESS" \
     -d '{
       "name": "Test Vendor",
       "addresses": [
         {"network": "ethereum", "address": "0x...", "isPrimary": true},
         {"network": "tron", "address": "T...", "isPrimary": true}
       ]
     }'
   ```

2. **Integrate UI Components**
   - Add `VendorAddressManager` to vendor edit pages
   - Add `TransactionList` to history page
   - Replace old network selectors with `NetworkSelector`

3. **Update Existing Code**
   - Replace direct `vendor.wallet_address` usage with `vendor.addresses` queries
   - Update payment creation to include `network_type` and network-specific fields
   - Add network filtering to transaction list pages

4. **Run Tests**
   ```bash
   pnpm test
   ```

## Support

If you encounter any issues during migration:
1. Check the migration script: `scripts/009_multi_network_support.sql`
2. Review Prisma schema: `prisma/schema.prisma`
3. Check logs for detailed error messages
4. Verify database connection and permissions

---

**Migration prepared by:** Claude Code
**Date:** 2026-02-07
**Version:** 1.0.0
