# API Monetizer Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      API Monetizer Flow                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Client Request                                                        │
│         │                                                               │
│         ▼                                                               │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │              APIMonetizer Middleware                        │       │
│   │                                                             │       │
│   │  1. Check X-Payment header                                  │       │
│   │     ├── Missing → Return 402 + X-Payment-Request            │       │
│   │     └── Present → Verify payment                            │       │
│   │                                                             │       │
│   │  2. Calculate price (based on pricing model)                │       │
│   │                                                             │       │
│   │  3. Verify payment amount >= required price                 │       │
│   │                                                             │       │
│   │  4. Forward to upstream API                                 │       │
│   │                                                             │       │
│   │  5. Track usage and return response                         │       │
│   └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. APIMonetizer Class
Main class that handles request monetization.

```typescript
interface MonetizeConfig {
  upstream: UpstreamConfig;
  pricing: PricingConfig;
  recipient: string;
  network?: 'base' | 'ethereum' | 'polygon';
  token?: 'USDC' | 'USDT';
  rateLimit?: RateLimitConfig;
  analytics?: boolean;
  subscriptionCheck?: (walletAddress: string) => Promise<boolean>;
}

interface UpstreamConfig {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

interface PricingConfig {
  model: 'perRequest' | 'perToken' | 'dynamic' | 'tiered';
  perRequest?: string;
  perInputToken?: string;
  perOutputToken?: string;
  dynamic?: (req: Request) => Promise<string>;
  tiers?: PricingTier[];
}
```

### 2. PricingStrategy Module
Handles different pricing models.

```typescript
interface PricingStrategy {
  calculatePrice(request: Request, response?: Response): Promise<string>;
}

class PerRequestPricing implements PricingStrategy { }
class PerTokenPricing implements PricingStrategy { }
class DynamicPricing implements PricingStrategy { }
class TieredPricing implements PricingStrategy { }
```

### 3. PaymentVerifier
Verifies x402 payment proofs.

```typescript
interface PaymentVerifier {
  verify(paymentHeader: string, requiredAmount: string): Promise<VerifyResult>;
}
```

### 4. UsageTracker Service
Tracks API usage and revenue.

```typescript
interface UsageRecord {
  id: string;
  walletAddress: string;
  endpoint: string;
  amount: string;
  timestamp: Date;
  requestSize?: number;
  responseSize?: number;
  tokensUsed?: { input: number; output: number };
}
```

## File Structure

```
packages/sdk/src/modules/
├── monetizer.ts           # Main APIMonetizer class
├── pricing.ts             # Pricing strategies

services/
├── usage-tracker.service.ts  # Usage tracking

app/api/monetize/
├── [...path]/route.ts     # Dynamic proxy route

app/vendors/monetize/
├── page.tsx               # Configuration UI
├── components/
│   ├── PricingConfig.tsx
│   ├── UpstreamConfig.tsx
│   └── UsageStats.tsx

migrations/
├── 005_usage_tracking_schema.sql
```

## Database Schema

```sql
-- Usage tracking
CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  amount_charged TEXT NOT NULL,
  payment_tx_hash TEXT,
  request_timestamp TIMESTAMPTZ DEFAULT NOW(),
  response_status INTEGER,
  tokens_input INTEGER,
  tokens_output INTEGER,
  metadata JSONB
);

-- Monetizer configurations
CREATE TABLE monetizer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id),
  name TEXT NOT NULL,
  upstream_url TEXT NOT NULL,
  pricing_model TEXT NOT NULL,
  pricing_config JSONB NOT NULL,
  recipient_address TEXT NOT NULL,
  network TEXT DEFAULT 'base',
  token TEXT DEFAULT 'USDC',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoints

### GET /api/monetize/configs
List monetizer configurations for vendor.

### POST /api/monetize/configs
Create new monetizer configuration.

### GET /api/monetize/usage
Get usage statistics.

### POST /api/monetize/[...path]
Dynamic proxy endpoint (requires payment).

## Payment Flow

1. Client sends request without payment
2. Middleware returns 402 with X-Payment-Request header
3. Client creates x402 payment authorization
4. Client signs with wallet
5. Client resends request with X-Payment header
6. Middleware verifies payment via CDP/Relayer
7. Request forwarded to upstream
8. Response returned to client
9. Usage recorded

## Security Considerations

- Validate all payment signatures
- Track nonces to prevent replay attacks
- Rate limit per wallet address
- Encrypt upstream API credentials
- Sanitize request/response data
