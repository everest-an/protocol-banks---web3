/**
 * A2A Payment Handlers
 *
 * Bridges A2A messages to existing payment services:
 * - proposal-service for creating PaymentProposals
 * - x402-fee-calculator for quotes
 * - Prisma for status queries
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger/structured-logger'
import { extractAddressFromDid } from '../types'
import { txExecutorService } from '@/lib/services/tx-executor-service'
import { budgetGuardService } from '@/lib/services/budget-guard-service'
import type {
  requestPaymentParamsSchema,
  paymentStatusParamsSchema,
  confirmPaymentParamsSchema,
  cancelPaymentParamsSchema,
} from '../message-types'
import type { z } from 'zod'
import type { Address, Hex } from 'viem'

const component = 'a2a-payment-handler'

// ─── Handlers ───────────────────────────────────────────────────────

/**
 * Handle a2a.requestPayment — create a PaymentProposal.
 */
export async function handleRequestPayment(
  params: z.infer<typeof requestPaymentParamsSchema>,
  messageId: string
): Promise<unknown> {
  const fromAddress = extractAddressFromDid(params.from_did)
  if (!fromAddress) throw new Error('Invalid from_did')

  logger.info('A2A requestPayment received', {
    component,
    action: 'request_payment',
    metadata: {
      from: params.from_did,
      to: params.to,
      amount: params.amount,
      token: params.token,
    },
  })

  // Create a PaymentProposal via direct Prisma (reuses existing model)
  const proposal = await prisma.paymentProposal.create({
    data: {
      agent_id: messageId, // Link to A2A message as reference
      owner_address: fromAddress,
      recipient_address: params.to,
      amount: params.amount,
      token: params.token,
      chain_id: params.chain_id ?? 1,
      reason: params.memo ?? `A2A payment request from ${params.from_did}`,
      metadata: {
        source: 'a2a',
        from_did: params.from_did,
        chain: params.chain,
        invoice_id: params.invoice_id,
        callback_url: params.callback_url,
      },
      status: 'pending',
    },
  })

  return {
    request_id: proposal.id,
    status: 'pending',
    amount: params.amount,
    token: params.token,
    recipient: params.to,
    message: 'Payment request created. Awaiting approval.',
  }
}

/**
 * Handle a2a.paymentStatus — query payment or proposal status.
 */
export async function handlePaymentStatus(
  params: z.infer<typeof paymentStatusParamsSchema>
): Promise<unknown> {
  // Try to find by request_id (proposal)
  if (params.request_id) {
    const proposal = await prisma.paymentProposal.findUnique({
      where: { id: params.request_id },
    })
    if (proposal) {
      return {
        request_id: proposal.id,
        status: proposal.status,
        tx_hash: proposal.tx_hash,
        amount: proposal.amount,
        token: proposal.token,
        recipient: proposal.recipient_address,
      }
    }
  }

  // Try to find by tx_hash (payment)
  if (params.tx_hash) {
    const payment = await prisma.payment.findFirst({
      where: { tx_hash: params.tx_hash },
    })
    if (payment) {
      return {
        payment_id: payment.id,
        status: payment.status,
        tx_hash: payment.tx_hash,
        amount: payment.amount,
        token: payment.token,
        from: payment.from_address,
        to: payment.to_address,
      }
    }
  }

  return { status: 'not_found', message: 'No matching payment found' }
}

/**
 * Handle a2a.confirmPayment — update proposal with tx hash,
 * or auto-execute on-chain if executor key is configured and no tx_hash provided.
 */
export async function handleConfirmPayment(
  params: z.infer<typeof confirmPaymentParamsSchema>
): Promise<unknown> {
  const proposal = await prisma.paymentProposal.findUnique({
    where: { id: params.request_id },
  })
  if (!proposal) {
    return { error: 'Request not found', request_id: params.request_id }
  }

  // If tx_hash is provided, just record it
  if (params.tx_hash) {
    const updated = await prisma.paymentProposal.update({
      where: { id: params.request_id },
      data: {
        status: params.status === 'completed' ? 'executed' : params.status === 'failed' ? 'failed' : 'executing',
        tx_hash: params.tx_hash,
        executed_at: params.status === 'completed' ? new Date() : undefined,
      },
    })

    logger.info('A2A payment confirmed with tx_hash', {
      component,
      action: 'confirm_payment',
      metadata: { request_id: params.request_id, tx_hash: params.tx_hash, status: params.status },
    })

    return {
      request_id: updated.id,
      status: updated.status,
      tx_hash: updated.tx_hash,
    }
  }

  // No tx_hash: try auto-execute if executor key is available
  const executorKey = process.env.AGENT_EXECUTOR_PRIVATE_KEY
  if (executorKey && proposal.status === 'pending') {
    const guardResult = await budgetGuardService.check({
      agentId: proposal.agent_id,
      ownerAddress: proposal.owner_address,
      amount: proposal.amount,
      token: proposal.token,
      chainId: proposal.chain_id ?? 1,
    })

    if (!guardResult.allowed) {
      return {
        request_id: proposal.id,
        status: 'rejected',
        error: `BudgetGuard: ${guardResult.reason}`,
      }
    }

    const txResult = await txExecutorService.smartExecute({
      privateKey: executorKey as Hex,
      to: proposal.recipient_address as Address,
      amount: proposal.amount,
      token: proposal.token,
      chainId: proposal.chain_id ?? 1,
    })

    if (txResult.success) {
      budgetGuardService.recordSuccess(proposal.agent_id, parseFloat(proposal.amount))

      const updated = await prisma.paymentProposal.update({
        where: { id: params.request_id },
        data: {
          status: 'executed',
          tx_hash: txResult.txHash,
          executed_at: new Date(),
        },
      })

      logger.info('A2A payment auto-executed on-chain', {
        component,
        action: 'confirm_payment_auto_execute',
        metadata: { request_id: params.request_id, tx_hash: txResult.txHash },
      })

      return {
        request_id: updated.id,
        status: 'executed',
        tx_hash: txResult.txHash,
        auto_executed: true,
      }
    } else {
      budgetGuardService.recordFailure(proposal.agent_id)
      return {
        request_id: proposal.id,
        status: 'failed',
        error: txResult.error,
      }
    }
  }

  // No executor key, no tx_hash — mark as executing
  const updated = await prisma.paymentProposal.update({
    where: { id: params.request_id },
    data: { status: 'executing' },
  })

  return {
    request_id: updated.id,
    status: updated.status,
    message: 'Awaiting on-chain transaction submission.',
  }
}

/**
 * Handle a2a.cancelPayment — cancel a pending request.
 */
export async function handleCancelPayment(
  params: z.infer<typeof cancelPaymentParamsSchema>
): Promise<unknown> {
  const proposal = await prisma.paymentProposal.findUnique({
    where: { id: params.request_id },
  })
  if (!proposal) {
    return { error: 'Request not found', request_id: params.request_id }
  }
  if (proposal.status !== 'pending') {
    return { error: `Cannot cancel: status is ${proposal.status}`, request_id: params.request_id }
  }

  const updated = await prisma.paymentProposal.update({
    where: { id: params.request_id },
    data: {
      status: 'rejected',
      rejection_reason: params.reason ?? 'Cancelled via A2A',
    },
  })

  return {
    request_id: updated.id,
    status: 'cancelled',
  }
}

/**
 * Handle a2a.handshake — return platform capabilities.
 */
export async function handleHandshake(
  params: { from_did: string; capabilities?: string[] }
): Promise<unknown> {
  return {
    platform: 'Protocol Banks',
    version: '1.0',
    capabilities: ['payment', 'invoice', 'batch_payment', 'x402'],
    supported_tokens: ['USDC', 'USDT', 'DAI', 'ETH'],
    supported_chains: ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'tron'],
    protocols: ['a2a', 'mcp', 'x402'],
    message: `Welcome ${params.from_did}. Protocol Banks is ready for A2A communication.`,
  }
}
