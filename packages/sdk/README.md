# @protocolbanks/sdk

Multi-chain cryptocurrency payment SDK for merchants. Accept USDC, USDT, DAI, ETH, BTC, SOL across 8 blockchains.

## Features

- 🔗 **Multi-Chain Support** - Ethereum, Polygon, Base, Arbitrum, Optimism, BSC, Solana, Bitcoin
- 💰 **Multi-Token** - USDC, USDT, DAI, ETH, MATIC, BNB, SOL, BTC
- ⚡ **x402 Gasless Payments** - Users pay without gas fees (EIP-3009)
- 📦 **Batch Payments** - Send to 500 recipients in one transaction
- 🔒 **Security** - HMAC-SHA256 signatures, AES-256 encryption, JWT auth
- 🎨 **Embedded Checkout** - Drop-in React components or vanilla JS

## Installation

```bash
npm install @protocolbanks/sdk
# or
pnpm add @protocolbanks/sdk
# or
yarn add @protocolbanks/sdk
```

## Quick Start

### 1. Initialize Client

```typescript
import { ProtocolBanksClient } from '@protocolbanks/sdk';

const client = new ProtocolBanksClient({
  apiKey: 'pk_live_xxx',
  apiSecret: 'sk_live_xxx',
  environment: 'production', // 'production' | 'sandbox' | 'testnet'
});

await client.initialize();
```

### 2. Generate Payment Link

```typescript
const link = client.links.generate({
  to: '0x1234567890abcdef1234567890abcdef12345678',
  amount: '100',
  token: 'USDC',
  chain: 137, // Polygon
  expiryHours: 24,
  orderId: 'order_123',
  memo: 'Payment for Order #123',
});

console.log(link.url);
// https://pay.protocolbanks.com/p/abc123...
```

### 3. Generate QR Code

```typescript
const qr = await client.links.generateQR(link, {
  size: 300,
  format: 'svg',
  logo: 'https://example.com/logo.png',
});

// Use in HTML: <img src={qr.data} />
```

### 4. Verify Payment Link

```typescript
const result = client.links.verify(paymentUrl);

if (result.valid && !result.expired) {
  console.log('Valid payment link:', result.params);
} else {
  console.log('Invalid:', result.error);
}
```

## x402 Gasless Payments

Let users pay without gas fees using EIP-3009 TransferWithAuthorization:

```typescript
// 1. Create authorization
const auth = await client.x402.createAuthorization({
  to: '0x1234...',
  amount: '100',
  token: 'USDC',
  chainId: 137,
  validFor: 3600, // 1 hour
});

// 2. Get typed data for user to sign
const typedData = client.x402.getTypedData(auth, userAddress);

// 3. User signs with wallet (e.g., MetaMask)
const signature = await wallet.signTypedData(typedData);

// 4. Submit signature - relayer executes transaction
const result = await client.x402.submitSignature(auth.id, signature);

// 5. Wait for completion
const final = await client.x402.waitForCompletion(auth.id);
console.log('Transaction:', final.transactionHash);
```

## Batch Payments

Send payments to multiple recipients (up to 500):

```typescript
const recipients = [
  { address: '0x1111...', amount: '50', token: 'USDC' },
  { address: '0x2222...', amount: '75', token: 'USDC' },
  { address: '0x3333...', amount: '25', token: 'USDC' },
];

// Validate first
const errors = await client.batch.validate(recipients);
if (errors.length > 0) {
  console.log('Validation errors:', errors);
  return;
}

// Submit batch
const batch = await client.batch.submit(recipients, {
  chain: 137,
  priority: 'medium',
  webhookUrl: 'https://example.com/webhook',
});

// Poll for status
client.batch.poll(batch.batchId, (status) => {
  console.log(`Progress: ${status.progress.completed}/${status.progress.total}`);
  
  if (status.status === 'completed') {
    console.log('Batch complete!');
  }
});
```

## Webhooks

Receive real-time payment notifications:

```typescript
import { createWebhookMiddleware } from '@protocolbanks/sdk';

// Express middleware
const verifyWebhook = createWebhookMiddleware('whsec_xxx');

app.post('/webhook', async (req, res) => {
  try {
    const event = await verifyWebhook(req);
    
    switch (event.type) {
      case 'payment.completed':
        console.log('Payment received:', event.data);
        break;
      case 'payment.failed':
        console.log('Payment failed:', event.data);
        break;
      case 'batch.completed':
        console.log('Batch complete:', event.data);
        break;
    }
    
    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
```

## Embedded Checkout

### Simplest Integration (One Line)

```html
<script src="https://sdk.protocolbanks.com/checkout.js"
        data-api-key="pk_live_xxx"
        data-amount="100"
        data-token="USDC"
        data-recipient="0x1234...">
</script>
```

### React Components

```bash
npm install @protocolbanks/react
```

```tsx
import { CheckoutProvider, PaymentButton, CheckoutModal } from '@protocolbanks/react';

function App() {
  return (
    <CheckoutProvider apiKey="pk_live_xxx">
      <PaymentButton
        amount="100"
        recipientAddress="0x1234..."
        token="USDC"
        onSuccess={(result) => console.log('Paid!', result)}
      />
      <CheckoutModal />
    </CheckoutProvider>
  );
}
```

### Generate Embed Code

```typescript
import { generateEmbedCode } from '@protocolbanks/sdk';

const codes = generateEmbedCode({
  apiKey: 'pk_live_xxx',
  amount: '100',
  recipientAddress: '0x1234...',
  token: 'USDC',
});

console.log(codes.script);  // Script tag
console.log(codes.button);  // Button code
console.log(codes.react);   // React component
console.log(codes.vue);     // Vue component
```

## Supported Chains

| Chain | ID | Tokens | Gasless |
|-------|-----|--------|---------|
| Ethereum | 1 | USDC, USDT, DAI, ETH | ✅ |
| Polygon | 137 | USDC, USDT, DAI, MATIC | ✅ |
| Base | 8453 | USDC, ETH | ✅ |
| Arbitrum | 42161 | USDC, USDT, ETH | ✅ |
| Optimism | 10 | USDC, USDT, ETH | ✅ |
| BSC | 56 | USDC, USDT, BNB | ❌ |
| Solana | solana | USDC, SOL | ❌ |
| Bitcoin | bitcoin | BTC | ❌ |

## Error Handling

```typescript
import { ProtocolBanksError, ErrorCodes } from '@protocolbanks/sdk';

try {
  const link = client.links.generate({ ... });
} catch (error) {
  if (error instanceof ProtocolBanksError) {
    console.log('Code:', error.code);      // PB_LINK_001
    console.log('Message:', error.message);
    console.log('Retryable:', error.retryable);
    
    switch (error.code) {
      case ErrorCodes.LINK_INVALID_ADDRESS:
        // Handle invalid address
        break;
      case ErrorCodes.RATE_LIMIT_EXCEEDED:
        // Wait and retry
        await sleep(error.retryAfter * 1000);
        break;
    }
  }
}
```

## Configuration Options

```typescript
const client = new ProtocolBanksClient({
  apiKey: 'pk_live_xxx',
  apiSecret: 'sk_live_xxx',
  environment: 'production',
  
  // Timeouts
  timeout: 30000,
  
  // Retry configuration
  retryConfig: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  },
  
  // Rate limiting (for high concurrency)
  rateLimitConfig: {
    maxRequestsPerSecond: 100,
    maxConcurrent: 50,
    queueSize: 10000,
  },
  
  // Custom logger
  logger: {
    debug: (msg) => console.debug(msg),
    info: (msg) => console.info(msg),
    warn: (msg) => console.warn(msg),
    error: (msg) => console.error(msg),
  },
});
```

## Security Best Practices

1. **Never expose API secret** in client-side code
2. **Use HTTPS** for all API calls (enforced by SDK)
3. **Verify webhooks** using signature validation
4. **Validate addresses** before generating payment links
5. **Set expiry times** on payment links (default: 24h)

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  PaymentLink,
  PaymentLinkParams,
  CheckoutConfig,
  X402Authorization,
  BatchRecipient,
  WebhookEvent,
  ChainId,
  TokenSymbol,
} from '@protocolbanks/sdk';
```

## API Reference

See full API documentation at [docs.protocolbanks.com](https://docs.protocolbanks.com)

## License

MIT
