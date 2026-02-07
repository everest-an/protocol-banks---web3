/**
 * Zod Validation Schemas - Yield API
 *
 * Input validation for all yield-related API endpoints.
 * Prevents injection attacks, invalid data, and unexpected inputs.
 */

import { z } from 'zod'

// Ethereum address pattern (0x + 40 hex chars)
const evmAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address format')

// TRON address pattern (T + 33 base58 chars)
const tronAddressSchema = z.string().regex(/^T[1-9A-HJ-NP-Za-km-z]{33}$/, 'Invalid TRON address format')

// Merchant address (EVM or TRON)
const merchantAddressSchema = z.string().refine(
  (val) => /^0x[a-fA-F0-9]{40}$/.test(val) || /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(val),
  { message: 'Invalid merchant address: must be a valid EVM (0x...) or TRON (T...) address' }
)

// Supported yield networks
const yieldNetworkSchema = z.enum([
  'ethereum', 'base', 'arbitrum', 'tron', 'tron-nile'
])

// ============================================================
// Balance API Schemas
// ============================================================

export const yieldBalanceQuerySchema = z.object({
  merchant: merchantAddressSchema,
  network: yieldNetworkSchema.optional(),
  summary: z.enum(['true', 'false']).optional().default('false'),
}).refine(
  (data) => data.summary === 'true' || data.network,
  { message: 'Network is required when summary=false' }
)

export type YieldBalanceQuery = z.infer<typeof yieldBalanceQuerySchema>

// ============================================================
// Stats API Schemas
// ============================================================

export const yieldStatsQuerySchema = z.object({
  network: yieldNetworkSchema.optional(),
})

export type YieldStatsQuery = z.infer<typeof yieldStatsQuerySchema>

// ============================================================
// Common Schemas (reusable across APIs)
// ============================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const userAddressHeaderSchema = z.string().refine(
  (val) => /^0x[a-fA-F0-9]{40}$/.test(val) || /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(val),
  { message: 'Invalid x-user-address header: must be a valid wallet address' }
)

// ============================================================
// Payment Queue Schemas
// ============================================================

export const paymentTaskSchema = z.object({
  paymentId: z.string().min(1).max(100),
  orderId: z.string().min(1).max(100),
  txHash: z.string().regex(/^(0x[a-fA-F0-9]{64}|[a-fA-F0-9]{64})$/, 'Invalid transaction hash'),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount format'),
  token: z.string().min(1).max(20),
  network: z.enum(['tron', 'ethereum', 'base', 'arbitrum']),
  merchantId: z.string().min(1).max(100),
})

export type ValidatedPaymentTask = z.infer<typeof paymentTaskSchema>

// ============================================================
// Helper: Parse search params into object
// ============================================================

export function parseSearchParams(searchParams: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    result[key] = value
  })
  return result
}

// ============================================================
// Helper: Format Zod errors for API responses
// ============================================================

export function formatZodError(error: z.ZodError): string {
  return error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
}
