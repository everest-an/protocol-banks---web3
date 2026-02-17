/**
 * Settlement & Reconciliation Service (清算对账)
 *
 * Periodically reconciles on-chain balances with internal ledger.
 * Generates settlement records and flags discrepancies.
 */

import { getClient } from "@/lib/prisma"
import { Decimal } from "@prisma/client/runtime/library"

// ─── Types ──────────────────────────────────────────────────────────────────

export type SettlementStatus =
  | "pending"
  | "processing"
  | "reconciled"
  | "discrepancy_found"
  | "resolved"

export interface CreateSettlementParams {
  userAddress: string
  periodStart: Date
  periodEnd: Date
  token: string
  chain: string
  onChainBalance?: string | number
}

export interface ReconciliationResult {
  settlementId: string
  status: SettlementStatus
  totalDebits: string
  totalCredits: string
  netAmount: string
  onChainBalance?: string
  ledgerBalance?: string
  discrepancy?: string
}

// ─── Core Operations ────────────────────────────────────────────────────────

/**
 * Create a settlement record for a given period.
 * Aggregates all ledger entries in the period and compares with on-chain balance.
 */
export async function createSettlement(
  params: CreateSettlementParams
): Promise<ReconciliationResult> {
  const prisma = getClient()

  // 1. Aggregate ledger entries for this period
  const debits = await prisma.ledgerEntry.aggregate({
    where: {
      account_address: params.userAddress,
      token: params.token,
      chain: params.chain,
      entry_type: "DEBIT",
      created_at: {
        gte: params.periodStart,
        lt: params.periodEnd,
      },
    },
    _sum: { amount: true },
    _count: true,
  })

  const credits = await prisma.ledgerEntry.aggregate({
    where: {
      account_address: params.userAddress,
      token: params.token,
      chain: params.chain,
      entry_type: "CREDIT",
      created_at: {
        gte: params.periodStart,
        lt: params.periodEnd,
      },
    },
    _sum: { amount: true },
    _count: true,
  })

  const totalDebits = debits._sum.amount ?? new Decimal(0)
  const totalCredits = credits._sum.amount ?? new Decimal(0)
  const netAmount = new Decimal(totalCredits.toString()).minus(
    totalDebits.toString()
  )
  const entryCount = (debits._count ?? 0) + (credits._count ?? 0)

  // 2. Get current ledger balance
  const userBalance = await prisma.userBalance.findUnique({
    where: {
      user_address_token_chain: {
        user_address: params.userAddress,
        token: params.token,
        chain: params.chain,
      },
    },
  })

  const ledgerBalance = userBalance
    ? new Decimal(userBalance.total.toString())
    : new Decimal(0)

  // 3. Calculate discrepancy if on-chain balance provided
  let discrepancy: Decimal | null = null
  let status: SettlementStatus = "pending"

  if (params.onChainBalance !== undefined) {
    const onChain = new Decimal(params.onChainBalance.toString())
    discrepancy = onChain.minus(ledgerBalance)

    // Tolerance: allow up to 0.000001 difference (rounding)
    const tolerance = new Decimal("0.000001")
    if (discrepancy.abs().lte(tolerance)) {
      status = "reconciled"
      discrepancy = new Decimal(0)
    } else {
      status = "discrepancy_found"
    }
  }

  // 4. Generate settlement ID
  const dateStr = params.periodStart.toISOString().slice(0, 10).replace(/-/g, "")
  const count = await prisma.settlementRecord.count({
    where: {
      user_address: params.userAddress,
      period_start: params.periodStart,
    },
  })
  const settlementId = `STL-${dateStr}-${(count + 1).toString().padStart(3, "0")}`

  // 5. Create settlement record
  const record = await prisma.settlementRecord.create({
    data: {
      settlement_id: settlementId,
      user_address: params.userAddress,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      token: params.token,
      chain: params.chain,
      total_debits: totalDebits,
      total_credits: totalCredits,
      net_amount: netAmount,
      on_chain_balance: params.onChainBalance
        ? new Decimal(params.onChainBalance.toString())
        : null,
      ledger_balance: ledgerBalance,
      discrepancy,
      entry_count: entryCount,
      status,
      completed_at: status === "reconciled" ? new Date() : null,
    },
  })

  return {
    settlementId: record.settlement_id,
    status: record.status as SettlementStatus,
    totalDebits: totalDebits.toString(),
    totalCredits: totalCredits.toString(),
    netAmount: netAmount.toString(),
    onChainBalance: params.onChainBalance?.toString(),
    ledgerBalance: ledgerBalance.toString(),
    discrepancy: discrepancy?.toString(),
  }
}

/**
 * Resolve a discrepancy manually
 */
export async function resolveDiscrepancy(
  settlementId: string,
  resolvedBy: string,
  notes: string
) {
  const prisma = getClient()

  return prisma.settlementRecord.update({
    where: { settlement_id: settlementId },
    data: {
      status: "resolved",
      resolved_by: resolvedBy,
      resolution_notes: notes,
      completed_at: new Date(),
    },
  })
}

/**
 * List settlement records with optional filters
 */
export async function listSettlements(params: {
  userAddress?: string
  status?: SettlementStatus
  token?: string
  chain?: string
  limit?: number
  offset?: number
}) {
  const prisma = getClient()
  const where: Record<string, unknown> = {}

  if (params.userAddress) where.user_address = params.userAddress
  if (params.status) where.status = params.status
  if (params.token) where.token = params.token
  if (params.chain) where.chain = params.chain

  const [records, total] = await Promise.all([
    prisma.settlementRecord.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: params.limit ?? 20,
      skip: params.offset ?? 0,
    }),
    prisma.settlementRecord.count({ where }),
  ])

  return {
    records: records.map((r) => ({
      ...r,
      total_debits: r.total_debits.toString(),
      total_credits: r.total_credits.toString(),
      net_amount: r.net_amount.toString(),
      on_chain_balance: r.on_chain_balance?.toString() ?? null,
      ledger_balance: r.ledger_balance?.toString() ?? null,
      discrepancy: r.discrepancy?.toString() ?? null,
    })),
    total,
  }
}

/**
 * Get settlements with discrepancies (for alerting/monitoring)
 */
export async function getDiscrepancies() {
  const prisma = getClient()

  return prisma.settlementRecord.findMany({
    where: {
      status: "discrepancy_found",
    },
    orderBy: { created_at: "desc" },
  })
}
