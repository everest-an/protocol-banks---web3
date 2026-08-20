# Protocol Banks - Quick Start Integration Guide

**Goal:** Accept crypto payments in your application in 15 minutes.

---

## Step 1: Get Your API Key (2 min)

1. Sign in at `https://app.protocolbanks.com`
2. Go to **Settings > API Keys**
3. Click **Create API Key**, name it (e.g., "Production")
4. Copy the key �?you will not see it again

```bash
# Your API key looks like: pb_live_abc123...
export PB_API_KEY="pb_live_abc123..."
export PB_WALLET="0xYourWalletAddress"
```

Use `x-wallet-address` for authenticated API calls (legacy `x-user-address` remains accepted for backward compatibility).

---

## Step 2: Create a Payment Invoice (3 min)

### cURL

```bash
curl -X POST https://app.protocolbanks.com/api/invoice \
  -H "Content-Type: application/json" \
  -H "x-wallet-address: $PB_WALLET" \
  -d '{
    "amount": 25.00,
    "token": "USDC",
    "recipient_address": "'$PB_WALLET'",
    "description": "Order #1234",
    "customer_email": "customer@example.com",
    "expires_at": "2026-03-01T00:00:00Z"
  }'
```

### Response

```json
{
  "id": "inv_abc123",
  "invoice_id": "INV-20260208-001",
  "amount": 25.00,
  "token": "USDC",
  "status": "pending",
  "payment_url": "https://app.protocolbanks.com/pay/INV-20260208-001",
  "expires_at": "2026-03-01T00:00:00Z"
}
```

Share `payment_url` with your customer �?they can pay with any supported wallet.

---

## Step 3: Set Up a Webhook (3 min)

Get notified when a payment is completed:

```bash
curl -X POST https://app.protocolbanks.com/api/webhooks \
  -H "Content-Type: application/json" \
  -H "x-wallet-address: $PB_WALLET" \
  -d '{
    "name": "Payment Notifications",
    "url": "https://your-server.com/webhooks/protocol-banks",
    "events": ["payment.completed", "payment.failed"]
  }'
```

### Webhook Payload

When a payment is completed, you'll receive:

```json
{
  "event": "payment.completed",
  "timestamp": "2026-02-08T12:00:00Z",
  "data": {
    "payment_id": "pay_xyz789",
    "invoice_id": "INV-20260208-001",
    "amount": "25.00",
    "token": "USDC",
    "chain": "base",
    "tx_hash": "0xabc...",
    "from_address": "0x...",
    "to_address": "0x...",
    "status": "completed"
  }
}
```

### Verify Webhook Signature

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

---

## Step 4: Verify a Payment (2 min)

After receiving a webhook, verify the payment on-chain:

```bash
curl -X POST https://app.protocolbanks.com/api/verify-payment \
  -H "Content-Type: application/json" \
  -H "x-wallet-address: $PB_WALLET" \
  -d '{
    "txHash": "0xabc123...",
    "orderId": "order_456",
    "amount": "25.00"
  }'
```

### Response

```json
{
  "valid": true,
  "confirmations": 12,
  "chain": "base"
}
```

---

## Step 5: Check Your Balance (2 min)

### Payment History

```bash
curl "https://app.protocolbanks.com/api/payments?status=completed&limit=10" \
  -H "x-wallet-address: $PB_WALLET"
```

### Analytics Summary

```bash
curl "https://app.protocolbanks.com/api/analytics/summary" \
  -H "x-wallet-address: $PB_WALLET"
```

### Auto-Yield Balance (Earn interest on idle funds)

```bash
curl "https://app.protocolbanks.com/api/yield/balance?merchant=$PB_WALLET&summary=true" \
  -H "x-wallet-address: $PB_WALLET"
```

---

## Supported Networks

| Network | Chain ID | Tokens | Yield Protocol |
|---------|----------|--------|----------------|
| Ethereum | 1 | USDC, USDT, DAI | Aave V3 |
| Base | 8453 | USDC, USDT | Aave V3 |
| Arbitrum | 42161 | USDC, USDT | Aave V3 |
| TRON | - | USDT (TRC20) | JustLend |

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Description of what went wrong",
  "success": false
}
```

| Status Code | Meaning |
|-------------|---------|
| 400 | Invalid input (check your parameters) |
| 401 | Missing or invalid `x-wallet-address` header |
| 404 | Resource not found |
| 409 | Conflict (duplicate resource) |
| 429 | Rate limit exceeded (check `Retry-After` header) |
| 500 | Server error (contact support) |

---

## SDK Examples

### Node.js

```javascript
const PB_API = 'https://app.protocolbanks.com/api';
const WALLET = '0xYourAddress';

// Create invoice
const res = await fetch(`${PB_API}/invoice`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-wallet-address': WALLET,
  },
  body: JSON.stringify({
    amount: 50.0,
    token: 'USDC',
    recipient_address: WALLET,
    description: 'Premium Plan',
  }),
});
const invoice = await res.json();
console.log('Payment URL:', invoice.payment_url);
```

### Python

```python
import requests

PB_API = "https://app.protocolbanks.com/api"
WALLET = "0xYourAddress"
HEADERS = {
    "Content-Type": "application/json",
    "x-wallet-address": WALLET,
}

# Create invoice
response = requests.post(f"{PB_API}/invoice", json={
    "amount": 50.0,
    "token": "USDC",
    "recipient_address": WALLET,
    "description": "Premium Plan",
}, headers=HEADERS)

invoice = response.json()
print(f"Payment URL: {invoice['payment_url']}")
```

---

## Webhook Events

| Event | Description |
|-------|-------------|
| `payment.completed` | Payment confirmed on-chain |
| `payment.failed` | Payment failed or expired |
| `invoice.paid` | Invoice has been paid |
| `invoice.expired` | Invoice expired without payment |
| `vendor.updated` | Vendor details changed |
| `subscription.renewed` | Subscription payment processed |
| `subscription.failed` | Subscription payment failed |

---

## Next Steps

- **Batch Payments:** Send to multiple recipients at once via `/api/batch-payment/execute`
- **Subscriptions:** Set up recurring payments via `/api/subscriptions`
- **Auto-Yield:** Earn interest on idle funds via `/api/yield/balance`
- **Multi-Sig:** Configure multi-signature approval workflows
- **AI Agents:** Automate payments with AI agents via `/api/agents`

Full API reference: [docs/openapi.yaml](./openapi.yaml)
