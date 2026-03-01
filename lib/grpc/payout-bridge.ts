/**
 * Payout Bridge
 *
 * Bridges the existing TypeScript payment logic with the Go Payout Engine.
 * Provides a gradual migration path with feature flags.
 */

import { getPayoutEngineClient, isGoServicesEnabled, type BatchPayoutRequest, type BatchPayoutResponse } from "./client"
import { prisma } from "@/lib/prisma"

interface PaymentRecipient {
  address: string
  amount: string
  token: string
  chainId: number
  vendorName?: string
  vendorId?: string
}

interface BatchPaymentResult {
  batchId: string
  status: "pending" | "processing" | "completed" | "partial_failure" | "failed"
  totalRecipients: number
  successCount: number
  failureCount: number
  transactions: {
    address: string
    txHash: string
    status: "pending" | "confirmed" | "failed"
    error?: string
  }[]
}

/**
 * Submit batch payment - routes to Go service or TypeScript based on feature flag
 */
export async function submitBatchPayment(
  userId: string,
  senderAddress: string,
  recipients: PaymentRecipient[],
  options: {
    useMultisig?: boolean
    multisigWalletId?: string
    priority?: "low" | "medium" | "high" | "urgent"
  } = {},
): Promise<BatchPaymentResult> {
  const batchId = `batch_${Date.now()}_${(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 9) : require('crypto').randomBytes(5).toString('hex'))}`

  // Record batch in database
  await prisma.$executeRawUnsafe(
    `INSERT INTO batch_payments (id, user_id, sender_address, total_recipients, status, use_multisig, multisig_wallet_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    batchId,
    userId,
    senderAddress,
    recipients.length,
    "pending",
    options.useMultisig || false,
    options.multisigWalletId || null,
    new Date().toISOString(),
  )

  if (isGoServicesEnabled()) {
    return submitViaGoService(batchId, userId, senderAddress, recipients, options)
  } else {
    return submitViaTypeScript(batchId, userId, senderAddress, recipients, options)
  }
}

/**
 * Submit via Go Payout Engine
 */
async function submitViaGoService(
  batchId: string,
  userId: string,
  senderAddress: string,
  recipients: PaymentRecipient[],
  options: {
    useMultisig?: boolean
    multisigWalletId?: string
    priority?: "low" | "medium" | "high" | "urgent"
  },
): Promise<BatchPaymentResult> {
  const client = getPayoutEngineClient()

  const request: BatchPayoutRequest = {
    batchId,
    userId,
    senderAddress,
    recipients: recipients.map((r) => ({
      address: r.address,
      amount: r.amount,
      tokenAddress: r.token,
      chainId: r.chainId,
      vendorName: r.vendorName,
      vendorId: r.vendorId,
    })),
    useMultisig: options.useMultisig || false,
    multisigWalletId: options.multisigWalletId,
    priority: (options.priority?.toUpperCase() || "MEDIUM") as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  }

  const response = await client.submitBatchPayout(request)

  return mapGoResponseToResult(response)
}

/**
 * Submit via TypeScript — uses BatchOrchestratorService for real on-chain execution.
 * Falls back to record-only mode if no executor private key is configured.
 */
async function submitViaTypeScript(
  batchId: string,
  userId: string,
  senderAddress: string,
  recipients: PaymentRecipient[],
  options: {
    useMultisig?: boolean
    multisigWalletId?: string
    priority?: "low" | "medium" | "high" | "urgent"
  },
): Promise<BatchPaymentResult> {
  const executorKey = process.env.AGENT_EXECUTOR_PRIVATE_KEY
  if (!executorKey) {
    // No executor key — create pending records only
    console.warn('[PayoutBridge] No AGENT_EXECUTOR_PRIVATE_KEY, creating pending records')
    return {
      batchId,
      status: "pending",
      totalRecipients: recipients.length,
      successCount: 0,
      failureCount: 0,
      transactions: recipients.map((r) => ({
        address: r.address,
        txHash: "",
        status: "pending" as const,
      })),
    }
  }

  // Use BatchOrchestratorService for real on-chain execution
  const { batchOrchestratorService } = await import("@/lib/services/batch-orchestrator-service")

  const result = await batchOrchestratorService.submitBatch({
    privateKey: executorKey as `0x${string}`,
    ownerAddress: senderAddress as `0x${string}`,
    payments: recipients.map((r) => ({
      to: r.address as `0x${string}`,
      amount: r.amount,
      token: r.token,
      chainId: r.chainId,
      memo: r.vendorName,
    })),
    strategy: 'concurrent',
    maxConcurrency: 5,
    retryOnFailure: true,
    maxRetries: 3,
  })

  return {
    batchId: result.batchId,
    status: result.status,
    totalRecipients: result.totalCount,
    successCount: result.successCount,
    failureCount: result.failureCount,
    transactions: result.transactions.map((tx) => ({
      address: tx.to,
      txHash: tx.txHash,
      status: tx.status === 'confirmed' ? 'confirmed' : 'failed',
      error: tx.error,
    })),
  }
}

/**
 * Get batch payment status
 */
export async function getBatchPaymentStatus(batchId: string, userId: string): Promise<BatchPaymentResult | null> {
  if (isGoServicesEnabled()) {
    const client = getPayoutEngineClient()
    try {
      const response = await client.getBatchStatus({ batchId, userId })
      return mapGoResponseToResult(response)
    } catch (error) {
      console.error("[PayoutBridge] Failed to get status from Go service:", error)
    }
  }

  // Fallback: read from database
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT bp.*, json_agg(bpi.*) as items
     FROM batch_payments bp
     LEFT JOIN batch_payment_items bpi ON bpi.batch_payment_id = bp.id
     WHERE bp.id = $1 AND bp.user_id = $2
     GROUP BY bp.id`,
    batchId,
    userId,
  )

  if (!rows || rows.length === 0) return null

  const data = rows[0]

  return {
    batchId: data.id,
    status: data.status,
    totalRecipients: data.total_recipients,
    successCount: data.success_count || 0,
    failureCount: data.failure_count || 0,
    transactions: (data.items?.[0] ? data.items : []).map((item: any) => ({
      address: item.recipient_address,
      txHash: item.tx_hash || "",
      status: item.status,
      error: item.error_message,
    })),
  }
}

/**
 * Cancel batch payment
 */
export async function cancelBatchPayment(
  batchId: string,
  userId: string,
): Promise<{ success: boolean; message: string }> {
  if (isGoServicesEnabled()) {
    const client = getPayoutEngineClient()
    return client.cancelBatch(batchId, userId)
  }

  // TypeScript fallback: just update database status
  const result = await prisma.$executeRawUnsafe(
    `UPDATE batch_payments SET status = $1, cancelled_at = $2
     WHERE id = $3 AND user_id = $4 AND status = $5`,
    "cancelled",
    new Date().toISOString(),
    batchId,
    userId,
    "pending",
  )

  if (result === 0) {
    return { success: false, message: "Cannot cancel batch that is already processing" }
  }

  return { success: true, message: "Batch cancelled successfully" }
}

/**
 * Estimate gas for batch payment
 */
export async function estimateBatchGas(
  userId: string,
  senderAddress: string,
  recipients: PaymentRecipient[],
): Promise<{
  totalGasEstimate: string
  gasPrice: string
  totalCostWei: string
  totalCostUsd: number
}> {
  if (isGoServicesEnabled()) {
    const client = getPayoutEngineClient()
    return client.estimateGas({
      batchId: "estimate",
      userId,
      senderAddress,
      recipients: recipients.map((r) => ({
        address: r.address,
        amount: r.amount,
        tokenAddress: r.token,
        chainId: r.chainId,
      })),
      useMultisig: false,
      priority: "MEDIUM",
    })
  }

  // TypeScript fallback: rough estimate
  const gasPerTransfer = 65000n
  const totalGas = gasPerTransfer * BigInt(recipients.length)
  const gasPrice = 30000000000n // 30 gwei

  return {
    totalGasEstimate: totalGas.toString(),
    gasPrice: gasPrice.toString(),
    totalCostWei: (totalGas * gasPrice).toString(),
    totalCostUsd: Number((totalGas * gasPrice) / 10n ** 18n) * 2000, // Rough ETH price
  }
}

// Helper to map Go response to our result type
function mapGoResponseToResult(response: BatchPayoutResponse): BatchPaymentResult {
  return {
    batchId: response.batchId,
    status: response.status.toLowerCase() as BatchPaymentResult["status"],
    totalRecipients: response.totalRecipients,
    successCount: response.successCount,
    failureCount: response.failureCount,
    transactions: response.transactions.map((tx) => ({
      address: tx.recipientAddress,
      txHash: tx.txHash,
      status: tx.status.toLowerCase() as "pending" | "confirmed" | "failed",
      error: tx.errorMessage,
    })),
  }
}
