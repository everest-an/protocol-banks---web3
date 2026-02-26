/**
 * A2A Message Types — Zod Schemas
 *
 * Defines the JSON-RPC 2.0 message format for Agent-to-Agent communication.
 * All message types include nonce + timestamp for replay protection
 * and EIP-191 signature for authentication.
 */

import { z } from 'zod'

// ─── Common Fields ──────────────────────────────────────────────────

const a2aSecurityFields = {
  nonce: z.string().min(16).max(128),
  timestamp: z.string().datetime(),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid hex signature'),
}

const didField = z.string().regex(/^did:pkh:eip155:\d+:0x[a-fA-F0-9]{40}$/)

// ─── JSON-RPC 2.0 Envelope ─────────────────────────────────────────

export const A2A_METHODS = [
  'a2a.handshake',
  'a2a.requestPayment',
  'a2a.paymentQuote',
  'a2a.confirmPayment',
  'a2a.paymentStatus',
  'a2a.cancelPayment',
] as const

export type A2AMethod = typeof A2A_METHODS[number]

export const a2aEnvelopeSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.string().or(z.number()).optional(),
  method: z.enum(A2A_METHODS),
  params: z.record(z.unknown()),
})

export type A2AEnvelope = z.infer<typeof a2aEnvelopeSchema>

// ─── Method-Specific Params ─────────────────────────────────────────

/** HANDSHAKE: Initial capability exchange */
export const handshakeParamsSchema = z.object({
  from_did: didField,
  agent_card_url: z.string().url().optional(),
  capabilities: z.array(z.string()).default([]),
  ...a2aSecurityFields,
})

/** REQUEST_PAYMENT: Request a payment to be made */
export const requestPaymentParamsSchema = z.object({
  from_did: didField,
  to: z.string().min(1),           // recipient address
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  token: z.string().min(1),
  chain: z.string().optional(),
  chain_id: z.number().int().optional(),
  memo: z.string().max(500).optional(),
  invoice_id: z.string().optional(),
  callback_url: z.string().url().optional(),
  ...a2aSecurityFields,
})

/** PAYMENT_QUOTE: Response with fee/gas/rate info */
export const paymentQuoteParamsSchema = z.object({
  request_id: z.string(),
  from_did: didField,
  estimated_fee: z.string(),
  estimated_gas: z.string().optional(),
  exchange_rate: z.string().optional(),
  valid_until: z.string().datetime(),
  ...a2aSecurityFields,
})

/** CONFIRM_PAYMENT: Confirm payment execution */
export const confirmPaymentParamsSchema = z.object({
  request_id: z.string(),
  from_did: didField,
  tx_hash: z.string(),
  status: z.enum(['completed', 'pending', 'failed']),
  ...a2aSecurityFields,
})

/** PAYMENT_STATUS: Query payment status */
export const paymentStatusParamsSchema = z.object({
  from_did: didField,
  request_id: z.string().optional(),
  tx_hash: z.string().optional(),
  ...a2aSecurityFields,
})

/** CANCEL_PAYMENT: Cancel a pending payment request */
export const cancelPaymentParamsSchema = z.object({
  request_id: z.string(),
  from_did: didField,
  reason: z.string().max(500).optional(),
  ...a2aSecurityFields,
})

// ─── Params Schema Map ─────────────────────────────────────────────

export const methodParamsSchemas: Record<A2AMethod, z.ZodTypeAny> = {
  'a2a.handshake': handshakeParamsSchema,
  'a2a.requestPayment': requestPaymentParamsSchema,
  'a2a.paymentQuote': paymentQuoteParamsSchema,
  'a2a.confirmPayment': confirmPaymentParamsSchema,
  'a2a.paymentStatus': paymentStatusParamsSchema,
  'a2a.cancelPayment': cancelPaymentParamsSchema,
}

// ─── JSON-RPC Response ──────────────────────────────────────────────

export interface A2AResponse {
  jsonrpc: '2.0'
  id?: string | number
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

export function createA2AResponse(id: string | number | undefined, result: unknown): A2AResponse {
  return { jsonrpc: '2.0', id, result }
}

export function createA2AError(
  id: string | number | undefined,
  code: number,
  message: string,
  data?: unknown
): A2AResponse {
  return { jsonrpc: '2.0', id, error: { code, message, data } }
}

// Standard JSON-RPC error codes
export const A2A_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Custom codes
  INVALID_SIGNATURE: -32001,
  REPLAY_DETECTED: -32002,
  TIMESTAMP_EXPIRED: -32003,
  AGENT_NOT_FOUND: -32004,
  PAYMENT_FAILED: -32005,
  RATE_LIMITED: -32006,
} as const
