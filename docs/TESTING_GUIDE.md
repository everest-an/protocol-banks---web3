# Multi-Network Support Testing Guide

## Prerequisites

Before testing, ensure:
1. ✅ Database migration has been run successfully
2. ✅ Prisma client has been generated (`pnpm prisma generate`)
3. ✅ Development server is running (`pnpm dev`)
4. ✅ You have a wallet connected (MetaMask for EVM, TronLink for TRON)

## Test Environment Setup

```bash
# 1. Install dependencies (if not already done)
pnpm install

# 2. Generate Prisma client
pnpm prisma generate

# 3. Run database migration
pnpm prisma db push

# 4. Start development server
pnpm dev

# 5. Open application
# Navigate to http://localhost:3000
```

## Testing Scenarios

### 1. Vendor Multi-Network Address Management

#### Test 1.1: Create Vendor with Multiple Addresses

**Steps:**
1. Navigate to vendor management page
2. Click "Create Vendor" or "Add Vendor"
3. Fill in vendor details:
   - Name: "Test Multi-Network Vendor"
   - Add Ethereum address: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2`
   - Add TRON address: `TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE`
   - Add Base address: `0x1234567890123456789012345678901234567890`

**Using API:**
```bash
curl -X POST http://localhost:3000/api/vendors/multi-network \
  -H "Content-Type: application/json" \
  -H "x-user-address: YOUR_WALLET_ADDRESS" \
  -d '{
    "name": "Test Multi-Network Vendor",
    "addresses": [
      {
        "network": "ethereum",
        "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
        "label": "Main ETH wallet",
        "isPrimary": true
      },
      {
        "network": "tron",
        "address": "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
        "label": "Main TRON wallet",
        "isPrimary": true
      },
      {
        "network": "base",
        "address": "0x1234567890123456789012345678901234567890",
        "isPrimary": true
      }
    ],
    "companyName": "Test Company",
    "email": "test@example.com"
  }'
```

**Expected Result:**
- ✅ Vendor created successfully
- ✅ All three addresses saved
- ✅ Each address marked as primary for its network
- ✅ Network badges displayed correctly
- ✅ Addresses formatted with proper checksums

#### Test 1.2: Add Address to Existing Vendor

**Steps:**
1. Open existing vendor
2. Use `VendorAddressManager` component
3. Click "Add Address"
4. Enter Arbitrum address: `0xabcdefabcdefabcdefabcdefabcdefabcdefabcd`
5. Select network: "Arbitrum"
6. Add label: "Arbitrum wallet"
7. Save

**Using API:**
```bash
curl -X POST http://localhost:3000/api/vendors/VENDOR_ID/addresses \
  -H "Content-Type: application/json" \
  -H "x-user-address: YOUR_WALLET_ADDRESS" \
  -d '{
    "network": "arbitrum",
    "address": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    "label": "Arbitrum wallet",
    "isPrimary": true
  }'
```

**Expected Result:**
- ✅ New address added to vendor
- ✅ Arbitrum network badge appears
- ✅ Address is marked as primary for Arbitrum
- ✅ Total address count increased

#### Test 1.3: Update Address Label and Primary Status

**Steps:**
1. Select an existing address
2. Click edit icon
3. Change label to "Updated label"
4. Toggle primary status
5. Save

**Using API:**
```bash
curl -X PATCH http://localhost:3000/api/vendors/VENDOR_ID/addresses/ADDRESS_ID \
  -H "Content-Type: application/json" \
  -H "x-user-address: YOUR_WALLET_ADDRESS" \
  -d '{
    "label": "Updated label",
    "isPrimary": false
  }'
```

**Expected Result:**
- ✅ Label updated successfully
- ✅ Primary status changed
- ✅ UI reflects changes immediately
- ✅ No duplicate primary addresses on same network

#### Test 1.4: Delete Address

**Steps:**
1. Select an address (ensure it's not the last one)
2. Click delete icon
3. Confirm deletion

**Using API:**
```bash
curl -X DELETE http://localhost:3000/api/vendors/VENDOR_ID/addresses/ADDRESS_ID \
  -H "x-user-address: YOUR_WALLET_ADDRESS"
```

**Expected Result:**
- ✅ Address removed from list
- ✅ If deleting primary address, another address becomes primary
- ✅ Cannot delete last address (error message shown)

#### Test 1.5: Network Auto-Detection

**Steps:**
1. Click "Add Address"
2. Paste TRON address: `TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE`
3. Observe network dropdown

**Expected Result:**
- ✅ Network automatically set to "TRON"
- ✅ Address validated as TRON format
- ✅ Save button enabled

**Repeat with EVM address:**
1. Clear and paste: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2`

**Expected Result:**
- ✅ Network automatically set to "Ethereum" (default EVM)
- ✅ Address validated and checksummed
- ✅ Can manually change to other EVM networks (Base, Arbitrum, etc.)

### 2. Payment Multi-Network Support

#### Test 2.1: Create Payment to TRON Address

**Using API:**
```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -H "x-user-address: YOUR_WALLET_ADDRESS" \
  -d '{
    "from_address": "YOUR_WALLET_ADDRESS",
    "to_address": "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
    "amount": "100.00",
    "token": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    "token_symbol": "USDT",
    "type": "sent",
    "energy_used": "28000",
    "bandwidth_used": "345"
  }'
```

**Expected Result:**
- ✅ Payment created with `network_type: "TRON"`
- ✅ `chain` set to "tron"
- ✅ `chain_id` is null (TRON doesn't use chain IDs)
- ✅ `energy_used` and `bandwidth_used` saved correctly

#### Test 2.2: Create Payment to EVM Address

**Using API:**
```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -H "x-user-address: YOUR_WALLET_ADDRESS" \
  -d '{
    "from_address": "YOUR_WALLET_ADDRESS",
    "to_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
    "amount": "50.00",
    "token": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "token_symbol": "USDC",
    "chain": "ethereum",
    "type": "sent",
    "gas_used": "21000",
    "gas_price": "50000000000"
  }'
```

**Expected Result:**
- ✅ Payment created with `network_type: "EVM"`
- ✅ `chain` set to "ethereum"
- ✅ `chain_id` set to 1
- ✅ `gas_used` and `gas_price` saved correctly

#### Test 2.3: Filter Payments by Network

**Using API:**
```bash
# Get TRON payments only
curl -X GET "http://localhost:3000/api/payments?network=tron" \
  -H "x-user-address: YOUR_WALLET_ADDRESS"

# Get all EVM payments
curl -X GET "http://localhost:3000/api/payments?network_type=EVM" \
  -H "x-user-address: YOUR_WALLET_ADDRESS"

# Get Base network payments
curl -X GET "http://localhost:3000/api/payments?network=base" \
  -H "x-user-address: YOUR_WALLET_ADDRESS"
```

**Expected Result:**
- ✅ Only payments matching filter are returned
- ✅ Pagination works correctly
- ✅ `total` count reflects filtered results

#### Test 2.4: Filter Payments by Status and Date

**Using API:**
```bash
curl -X GET "http://localhost:3000/api/payments?status=completed&start_date=2026-01-01&network_type=TRON" \
  -H "x-user-address: YOUR_WALLET_ADDRESS"
```

**Expected Result:**
- ✅ Only completed TRON payments after Jan 1, 2026 are returned
- ✅ Multiple filters work together correctly

#### Test 2.5: Get Payment Statistics

**Using API:**
```bash
# Overall stats
curl -X GET "http://localhost:3000/api/payments/stats" \
  -H "x-user-address: YOUR_WALLET_ADDRESS"

# TRON-only stats
curl -X GET "http://localhost:3000/api/payments/stats?network_type=TRON" \
  -H "x-user-address: YOUR_WALLET_ADDRESS"
```

**Expected Result:**
```json
{
  "summary": {
    "totalPayments": 523,
    "totalVolumeUSD": 125430.50,
    "sentCount": 312,
    "receivedCount": 211,
    "recentActivity": 45
  },
  "byNetwork": [
    {"network": "tron", "count": 234, "volumeUSD": 45678.90},
    {"network": "ethereum", "count": 289, "volumeUSD": 79751.60}
  ],
  "byNetworkType": [
    {"networkType": "TRON", "count": 234, "volumeUSD": 45678.90},
    {"networkType": "EVM", "count": 289, "volumeUSD": 79751.60}
  ]
}
```

### 3. Batch Payment Multi-Network Support

#### Test 3.1: Create Batch with Mixed Addresses

**Using API:**
```bash
curl -X POST http://localhost:3000/api/batch-payment \
  -H "Content-Type: application/json" \
  -H "x-user-address: YOUR_WALLET_ADDRESS" \
  -d '{
    "recipients": [
      {"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2", "amount": "10.00"},
      {"address": "0x1234567890123456789012345678901234567890", "amount": "20.00"}
    ],
    "token": "USDC"
  }'
```

**Expected Result:**
- ✅ Batch created successfully
- ✅ Network auto-detected as "ethereum" from first recipient
- ✅ `network_type` set to "EVM"
- ✅ `chain_id` set correctly

#### Test 3.2: Create TRON Batch Payment

**Using API:**
```bash
curl -X POST http://localhost:3000/api/batch-payment \
  -H "Content-Type: application/json" \
  -H "x-user-address: YOUR_WALLET_ADDRESS" \
  -d '{
    "recipients": [
      {"address": "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE", "amount": "50.00"},
      {"address": "TAjQx2VkFLiQPSKCEKqHBWGWPWNQqKQw2h", "amount": "75.00"}
    ],
    "token": "USDT"
  }'
```

**Expected Result:**
- ✅ Batch created for TRON network
- ✅ `network_type` set to "TRON"
- ✅ `chain` set to "tron"
- ✅ `chain_id` is null

#### Test 3.3: Filter Batches by Network

**Using API:**
```bash
curl -X GET "http://localhost:3000/api/batch-payment?network=tron" \
  -H "x-user-address: YOUR_WALLET_ADDRESS"
```

**Expected Result:**
- ✅ Only TRON batches returned
- ✅ Batch count accurate

### 4. UI Component Testing

#### Test 4.1: VendorAddressManager Component

**Steps:**
1. Navigate to vendor edit page
2. Locate `VendorAddressManager` component
3. Test all CRUD operations:
   - Add new address
   - Edit address label
   - Change primary status
   - Delete address
4. Verify all operations work smoothly

**Expected Behavior:**
- ✅ Dialogs open/close correctly
- ✅ Forms validate input
- ✅ Error messages display for invalid addresses
- ✅ Success feedback after operations
- ✅ List updates immediately after changes

#### Test 4.2: TransactionList Component

**Steps:**
1. Navigate to transaction history page
2. Test filtering:
   - Select "TRON" in network type filter
   - Select "Completed" status
   - Search for specific address
3. Verify results update

**Expected Behavior:**
- ✅ Filters apply correctly
- ✅ Network badges show correct colors
- ✅ Gas/Energy fields display based on network type
- ✅ Block explorer links work
- ✅ Pagination loads more results

#### Test 4.3: NetworkSelector Component

**Steps:**
1. Find any form with NetworkSelector
2. Click dropdown
3. Verify network options appear
4. Select different networks

**Expected Behavior:**
- ✅ All networks listed (Ethereum, TRON, Base, Arbitrum, BSC)
- ✅ Network badges display in dropdown
- ✅ Selection updates parent component
- ✅ "All Networks" option appears if includeAll=true

### 5. Edge Cases and Error Handling

#### Test 5.1: Invalid Address Format

**Using API:**
```bash
curl -X POST http://localhost:3000/api/vendors/VENDOR_ID/addresses \
  -H "Content-Type: application/json" \
  -H "x-user-address: YOUR_WALLET_ADDRESS" \
  -d '{
    "network": "ethereum",
    "address": "invalid-address",
    "isPrimary": true
  }'
```

**Expected Result:**
- ✅ Returns 400 error
- ✅ Error message: "Invalid address: ..."
- ✅ No database changes

#### Test 5.2: Duplicate Network Address

**Using API:**
```bash
# Add address on network that already has one
curl -X POST http://localhost:3000/api/vendors/VENDOR_ID/addresses \
  -H "Content-Type: application/json" \
  -H "x-user-address: YOUR_WALLET_ADDRESS" \
  -d '{
    "network": "ethereum",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
    "isPrimary": true
  }'
```

**Expected Result:**
- ✅ Returns 409 error
- ✅ Error message: "Address already exists for this network"
- ✅ No duplicate created

#### Test 5.3: Delete Last Address

**Using API:**
```bash
# Try to delete vendor's only address
curl -X DELETE http://localhost:3000/api/vendors/VENDOR_ID/addresses/LAST_ADDRESS_ID \
  -H "x-user-address: YOUR_WALLET_ADDRESS"
```

**Expected Result:**
- ✅ Returns 400 error
- ✅ Error message: "Cannot delete the last address"
- ✅ Address not deleted

#### Test 5.4: Unauthorized Access

**Using API:**
```bash
# Try to access another user's vendor
curl -X GET http://localhost:3000/api/vendors/OTHER_USER_VENDOR_ID/addresses \
  -H "x-user-address: YOUR_WALLET_ADDRESS"
```

**Expected Result:**
- ✅ Returns 401 or 403 error
- ✅ No data leaked
- ✅ RLS policies working

### 6. Performance Testing

#### Test 6.1: Load Testing with Many Addresses

**Steps:**
1. Create vendor with 10+ addresses across different networks
2. Load vendor detail page
3. Measure load time

**Expected Result:**
- ✅ Page loads in < 2 seconds
- ✅ All addresses render correctly
- ✅ No UI lag or jank

#### Test 6.2: Filter Large Transaction List

**Steps:**
1. Generate 1000+ test transactions
2. Apply multiple filters
3. Measure response time

**Expected Result:**
- ✅ API responds in < 1 second
- ✅ Database indexes being used (check query plan)
- ✅ Pagination works efficiently

## Automated Testing

### Unit Tests

Run existing tests:
```bash
pnpm test
```

**Key test files:**
- `lib/__tests__/address-utils.test.ts` - Address validation
- `lib/__tests__/networks.test.ts` - Network configuration
- `lib/__tests__/integration.test.ts` - Integration scenarios

### Integration Tests

Create new integration tests for API endpoints:

```typescript
// tests/api/vendors-multi-network.test.ts
describe("Vendor Multi-Network API", () => {
  test("creates vendor with multiple addresses", async () => {
    const response = await fetch("/api/vendors/multi-network", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-address": testAddress,
      },
      body: JSON.stringify({
        name: "Test Vendor",
        addresses: [
          { network: "ethereum", address: "0x...", isPrimary: true },
          { network: "tron", address: "T...", isPrimary: true },
        ],
      }),
    })

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.vendor.addresses).toHaveLength(2)
  })

  // Add more tests...
})
```

## Test Data

### Sample Addresses

**Ethereum:**
- `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2`
- `0x1234567890123456789012345678901234567890`

**TRON:**
- `TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE`
- `TAjQx2VkFLiQPSKCEKqHBWGWPWNQqKQw2h`

**Base:**
- `0xabcdefabcdefabcdefabcdefabcdefabcdefabcd`

**Arbitrum:**
- `0x9876543210987654321098765432109876543210`

### Sample Tokens

**TRON USDT (TRC20):**
- `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`

**Ethereum USDC:**
- `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`

## Troubleshooting

### Issue: "Database migration not applied"

**Solution:**
```bash
pnpm prisma db push
```

### Issue: "Prisma client outdated"

**Solution:**
```bash
pnpm prisma generate
```

### Issue: "Network auto-detection not working"

**Check:**
1. Address format is correct
2. `validateAddress()` function returns valid result
3. Import `address-utils` correctly in component

### Issue: "RLS policies blocking queries"

**Solution:**
- Ensure `x-user-address` header is set
- Check if current user owns the vendor
- Review RLS policies in migration script

## Test Completion Checklist

- [ ] All vendor CRUD operations work
- [ ] Multi-network address management functional
- [ ] Payment creation with TRON addresses works
- [ ] Payment creation with EVM addresses works
- [ ] Network filtering works correctly
- [ ] Statistics endpoints return accurate data
- [ ] Batch payments work for both EVM and TRON
- [ ] UI components render correctly
- [ ] Network auto-detection works
- [ ] Error handling displays proper messages
- [ ] Edge cases handled gracefully
- [ ] Performance is acceptable
- [ ] Unit tests pass
- [ ] Integration tests pass

## Reporting Issues

When reporting issues, include:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. API request/response (if applicable)
5. Browser console errors
6. Network request details from DevTools

---

**Testing Guide Version:** 1.0.0
**Last Updated:** 2026-02-07
