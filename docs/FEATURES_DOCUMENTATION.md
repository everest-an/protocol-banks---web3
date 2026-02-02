# Protocol Banks - Feature Documentation

Complete guide to all platform features.

**Version:** 2.0  
**Last Updated:** 2026-02-02  
**Status:** Production + Planned Features

---

## Table of Contents

1. [Authentication](#authentication)
2. [Dashboard](#dashboard)
3. [Payments](#payments)
4. [Batch Payments](#batch-payments)
5. [Multi-Signature Wallets](#multi-signature-wallets)
6. [Cross-Chain Operations](#cross-chain-operations)
7. [Subscriptions](#subscriptions)
8. [AI Agent Integration](#ai-agent-integration)
9. [AI Billing Infrastructure (Coming Q2 2026)](#ai-billing-infrastructure)
10. [Security](#security)
11. [Mobile Features](#mobile-features)
12. [API Integration](#api-integration)

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
\`\`\`csv
address,amount,token
0x1234...,100,USDC
alice.eth,50,USDT
0x5678...,25,DAI
\`\`\`

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
\`\`\`
Signers:
- 0xabc... (Finance) - Can propose
- 0xdef... (CEO) - Can approve
- 0x123... (CFO) - Can approve

Threshold: 2
\`\`\`

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

## 8. AI Agent Integration

### Agent Registration

**Create AI Agent:**
1. Navigate to `/agents`
2. Click "Create Agent"
3. Enter agent name and type
4. System generates unique API key (`agent_xxxxxx`)
5. Copy API key (shown once)
6. Configure permissions and budget

**Agent Types:**
- **Trading Agent**: Automated trading operations
- **Payroll Agent**: Scheduled salary payments
- **Expense Agent**: Vendor and expense management
- **Subscription Agent**: Recurring payment automation
- **Custom Agent**: User-defined automation

### Budget Management

**Set Budget Limits:**
1. Go to agent details page
2. Click "Manage Budget"
3. Set limits:
   - Daily limit (e.g., 100 USDC)
   - Weekly limit (e.g., 500 USDC)
   - Monthly limit (e.g., 2000 USDC)
4. Select allowed tokens (USDC, USDT, DAI)
5. Select allowed chains (Ethereum, Polygon, etc.)
6. Save configuration

**Budget Tracking:**
- Real-time usage monitoring
- Automatic alerts at 80% usage
- Budget reset schedules
- Historical usage reports

### Payment Proposals

**Agent Workflow:**
1. Agent creates payment proposal via API
2. System checks budget availability
3. If within budget: Auto-execute (if enabled)
4. If over budget: Require human approval
5. Notification sent to owner
6. Owner approves/rejects on mobile

**Auto-Execute Rules:**
```typescript
// Example configuration
{
  "autoExecute": true,
  "conditions": {
    "maxAmount": "100",
    "allowedRecipients": ["0x..."],
    "requiresApprovalAbove": "1000"
  }
}
```

### x402 Protocol (Gasless Payments)

**How it works:**
1. Agent creates payment proposal
2. Owner signs EIP-712 authorization message (no gas)
3. Relayer submits signed authorization
4. Transfer executes, relayer pays gas

**Benefits:**
- No ETH needed in approval wallet
- Batch approvals when gas is low
- Secure (amount, recipient, expiration specific)
- 50%+ gas cost reduction

### Agent API

**Authentication:**
```bash
curl -X POST https://api.protocolbanks.com/api/agents/proposals \
  -H "Authorization: Bearer agent_xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "amount": "100",
    "token": "USDC",
    "chain_id": 137,
    "reason": "Monthly API subscription payment"
  }'
```

**Response:**
```json
{
  "id": "proposal_abc123",
  "status": "executed",
  "auto_executed": true,
  "tx_hash": "0x...",
  "timestamp": "2026-02-02T12:00:00Z"
}
```

**Webhook Events:**
- `agent.created`
- `proposal.created`
- `proposal.approved`
- `proposal.rejected`
- `proposal.executed`
- `budget.warning` (80% used)
- `budget.exceeded`

---

## 9. AI Billing Infrastructure (Coming Q2 2026)

### PB-Stream: Micro-Payment Gateway

**HTTP 402 Middleware Integration:**

**Node.js/Express:**
```typescript
import { PBStream } from '@protocolbanks/stream-sdk'

const pbStream = new PBStream({
  apiKey: process.env.PB_API_KEY,
  service: 'my-ai-service',
  ratePerCall: '0.01'  // 0.01 USDC per API call
})

// Apply middleware
app.use('/api/ai', pbStream.middleware())
```

**Python/Flask:**
```python
from protocolbanks import PBStream

pb_stream = PBStream(
    api_key=os.getenv('PB_API_KEY'),
    service='my-ai-service',
    rate_per_call='0.01'
)

@app.route('/api/ai')
@pb_stream.require_payment
def ai_endpoint():
    return {'result': 'success'}
```

**Features:**
- Micro-payments as low as $0.001
- Off-chain accumulation (state channels)
- Batch settlement (every 10 USDC)
- Dynamic pricing (peak hour multipliers)
- Real-time billing

### Session Keys: Automatic Payments

**User Authorization Flow:**
1. User visits AI service website
2. Clicks "Connect Wallet"
3. Authorizes Session Key:
   - Maximum spending: 50 USDC
   - Duration: 30 days
   - Allowed services: Specific contracts
4. Session key generated and stored
5. AI can now charge automatically

**Silent Payments:**
- No wallet popup for each transaction
- Payments happen in background
- User receives periodic summaries
- Can revoke anytime

**Emergency Controls:**
- Instant freeze capability
- Real-time usage monitoring
- Automatic expiration
- Spending limit enforcement

### AI Sentinel: Fraud Detection

**Rule Engine:**

**Rule 1: Single Amount Anomaly**
```
if currentAmount > averageAmount * 10:
    freezeSessionKey("Abnormal single payment")
    sendAlert(user, "Suspicious large payment detected")
```

**Rule 2: Frequency Anomaly**
```
if callsPerMinute > 100:
    freezeSessionKey("Abnormal call frequency")
    sendAlert(user, "Unusual API call frequency")
```

**Rule 3: Low Balance Warning**
```
if remainingBalance < limitAmount * 0.1:
    sendAlert(user, "Balance below 10%")
```

**Anomaly Detection:**
- ML-based behavioral analysis
- Z-score analysis of spending patterns
- Frequency spike detection
- Amount anomaly detection
- Historical baseline learning

**Circuit Breaker:**
- Automatic freeze on anomaly
- Multi-channel alerts (Telegram, Email, Webhook)
- User-defined risk parameters
- Whitelist trusted services

### Stream Payments: Real-Time Billing

**Use Cases:**

**1. Web3 Car Rental:**
```
User scans QR → Authorize Session Key
↓
Start driving → Begin billing (0.5 USDC/hour)
↓
Peak hours → Dynamic rate (0.75 USDC/hour)
↓
Return car → Stop billing
↓
Auto-settle → Generate PDF invoice
```

**2. GPU Compute:**
```
Enterprise funds Agent (100 USDC)
↓
Agent rents GPU → Real-time billing (0.001 USDC/second)
↓
Balance low → Auto-alert
↓
Top up → Service continues
```

**3. API Marketplace:**
```
Developer integrates PB-Stream
↓
Client calls API → Micro-charge (0.001 USDC/call)
↓
Accumulate off-chain → Batch settle every 1 USDC
↓
Webhook notification → Update client balance
```

---

## 10. Security

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

## 11. Mobile Features

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

## 12. API Integration

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
\`\`\`json
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
\`\`\`

**Verify Signature:**
\`\`\`typescript
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
\`\`\`

### API Keys

**Generate:**
1. Go to `/settings/api-keys`
2. Click "Generate API Key"
3. Enter name
4. Set permissions (read/write)
5. Copy key (shown once)

**Authentication:**
\`\`\`bash
curl https://api.protocolbanks.com/v1/payments \
  -H "Authorization: Bearer pb_live_..." \
  -H "Content-Type: application/json"
\`\`\`

---

## Support

For questions or issues:
- **Documentation:** https://docs.protocolbanks.com
- **Whitepaper:** [WHITEPAPER.md](../WHITEPAPER.md)
- **Technical Architecture:** [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)
- **GitHub:** https://github.com/everest-an/protocol-banks---web3/issues
- **Email:** everest9812@gmail.com

---

## Appendix: Feature Status

| Feature | Status | Release |
|---------|--------|---------|
| **Authentication** | Production | Q1 2025 |
| **Single Payments** | Production | Q1 2025 |
| **Batch Payments** | Production | Q1 2025 |
| **Multi-Sig Wallets** | Production | Q1 2025 |
| **Cross-Chain Swap** | Production | Q1 2025 |
| **Subscriptions** | Production | Q1 2025 |
| **AI Agent API** | Production | Q1 2025 |
| **x402 Protocol** | Production | Q1 2025 |
| **Session Keys** | Development | Q2 2026 |
| **PB-Stream Gateway** | Development | Q2 2026 |
| **AI Sentinel** | Development | Q2 2026 |
| **Stream Payments** | Planned | Q2 2026 |

---

**Built for the AI Era**
