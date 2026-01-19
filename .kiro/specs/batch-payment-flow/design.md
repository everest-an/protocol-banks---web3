# Design Document

## System Architecture

### High-Level Flow

```
File Upload (CSV/Excel)
    ↓
File Parsing & Validation
    ↓
Data Cleaning & Deduplication
    ↓
Fee Calculation & Preview
    ↓
User Confirmation & PIN Entry
    ↓
Transaction Signing
    ↓
Batch Submission (Standard or x402)
    ↓
On-Chain Execution
    ↓
Status Tracking & Reporting
```

### Component Interactions

```
Frontend (Next.js)
    ↓
API Routes (/api/batch-payment/*)
    ↓
Batch Service (Business Logic)
    ├─ File Parser
    ├─ Batch Validator
    ├─ Fee Calculator
    ├─ Transaction Executor
    └─ Status Tracker
    ↓
Database (PostgreSQL)
    ├─ batch_payments
    ├─ payment_items
    ├─ batch_drafts
    └─ payment_audit_logs
    ↓
External Services
    ├─ Blockchain RPC (Alchemy/Infura)
    ├─ Token Contract Interactions
    └─ Relayer (for x402)
```

## Database Schema

### batch_payments Table

```sql
CREATE TABLE batch_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  batch_name VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  -- Status: draft, pending_confirmation, processing, completed, failed, cancelled
  total_amount DECIMAL(38, 18) NOT NULL,
  total_fee DECIMAL(38, 18) NOT NULL,
  payment_method VARCHAR(50) NOT NULL, -- 'standard' or 'x402'
  item_count INT NOT NULL,
  successful_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_batch_payments_user_id ON batch_payments(user_id);
CREATE INDEX idx_batch_payments_status ON batch_payments(status);
CREATE INDEX idx_batch_payments_created_at ON batch_payments(created_at);
```

### payment_items Table

```sql
CREATE TABLE payment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batch_payments(id) ON DELETE CASCADE,
  recipient_address VARCHAR(42) NOT NULL,
  amount DECIMAL(38, 18) NOT NULL,
  token_symbol VARCHAR(20) NOT NULL, -- USDT, USDC, DAI, ETH, etc.
  token_address VARCHAR(42),
  chain_id INT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- Status: pending, processing, completed, failed
  transaction_hash VARCHAR(255),
  error_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_payment_items_batch_id ON payment_items(batch_id);
CREATE INDEX idx_payment_items_status ON payment_items(status);
CREATE INDEX idx_payment_items_recipient ON payment_items(recipient_address);
```

### batch_drafts Table

```sql
CREATE TABLE batch_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  draft_name VARCHAR(255),
  file_data JSONB NOT NULL, -- Parsed CSV/Excel data
  validation_status JSONB, -- Validation results
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days'
);

CREATE INDEX idx_batch_drafts_user_id ON batch_drafts(user_id);
CREATE INDEX idx_batch_drafts_expires_at ON batch_drafts(expires_at);
```

### payment_audit_logs Table

```sql
CREATE TABLE payment_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES batch_payments(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_audit_logs_batch_id ON payment_audit_logs(batch_id);
CREATE INDEX idx_payment_audit_logs_user_id ON payment_audit_logs(user_id);
```

## API Interfaces

### POST /api/batch-payment/upload

**Request:**
```json
{
  "file": "<base64-encoded-file>",
  "fileName": "payments.csv"
}
```

**Response (200):**
```json
{
  "success": true,
  "draftId": "draft_xxx",
  "itemCount": 150,
  "validCount": 148,
  "invalidCount": 2,
  "errors": [
    {
      "row": 5,
      "error": "Invalid Ethereum address"
    }
  ]
}
```

### POST /api/batch-payment/validate

**Request:**
```json
{
  "draftId": "draft_xxx"
}
```

**Response (200):**
```json
{
  "success": true,
  "validItems": 148,
  "invalidItems": 2,
  "summary": {
    "totalAmount": "50000.00",
    "tokenBreakdown": {
      "USDT": "30000.00",
      "USDC": "20000.00"
    }
  }
}
```

### POST /api/batch-payment/calculate-fees

**Request:**
```json
{
  "draftId": "draft_xxx",
  "paymentMethod": "standard"
}
```

**Response (200):**
```json
{
  "success": true,
  "gasEstimate": "0.5",
  "serviceFee": "250.00",
  "totalFee": "250.50",
  "breakdown": {
    "USDT": {
      "gasEstimate": "0.25",
      "serviceFee": "150.00"
    },
    "USDC": {
      "gasEstimate": "0.25",
      "serviceFee": "100.00"
    }
  }
}
```

### POST /api/batch-payment/submit

**Request:**
```json
{
  "draftId": "draft_xxx",
  "paymentMethod": "standard",
  "pin": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "batchId": "batch_xxx",
  "status": "processing",
  "itemCount": 148,
  "estimatedCompletion": "2024-01-20T10:30:00Z"
}
```

### GET /api/batch-payment/:batchId/status

**Response (200):**
```json
{
  "batchId": "batch_xxx",
  "status": "processing",
  "successCount": 75,
  "failedCount": 0,
  "pendingCount": 73,
  "items": [
    {
      "id": "item_xxx",
      "recipient": "0x...",
      "amount": "100.00",
      "token": "USDT",
      "status": "completed",
      "txHash": "0x..."
    }
  ]
}
```

## File Format Support

### CSV Format

```
recipient_address,amount,token_symbol
0x1234567890123456789012345678901234567890,100.00,USDT
0x0987654321098765432109876543210987654321,50.00,USDC
```

### Excel Format

- Column A: recipient_address
- Column B: amount
- Column C: token_symbol
- Supports multiple sheets (each sheet = separate batch)

## Token Support

### Supported Tokens

```javascript
const SUPPORTED_TOKENS = {
  USDT: {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    chains: [1, 137, 42161]
  },
  USDC: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    chains: [1, 137, 42161]
  },
  DAI: {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18,
    chains: [1, 137, 42161]
  },
  ETH: {
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18,
    chains: [1, 137, 42161]
  }
};
```

## Fee Calculation Strategy

### Gas Estimation

- **Standard Transfer**: ~65,000 gas per token
- **Batch of 100 items**: ~6.5M gas total
- **Gas Price**: Use current network gas price from RPC
- **Multiplier**: 1.2x for safety margin

### Service Fee

- **Percentage**: 0.5% of total transfer amount
- **Minimum**: $1.00 per batch
- **Maximum**: $500.00 per batch
- **Calculation**: `serviceFee = max(1, min(500, totalAmount * 0.005))`

### Fee Breakdown

```
Total Amount: $50,000.00
Gas Cost: $250.00
Service Fee: $250.00
Total Fee: $500.00
Final Amount to Recipients: $49,500.00
```

## Transaction Execution Strategy

### Standard Payment Flow

1. **Signing**: Reconstruct private key from Shamir shares using PIN
2. **Grouping**: Group payments by token
3. **Approval**: Check token allowance, approve if needed
4. **Execution**: Submit transfer transactions
5. **Monitoring**: Poll for transaction confirmation
6. **Cleanup**: Destroy private key after signing

### x402 Payment Flow

1. **Authorization**: Generate EIP-712 signatures for each payment
2. **Submission**: Submit signatures to relayer
3. **Relayer Execution**: Relayer submits TransferWithAuthorization
4. **Monitoring**: Poll for on-chain execution
5. **Verification**: Verify nonce increments

## Error Handling Strategy

### File Parsing Errors

- Invalid CSV format → Return specific line number
- Missing required columns → Return column names needed
- Encoding issues → Suggest UTF-8 encoding

### Validation Errors

- Invalid address → Return address and reason
- Duplicate recipient → Return recipient address
- Unsupported token → Return token symbol and supported list

### Transaction Errors

- Insufficient balance → Return required balance
- Token approval failed → Suggest retry
- Gas estimation failed → Suggest manual gas limit
- Nonce conflict → Retry with new nonce

## Correctness Properties

### Property 1: File Parsing Completeness
**Invariant**: All rows in uploaded file must be parsed (valid or invalid)
**Test**: Upload file with 100 rows, verify parsed count = 100

### Property 2: Validation Accuracy
**Invariant**: All valid items must pass validation, all invalid items must fail
**Test**: Create batch with known valid/invalid items, verify counts

### Property 3: Fee Calculation Consistency
**Invariant**: Total fee = gas cost + service fee
**Test**: Calculate fees, verify formula matches

### Property 4: Amount Precision
**Invariant**: All amounts must maintain 18 decimal precision
**Test**: Use amounts with many decimals, verify no rounding errors

### Property 5: Batch Atomicity
**Invariant**: Either all payments succeed or all fail (no partial success)
**Test**: Submit batch, verify all items have same final status

### Property 6: Token Grouping Correctness
**Invariant**: All payments for same token must be in same transaction group
**Test**: Submit batch with mixed tokens, verify grouping

### Property 7: Recipient Deduplication
**Invariant**: Duplicate recipients must be detected and reported
**Test**: Upload batch with duplicate recipients, verify detection

### Property 8: Address Checksum Validation
**Invariant**: All Ethereum addresses must pass checksum validation
**Test**: Use invalid checksum address, verify rejection

### Property 9: Transaction Hash Tracking
**Invariant**: Every completed payment must have valid transaction hash
**Test**: Query completed payments, verify all have tx hashes

### Property 10: Status Transition Validity
**Invariant**: Status can only transition: draft → pending → processing → completed/failed
**Test**: Attempt invalid status transitions, verify rejection

### Property 11: Draft Expiration
**Invariant**: Drafts older than 30 days must be marked expired
**Test**: Create draft, wait 30 days, verify expiration

### Property 12: Audit Log Completeness
**Invariant**: Every batch action must have corresponding audit log
**Test**: Perform batch actions, verify audit logs created

### Property 13: User Authorization
**Invariant**: User can only access their own batches
**Test**: Attempt to access another user's batch, verify rejection

### Property 14: Fee Deduction Accuracy
**Invariant**: Amount received = amount sent - fees
**Test**: Verify on-chain amount matches calculation

### Property 15: Token Allowance Management
**Invariant**: If allowance < amount, approval must be requested
**Test**: Submit payment with insufficient allowance, verify approval

### Property 16: Nonce Increment
**Invariant**: Each transaction must have unique nonce
**Test**: Submit multiple transactions, verify nonces are unique

### Property 17: Gas Estimation Accuracy
**Invariant**: Actual gas used must be within 20% of estimate
**Test**: Compare estimated vs actual gas, verify within range

### Property 18: Batch Item Count Consistency
**Invariant**: successful_count + failed_count + pending_count = item_count
**Test**: Query batch, verify count formula

### Property 19: Timestamp Ordering
**Invariant**: submitted_at >= created_at, completed_at >= submitted_at
**Test**: Query batches, verify timestamp ordering

### Property 20: Draft Data Integrity
**Invariant**: Draft data must match original file data
**Test**: Upload file, save draft, verify data matches

## Implementation Notes

- Use TypeScript for type safety
- Implement streaming for large file uploads
- Use connection pooling for database
- Implement exponential backoff for RPC calls
- Cache token metadata (decimals, addresses)
- Implement comprehensive error logging
- Use environment variables for configuration
- Implement health checks for blockchain RPC
