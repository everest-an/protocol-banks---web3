import { isEvmAddressFormat, detectAddressType, validateAddress } from "@/lib/address-utils"
import type { Payment, Recipient, PaymentResult } from "@/types"
import { sendToken, signERC3009Authorization, executeERC3009Transfer, getInjectedEthereum } from "@/lib/web3"
import {
  validateBatch,
  calculateBatchTotals,
  findDuplicateRecipients,
  type BatchPaymentItem,
} from "@/lib/services/batch-validator.service"
import {
  calculateBatchFees,
  formatFee,
} from "@/lib/services/fee-calculator.service"
import {
  generateBatchCsvReport,
} from "@/lib/services/report-generator.service"
import { webhookTriggerService, type PaymentEventData, type BatchPaymentEventData } from "./webhook-trigger-service"
import { processTronPayment, isValidTronAddress } from "./tron-payment"

// Lazy import to avoid bundling pg/prisma on client side
const getVendorPaymentService = () =>
  import("./vendor-payment-service").then((m) => m.vendorPaymentService)

/**
 * 验证收款人数据
 */
export function validateRecipients(recipients: Recipient[]): void {
  if (!recipients || recipients.length === 0) {
    throw new Error("No recipients provided")
  }

  for (const recipient of recipients) {
    // Validate address (supports both EVM and TRON)
    const addressValidation = validateAddress(recipient.address)
    if (!addressValidation.isValid) {
      throw new Error(`Invalid address: ${recipient.address}`)
    }

    if (!recipient.amount || recipient.amount <= 0) {
      throw new Error(`Invalid amount for ${recipient.address}`)
    }
    if (!recipient.token) {
      throw new Error(`Token not specified for ${recipient.address}`)
    }
  }
}

/**
 * 计算总支付金额
 */
export function calculateTotal(recipients: Recipient[]): number {
  return recipients.reduce((sum, r) => sum + (r.amount || 0), 0)
}

/**
 * 计算预估手续费
 */
export function estimateFees(recipients: Recipient[], gasPrice = 20): number {
  // 每笔交易约 21000 gas + ERC20 转账约 65000 gas
  const gasPerTx = 86000
  return (recipients.length * gasPerTx * gasPrice) / 1e9 // 返回 ETH
}

/**
 * 处理单笔支付
 */
export async function processSinglePayment(
  recipient: Recipient,
  wallet: string,
  chain: string,
): Promise<PaymentResult> {
  console.log("[v0] Processing payment:", { recipient, wallet, chain })

  const paymentId = `pay_${Date.now()}_${(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 9) : require('crypto').randomBytes(5).toString('hex'))}`

  // Detect address type (EVM or TRON)
  const addressType = detectAddressType(recipient.address)
  console.log("[v0] Detected address type:", addressType)

  const eventData: PaymentEventData = {
    payment_id: paymentId,
    from_address: wallet,
    to_address: recipient.address,
    amount: String(recipient.amount),
    token_symbol: recipient.token || "USDC",
    chain_id: chain === "EVM" ? 1 : 1, // Default to mainnet
    status: "pending",
    created_at: new Date().toISOString(),
  }

  // Trigger payment.created webhook (fire and forget)
  webhookTriggerService.triggerPaymentCreated(wallet, eventData).catch((err) => {
    console.error("[v0] Failed to trigger payment.created webhook:", err)
  })

  // Auto-link payment to vendor (fire and forget, lazy loaded to avoid prisma in client bundle)
  getVendorPaymentService().then((svc) =>
    svc.autoLinkPayment(paymentId, recipient.address).then((vendorId) => {
      if (vendorId) {
        console.log("[v0] Payment auto-linked to vendor:", vendorId)
      }
    })
  ).catch((err) => {
    console.error("[v0] Failed to auto-link payment to vendor:", err)
  })

  try {
    let txHash: string

    // Route to appropriate payment handler based on address type
    if (addressType === "TRON") {
      // TRON payment
      console.log("[v0] Processing TRON payment")
      const result = await processTronPayment(recipient, wallet)

      if (!result.success) {
        throw new Error(result.error || "TRON payment failed")
      }

      txHash = result.txHash!
    } else {
      // EVM payment
      console.log("[v0] Processing EVM payment")

      // Get the correct token address for the current chain
      const chainId = await (async () => {
        const ethereum = getInjectedEthereum()
        if (ethereum) {
          const provider = new (await import("ethers")).ethers.BrowserProvider(ethereum)
          const network = await provider.getNetwork()
          return Number(network.chainId)
        }
        return 1 // Default to mainnet
      })()

      const { getTokenAddress } = await import("@/lib/web3")
      const tokenAddress = getTokenAddress(chainId, recipient.token || "USDC")

      if (!tokenAddress) {
        throw new Error(`Token ${recipient.token} not supported on chain ${chainId}`)
      }

      console.log("[v0] Sending token:", {
        tokenAddress,
        to: recipient.address,
        amount: recipient.amount,
        token: recipient.token,
        chainId,
      })

      const { sendToken } = await import("@/lib/web3")
      txHash = await sendToken(tokenAddress, recipient.address, String(recipient.amount))
    }

    // Trigger payment.completed webhook (fire and forget)
    webhookTriggerService.triggerPaymentCompleted(wallet, {
      ...eventData,
      tx_hash: txHash,
      status: "completed",
    }).catch((err) => {
      console.error("[v0] Failed to trigger payment.completed webhook:", err)
    })

    return {
      success: true,
      txHash,
      recipient: recipient.address,
      amount: recipient.amount,
      token: recipient.token,
    }
  } catch (error) {
    console.error("[v0] Payment failed:", error)

    // Trigger payment.failed webhook (fire and forget)
    webhookTriggerService.triggerPaymentFailed(wallet, {
      ...eventData,
      status: "failed",
    }).catch((err) => {
      console.error("[v0] Failed to trigger payment.failed webhook:", err)
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      recipient: recipient.address,
      amount: recipient.amount,
      token: recipient.token,
    }
  }
}

/**
 * 处理批量支付
 */
export async function processBatchPayments(
  recipients: Recipient[],
  wallet: string,
  chain: string,
  onProgress?: (current: number, total: number) => void,
): Promise<PaymentResult[]> {
  console.log("[v0] Processing batch payments:", { count: recipients.length, wallet, chain })

  validateRecipients(recipients)

  // Validate all recipients are on the same network
  if (recipients.length > 0) {
    const firstAddressType = detectAddressType(recipients[0].address)
    const allSameNetwork = recipients.every((r) => detectAddressType(r.address) === firstAddressType)

    if (!allSameNetwork) {
      throw new Error(
        "All recipients must be on the same network. Cannot mix EVM and TRON addresses in a batch payment.",
      )
    }

    console.log("[v0] Batch payment network:", firstAddressType)
  }

  const results: PaymentResult[] = []

  for (let i = 0; i < recipients.length; i++) {
    const result = await processSinglePayment(recipients[i], wallet, chain)
    results.push(result)

    if (onProgress) {
      onProgress(i + 1, recipients.length)
    }

    // 防止网络拥堵，添加小延迟
    // TRON has 3s block time, EVM varies but 1-3s is safe
    const delayMs = detectAddressType(recipients[i].address) === "TRON" ? 3000 : 1000
    if (i < recipients.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return results
}

/**
 * 处理 EIP-3009 支付授权
 */
export async function processEIP3009Payment(
  from: string,
  to: string,
  amount: string,
  token: string,
  chainId: number,
): Promise<{ v: number; r: string; s: string; nonce: string; validAfter: number; validBefore: number }> {
  console.log("[v0] Processing EIP-3009 payment:", { from, to, amount, token })

  const authorization = await signERC3009Authorization(token, from, to, amount, chainId)

  return authorization
}

/**
 * 执行 EIP-3009 转账
 */
export async function executeEIP3009Payment(
  tokenAddress: string,
  from: string,
  to: string,
  amount: string,
  auth: { v: number; r: string; s: string; nonce: string; validAfter: number; validBefore: number },
): Promise<string> {
  console.log("[v0] Executing EIP-3009 transfer")

  const txHash = await executeERC3009Transfer(tokenAddress, from, to, amount, auth)
  return txHash
}

/**
 * 格式化支付数据用于显示
 */
export function formatPaymentForDisplay(payment: Payment) {
  return {
    ...payment,
    formattedAmount: `${payment.amount} ${payment.token}`,
    formattedDate: new Date(payment.created_at).toLocaleDateString(),
    statusBadge: payment.status === "completed" ? "success" : payment.status === "pending" ? "warning" : "error",
  }
}

/**
 * 验证支付数据（别名，用于向后兼容）
 */
export function validatePaymentData(recipients: Recipient[]): void {
  return validateRecipients(recipients)
}

/**
 * 处理批量支付（别名，用于向后兼容）
 */
export async function processBatchPayment(
  recipients: Recipient[],
  wallet: string,
  isDemoMode = false,
): Promise<{ successCount: number; totalPaid: string; results: PaymentResult[]; feeBreakdown?: any; report?: string }> {
  console.log("[v0] processBatchPayment called:", { recipients: recipients.length, wallet, isDemoMode })

  // Convert to BatchPaymentItem for validation
  const batchItems: BatchPaymentItem[] = recipients.map((r) => ({
    recipient: r.address,
    amount: r.amount,
    token: r.token,
  }))

  // Use new batch validation service
  const validationResult = validateBatch(batchItems)
  if (!validationResult.valid) {
    const errorMessages = validationResult.errors.map((e) => `Row ${e.row}: ${e.message}`).join("; ")
    throw new Error(`Validation failed: ${errorMessages}`)
  }

  // Check for duplicates
  const duplicates = findDuplicateRecipients(batchItems)
  if (duplicates.length > 0) {
    console.warn("[v0] Duplicate recipients found:", duplicates)
  }

  // Calculate fees using fee service
  const amounts = recipients.map((r) => r.amount || 0)
  const feeBreakdown = calculateBatchFees(amounts, "base")
  console.log("[v0] Fee breakdown:", {
    totalAmount: formatFee(feeBreakdown.totalAmount),
    totalFees: formatFee(feeBreakdown.totalFees),
    netAmount: formatFee(feeBreakdown.totalNetAmount),
  })

  const batchId = `batch_${Date.now()}_${(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 9) : require('crypto').randomBytes(5).toString('hex'))}`
  const total = Number(recipients.reduce((sum, r) => sum + (r.amount || 0), 0))
  const batchEventData: BatchPaymentEventData = {
    batch_id: batchId,
    from_address: wallet,
    total_amount: String(total),
    total_items: recipients.length,
    token: recipients[0]?.token || "USDT",
    chain_id: 1, // Default to mainnet
    status: "pending",
    created_at: new Date().toISOString(),
  }

  // Trigger batch_payment.created webhook (fire and forget)
  webhookTriggerService.triggerBatchPaymentCreated(wallet, batchEventData).catch((err) => {
    console.error("[v0] Failed to trigger batch_payment.created webhook:", err)
  })

  if (isDemoMode) {
    // Demo mode - simulate success
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const results = recipients.map((r) => ({
      success: true,
      recipient: r.address,
      amount: r.amount,
      token: r.token,
      txHash: `0xdemo${Date.now()}`,
    }))

    // Generate report
    const report = generateBatchCsvReport(
      results.map((r) => ({
        recipient: r.recipient,
        amount: r.amount,
        token: r.token || "USDT",
        status: "success" as const,
        transactionHash: r.txHash,
        timestamp: Date.now(),
      })),
    )

    // Trigger batch_payment.completed webhook (fire and forget)
    webhookTriggerService.triggerBatchPaymentCompleted(wallet, {
      ...batchEventData,
      status: "completed",
    }).catch((err) => {
      console.error("[v0] Failed to trigger batch_payment.completed webhook:", err)
    })

    return {
      successCount: recipients.length,
      totalPaid: total.toFixed(2),
      results,
      feeBreakdown,
      report,
    }
  }

  // Real mode - process payments
  const results = await processBatchPayments(recipients, wallet, "EVM")

  const successCount = results.filter((r) => r.success).length
  const totalPaid = Number(results.reduce((sum, r) => (r.success ? sum + Number(r.amount) : sum), 0)).toFixed(2)

  // Generate report
  const report = generateBatchCsvReport(
    results.map((r) => ({
      recipient: r.recipient || "",
      amount: r.amount ?? 0,
      token: r.token || "USDT",
      status: r.success ? ("success" as const) : ("failed" as const),
      transactionHash: r.txHash,
      error: r.error,
      timestamp: Date.now(),
    })),
  )

  // Trigger batch_payment.completed webhook (fire and forget)
  webhookTriggerService.triggerBatchPaymentCompleted(wallet, {
    ...batchEventData,
    status: successCount === recipients.length ? "completed" : "partial",
  }).catch((err) => {
    console.error("[v0] Failed to trigger batch_payment.completed webhook:", err)
  })

  return {
    successCount,
    totalPaid,
    results,
    feeBreakdown,
    report,
  }
}
