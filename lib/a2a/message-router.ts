/**
 * A2A Message Router
 *
 * Routes incoming JSON-RPC 2.0 A2A messages to the appropriate handler
 * after performing signature verification and replay protection.
 */

import { logger } from '@/lib/logger/structured-logger'
import { prisma } from '@/lib/prisma'
import { verifyA2ASignature, checkTimestamp, isNonceUsed } from './message-verifier'
import {
  type A2AEnvelope,
  type A2AResponse,
  type A2AMethod,
  a2aEnvelopeSchema,
  methodParamsSchemas,
  createA2AResponse,
  createA2AError,
  A2A_ERROR_CODES,
} from './message-types'
import {
  handleHandshake,
  handleRequestPayment,
  handlePaymentStatus,
  handleConfirmPayment,
  handleCancelPayment,
} from './handlers/payment-handler'

const component = 'a2a-router'

/**
 * Process an incoming A2A JSON-RPC message.
 *
 * 1. Validate envelope format
 * 2. Validate method-specific params
 * 3. Verify EIP-191 signature
 * 4. Check replay protection (nonce + timestamp)
 * 5. Route to handler
 * 6. Store message in DB
 * 7. Return JSON-RPC response
 */
export async function routeA2AMessage(body: unknown): Promise<A2AResponse> {
  // 1. Validate envelope
  const envelopeParse = a2aEnvelopeSchema.safeParse(body)
  if (!envelopeParse.success) {
    return createA2AError(
      undefined,
      A2A_ERROR_CODES.INVALID_REQUEST,
      'Invalid JSON-RPC 2.0 envelope',
      envelopeParse.error.errors
    )
  }

  const envelope = envelopeParse.data
  const { method, params, id } = envelope

  // 2. Validate method-specific params
  const paramsSchema = methodParamsSchemas[method]
  const paramsParse = paramsSchema.safeParse(params)
  if (!paramsParse.success) {
    return createA2AError(
      id,
      A2A_ERROR_CODES.INVALID_PARAMS,
      `Invalid params for ${method}`,
      paramsParse.error.errors
    )
  }

  const validParams = paramsParse.data as Record<string, unknown>
  const fromDid = validParams.from_did as string
  const nonce = validParams.nonce as string
  const timestamp = validParams.timestamp as string

  // 3. Check timestamp freshness
  const timestampError = checkTimestamp(timestamp)
  if (timestampError) {
    return createA2AError(id, A2A_ERROR_CODES.TIMESTAMP_EXPIRED, timestampError)
  }

  // 4. Check nonce uniqueness
  const nonceUsed = await isNonceUsed(nonce)
  if (nonceUsed) {
    return createA2AError(id, A2A_ERROR_CODES.REPLAY_DETECTED, 'Nonce already used')
  }

  // 5. Verify EIP-191 signature
  const recoveredAddress = await verifyA2ASignature(validParams, fromDid)
  if (!recoveredAddress) {
    logger.logSecurityEvent('a2a_invalid_signature', 'high', {
      from_did: fromDid,
      method,
    }, { component })
    return createA2AError(id, A2A_ERROR_CODES.INVALID_SIGNATURE, 'Invalid signature')
  }

  // 6. Store message in DB (nonce unique constraint provides final replay protection)
  let messageRecord
  try {
    messageRecord = await prisma.a2AMessage.create({
      data: {
        message_type: method,
        from_did: fromDid,
        from_address: recoveredAddress,
        payload: JSON.parse(JSON.stringify(validParams)),
        signature: validParams.signature as string,
        nonce,
        timestamp: new Date(timestamp),
        status: 'processing',
      },
    })
  } catch (error: unknown) {
    // Unique constraint violation on nonce = race condition replay
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return createA2AError(id, A2A_ERROR_CODES.REPLAY_DETECTED, 'Nonce already used')
    }
    throw error
  }

  // 7. Route to handler
  try {
    const result = await dispatchToHandler(method, validParams, messageRecord.id)

    // Update message status
    await prisma.a2AMessage.update({
      where: { id: messageRecord.id },
      data: { status: 'completed', processed_at: new Date() },
    })

    logger.info(`A2A ${method} processed`, {
      component,
      action: method,
      metadata: { from_did: fromDid, message_id: messageRecord.id },
    })

    return createA2AResponse(id, result)
  } catch (error) {
    // Update message status on failure
    await prisma.a2AMessage.update({
      where: { id: messageRecord.id },
      data: {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        processed_at: new Date(),
      },
    })

    logger.error(`A2A ${method} failed`, error as Error, {
      component,
      metadata: { from_did: fromDid, message_id: messageRecord.id },
    })

    return createA2AError(
      id,
      A2A_ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Processing failed'
    )
  }
}

/**
 * Dispatch to the appropriate handler based on method name.
 */
async function dispatchToHandler(
  method: A2AMethod,
  params: Record<string, unknown>,
  messageId: string
): Promise<unknown> {
  switch (method) {
    case 'a2a.handshake':
      return handleHandshake(params as Parameters<typeof handleHandshake>[0])
    case 'a2a.requestPayment':
      return handleRequestPayment(params as Parameters<typeof handleRequestPayment>[0], messageId)
    case 'a2a.paymentStatus':
      return handlePaymentStatus(params as Parameters<typeof handlePaymentStatus>[0])
    case 'a2a.confirmPayment':
      return handleConfirmPayment(params as Parameters<typeof handleConfirmPayment>[0])
    case 'a2a.cancelPayment':
      return handleCancelPayment(params as Parameters<typeof handleCancelPayment>[0])
    case 'a2a.paymentQuote':
      // Payment quotes use the same flow as requestPayment but return fee info
      return {
        estimated_fee: '0.50',
        estimated_gas: '0.001',
        valid_until: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        message: 'Quote is an estimate. Actual fees may vary.',
      }
    default:
      throw new Error(`Unknown method: ${method}`)
  }
}
