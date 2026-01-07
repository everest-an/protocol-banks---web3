/**
 * Payout Bridge
 *
 * Bridges the existing TypeScript payment logic with the Go Payout Engine.
 * Provides a gradual migration path with feature flags.
 */

import { getPayoutEngineClient, isGoServicesEnabled, type BatchPayoutRequest, type BatchPayoutResponse } from "./client"
import { createClient } from "@/lib/supabase/client"

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
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Record batch in database
  const supabase = createClient()
  await supabase.from("batch_payments").insert({
    id: batchId,
    user_id: userId,
    sender_address: senderAddress,
    total_recipients: recipients.length,
    status: "pending",
    use_multisig: options.useMultisig || false,
    multisig_wallet_id: options.multisigWalletId,
    created_at: new Date().toISOString(),
  })

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
 * Submit via TypeScript (existing implementation)
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
  // Import existing payment service
  const { PaymentService } = await import("@/lib/services/payment-service")
  const paymentService = new PaymentService()

  // Use existing TypeScript implementation
  const result = await paymentService.processBatchPayments(
    recipients.map((r) => ({
      address: r.address,
      amount: r.amount,
      token: r.token,
    })),
    {
      chainId: recipients[0]?.chainId || 1,
      batchId,
    },
  )

  return {
    batchId,
    status: result.failed > 0 ? "partial_failure" : "completed",
    totalRecipients: recipients.length,
    successCount: result.successful,
    failureCount: result.failed,
    transactions: result.results.map((r: any) => ({
      address: r.address,
      txHash: r.txHash || "",
      status: r.success ? "confirmed" : "failed",
      error: r.error,
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
  const supabase = createClient()
  const { data, error } = await supabase
    .from("batch_payments")
    .select("*, batch_payment_items(*)")
    .eq("id", batchId)
    .eq("user_id", userId)
    .single()

  if (error || !data) return null

  return {
    batchId: data.id,
    status: data.status,
    totalRecipients: data.total_recipients,
    successCount: data.success_count || 0,
    failureCount: data.failure_count || 0,
    transactions: (data.batch_payment_items || []).map((item: any) => ({
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
  const supabase = createClient()
  const { error } = await supabase
    .from("batch_payments")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", batchId)
    .eq("user_id", userId)
    .eq("status", "pending")

  if (error) {
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
