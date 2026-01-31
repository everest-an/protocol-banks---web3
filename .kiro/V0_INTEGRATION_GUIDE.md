# v0 Integration Guide

## Overview

This guide documents the integration patterns and APIs available in Protocol Banks.

## Settlement Methods

### CDP (Coinbase Developer Platform)
- **Chain**: Base (8453)
- **Fee**: 0%
- **Method**: Direct CDP settlement
- **Recommended**: Yes - for cost savings

### Relayer
- **Chains**: Ethereum, Polygon, Arbitrum, Optimism, etc.
- **Fee**: 0.1% - 0.5% depending on chain
- **Method**: Transaction relay with gas abstraction

## API Reference

### x402 Protocol APIs

#### POST /api/x402/authorize
Create a payment authorization.

\`\`\`typescript
interface AuthorizeRequest {
  from: string       // Payer address
  to: string         // Payee address
  amount: string     // Amount in token units
  token: string      // Token symbol (USDC, USDT)
  chainId: number    // Chain ID
  validAfter?: number
  validBefore?: number
}

interface AuthorizeResponse {
  authorizationId: string
  nonce: string
  signature: string
  validAfter: number
  validBefore: number
}
\`\`\`

#### POST /api/x402/settle
Settle a payment via CDP or Relayer.

\`\`\`typescript
interface SettleRequest {
  authorizationId: string
  transactionHash?: string
  chainId: number
  amount: string
  token: string
  from: string
  to: string
}

interface SettleResponse {
  success: boolean
  settlementId: string
  settlementMethod: "CDP" | "Relayer"
  fee: number
  transactionHash?: string
}
\`\`\`

### Batch Payment APIs

#### POST /api/batch-payment
Create a batch payment job.

\`\`\`typescript
interface BatchCreateRequest {
  recipients: Array<{
    address: string
    amount: number
    token?: string
    memo?: string
  }>
  token: string
  chainId: number
  fromAddress: string
}

interface BatchCreateResponse {
  batchId: string
  itemCount: number
  totalAmount: number
  estimatedFee: number
  settlementMethod: "CDP" | "Relayer"
}
\`\`\`

#### POST /api/batch-payment/execute
Execute a batch payment.

\`\`\`typescript
interface BatchExecuteRequest {
  batchId: string
  chainId?: number
}

interface BatchExecuteResponse {
  batchId: string
  status: "completed" | "partial" | "failed"
  summary: {
    total: number
    successful: number
    failed: number
    totalAmount: number
    fee: number
    settlementMethod: string
  }
  results: Array<{
    recipient: string
    amount: number
    success: boolean
    txHash?: string
    error?: string
  }>
}
\`\`\`

## Hooks Reference

### useBatchPayment

\`\`\`typescript
const {
  isProcessing,
  isRetrying,
  progress,
  results,
  failedItems,
  error,
  feeBreakdown,
  report,
  executeBatch,
  retryFailed,
  reset,
  downloadReport,
} = useBatchPayment()
\`\`\`

### useX402

\`\`\`typescript
const {
  client,
  isReady,
  pendingPayment,
  isProcessing,
  fetch,           // x402-aware fetch
  approvePayment,
  rejectPayment,
} = useX402({ autoSign: false, maxAutoAmount: 1 })
\`\`\`

### useMCPSubscriptions

\`\`\`typescript
const {
  subscriptions,
  providers,
  loading,
  error,
  subscribe,
  unsubscribe,
  changePlan,
  refresh,
} = useMCPSubscriptions()
\`\`\`

### useMonetizeConfig

\`\`\`typescript
const {
  config,
  apiKeys,
  usage,
  totalRevenue,
  totalCalls,
  loading,
  error,
  updateConfig,
  createAPIKey,
  revokeAPIKey,
  addTier,
  updateTier,
  deleteTier,
  refresh,
} = useMonetizeConfig()
\`\`\`

## Database Schema

### mcp_subscriptions
\`\`\`sql
CREATE TABLE mcp_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  calls_used INTEGER DEFAULT 0,
  calls_limit INTEGER NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

### monetize_configs
\`\`\`sql
CREATE TABLE monetize_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT false,
  tiers JSONB,
  default_tier TEXT DEFAULT 'free',
  webhook_url TEXT,
  rate_limit_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

### api_keys
\`\`\`sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tier TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  calls_used INTEGER DEFAULT 0,
  calls_limit INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
\`\`\`

## Environment Variables

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:
- `NEXT_PUBLIC_APP_URL`
- `PAYMENT_LINK_SECRET`
- `REQUEST_SIGNING_SECRET`
