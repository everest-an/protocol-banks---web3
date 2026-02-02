/**
 * Split Payment Service
 * 分账服务 - 支持按百分比或固定金额分配支付
 */

import Big from "big.js"
import { ethers } from "ethers"
import type {
  SplitRecipient,
  SplitPaymentRequest,
  SplitPaymentResponse,
  SplitPaymentResult,
  SplitCalculation,
  SplitValidationResult,
  SplitValidationError,
  SplitValidationWarning,
  SplitPaymentOptions,
  SplitTemplate,
  SplitPaymentHistory,
  SplitFeeBreakdown,
  AllocationMethod,
  DEFAULT_SPLIT_OPTIONS,
} from "@/types/split-payment"
import { processBatchPayments, type BatchPaymentOptions } from "./payment-service"
import type { Recipient, PaymentResult } from "@/types/payment"

// ============================================
// Constants
// ============================================

/** 平台手续费率 (basis points, 1 bp = 0.01%) */
const PLATFORM_FEE_BPS = 30 // 0.3%

/** 最小支付金额 (USD) */
const MIN_PAYMENT_AMOUNT = 0.01

/** 百分比精度 */
const PERCENTAGE_PRECISION = 4

/** 金额精度 */
const AMOUNT_PRECISION = 6

// ============================================
// Split Payment Service
// ============================================

export class SplitPaymentService {
  /**
   * 验证分账请求
   */
  validate(request: SplitPaymentRequest): SplitValidationResult {
    const errors: SplitValidationError[] = []
    const warnings: SplitValidationWarning[] = []

    // 检查接收者列表
    if (!request.recipients || request.recipients.length === 0) {
      errors.push({
        type: "EMPTY_RECIPIENTS",
        message: "至少需要一个收款人",
      })
      return { valid: false, errors, warnings }
    }

    // 检查总金额
    if (!request.totalAmount || request.totalAmount <= 0) {
      errors.push({
        type: "INVALID_AMOUNT",
        message: "总金额必须大于 0",
      })
    }

    // 验证每个接收者
    const addressSet = new Set<string>()
    let totalAllocation = new Big(0)

    request.recipients.forEach((recipient, index) => {
      // 验证地址
      if (!recipient.address || !ethers.isAddress(recipient.address)) {
        errors.push({
          type: "INVALID_ADDRESS",
          message: `无效的钱包地址: ${recipient.address}`,
          index,
          address: recipient.address,
        })
      }

      // 检查重复地址
      const normalizedAddress = recipient.address?.toLowerCase()
      if (normalizedAddress && addressSet.has(normalizedAddress)) {
        errors.push({
          type: "DUPLICATE_RECIPIENT",
          message: `重复的收款人地址: ${recipient.address}`,
          index,
          address: recipient.address,
        })
      }
      addressSet.add(normalizedAddress)

      // 验证分配比例/金额
      if (recipient.allocation === undefined || recipient.allocation <= 0) {
        errors.push({
          type: "INVALID_ALLOCATION",
          message: `收款人 ${index + 1} 的分配值无效`,
          index,
        })
      } else {
        totalAllocation = totalAllocation.plus(recipient.allocation)
      }
    })

    // 百分比模式：检查总和是否为 100%
    if (request.method === "percentage" && errors.length === 0) {
      const diff = totalAllocation.minus(100).abs()
      if (diff.gt(0.01)) {
        errors.push({
          type: "TOTAL_MISMATCH",
          message: `百分比总和必须为 100%，当前为 ${totalAllocation.toFixed(2)}%`,
        })
      }
    }

    // 固定金额模式：检查总和是否等于总金额
    if (request.method === "fixed" && errors.length === 0) {
      const diff = totalAllocation.minus(request.totalAmount).abs()
      if (diff.gt(0.01)) {
        errors.push({
          type: "TOTAL_MISMATCH",
          message: `分配总额 (${totalAllocation.toFixed(2)}) 与总金额 (${request.totalAmount}) 不匹配`,
        })
      }
    }

    // 检查小额支付警告
    if (request.method === "percentage" && request.totalAmount) {
      request.recipients.forEach((recipient, index) => {
        const amount = new Big(request.totalAmount).times(recipient.allocation).div(100)
        if (amount.lt(MIN_PAYMENT_AMOUNT)) {
          warnings.push({
            type: "LOW_AMOUNT",
            message: `收款人 ${index + 1} 的金额过低 (${amount.toFixed(6)})，可能导致交易失败`,
            value: amount.toNumber(),
          })
        }
      })
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * 计算分账金额
   * 使用 Big.js 确保精确计算，避免浮点数精度问题
   */
  calculate(
    totalAmount: number,
    recipients: SplitRecipient[],
    method: AllocationMethod,
    options: SplitPaymentOptions = {}
  ): SplitCalculation {
    const opts = { ...DEFAULT_SPLIT_OPTIONS, ...options }
    const errors: string[] = []
    const warnings: string[] = []

    const total = new Big(totalAmount)
    let allocatedTotal = new Big(0)
    const calculatedRecipients: (SplitRecipient & { calculatedAmount: number })[] = []

    if (method === "percentage") {
      // 百分比模式：按比例计算金额
      recipients.forEach((recipient, index) => {
        const percentage = new Big(recipient.allocation)
        let amount = total.times(percentage).div(100)

        // 应用舍入模式
        if (opts.roundingMode === "floor") {
          amount = new Big(amount.toFixed(opts.precision, Big.roundDown))
        } else if (opts.roundingMode === "ceil") {
          amount = new Big(amount.toFixed(opts.precision, Big.roundUp))
        } else {
          amount = new Big(amount.toFixed(opts.precision, Big.roundHalfUp))
        }

        // 检查最小金额
        if (amount.lt(opts.minAmount)) {
          warnings.push(`收款人 ${index + 1} 的金额 (${amount.toFixed(opts.precision)}) 低于最小值 (${opts.minAmount})`)
        }

        allocatedTotal = allocatedTotal.plus(amount)
        calculatedRecipients.push({
          ...recipient,
          calculatedAmount: amount.toNumber(),
        })
      })

      // 处理舍入差额：将差额分配给最后一个接收者
      const diff = total.minus(allocatedTotal)
      if (!diff.eq(0) && calculatedRecipients.length > 0) {
        const lastRecipient = calculatedRecipients[calculatedRecipients.length - 1]
        lastRecipient.calculatedAmount = new Big(lastRecipient.calculatedAmount).plus(diff).toNumber()
        allocatedTotal = total

        if (diff.abs().gt(0.01)) {
          warnings.push(`舍入调整: ${diff.toFixed(opts.precision)} 分配给最后一个接收者`)
        }
      }
    } else {
      // 固定金额模式：直接使用指定金额
      recipients.forEach((recipient) => {
        const amount = new Big(recipient.allocation)
        allocatedTotal = allocatedTotal.plus(amount)
        calculatedRecipients.push({
          ...recipient,
          calculatedAmount: amount.toNumber(),
        })
      })
    }

    const roundingDifference = total.minus(allocatedTotal).toNumber()

    return {
      valid: errors.length === 0,
      recipients: calculatedRecipients,
      totalAmount: total.toNumber(),
      allocatedTotal: allocatedTotal.toNumber(),
      roundingDifference,
      errors,
      warnings,
    }
  }

  /**
   * 计算手续费明细
   */
  calculateFees(
    totalAmount: number,
    recipients: (SplitRecipient & { calculatedAmount: number })[],
    gasPrice: number = 20
  ): SplitFeeBreakdown {
    const total = new Big(totalAmount)
    const platformFeeRate = PLATFORM_FEE_BPS / 10000
    const platformFee = total.times(platformFeeRate)

    // 估算 Gas 费（每笔约 86000 gas）
    const gasPerTx = 86000
    const estimatedGasFee = (recipients.length * gasPerTx * gasPrice) / 1e9

    const perRecipientFees = recipients.map((r) => {
      const amount = new Big(r.calculatedAmount)
      const fee = amount.times(platformFeeRate)
      return {
        recipient: r.address,
        amount: r.calculatedAmount,
        fee: fee.toNumber(),
        netAmount: amount.minus(fee).toNumber(),
      }
    })

    return {
      totalAmount: total.toNumber(),
      platformFeeRate,
      platformFee: platformFee.toNumber(),
      estimatedGasFee,
      netAmount: total.minus(platformFee).toNumber(),
      perRecipientFees,
    }
  }

  /**
   * 执行分账支付
   */
  async execute(
    request: SplitPaymentRequest,
    wallet: string,
    options?: SplitPaymentOptions,
    onProgress?: (current: number, total: number) => void
  ): Promise<SplitPaymentResponse> {
    const splitId = `split_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startTime = Date.now()

    console.log("[SplitPayment] Starting split payment:", {
      id: splitId,
      totalAmount: request.totalAmount,
      recipients: request.recipients.length,
      method: request.method,
    })

    // 1. 验证请求
    const validation = this.validate(request)
    if (!validation.valid) {
      console.error("[SplitPayment] Validation failed:", validation.errors)
      return {
        id: splitId,
        status: "failed",
        totalAmount: request.totalAmount,
        paidAmount: 0,
        token: request.token,
        method: request.method,
        results: [],
        successCount: 0,
        failedCount: request.recipients.length,
        created_at: new Date().toISOString(),
      }
    }

    // 2. 计算分账金额
    const calculation = this.calculate(
      request.totalAmount,
      request.recipients,
      request.method,
      options
    )

    if (!calculation.valid) {
      console.error("[SplitPayment] Calculation failed:", calculation.errors)
      return {
        id: splitId,
        status: "failed",
        totalAmount: request.totalAmount,
        paidAmount: 0,
        token: request.token,
        method: request.method,
        results: [],
        successCount: 0,
        failedCount: request.recipients.length,
        created_at: new Date().toISOString(),
      }
    }

    // 3. 转换为批量支付格式
    const batchRecipients: Recipient[] = calculation.recipients.map((r) => ({
      address: r.address,
      amount: r.calculatedAmount,
      token: request.token,
      name: r.name,
      memo: r.memo,
    }))

    // 4. 执行批量支付
    const batchOptions: BatchPaymentOptions = {
      concurrency: options?.concurrency || DEFAULT_SPLIT_OPTIONS.concurrency,
      batchDelay: options?.batchDelay || DEFAULT_SPLIT_OPTIONS.batchDelay,
      timeout: options?.timeout || DEFAULT_SPLIT_OPTIONS.timeout,
      retries: options?.retries || DEFAULT_SPLIT_OPTIONS.retries,
    }

    const paymentResults = await processBatchPayments(
      batchRecipients,
      wallet,
      "EVM",
      onProgress,
      batchOptions
    )

    // 5. 转换结果格式
    const results: SplitPaymentResult[] = paymentResults.map((pr, index) => ({
      success: pr.success,
      recipient: pr.recipient,
      amount: pr.amount,
      txHash: pr.txHash,
      error: pr.error,
      allocation: calculation.recipients[index].allocation,
      method: request.method,
    }))

    const successCount = results.filter((r) => r.success).length
    const failedCount = results.length - successCount
    const paidAmount = results
      .filter((r) => r.success)
      .reduce((sum, r) => sum + r.amount, 0)

    // 6. 计算手续费
    const feeBreakdown = this.calculateFees(request.totalAmount, calculation.recipients)

    const elapsed = Date.now() - startTime
    console.log("[SplitPayment] Completed:", {
      id: splitId,
      successCount,
      failedCount,
      paidAmount,
      elapsed: `${elapsed}ms`,
    })

    return {
      id: splitId,
      status: failedCount === 0 ? "completed" : successCount === 0 ? "failed" : "partial",
      totalAmount: request.totalAmount,
      paidAmount,
      token: request.token,
      method: request.method,
      results,
      successCount,
      failedCount,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      feeBreakdown,
    }
  }

  /**
   * 从模板创建分账请求
   */
  createFromTemplate(
    template: SplitTemplate,
    totalAmount: number,
    token?: string
  ): SplitPaymentRequest {
    return {
      totalAmount,
      token: token || template.default_token,
      method: template.method,
      recipients: template.recipients.map((r) => ({
        address: r.address,
        allocation: r.allocation,
        name: r.name,
        memo: r.memo,
      })),
      templateId: template.id,
    }
  }

  /**
   * 预览分账结果（不执行支付）
   */
  preview(request: SplitPaymentRequest, options?: SplitPaymentOptions): {
    validation: SplitValidationResult
    calculation: SplitCalculation | null
    fees: SplitFeeBreakdown | null
  } {
    const validation = this.validate(request)

    if (!validation.valid) {
      return {
        validation,
        calculation: null,
        fees: null,
      }
    }

    const calculation = this.calculate(
      request.totalAmount,
      request.recipients,
      request.method,
      options
    )

    const fees = this.calculateFees(request.totalAmount, calculation.recipients)

    return {
      validation,
      calculation,
      fees,
    }
  }
}

// Export singleton instance
export const splitPaymentService = new SplitPaymentService()

// Export utility functions
export function validateSplitPayment(request: SplitPaymentRequest): SplitValidationResult {
  return splitPaymentService.validate(request)
}

export function calculateSplitAmounts(
  totalAmount: number,
  recipients: SplitRecipient[],
  method: AllocationMethod,
  options?: SplitPaymentOptions
): SplitCalculation {
  return splitPaymentService.calculate(totalAmount, recipients, method, options)
}

export async function executeSplitPayment(
  request: SplitPaymentRequest,
  wallet: string,
  options?: SplitPaymentOptions,
  onProgress?: (current: number, total: number) => void
): Promise<SplitPaymentResponse> {
  return splitPaymentService.execute(request, wallet, options, onProgress)
}
