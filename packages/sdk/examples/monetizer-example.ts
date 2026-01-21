/**
 * API Monetizer Usage Examples
 * 
 * This file demonstrates how to use the API Monetizer module
 * to monetize REST APIs with x402 payments.
 */

import {
  APIMonetizer,
  createAPIMonetizer,
  createNextHandler,
  createExpressMiddleware,
  PerRequestPricing,
  PerTokenPricing,
  AI_PRICING_PRESETS,
} from '../src';

// ============================================================================
// Example 1: Basic Per-Request Pricing
// ============================================================================

/**
 * Monetize any API with a fixed price per request.
 * Great for simple APIs where each request has similar cost.
 */
const basicMonetizer = createAPIMonetizer({
  upstream: {
    url: 'https://api.example.com',
    headers: {
      'Authorization': 'Bearer your-api-key',
    },
    timeout: 30000,
  },
  pricing: {
    model: 'perRequest',
    perRequest: '0.01', // $0.01 per request
  },
  recipient: '0x1234567890123456789012345678901234567890',
  network: 'base', // 0 fees on Base
  token: 'USDC',
});

// Use in Next.js API route
export const basicHandler = createNextHandler({
  upstream: { url: 'https://api.example.com' },
  pricing: { model: 'perRequest', perRequest: '0.01' },
  recipient: '0x1234567890123456789012345678901234567890',
});

// ============================================================================
// Example 2: AI API with Per-Token Pricing
// ============================================================================

/**
 * Monetize AI APIs (OpenAI, Anthropic, etc.) with per-token pricing.
 * Charges based on input and output token counts.
 */
const aiMonetizer = createAPIMonetizer({
  upstream: {
    url: 'https://api.openai.com/v1',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  },
  pricing: {
    model: 'perToken',
    // Use preset pricing for GPT-4 Turbo
    ...AI_PRICING_PRESETS['gpt-4-turbo'],
  },
  recipient: '0x1234567890123456789012345678901234567890',
  network: 'base',
  token: 'USDC',
  description: 'GPT-4 Turbo API Access',
});

// ============================================================================
// Example 3: Tiered Pricing with Volume Discounts
// ============================================================================

/**
 * Offer volume discounts with tiered pricing.
 * Price decreases as usage increases.
 */
const tieredMonetizer = createAPIMonetizer({
  upstream: {
    url: 'https://api.example.com',
  },
  pricing: {
    model: 'tiered',
    tiers: [
      { upTo: 100, price: '0.01' },    // First 100 requests: $0.01 each
      { upTo: 1000, price: '0.008' },  // 101-1000 requests: $0.008 each
      { upTo: 10000, price: '0.005' }, // 1001-10000 requests: $0.005 each
      { upTo: Infinity, price: '0.003' }, // 10000+ requests: $0.003 each
    ],
  },
  recipient: '0x1234567890123456789012345678901234567890',
});

// ============================================================================
// Example 4: Dynamic Pricing Based on Request Content
// ============================================================================

/**
 * Calculate price dynamically based on request content.
 * Useful for APIs where cost varies by operation.
 */
const dynamicMonetizer = createAPIMonetizer({
  upstream: {
    url: 'https://api.example.com',
  },
  pricing: {
    model: 'dynamic',
    dynamic: async (request) => {
      const body = await request.clone().json();
      
      // Price based on operation type
      switch (body.operation) {
        case 'simple':
          return '0.001';
        case 'complex':
          return '0.01';
        case 'premium':
          return '0.1';
        default:
          return '0.005';
      }
    },
    minPrice: '0.001',
    maxPrice: '1.00',
  },
  recipient: '0x1234567890123456789012345678901234567890',
});

// ============================================================================
// Example 5: With Subscription Bypass
// ============================================================================

/**
 * Allow subscribers to bypass per-request payments.
 * Check subscription status before requiring payment.
 */
const subscriptionMonetizer = createAPIMonetizer({
  upstream: {
    url: 'https://api.example.com',
  },
  pricing: {
    model: 'perRequest',
    perRequest: '0.01',
  },
  recipient: '0x1234567890123456789012345678901234567890',
  
  // Check if wallet has active subscription
  subscriptionCheck: async (walletAddress) => {
    const response = await fetch(`/api/subscriptions/check?wallet=${walletAddress}`);
    const data = await response.json();
    return data.hasActiveSubscription;
  },
});

// ============================================================================
// Example 6: With Rate Limiting
// ============================================================================

/**
 * Add rate limiting to prevent abuse.
 * Limits can be per minute, hour, or day.
 */
const rateLimitedMonetizer = createAPIMonetizer({
  upstream: {
    url: 'https://api.example.com',
  },
  pricing: {
    model: 'perRequest',
    perRequest: '0.01',
  },
  recipient: '0x1234567890123456789012345678901234567890',
  rateLimit: {
    maxPerMinute: 60,   // 60 requests per minute
    maxPerHour: 1000,   // 1000 requests per hour
    maxPerDay: 10000,   // 10000 requests per day
  },
});

// ============================================================================
// Example 7: With Allowlist/Blocklist
// ============================================================================

/**
 * Control access with wallet allowlist and blocklist.
 * Allowlisted wallets bypass payment, blocklisted are rejected.
 */
const accessControlMonetizer = createAPIMonetizer({
  upstream: {
    url: 'https://api.example.com',
  },
  pricing: {
    model: 'perRequest',
    perRequest: '0.01',
  },
  recipient: '0x1234567890123456789012345678901234567890',
  
  // These wallets don't need to pay
  allowlist: [
    '0xABCD...', // Team wallet
    '0xEFGH...', // Partner wallet
  ],
  
  // These wallets are blocked
  blocklist: [
    '0x1234...', // Known abuser
  ],
});

// ============================================================================
// Example 8: Express Middleware
// ============================================================================

/**
 * Use with Express.js applications.
 */
const expressMiddleware = createExpressMiddleware({
  upstream: {
    url: 'https://api.example.com',
  },
  pricing: {
    model: 'perRequest',
    perRequest: '0.01',
  },
  recipient: '0x1234567890123456789012345678901234567890',
});

// Usage in Express:
// app.use('/api/paid', expressMiddleware);

// ============================================================================
// Example 9: Manual Request Handling
// ============================================================================

/**
 * Handle requests manually for more control.
 */
async function handleManually(request: Request): Promise<Response> {
  const monetizer = new APIMonetizer({
    upstream: { url: 'https://api.example.com' },
    pricing: { model: 'perRequest', perRequest: '0.01' },
    recipient: '0x1234567890123456789012345678901234567890',
  });
  
  // Handle the request
  const response = await monetizer.handleRequest(request);
  
  // Add custom headers or modify response
  const headers = new Headers(response.headers);
  headers.set('X-Custom-Header', 'value');
  
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

// ============================================================================
// Example 10: Using Pricing Strategies Directly
// ============================================================================

/**
 * Use pricing strategies directly for custom implementations.
 */
async function calculateCustomPrice(request: Request): Promise<string> {
  // Per-request pricing
  const perRequest = new PerRequestPricing({ price: '0.01' });
  const result1 = await perRequest.calculatePrice(request);
  console.log('Per-request price:', result1.price);
  
  // Per-token pricing
  const perToken = new PerTokenPricing({
    perInputToken: '0.00001',
    perOutputToken: '0.00003',
  });
  const result2 = await perToken.calculatePrice(request, {
    tokenUsage: { inputTokens: 1000, outputTokens: 500 },
  });
  console.log('Per-token price:', result2.price);
  console.log('Breakdown:', result2.breakdown);
  
  return result1.price;
}
