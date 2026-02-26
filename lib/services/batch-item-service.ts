/**
 * Batch Item Service (批量支付明细)
 *
 * Tracks individual recipients within a batch payment.
 * Supports per-item status, retry logic, and fee tracking.
 */

import { getClient } from "@/lib/prisma"

// ─── Types ──────────────────────────────────────────────────────────────────

export type BatchItemStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "skipped"

export interface CreateBatchItemsParams {
  batchId: string
  items: Array<{
    recipient: string
    amount: string | number
    token: string
    chain: string
  }>
}

export interface UpdateBatchItemParams {
  batchId: string
  index: number
  status: BatchItemStatus
  txHash?: string
  errorMessage?: string
  gasUsed?: bigint
  energyUsed?: bigint
  feeAmount?: string | number
  ledgerEntryId?: string
}

// ─── Core Operations ────────────────────────────────────────────────────────

/**
 * Create all items for a batch payment
 */
export async function createBatchItems(params: CreateBatchItemsParams) {
  const prisma = getClient()

  const data = params.items.map((item, index) => ({
    batch_id: params.batchId,
    index,
    recipient: item.recipient,
    amount: parseFloat(item.amount.toString()),
    token: item.token,
    chain: item.chain,
    status: "pending" as const,
  }))

  await prisma.batchItem.createMany({ data })

  return { count: data.length }
}

/**
 * Update a single batch item's status
 */
export async function updateBatchItem(params: UpdateBatchItemParams) {
  const prisma = getClient()

  const updateData: Record<string, unknown> = {
    status: params.status,
  }

  if (params.txHash) updateData.tx_hash = params.txHash
  if (params.errorMessage) updateData.error_message = params.errorMessage
  if (params.gasUsed !== undefined) updateData.gas_used = params.gasUsed
  if (params.energyUsed !== undefined) updateData.energy_used = params.energyUsed
  if (params.feeAmount) {
    updateData.fee_amount = parseFloat(params.feeAmount.toString())
  }
  if (params.ledgerEntryId) updateData.ledger_entry_id = params.ledgerEntryId

  if (params.status === "completed" || params.status === "failed") {
    updateData.completed_at = new Date()
  }

  if (params.status === "failed") {
    updateData.retry_count = { increment: 1 }
  }

  return prisma.batchItem.update({
    where: {
      batch_id_index: {
        batch_id: params.batchId,
        index: params.index,
      },
    },
    data: updateData,
  })
}

/**
 * Get all items for a batch with summary statistics
 */
export async function getBatchItems(batchId: string) {
  const prisma = getClient()

  const items = await prisma.batchItem.findMany({
    where: { batch_id: batchId },
    orderBy: { index: "asc" },
  })

  const summary = {
    total: items.length,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
    totalAmount: 0,
    completedAmount: 0,
    totalFees: 0,
  }

  for (const item of items) {
    summary[item.status as keyof typeof summary] =
      (summary[item.status as keyof typeof summary] as number) + 1
    summary.totalAmount += parseFloat(item.amount.toString())
    if (item.status === "completed") {
      summary.completedAmount += parseFloat(item.amount.toString())
    }
    if (item.fee_amount) {
      summary.totalFees += parseFloat(item.fee_amount.toString())
    }
  }

  return {
    items: items.map((item) => ({
      ...item,
      amount: item.amount.toString(),
      fee_amount: item.fee_amount?.toString() ?? null,
      gas_used: item.gas_used?.toString() ?? null,
      energy_used: item.energy_used?.toString() ?? null,
    })),
    summary: {
      ...summary,
      totalAmount: summary.totalAmount.toString(),
      completedAmount: summary.completedAmount.toString(),
      totalFees: summary.totalFees.toString(),
    },
  }
}

/**
 * Get failed items that can be retried
 */
export async function getRetryableItems(batchId: string) {
  const prisma = getClient()

  // Get failed items where retry_count < max_retries
  const items = await prisma.batchItem.findMany({
    where: {
      batch_id: batchId,
      status: "failed",
    },
    orderBy: { index: "asc" },
  })

  return items.filter((item) => item.retry_count < item.max_retries)
}

/**
 * Retry all failed items in a batch
 */
export async function retryFailedItems(batchId: string) {
  const prisma = getClient()

  // Reset failed items that haven't exceeded max retries
  const result = await prisma.$executeRaw`
    UPDATE batch_items
    SET status = 'pending', error_message = NULL, completed_at = NULL
    WHERE batch_id = ${batchId}
      AND status = 'failed'
      AND retry_count < max_retries
  `

  return { resetCount: result }
}

/**
 * Mark item as processing (claim it for execution)
 */
export async function claimBatchItem(batchId: string, index: number) {
  const prisma = getClient()

  // Only claim if still pending (prevents double-processing)
  const result = await prisma.batchItem.updateMany({
    where: {
      batch_id: batchId,
      index,
      status: "pending",
    },
    data: {
      status: "processing",
    },
  })

  return result.count > 0
}
