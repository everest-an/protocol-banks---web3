/**
 * Enterprise Ledger Service (总账系统)
 *
 * Double-entry bookkeeping with balance locking for concurrent payment safety.
 * Every financial event creates a balanced debit/credit pair.
 *
 * Design principles:
 * - Immutable entries: LedgerEntry records are never updated or deleted
 * - Atomic operations: Balance updates + ledger entries in a single transaction
 * - Optimistic locking: UserBalance.version prevents concurrent overwrites
 * - Idempotency: duplicate operations rejected via idempotency_key
 */

import { getClient } from "@/lib/prisma"
import { randomUUID } from "crypto"

// ─── Types ──────────────────────────────────────────────────────────────────

export type EntryCategory =
  | "payment"
  | "fee"
  | "refund"
  | "settlement"
  | "deposit"
  | "withdrawal"
  | "lock"
  | "unlock"

export interface LedgerTransferParams {
  idempotencyKey: string
  fromAddress: string
  toAddress: string
  amount: string | number
  token: string
  chain: string
  category: EntryCategory
  referenceType?: string
  referenceId?: string
  txHash?: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface LedgerLockParams {
  userAddress: string
  amount: string | number
  token: string
  chain: string
  referenceType: string
  referenceId: string
  idempotencyKey: string
}

export interface BalanceInfo {
  available: string
  locked: string
  total: string
  token: string
  chain: string
}

// ─── Core Ledger Operations ─────────────────────────────────────────────────

/**
 * Record a transfer between two accounts with double-entry bookkeeping.
 * Creates a DEBIT on sender + CREDIT on receiver atomically.
 */
export async function recordTransfer(params: LedgerTransferParams) {
  const prisma = getClient()
  const amount = parseFloat(params.amount.toString())

  if (amount <= 0) {
    throw new Error("Transfer amount must be positive")
  }

  // Check idempotency
  const existing = await prisma.idempotencyKey.findUnique({
    where: { key: params.idempotencyKey },
  })
  if (existing?.status === "completed") {
    return { duplicate: true, idempotencyKey: params.idempotencyKey }
  }

  return prisma.$transaction(async (tx) => {
    // 1. Get or create sender balance with optimistic lock
    const senderBalance = await getOrCreateBalance(
      tx,
      params.fromAddress,
      params.token,
      params.chain
    )

    // 2. Check sufficient available balance
    if (parseFloat(senderBalance.available.toString()) < amount) {
      throw new Error(
        `Insufficient balance: available=${senderBalance.available}, required=${amount}`
      )
    }

    // 3. Get or create receiver balance
    const receiverBalance = await getOrCreateBalance(
      tx,
      params.toAddress,
      params.token,
      params.chain
    )

    // 4. Update sender balance (debit)
    const newSenderAvailable = parseFloat(senderBalance.available.toString()) - amount
    const newSenderTotal = parseFloat(senderBalance.total.toString()) - amount

    await tx.userBalance.update({
      where: {
        user_address_token_chain: {
          user_address: params.fromAddress,
          token: params.token,
          chain: params.chain,
        },
        version: senderBalance.version, // Optimistic lock
      },
      data: {
        available: newSenderAvailable,
        total: newSenderTotal,
        version: { increment: 1 },
      },
    })

    // 5. Update receiver balance (credit)
    const newReceiverAvailable = parseFloat(receiverBalance.available.toString()) + amount
    const newReceiverTotal = parseFloat(receiverBalance.total.toString()) + amount

    await tx.userBalance.update({
      where: {
        user_address_token_chain: {
          user_address: params.toAddress,
          token: params.token,
          chain: params.chain,
        },
        version: receiverBalance.version,
      },
      data: {
        available: newReceiverAvailable,
        total: newReceiverTotal,
        version: { increment: 1 },
      },
    })

    // 6. Create debit entry (sender)
    await tx.ledgerEntry.create({
      data: {
        idempotency_key: params.idempotencyKey,
        account_address: params.fromAddress,
        entry_type: "DEBIT",
        category: params.category,
        amount,
        token: params.token,
        chain: params.chain,
        balance_before: parseFloat(senderBalance.available.toString()),
        balance_after: newSenderAvailable,
        counterparty: params.toAddress,
        reference_type: params.referenceType,
        reference_id: params.referenceId,
        tx_hash: params.txHash,
        description: params.description,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    })

    // 7. Create credit entry (receiver)
    await tx.ledgerEntry.create({
      data: {
        idempotency_key: params.idempotencyKey,
        account_address: params.toAddress,
        entry_type: "CREDIT",
        category: params.category,
        amount,
        token: params.token,
        chain: params.chain,
        balance_before: parseFloat(receiverBalance.available.toString()),
        balance_after: newReceiverAvailable,
        counterparty: params.fromAddress,
        reference_type: params.referenceType,
        reference_id: params.referenceId,
        tx_hash: params.txHash,
        description: params.description,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    })

    return {
      duplicate: false,
      idempotencyKey: params.idempotencyKey,
      senderBalance: newSenderAvailable.toString(),
      receiverBalance: newReceiverAvailable.toString(),
    }
  })
}

/**
 * Lock balance for a pending transaction.
 * Moves funds from `available` to `locked`.
 */
export async function lockBalance(params: LedgerLockParams) {
  const prisma = getClient()
  const amount = parseFloat(params.amount.toString())

  if (amount <= 0) {
    throw new Error("Lock amount must be positive")
  }

  return prisma.$transaction(async (tx) => {
    const balance = await getOrCreateBalance(
      tx,
      params.userAddress,
      params.token,
      params.chain
    )

    if (parseFloat(balance.available.toString()) < amount) {
      throw new Error(
        `Insufficient available balance for lock: available=${balance.available}, required=${amount}`
      )
    }

    const newAvailable = parseFloat(balance.available.toString()) - amount
    const newLocked = parseFloat(balance.locked.toString()) + amount

    await tx.userBalance.update({
      where: {
        user_address_token_chain: {
          user_address: params.userAddress,
          token: params.token,
          chain: params.chain,
        },
        version: balance.version,
      },
      data: {
        available: newAvailable,
        locked: newLocked,
        version: { increment: 1 },
      },
    })

    // Record lock as ledger entry
    await tx.ledgerEntry.create({
      data: {
        idempotency_key: params.idempotencyKey,
        account_address: params.userAddress,
        entry_type: "DEBIT",
        category: "lock",
        amount,
        token: params.token,
        chain: params.chain,
        balance_before: parseFloat(balance.available.toString()),
        balance_after: newAvailable,
        reference_type: params.referenceType,
        reference_id: params.referenceId,
        description: "Balance locked for pending transaction",
      },
    })

    return {
      available: newAvailable.toString(),
      locked: newLocked.toString(),
    }
  })
}

/**
 * Unlock balance after a transaction completes or fails.
 * Moves funds from `locked` back to `available` (on failure)
 * or removes from `locked` and `total` (on success, already transferred).
 */
export async function unlockBalance(params: {
  userAddress: string
  amount: string | number
  token: string
  chain: string
  referenceType: string
  referenceId: string
  success: boolean // true = funds were spent, false = return to available
  idempotencyKey: string
}) {
  const prisma = getClient()
  const amount = parseFloat(params.amount.toString())

  return prisma.$transaction(async (tx) => {
    const balance = await getOrCreateBalance(
      tx,
      params.userAddress,
      params.token,
      params.chain
    )

    const currentLocked = parseFloat(balance.locked.toString())
    if (currentLocked < amount) {
      throw new Error(
        `Unlock amount exceeds locked balance: locked=${balance.locked}, unlock=${amount}`
      )
    }

    const newLocked = currentLocked - amount

    if (params.success) {
      // Funds were spent - remove from locked and total
      const newTotal = parseFloat(balance.total.toString()) - amount
      await tx.userBalance.update({
        where: {
          user_address_token_chain: {
            user_address: params.userAddress,
            token: params.token,
            chain: params.chain,
          },
          version: balance.version,
        },
        data: {
          locked: newLocked,
          total: newTotal,
          version: { increment: 1 },
        },
      })
    } else {
      // Transaction failed - return to available
      const newAvailable = parseFloat(balance.available.toString()) + amount
      await tx.userBalance.update({
        where: {
          user_address_token_chain: {
            user_address: params.userAddress,
            token: params.token,
            chain: params.chain,
          },
          version: balance.version,
        },
        data: {
          available: newAvailable,
          locked: newLocked,
          version: { increment: 1 },
        },
      })
    }

    // Record unlock as ledger entry
    await tx.ledgerEntry.create({
      data: {
        idempotency_key: params.idempotencyKey,
        account_address: params.userAddress,
        entry_type: "CREDIT",
        category: "unlock",
        amount,
        token: params.token,
        chain: params.chain,
        balance_before: parseFloat(balance.locked.toString()),
        balance_after: newLocked,
        reference_type: params.referenceType,
        reference_id: params.referenceId,
        description: params.success
          ? "Balance unlocked - transaction completed"
          : "Balance unlocked - transaction failed, returned to available",
      },
    })

    return { locked: newLocked.toString() }
  })
}

// ─── Query Operations ───────────────────────────────────────────────────────

/**
 * Get all balances for a user across all tokens and chains
 */
export async function getUserBalances(
  userAddress: string
): Promise<BalanceInfo[]> {
  const prisma = getClient()
  const balances = await prisma.userBalance.findMany({
    where: { user_address: userAddress },
    orderBy: [{ chain: "asc" }, { token: "asc" }],
  })

  return balances.map((b) => ({
    available: b.available.toString(),
    locked: b.locked.toString(),
    total: b.total.toString(),
    token: b.token,
    chain: b.chain,
  }))
}

/**
 * Get ledger entries for an account with pagination
 */
export async function getLedgerEntries(params: {
  accountAddress: string
  token?: string
  chain?: string
  category?: string
  limit?: number
  offset?: number
}) {
  const prisma = getClient()
  const where: Record<string, unknown> = {
    account_address: params.accountAddress,
  }
  if (params.token) where.token = params.token
  if (params.chain) where.chain = params.chain
  if (params.category) where.category = params.category

  const [entries, total] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
    }),
    prisma.ledgerEntry.count({ where }),
  ])

  return {
    entries: entries.map((e) => ({
      ...e,
      amount: e.amount.toString(),
      balance_before: e.balance_before.toString(),
      balance_after: e.balance_after.toString(),
    })),
    total,
  }
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

async function getOrCreateBalance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  userAddress: string,
  token: string,
  chain: string
) {
  let balance = await tx.userBalance.findUnique({
    where: {
      user_address_token_chain: {
        user_address: userAddress,
        token,
        chain,
      },
    },
  })

  if (!balance) {
    balance = await tx.userBalance.create({
      data: {
        user_address: userAddress,
        token,
        chain,
        available: 0,
        locked: 0,
        total: 0,
      },
    })
  }

  return balance
}

/**
 * Generate a unique idempotency key for internal operations
 */
export function generateIdempotencyKey(
  prefix: string,
  ...parts: string[]
): string {
  return `${prefix}:${parts.join(":")}:${randomUUID().slice(0, 8)}`
}
