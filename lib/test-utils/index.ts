/**
 * Test utilities for Protocol Banks
 * Provides helpers for API mocking, database seeding, and property-based testing
 */

import * as fc from 'fast-check';

// ============================================
// Arbitrary Generators for Property-Based Testing
// ============================================

/**
 * Generate valid Ethereum addresses
 */
export const ethereumAddressArb = fc.hexaString({ minLength: 40, maxLength: 40 })
  .map(hex => `0x${hex}`);

/**
 * Generate valid API key names
 */
export const apiKeyNameArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/**
 * Generate valid API key permissions
 */
export const permissionArb = fc.constantFrom('read', 'write', 'payments', 'webhooks', 'admin');
export const permissionsArb = fc.array(permissionArb, { minLength: 1, maxLength: 5 });

/**
 * Generate valid webhook URLs
 */
export const webhookUrlArb = fc.webUrl({ withPath: true });

/**
 * Generate valid webhook events
 */
export const webhookEventArb = fc.constantFrom(
  'payment.created',
  'payment.completed',
  'payment.failed',
  'batch_payment.created',
  'batch_payment.completed',
  'multisig.proposal_created',
  'multisig.executed'
);
export const webhookEventsArb = fc.array(webhookEventArb, { minLength: 1, maxLength: 7 });

/**
 * Generate valid subscription frequencies
 */
export const frequencyArb = fc.constantFrom('daily', 'weekly', 'monthly', 'yearly');

/**
 * Generate valid token amounts (as string)
 */
export const tokenAmountArb = fc.float({ min: Math.fround(0.01), max: Math.fround(1000000), noNaN: true })
  .map(n => n.toFixed(2));

/**
 * Generate valid token symbols
 */
export const tokenSymbolArb = fc.constantFrom('USDC', 'USDT', 'DAI', 'ETH');

/**
 * Generate valid chain IDs
 */
export const chainIdArb = fc.constantFrom(1, 137, 8453, 42161); // Ethereum, Polygon, Base, Arbitrum

// ============================================
// Mock Data Factories
// ============================================

export interface MockAPIKey {
  id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  owner_address: string;
  permissions: string[];
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function createMockAPIKey(overrides: Partial<MockAPIKey> = {}): MockAPIKey {
  return {
    id: `key-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: 'Test API Key',
    key_hash: 'mock-hash-' + Math.random().toString(36).slice(2),
    key_prefix: 'pb_test_',
    owner_address: '0x' + '1'.repeat(40),
    permissions: ['read'],
    rate_limit_per_minute: 60,
    rate_limit_per_day: 10000,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export interface MockWebhook {
  id: string;
  name: string;
  url: string;
  owner_address: string;
  events: string[];
  secret_hash: string;
  is_active: boolean;
  retry_count: number;
  timeout_ms: number;
  created_at: string;
  updated_at: string;
}

export function createMockWebhook(overrides: Partial<MockWebhook> = {}): MockWebhook {
  return {
    id: `webhook-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: 'Test Webhook',
    url: 'https://example.com/webhook',
    owner_address: '0x' + '1'.repeat(40),
    events: ['payment.completed'],
    secret_hash: 'mock-secret-hash-' + Math.random().toString(36).slice(2),
    is_active: true,
    retry_count: 3,
    timeout_ms: 30000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export interface MockSubscription {
  id: string;
  owner_address: string;
  service_name: string;
  wallet_address: string;
  amount: string;
  token: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  status: 'active' | 'paused' | 'cancelled' | 'payment_failed';
  next_payment_date: string | null;
  last_payment_date: string | null;
  total_paid: string;
  chain_id: number;
  created_at: string;
  updated_at: string;
}

export function createMockSubscription(overrides: Partial<MockSubscription> = {}): MockSubscription {
  return {
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    owner_address: '0x' + '1'.repeat(40),
    service_name: 'Test Service',
    wallet_address: '0x' + '2'.repeat(40),
    amount: '100.00',
    token: 'USDC',
    frequency: 'monthly',
    status: 'active',
    next_payment_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    last_payment_date: null,
    total_paid: '0',
    chain_id: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export interface MockPayment {
  id: string;
  from_address: string;
  to_address: string;
  amount: string;
  token_symbol: string;
  chain_id: number;
  status: 'pending' | 'completed' | 'failed';
  tx_hash: string | null;
  vendor_id: string | null;
  created_by: string;
  created_at: string;
}

export function createMockPayment(overrides: Partial<MockPayment> = {}): MockPayment {
  return {
    id: `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    from_address: '0x' + '1'.repeat(40),
    to_address: '0x' + '2'.repeat(40),
    amount: '100.00',
    token_symbol: 'USDC',
    chain_id: 1,
    status: 'completed',
    tx_hash: '0x' + 'a'.repeat(64),
    vendor_id: null,
    created_by: '0x' + '1'.repeat(40),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export interface MockVendor {
  id: string;
  name: string;
  wallet_address: string;
  category: string;
  tier: 'vendor' | 'partner' | 'subsidiary';
  monthly_volume: number;
  transaction_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function createMockVendor(overrides: Partial<MockVendor> = {}): MockVendor {
  return {
    id: `vendor-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: 'Test Vendor',
    wallet_address: '0x' + '3'.repeat(40),
    category: 'Services',
    tier: 'vendor',
    monthly_volume: 0,
    transaction_count: 0,
    created_by: '0x' + '1'.repeat(40),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================
// API Mocking Utilities
// ============================================

export interface MockResponse {
  status: number;
  body: any;
  headers?: Record<string, string>;
}

export function createMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
} = {}): Request {
  const { method = 'GET', url = 'http://localhost:3000/api/test', headers = {}, body } = options;
  
  return new Request(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function createAuthenticatedRequest(options: {
  method?: string;
  url?: string;
  apiKey?: string;
  body?: any;
} = {}): Request {
  const { apiKey = 'pb_test_key123', ...rest } = options;
  
  return createMockRequest({
    ...rest,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
}

// ============================================
// Database Seeding Utilities
// ============================================

export interface SeedData {
  apiKeys?: MockAPIKey[];
  webhooks?: MockWebhook[];
  subscriptions?: MockSubscription[];
  payments?: MockPayment[];
  vendors?: MockVendor[];
}

/**
 * Generate seed data for testing
 */
export function generateSeedData(counts: {
  apiKeys?: number;
  webhooks?: number;
  subscriptions?: number;
  payments?: number;
  vendors?: number;
} = {}): SeedData {
  const ownerAddress = '0x' + '1'.repeat(40);
  
  return {
    apiKeys: Array.from({ length: counts.apiKeys || 0 }, (_, i) => 
      createMockAPIKey({ name: `API Key ${i + 1}`, owner_address: ownerAddress })
    ),
    webhooks: Array.from({ length: counts.webhooks || 0 }, (_, i) =>
      createMockWebhook({ name: `Webhook ${i + 1}`, owner_address: ownerAddress })
    ),
    subscriptions: Array.from({ length: counts.subscriptions || 0 }, (_, i) =>
      createMockSubscription({ service_name: `Service ${i + 1}`, owner_address: ownerAddress })
    ),
    payments: Array.from({ length: counts.payments || 0 }, (_, i) =>
      createMockPayment({ created_by: ownerAddress })
    ),
    vendors: Array.from({ length: counts.vendors || 0 }, (_, i) =>
      createMockVendor({ name: `Vendor ${i + 1}`, created_by: ownerAddress })
    ),
  };
}

// ============================================
// Assertion Helpers
// ============================================

/**
 * Assert that a value is a valid SHA-256 hash (64 hex characters)
 */
export function isValidSHA256Hash(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

/**
 * Assert that a value is a valid HMAC-SHA256 signature
 */
export function isValidHMACSHA256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

/**
 * Assert that a value is a valid Ethereum address
 */
export function isValidEthereumAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

/**
 * Assert that a value is a valid UUID
 */
export function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Assert that a date is in the future
 */
export function isDateInFuture(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime() > Date.now();
}

/**
 * Assert that two dates are approximately equal (within tolerance)
 */
export function areDatesApproximatelyEqual(
  date1: Date | string,
  date2: Date | string,
  toleranceMs: number = 1000
): boolean {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  return Math.abs(d1.getTime() - d2.getTime()) <= toleranceMs;
}

// ============================================
// Re-export fast-check for convenience
// ============================================

export { fc };
