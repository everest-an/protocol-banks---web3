/**
 * Cross-Chain Transaction State Machine (跨链交易状态机)
 *
 * Manages the lifecycle of cross-chain swaps and bridges with
 * explicit state transitions and audit trail.
 *
 * States:
 *   initiated → source_confirmed → bridging → dest_pending → completed
 *                                                           → failed → refunded
 */

import { getClient } from "@/lib/prisma"

// ─── Types ──────────────────────────────────────────────────────────────────

export type CrossChainState =
  | "initiated"
  | "source_confirmed"
  | "bridging"
  | "dest_pending"
  | "completed"
  | "failed"
  | "refunded"

export type TransitionTrigger =
  | "user_action"
  | "blockchain_event"
  | "timeout"
  | "error"
  | "provider_callback"

// Valid state transitions
const VALID_TRANSITIONS: Record<CrossChainState, CrossChainState[]> = {
  initiated: ["source_confirmed", "failed"],
  source_confirmed: ["bridging", "failed"],
  bridging: ["dest_pending", "failed"],
  dest_pending: ["completed", "failed"],
  completed: [], // Terminal state
  failed: ["refunded", "initiated"], // Can retry or refund
  refunded: [], // Terminal state
}

export interface CreateCrossChainParams {
  userAddress: string
  type: "swap" | "bridge" | "transfer"
  provider: string
  sourceChain: string
  sourceToken: string
  sourceAmount: string | number
  destChain: string
  destToken: string
  recipientAddress?: string
  slippageBps?: number
  routeData?: unknown
  idempotencyKey?: string
  estimatedTime?: number
}

// ─── Core Operations ────────────────────────────────────────────────────────

/**
 * Create a new cross-chain transaction
 */
export async function createCrossChainTransaction(
  params: CreateCrossChainParams
) {
  const prisma = getClient()

  // Check idempotency if key provided
  if (params.idempotencyKey) {
    const existing = await prisma.crossChainTransaction.findUnique({
      where: { idempotency_key: params.idempotencyKey },
    })
    if (existing) {
      return existing
    }
  }

  const tx = await prisma.crossChainTransaction.create({
    data: {
      user_address: params.userAddress,
      type: params.type,
      provider: params.provider,
      source_chain: params.sourceChain,
      source_token: params.sourceToken,
      source_amount: parseFloat(params.sourceAmount.toString()),
      dest_chain: params.destChain,
      dest_token: params.destToken,
      recipient_address: params.recipientAddress,
      slippage_bps: params.slippageBps,
      route_data: params.routeData as object ?? undefined,
      idempotency_key: params.idempotencyKey,
      estimated_time: params.estimatedTime,
      state: "initiated",
    },
  })

  // Record initial state
  await prisma.crossChainStateTransition.create({
    data: {
      transaction_id: tx.id,
      from_state: "none",
      to_state: "initiated",
      trigger: "user_action",
      details: { provider: params.provider },
    },
  })

  return tx
}

/**
 * Transition a cross-chain transaction to a new state
 */
export async function transitionState(
  transactionId: string,
  newState: CrossChainState,
  trigger: TransitionTrigger,
  details?: Record<string, unknown>
) {
  const prisma = getClient()

  const tx = await prisma.crossChainTransaction.findUnique({
    where: { id: transactionId },
  })

  if (!tx) {
    throw new Error(`Cross-chain transaction ${transactionId} not found`)
  }

  const currentState = tx.state as CrossChainState
  const allowed = VALID_TRANSITIONS[currentState]

  if (!allowed.includes(newState)) {
    throw new Error(
      `Invalid state transition: ${currentState} → ${newState}. ` +
        `Allowed transitions from ${currentState}: [${allowed.join(", ")}]`
    )
  }

  // Determine update data
  const updateData: Record<string, unknown> = {
    state: newState,
    sub_state: details?.subState ?? null,
  }

  if (details?.sourceTxHash) {
    updateData.source_tx_hash = details.sourceTxHash
  }
  if (details?.destTxHash) {
    updateData.dest_tx_hash = details.destTxHash
  }
  if (details?.destAmount) {
    updateData.dest_amount = parseFloat(details.destAmount as string)
  }
  if (details?.errorMessage) {
    updateData.error_message = details.errorMessage
    updateData.error_code = details.errorCode ?? null
  }
  if (newState === "completed" || newState === "refunded") {
    updateData.completed_at = new Date()
  }
  if (newState === "failed") {
    updateData.retry_count = { increment: 1 }
  }

  // Atomic update + state transition log
  const [updated] = await prisma.$transaction([
    prisma.crossChainTransaction.update({
      where: { id: transactionId },
      data: updateData,
    }),
    prisma.crossChainStateTransition.create({
      data: {
        transaction_id: transactionId,
        from_state: currentState,
        to_state: newState,
        trigger,
        details: details as object ?? undefined,
      },
    }),
  ])

  return updated
}

/**
 * Get a cross-chain transaction with its full state history
 */
export async function getCrossChainTransaction(transactionId: string) {
  const prisma = getClient()

  const tx = await prisma.crossChainTransaction.findUnique({
    where: { id: transactionId },
    include: {
      state_transitions: {
        orderBy: { created_at: "asc" },
      },
    },
  })

  if (!tx) return null

  return {
    ...tx,
    source_amount: tx.source_amount.toString(),
    dest_amount: tx.dest_amount?.toString() ?? null,
    state_transitions: tx.state_transitions.map((t) => ({
      ...t,
      created_at: t.created_at.toISOString(),
    })),
  }
}

/**
 * List cross-chain transactions for a user
 */
export async function listCrossChainTransactions(params: {
  userAddress: string
  state?: CrossChainState
  type?: string
  limit?: number
  offset?: number
}) {
  const prisma = getClient()
  const where: Record<string, unknown> = {
    user_address: params.userAddress,
  }
  if (params.state) where.state = params.state
  if (params.type) where.type = params.type

  const [transactions, total] = await Promise.all([
    prisma.crossChainTransaction.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: params.limit ?? 20,
      skip: params.offset ?? 0,
    }),
    prisma.crossChainTransaction.count({ where }),
  ])

  return {
    transactions: transactions.map((tx) => ({
      ...tx,
      source_amount: tx.source_amount.toString(),
      dest_amount: tx.dest_amount?.toString() ?? null,
    })),
    total,
  }
}

/**
 * Find stalled transactions that need attention (for monitoring/cron)
 */
export async function findStalledTransactions(stalledMinutes: number = 30) {
  const prisma = getClient()
  const cutoff = new Date(Date.now() - stalledMinutes * 60 * 1000)

  return prisma.crossChainTransaction.findMany({
    where: {
      state: { in: ["initiated", "source_confirmed", "bridging", "dest_pending"] },
      updated_at: { lt: cutoff },
    },
    orderBy: { updated_at: "asc" },
  })
}
