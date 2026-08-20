# Protocol Banks - Feature Documentation

Complete guide to all platform features.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Dashboard](#dashboard)
3. [Payments](#payments)
4. [Batch Payments](#batch-payments)
5. [Multi-Signature Wallets](#multi-signature-wallets)
6. [Cross-Chain Operations](#cross-chain-operations)
7. [Subscriptions](#subscriptions)
8. [Security](#security)
9. [Mobile Features](#mobile-features)
10. [API Integration](#api-integration)

---

## 1. Authentication

### Personal Mode (Email/Google)

**Setup:**
1. Visit homepage and click "Sign In"
2. Choose "Personal" mode
3. Enter email or click "Continue with Google"
4. For email: Click magic link in inbox
5. First login: Set 6-digit PIN
6. Embedded wallet auto-created

**Security:**
- PIN-encrypted private key
- Shamir 2-of-3 split
- Recovery code provided
- Biometric unlock available

### Business Mode (Hardware Wallets)

**Supported Wallets:**
- Ledger (Nano S, Nano X, Stax)
- Trezor (One, Model T)
- MetaMask
- WalletConnect-compatible wallets

**Connection:**
1. Click "Sign In" → "Business"
2. Select wallet type
3. Approve connection in wallet
4. Sign authentication message

---

## 2. Dashboard

### Global Payment Mesh

**Visualization:**
- Network graph of all vendors/partners
- Node colors: Green (active), Blue (subsidiaries), Gray (inactive)
- Real-time transaction flow
- Click nodes to view details

**Mobile:**
- Drawer panel (bottom sheet)
- Pinch to zoom
- Double-tap to center

### Balance Overview

**Display:**
- Total balance in USD (fiat base)
- Breakdown by chain (Ethereum 60%, Polygon 24%, etc.)
- Click to expand distribution

**Supported Chains:**
- Ethereum
- Polygon
- Arbitrum
- Base
- Optimism
- BNB Chain

---

## 3. Payments

### Single Payment

**Steps:**
1. Navigate to `/pay`
2. Enter recipient address (ENS supported)
3. Select token (USDC, USDT, DAI, ETH)
4. Enter amount
5. Select network
6. Review gas estimate
7. Click "Send"
8. Sign transaction

**Multi-Sig Protection:**
- Optional for business accounts
- Requires threshold signatures
- Mobile approval notifications

---

## 4. Batch Payments

### Excel Import

**File Format:**
```csv
address,amount,token
0x1234...,100,USDC
alice.eth,50,USDT
0x5678...,25,DAI
```

**Supported Columns:**
- `address` / `wallet` / `recipient` (required)
- `amount` / `value` (required)
- `token` / `currency` (required)
- `vendorName` / `name` (optional)
- `note` / `memo` (optional)

**Process:**
1. Go to `/batch-payment`
2. Click "Import" and select file
3. System validates all addresses
4. Review summary (total amount, recipient count)
5. Enable multi-sig if needed
6. Click "Execute Batch Payment"
7. Monitor progress in real-time

**Validation:**
- Address checksum verification
- ENS resolution
- Duplicate detection
- Balance check

**Performance:**
- Go service processes 500+ transactions/second
- Automatic nonce management
- Gas optimization
- Retry failed transactions

---

## 5. Multi-Signature Wallets

### Setup

**Create Multi-Sig:**
1. Go to `/settings/multisig`
2. Click "Create Multi-sig"
3. Enter wallet name
4. Select network
5. Add signers (addresses + roles)
6. Set threshold (e.g., 2-of-3)
7. Click "Deploy"

**Example Configuration:**
```
Signers:
- 0xabc... (Finance) - Can propose
- 0xdef... (CEO) - Can approve
- 0x123... (CFO) - Can approve

Threshold: 2
```

### Transaction Approval

**Workflow:**
1. Finance creates payment transaction
2. System creates proposal
3. Push notification sent to CEO/CFO
4. CEO opens mobile app → Reviews → Signs
5. Threshold reached → Transaction executes

**Mobile Approval:**
- PWA push notifications
- Biometric verification
- Transaction details preview
- One-tap approval

---

## 6. Cross-Chain Operations

### Swap

**Powered by Rango Exchange:**
1. Go to `/swap`
2. Select source token/chain
3. Select destination token/chain
4. Enter amount
5. View best route (multi-hop displayed)
6. Set slippage tolerance
7. Click "Swap"
8. Approve + Execute

**Features:**
- 50+ chains supported
- 100+ DEX aggregation
- MEV protection
- Price impact warning

### Bridge

**ZetaChain Integration:**
1. Select source chain
2. Select destination chain
3. Enter amount
4. Click "Bridge"
5. Omnichain message sent
6. Assets arrive on destination

**Supported:**
- EVM ↔ EVM
- Bitcoin ↔ EVM
- Native asset transfers

---

## 7. Subscriptions

### Create Subscription

**Setup:**
1. Go to `/subscriptions`
2. Click "Create Subscription"
3. Enter vendor address
4. Set amount and token
5. Choose frequency (daily/weekly/monthly)
6. Select payment wallet
7. Enable/review auto-pay

**Management:**
- Pause anytime
- Edit amount
- Change frequency
- View payment history
- Balance alerts

---

## 8. Security

### Audit Logs

**View Logs:**
1. Go to `/security`
2. See all actions:
   - Logins
   - Payments
   - Settings changes
   - API calls

**Export:**
- CSV download
- Date range filter
- Event type filter

### Rate Limiting

**Limits:**
- 100 requests / 15 minutes (per user)
- 1000 requests / hour (global)
- Automatic blocking on violations

### Two-Factor Actions

**Required for:**
- Large payments (>$10,000)
- Multi-sig changes
- API key creation
- Webhook registration

---

## 9. Mobile Features

### PWA Installation

**iOS Safari:**
1. Tap Share button
2. Tap "Add to Home Screen"
3. Name: "Protocol Banks"
4. Tap "Add"

**Android Chrome:**
1. Tap menu (3 dots)
2. Tap "Install app"
3. Confirm

### Push Notifications

**Enable:**
1. Settings → Notifications
2. Click "Enable Push Notifications"
3. Allow browser permission
4. Test notification sent

**Notification Types:**
- Pending multi-sig approvals
- Payment confirmations
- Failed transactions
- Security alerts

### Biometric Verification

**Setup:**
1. Settings → Security
2. Enable "Biometric Unlock"
3. Verify Face ID / Touch ID
4. Now required for:
   - Large payments
   - Multi-sig approvals
   - Wallet exports

---

## 10. API Integration

### Webhooks

**Setup:**
1. Go to `/settings/webhooks`
2. Click "Add Webhook"
3. Enter URL
4. Select events:
   - `payment.created`
   - `payment.confirmed`
   - `payment.failed`
   - `multisig.proposal_created`
   - `multisig.threshold_reached`
5. Copy signing secret
6. Save

**Payload Example:**
```json
{
  "event": "payment.confirmed",
  "timestamp": 1704844800,
  "data": {
    "id": "tx_abc123",
    "from": "0x...",
    "to": "0x...",
    "amount": "100.00",
    "token": "USDC",
    "chain": "ethereum",
    "txHash": "0x..."
  },
  "signature": "sha256=..."
}
```

**Verify Signature:**
```typescript
import crypto from 'crypto'

const signature = request.headers['x-webhook-signature']
const payload = request.body
const secret = process.env.WEBHOOK_SECRET

const expectedSignature = crypto
  .createHmac('sha256', secret)
  .update(JSON.stringify(payload))
  .digest('hex')

if (signature !== `sha256=${expectedSignature}`) {
  throw new Error('Invalid signature')
}
```

### API Keys

**Generate:**
1. Go to `/settings/api-keys`
2. Click "Generate API Key"
3. Enter name
4. Set permissions (read/write)
5. Copy key (shown once)

**Authentication:**
```bash
curl https://api.protocolbanks.com/v1/payments \
  -H "Authorization: Bearer pb_live_..." \
  -H "Content-Type: application/json"
```

---

## Support

For questions or issues:
- **Documentation:** https://docs.protocolbanks.com
- **GitHub:** https://github.com/YOUR_ORG/protocol-banks/issues
- **Email:** support@protocolbanks.com
