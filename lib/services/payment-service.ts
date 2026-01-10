import { ethers } from "ethers"
import type { Payment, Recipient, PaymentResult } from "@/types"
import { sendToken, signERC3009Authorization, executeERC3009Transfer } from "@/lib/web3"

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
  console.log("[v0] Processing payment:", { recipient, wallet, chain })

  try {
    const txHash = await sendToken(wallet, recipient.address, recipient.amount, recipient.token, chain)

    return {
      success: true,
      txHash,
      recipient: recipient.address,
      amount: recipient.amount,
      token: recipient.token,
    }
  } catch (error) {
    console.error("[v0] Payment failed:", error)
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
): Promise<{ successCount: number; totalPaid: string; results: PaymentResult[] }> {
  console.log("[v0] processBatchPayment called:", { recipients: recipients.length, wallet, isDemoMode })

  if (isDemoMode) {
    // Demo mode - simulate success
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const total = recipients.reduce((sum, r) => sum + (r.amount || 0), 0)
    return {
      successCount: recipients.length,
      totalPaid: total.toFixed(2),
      results: recipients.map((r) => ({
        success: true,
        recipient: r.address,
        amount: r.amount,
        token: r.token,
        txHash: `0xdemo${Date.now()}`,
      })),
    }
  }

  // Real mode - process payments
  const results = await processBatchPayments(recipients, wallet, "EVM")

  const successCount = results.filter((r) => r.success).length
  const totalPaid = results.reduce((sum, r) => (r.success ? sum + r.amount : sum), 0).toFixed(2)

  return {
    successCount,
    totalPaid,
    results,
  }
}
