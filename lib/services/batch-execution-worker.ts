/**
 * Batch Execution Worker (并发执行引擎)
 *
 * Processes BatchItem records concurrently using configurable concurrency.
 * When Redis is available, uses BullMQ for distributed queue processing.
 * Falls back to in-process concurrent execution otherwise.
 *
 * Features:
 * - Configurable concurrency per chain (EVM: 10, TRON: 3)
 * - Claim-based processing (prevents double-execution)
 * - Per-item status tracking with retry
 * - Ledger entry creation on completion
 */

import { getClient } from "@/lib/prisma"
import { claimBatchItem, updateBatchItem } from "@/lib/services/batch-item-service"
import { recordTransfer, generateIdempotencyKey } from "@/lib/services/ledger-service"
import { goServicesBridge, type PayoutRequest } from "@/lib/services/go-services-bridge"

/** Signed EIP-3009 authorization, produced by the payer's wallet. */
type PayoutAuthorization = NonNullable<PayoutRequest["authorization"]>

// ─── Configuration ──────────────────────────────────────────────────────────

const CONCURRENCY: Record<string, number> = {
  EVM: 10,
  TRON: 3,
  DEFAULT: 5,
}

// Chain name → EVM chain ID mapping.
//
// Keep this aligned with lib/networks.ts (the app supports testnets there); a
// name missing here used to fall through to mainnet.
export const CHAIN_ID_BY_NAME: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  bsc: 56,
  sepolia: 11155111,
  tron: 728126428,
}

// Delay between items on the same chain (ms) to avoid nonce conflicts
const CHAIN_DELAY: Record<string, number> = {
  tron: 3000,
  ethereum: 1000,
  DEFAULT: 1000,
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BatchExecutionResult {
  batchId: string
  totalItems: number
  completed: number
  failed: number
  skipped: number
  /** Items settled through an EIP-3009 authorization (funds left the signer's own balance). */
  nonCustodial: number
  duration_ms: number
}

interface ExecutableItem {
  batchId: string
  index: number
  recipient: string
  amount: string
  token: string
  chain: string
  /** Present when the payer signed an EIP-3009 authorization for this item. */
  authorization?: PayoutAuthorization
}

// ─── Core Execution ─────────────────────────────────────────────────────────

/**
 * Execute all pending items in a batch with controlled concurrency.
 * This is the main entry point called by the cron/API.
 */
export async function executeBatch(
  batchId: string,
  fromAddress: string,
  networkType: string = "EVM",
  /**
   * Signed EIP-3009 authorizations keyed by item index. An item with an
   * authorization settles from the signer's own balance — the relayer only
   * submits it and pays gas. An item without one uses the legacy relayer-funded
   * path.
   */
  authorizations: Record<number, PayoutAuthorization> = {}
): Promise<BatchExecutionResult> {
  const prisma = getClient()
  const start = Date.now()

  // Get all pending items for this batch
  const pendingItems = await prisma.batchItem.findMany({
    where: {
      batch_id: batchId,
      status: "pending",
    },
    orderBy: { index: "asc" },
  })

  if (pendingItems.length === 0) {
    return {
      batchId,
      totalItems: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      nonCustodial: 0,
      duration_ms: Date.now() - start,
    }
  }

  // Update batch status to processing
  await prisma.batchPayment.update({
    where: { batch_id: batchId },
    data: { status: "processing" },
  })

  const concurrency = CONCURRENCY[networkType] ?? CONCURRENCY.DEFAULT
  let completed = 0
  let failed = 0
  let skipped = 0
  let nonCustodial = 0

  // Process items in concurrent batches
  const items: ExecutableItem[] = pendingItems.map((item) => ({
    batchId: item.batch_id,
    index: item.index,
    recipient: item.recipient,
    amount: item.amount.toString(),
    token: item.token,
    chain: item.chain,
    authorization: authorizations[item.index],
  }))

  // Chunk items for concurrent processing
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)

    const results = await Promise.allSettled(
      chunk.map((item) => processItem(item, fromAddress))
    )

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value === "completed" || result.value === "completed-eip3009") {
          completed++
          if (result.value === "completed-eip3009") nonCustodial++
        } else if (result.value === "failed") failed++
        else skipped++
      } else {
        failed++
      }
    }

    // Delay between chunks to avoid rate limiting
    const chainDelay = CHAIN_DELAY[items[0]?.chain] ?? CHAIN_DELAY.DEFAULT
    if (i + concurrency < items.length) {
      await new Promise((resolve) => setTimeout(resolve, chainDelay))
    }
  }

  // Update batch status based on results
  const finalStatus =
    failed > 0 && completed === 0
      ? "failed"
      : failed > 0
        ? "partial"
        : "completed"

  await prisma.batchPayment.update({
    where: { batch_id: batchId },
    data: {
      status: finalStatus,
      executed_at: new Date(),
    },
  })

  return {
    batchId,
    totalItems: items.length,
    completed,
    failed,
    skipped,
    nonCustodial,
    duration_ms: Date.now() - start,
  }
}

/**
 * Process a single batch item: claim → execute → update status
 */
async function processItem(
  item: ExecutableItem,
  fromAddress: string
): Promise<"completed" | "completed-eip3009" | "failed" | "skipped"> {
  // Claim the item (atomic, prevents double-processing)
  const claimed = await claimBatchItem(item.batchId, item.index)
  if (!claimed) {
    return "skipped" // Already claimed by another worker
  }

  try {
    // Execute the payment via Go payout-engine (or TypeScript fallback)
    //
    // Never default to mainnet. `?? 1` silently sent every unrecognised chain
    // name — testnets included — to Ethereum mainnet, where the relayer would
    // have moved real funds. An unknown chain now fails the item instead.
    const chainId = CHAIN_ID_BY_NAME[item.chain.toLowerCase()]
    if (chainId === undefined) {
      throw new Error(`Unsupported chain "${item.chain}" — refusing to execute on a default network`)
    }
    const payout = await goServicesBridge.executePayout({
      from_address: fromAddress,
      to_address: item.recipient,
      amount: item.amount,
      token: item.token,
      chain_id: chainId,
      memo: `Batch ${item.batchId} item #${item.index}`,
      authorization: item.authorization,
    })

    if (!payout.success) {
      throw new Error(payout.error || 'Payout execution failed')
    }

    // Record payment with the real on-chain tx_hash
    const prisma = getClient()
    const payment = await prisma.payment.create({
      data: {
        from_address: fromAddress,
        to_address: item.recipient,
        amount: item.amount,
        token: item.token,
        chain: item.chain,
        network_type: item.chain === "tron" ? "TRON" : "EVM",
        status: "completed",
        type: "sent",
        method: "batch",
        tx_hash: payout.tx_hash,
        memo: `Batch ${item.batchId} item #${item.index}`,
      },
    })

    // Record ledger entry
    try {
      await recordTransfer({
        idempotencyKey: generateIdempotencyKey("batch", item.batchId, String(item.index)),
        fromAddress,
        toAddress: item.recipient,
        amount: item.amount,
        token: item.token,
        chain: item.chain,
        category: "payment",
        referenceType: "batch_payment",
        referenceId: item.batchId,
        description: `Batch payment item #${item.index} to ${item.recipient}`,
      })
    } catch {
      // Ledger failure is non-fatal
    }

    // Update batch item as completed
    await updateBatchItem({
      batchId: item.batchId,
      index: item.index,
      status: "completed",
      txHash: payment.tx_hash ?? undefined,
    })

    return item.authorization ? "completed-eip3009" : "completed"
  } catch (error: any) {
    // Update batch item as failed
    await updateBatchItem({
      batchId: item.batchId,
      index: item.index,
      status: "failed",
      errorMessage: error.message || "Unknown error",
    })

    return "failed"
  }
}
