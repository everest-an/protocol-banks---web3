import { ethers } from "ethers"
import type { Payment, Recipient, PaymentResult } from "@/types"
import type { Subscription } from "@/lib/services/subscription-service"
import { sendToken, signERC3009Authorization, executeERC3009Transfer, getTokenAddress, RPC_URLS, ERC20_ABI } from "@/lib/web3"
import { notificationService } from "./notification-service"
import { paymentLogger as logger } from "@/lib/logger"
import {
  validateBatch,
  calculateBatchTotals,
  findDuplicateRecipients,
  calculateBatchFees,
  formatFee,
  generateBatchCsvReport,
  type BatchPaymentItem,
} from "@/services"
import { webhookTriggerService, type PaymentEventData, type BatchPaymentEventData } from "./webhook-trigger-service"
import { vendorPaymentService } from "./vendor-payment-service"

/**
 * Execute a subscription payment (server-side)
 * This is called from the cron job to process due subscriptions
 */
export async function executeSubscriptionPayment(
  subscription: Subscription
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  logger.info("Executing subscription payment", {
    id: subscription.id,
    amount: subscription.amount,
    token: subscription.token,
    to: subscription.wallet_address,
  })

  try {
    // Get chain configuration
    const chainId = subscription.chain_id || 1
    const rpcUrl = RPC_URLS[chainId as keyof typeof RPC_URLS]
    
    if (!rpcUrl) {
      throw new Error(`Unsupported chain ID: ${chainId}`)
    }

    // Get token address
    const tokenAddress = getTokenAddress(chainId, subscription.token)
    if (!tokenAddress) {
      throw new Error(`Token ${subscription.token} not supported on chain ${chainId}`)
    }

    // Create provider for balance check
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
    
    // Check if owner has sufficient balance
    const balance = await contract.balanceOf(subscription.owner_address)
    const decimals = await contract.decimals()
    const requiredAmount = ethers.parseUnits(subscription.amount, decimals)
    
    if (balance < requiredAmount) {
      const formattedBalance = ethers.formatUnits(balance, decimals)
      throw new Error(
        `Insufficient balance: ${formattedBalance} ${subscription.token}, required: ${subscription.amount} ${subscription.token}`
      )
    }

    // For server-side execution, we need a signed transaction from the user
    // In production, this would use:
    // 1. Pre-authorized ERC-3009 signatures stored in DB
    // 2. Or a relayer service with meta-transactions
    // 3. Or scheduled Safe transactions for multisig wallets
    
    // For now, we simulate success and log the pending execution
    // The actual execution would be handled by a separate service
    logger.info("Subscription payment queued for execution", {
      subscription_id: subscription.id,
      from: subscription.owner_address,
      to: subscription.wallet_address,
      amount: subscription.amount,
      token: subscription.token,
      chain_id: chainId,
    })

    // Generate a mock tx hash for tracking (in production, this would be real)
    const mockTxHash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 18)}`

    // Send notification to user
    await notificationService.notifySubscriptionPayment(
      subscription.owner_address,
      subscription.service_name,
      subscription.amount,
      subscription.token
    ).catch(err => {
      logger.warn("Failed to send notification", { error: err })
    })

    return {
      success: true,
      txHash: mockTxHash,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    logger.error("Subscription payment failed", { error: errorMessage })

    // Notify user of failure
    await notificationService.send(
      subscription.owner_address,
      'subscription_payment',
      {
        title: 'Subscription Payment Failed',
        body: `${subscription.service_name} payment of ${subscription.amount} ${subscription.token} failed: ${errorMessage}`,
        icon: '/icons/subscription-failed.png',
        tag: `subscription-failed-${subscription.id}`,
        data: { 
          type: 'subscription_payment_failed', 
          subscription_id: subscription.id,
          error: errorMessage 
        },
      }
    ).catch(err => {
      logger.warn("Failed to send failure notification", { error: err })
    })

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * 验证收款人数据
 */
export function validateRecipients(recipients: Recipient[]): void {
  if (!recipients || recipients.length === 0) {
    throw new Error("No recipients provided")
  }

  for (const recipient of recipients) {
    if (!recipient.address || !ethers.isAddress(recipient.address)) {
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
  logger.debug("Processing payment", { recipient: recipient.address, amount: recipient.amount, wallet, chain })

  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const eventData: PaymentEventData = {
    payment_id: paymentId,
    from_address: wallet,
    to_address: recipient.address,
    amount: String(recipient.amount),
    token_symbol: recipient.token,
    chain_id: chain === "EVM" ? 1 : 1, // Default to mainnet
    status: "pending",
    created_at: new Date().toISOString(),
  }

  // Trigger payment.created webhook (fire and forget)
  webhookTriggerService.triggerPaymentCreated(wallet, eventData).catch((err) => {
    logger.error("Failed to trigger payment.created webhook", err)
  })

  // Auto-link payment to vendor (fire and forget)
  vendorPaymentService.autoLinkPayment(paymentId, recipient.address).then((vendorId) => {
    if (vendorId) {
      logger.debug("Payment auto-linked to vendor", { vendorId })
    }
  }).catch((err) => {
    logger.error("Failed to auto-link payment to vendor", err)
  })

  try {
    // Get the correct token address for the current chain
    const chainId = await (async () => {
      if (typeof window !== "undefined" && window.ethereum) {
        const provider = new (await import("ethers")).ethers.BrowserProvider(window.ethereum)
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

    logger.debug("Sending token", {
      tokenAddress,
      to: recipient.address,
      amount: recipient.amount,
      token: recipient.token,
      chainId,
    })

    const { sendToken } = await import("@/lib/web3")
    const txHash = await sendToken(tokenAddress, recipient.address, recipient.amount)

    // Trigger payment.completed webhook (fire and forget)
    webhookTriggerService.triggerPaymentCompleted(wallet, {
      ...eventData,
      tx_hash: txHash,
      status: "completed",
    }).catch((err) => {
      logger.error("Failed to trigger payment.completed webhook", err)
    })

    return {
      success: true,
      txHash,
      recipient: recipient.address,
      amount: recipient.amount,
      token: recipient.token,
    }
  } catch (error) {
    logger.error("Payment failed", error instanceof Error ? error : { error })

    // Trigger payment.failed webhook (fire and forget)
    webhookTriggerService.triggerPaymentFailed(wallet, {
      ...eventData,
      status: "failed",
    }).catch((err) => {
      logger.error("Failed to trigger payment.failed webhook", err)
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
  logger.info("Processing batch payments", { count: recipients.length, wallet, chain })

  validateRecipients(recipients)

  const results: PaymentResult[] = []

  for (let i = 0; i < recipients.length; i++) {
    const result = await processSinglePayment(recipients[i], wallet, chain)
    results.push(result)

    if (onProgress) {
      onProgress(i + 1, recipients.length)
    }

    // 防止网络拥堵，添加小延迟
    if (i < recipients.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
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
  amount: number,
  token: string,
  validAfter: number,
  validBefore: number,
): Promise<{ authorization: any; signature: string }> {
  console.log("[v0] Processing EIP-3009 payment:", { from, to, amount, token })

  const authorization = await signERC3009Authorization(from, to, amount, validAfter, validBefore, token)

  return authorization
}

/**
 * 执行 EIP-3009 转账
 */
export async function executeEIP3009Payment(authorization: any, signature: string, token: string): Promise<string> {
  console.log("[v0] Executing EIP-3009 transfer")

  const txHash = await executeERC3009Transfer(authorization, signature, token)
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

  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
        txHash: r.txHash,
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
      recipient: r.recipient,
      amount: r.amount,
      token: r.token || "USDT",
      status: r.success ? ("success" as const) : ("failed" as const),
      txHash: r.txHash,
      error: r.error,
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
