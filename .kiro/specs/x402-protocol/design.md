# Design Document

## System Architecture

### High-Level Flow

```
User Initiates Payment
    ↓
Generate EIP-712 Domain Separator
    ↓
Create TransferWithAuthorization Struct
    ↓
User Signs with Private Key
    ↓
Verify Signature
    ↓
Submit to Relayer
    ↓
Relayer Submits On-Chain
    ↓
Smart Contract Verifies & Executes
    ↓
Payment Complete
```

### Component Interactions

```
Frontend (Next.js)
    ↓
API Routes (/api/x402/*)
    ↓
x402 Service (Business Logic)
    ├─ Signature Generator
    ├─ Nonce Manager
    ├─ Relayer Coordinator
    └─ On-Chain Verifier
    ↓
Database (PostgreSQL)
    ├─ x402_authorizations
    ├─ x402_nonces
    ├─ x402_executions
    └─ x402_audit_logs
    ↓
External Services
    ├─ Blockchain RPC (Alchemy/Infura)
    ├─ Relayer Service
    └─ Smart Contracts (ERC-3009)
```

## Database Schema

### x402_authorizations Table

```sql
CREATE TABLE x402_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token_address VARCHAR(42) NOT NULL,
  chain_id INT NOT NULL,
  from_address VARCHAR(42) NOT NULL,
  to_address VARCHAR(42) NOT NULL,
  amount DECIMAL(38, 18) NOT NULL,
  nonce INT NOT NULL,
  valid_after TIMESTAMP NOT NULL,
  valid_before TIMESTAMP NOT NULL,
  signature VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- Status: pending, submitted, executed, failed, expired, cancelled
  transaction_hash VARCHAR(255),
  relayer_address VARCHAR(42),
  relayer_fee DECIMAL(38, 18),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  executed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_x402_authorizations_user_id ON x402_authorizations(user_id);
CREATE INDEX idx_x402_authorizations_status ON x402_authorizations(status);
CREATE INDEX idx_x402_authorizations_token ON x402_authorizations(token_address, chain_id);
CREATE INDEX idx_x402_authorizations_valid_before ON x402_authorizations(valid_before);
```

### x402_nonces Table

```sql
CREATE TABLE x402_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token_address VARCHAR(42) NOT NULL,
  chain_id INT NOT NULL,
  current_nonce INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, token_address, chain_id)
);

CREATE INDEX idx_x402_nonces_user_id ON x402_nonces(user_id);
```

### x402_used_nonces Table

```sql
CREATE TABLE x402_used_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token_address VARCHAR(42) NOT NULL,
  chain_id INT NOT NULL,
  nonce INT NOT NULL,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, token_address, chain_id, nonce)
);

CREATE INDEX idx_x402_used_nonces_user_id ON x402_used_nonces(user_id);
```

### x402_executions Table

```sql
CREATE TABLE x402_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_id UUID NOT NULL REFERENCES x402_authorizations(id) ON DELETE CASCADE,
  relayer_id UUID,
  transaction_hash VARCHAR(255) NOT NULL UNIQUE,
  block_number INT,
  gas_used INT,
  actual_fee DECIMAL(38, 18),
  status VARCHAR(50) NOT NULL, -- pending, confirmed, failed
  error_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP
);

CREATE INDEX idx_x402_executions_authorization_id ON x402_executions(authorization_id);
CREATE INDEX idx_x402_executions_tx_hash ON x402_executions(transaction_hash);
```

### x402_audit_logs Table

```sql
CREATE TABLE x402_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_id UUID REFERENCES x402_authorizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_x402_audit_logs_authorization_id ON x402_audit_logs(authorization_id);
CREATE INDEX idx_x402_audit_logs_user_id ON x402_audit_logs(user_id);
```

## EIP-712 Domain Separator

### Domain Structure

```javascript
const domain = {
  name: "ProtocolBanks",
  version: "1",
  chainId: 1, // or 137, 42161, etc.
  verifyingContract: "0x..." // ERC-3009 token contract
};
```

### TransferWithAuthorization Type

```javascript
const types = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
    { name: "data", type: "bytes" }
  ]
};
```

### Message Structure

```javascript
const message = {
  from: "0x...", // Authorizer address
  to: "0x...", // Recipient address
  value: "1000000000000000000", // 1 token (18 decimals)
  validAfter: Math.floor(Date.now() / 1000),
  validBefore: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  nonce: "0x...", // Derived from user nonce
  data: "0x" // Optional data
};
```

## API Interfaces

### POST /api/x402/generate-authorization

**Request:**
```json
{
  "tokenAddress": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "chainId": 1,
  "toAddress": "0x...",
  "amount": "1000000000",
  "validityDuration": 3600
}
```

**Response (200):**
```json
{
  "success": true,
  "authorizationId": "auth_xxx",
  "domain": {
    "name": "ProtocolBanks",
    "version": "1",
    "chainId": 1,
    "verifyingContract": "0x..."
  },
  "types": {
    "TransferWithAuthorization": [...]
  },
  "message": {
    "from": "0x...",
    "to": "0x...",
    "value": "1000000000",
    "validAfter": 1705689600,
    "validBefore": 1705693200,
    "nonce": "0x...",
    "data": "0x"
  },
  "validBefore": "2024-01-20T11:00:00Z"
}
```

### POST /api/x402/submit-signature

**Request:**
```json
{
  "authorizationId": "auth_xxx",
  "signature": "0x..."
}
```

**Response (200):**
```json
{
  "success": true,
  "status": "submitted",
  "relayerAddress": "0x...",
  "estimatedFee": "0.5"
}
```

### POST /api/x402/submit-to-relayer

**Request:**
```json
{
  "authorizationId": "auth_xxx"
}
```

**Response (200):**
```json
{
  "success": true,
  "status": "relayer_submitted",
  "relayerTxHash": "0x...",
  "estimatedCompletion": "2024-01-20T10:30:00Z"
}
```

### GET /api/x402/:authorizationId/status

**Response (200):**
```json
{
  "authorizationId": "auth_xxx",
  "status": "executed",
  "transactionHash": "0x...",
  "blockNumber": 19000000,
  "gasUsed": 65000,
  "actualFee": "0.45",
  "executedAt": "2024-01-20T10:25:00Z"
}
```

### POST /api/x402/:authorizationId/cancel

**Response (200):**
```json
{
  "success": true,
  "status": "cancelled",
  "message": "Authorization cancelled, nonce marked as used"
}
```

## Nonce Management

### Nonce Generation

```javascript
// Get current nonce for user + token + chain
const nonce = await getNonce(userId, tokenAddress, chainId);

// Increment nonce for next authorization
const nextNonce = nonce + 1;

// Store used nonce to prevent replay
await markNonceAsUsed(userId, tokenAddress, chainId, nonce);
```

### Nonce Encoding

```javascript
// Convert nonce to bytes32 for EIP-712
const nonceBytes32 = ethers.utils.hexZeroPad(
  ethers.utils.hexlify(nonce),
  32
);
```

## Signature Verification

### Signature Recovery

```javascript
// Recover signer from signature
const recoveredAddress = ethers.utils.recoverAddress(
  ethers.utils._TypedDataEncoder.hash(domain, types, message),
  signature
);

// Verify recovered address matches authorizer
if (recoveredAddress.toLowerCase() !== message.from.toLowerCase()) {
  throw new Error("Invalid signature");
}
```

## Relayer Architecture

### Relayer Responsibilities

1. **Validation**: Verify signature and nonce
2. **Profitability Check**: Ensure gas cost < relayer fee
3. **Submission**: Submit TransferWithAuthorization to blockchain
4. **Monitoring**: Track transaction status
5. **Retry Logic**: Retry with higher gas if needed

### Relayer API

```javascript
// Submit authorization to relayer
POST /relayer/submit-authorization
{
  "domain": {...},
  "types": {...},
  "message": {...},
  "signature": "0x..."
}

// Get relayer status
GET /relayer/status/:txHash
```

## On-Chain Smart Contract Interface

### ERC-3009 Functions

```solidity
function transferWithAuthorization(
  address from,
  address to,
  uint256 value,
  uint256 validAfter,
  uint256 validBefore,
  bytes32 nonce,
  uint8 v,
  bytes32 r,
  bytes32 s
) external;

function authorizationState(
  address authorizer,
  bytes32 nonce
) external view returns (bool);
```

## Fee Distribution

### Fee Calculation

```javascript
// Relayer fee = gas cost + margin
const gasCost = gasUsed * gasPrice;
const relayerMargin = gasCost * 0.2; // 20% margin
const totalRelayerFee = gasCost + relayerMargin;

// Deduct from transfer amount
const amountReceived = amount - totalRelayerFee;
```

### Fee Limits

```javascript
const MIN_FEE = ethers.utils.parseUnits("0.01", 18); // $0.01
const MAX_FEE = ethers.utils.parseUnits("100", 18); // $100

const finalFee = Math.max(
  MIN_FEE,
  Math.min(MAX_FEE, totalRelayerFee)
);
```

## Error Handling Strategy

### Signature Errors

- Invalid signature format → Return specific error
- Signature mismatch → Return "Invalid signature"
- Signature expired → Return "Signature expired"

### Nonce Errors

- Nonce already used → Return current nonce
- Nonce overflow → Return error and suggest reset

### Validity Window Errors

- validAfter in future → Return "Authorization not yet valid"
- validBefore in past → Return "Authorization expired"

### On-Chain Errors

- Insufficient balance → Return required balance
- Token approval failed → Return "Approval required"
- Relayer submission failed → Return on-chain error

## Correctness Properties

### Property 1: Signature Validity
**Invariant**: Only valid signatures from authorizer should be accepted
**Test**: Create signature with wrong key, verify rejection

### Property 2: Nonce Uniqueness
**Invariant**: Each nonce can only be used once per user+token+chain
**Test**: Use same nonce twice, verify second is rejected

### Property 3: Nonce Increment
**Invariant**: Nonce must increment by 1 for each authorization
**Test**: Create multiple authorizations, verify nonce sequence

### Property 4: Validity Window Enforcement
**Invariant**: Authorization outside validity window must be rejected
**Test**: Submit after validBefore, verify rejection

### Property 5: Domain Separator Correctness
**Invariant**: Domain separator must match token contract
**Test**: Use wrong domain, verify signature fails

### Property 6: Message Integrity
**Invariant**: Message cannot be modified after signing
**Test**: Modify message after signing, verify rejection

### Property 7: Fee Deduction Accuracy
**Invariant**: Amount received = amount - fee
**Test**: Verify on-chain amount matches calculation

### Property 8: Relayer Authorization
**Invariant**: Only authorized relayers can submit transactions
**Test**: Submit with unauthorized relayer, verify rejection

### Property 9: Transaction Atomicity
**Invariant**: Either full transfer succeeds or entire transaction fails
**Test**: Simulate failure mid-transaction, verify rollback

### Property 10: Audit Log Completeness
**Invariant**: Every authorization action must be logged
**Test**: Perform authorization actions, verify audit logs

### Property 11: Status Transition Validity
**Invariant**: Status can only transition: pending → submitted → executed/failed
**Test**: Attempt invalid status transitions, verify rejection

### Property 12: Timestamp Consistency
**Invariant**: executed_at >= created_at
**Test**: Query authorizations, verify timestamp ordering

### Property 13: User Authorization
**Invariant**: User can only access their own authorizations
**Test**: Attempt to access another user's authorization, verify rejection

### Property 14: Chain ID Validation
**Invariant**: Authorization must be executed on correct chain
**Test**: Create authorization for chain A, submit to chain B, verify rejection

### Property 15: Token Address Validation
**Invariant**: Token address must be valid ERC-3009 contract
**Test**: Use invalid token address, verify rejection

### Property 16: Recipient Address Validation
**Invariant**: Recipient address must be valid Ethereum address
**Test**: Use invalid recipient, verify rejection

### Property 17: Amount Precision
**Invariant**: Amount must maintain token decimals precision
**Test**: Use amount with too many decimals, verify rounding

### Property 18: Gas Estimation Accuracy
**Invariant**: Actual gas used must be within 20% of estimate
**Test**: Compare estimated vs actual gas, verify within range

### Property 19: Relayer Fee Fairness
**Invariant**: Relayer fee must not exceed maximum cap
**Test**: Verify all fees are within configured limits

### Property 20: Cancellation Finality
**Invariant**: Cancelled authorization cannot be reused
**Test**: Cancel authorization, attempt reuse, verify rejection

## Implementation Notes

- Use ethers.js for EIP-712 signing
- Implement comprehensive error handling with specific error codes
- Use database transactions for multi-step operations
- Implement comprehensive logging for debugging
- Use environment variables for configuration (validity duration, fee limits)
- Implement health checks for relayer service
- Cache domain separators per chain
- Implement rate limiting for authorization requests
