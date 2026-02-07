/**
 * Double Spend Prevention Service
 *
 * 防双花攻击验证服务
 *
 * 攻击向量:
 * 1. 伪造交易哈希 - 通过链上验证防御
 * 2. 重放同一笔交易 - 通过唯一性约束防御
 * 3. 区块重组利用 - 通过确认深度防御
 *
 * 验证层级:
 * - Layer 1: 交易哈希唯一性检查
 * - Layer 2: 链上交易真实性验证
 * - Layer 3: 金额和接收地址匹配
 * - Layer 4: 确认数验证
 * - Layer 5: 区块重组检测
 */

import { prisma } from '@/lib/prisma'
import { getTronTransaction, getConfirmationInfo } from '@/lib/services/tron-payment'
import { logger } from '@/lib/logger/structured-logger'

/**
 * 验证结果
 */
export interface VerificationResult {
  valid: boolean
  reason?: string
  details?: {
    txExists: boolean
    amountMatches: boolean
    addressMatches: boolean
    confirmations: number
    requiredConfirmations: number
    isReorg: boolean
  }
}

/**
 * Double Spend Prevention Service
 */
export class DoubleSpendPreventionService {
  /**
   * 多层验证支付有效性
   *
   * @param txHash - 交易哈希
   * @param orderId - 订单 ID
   * @param expectedAmount - 预期金额
   * @param expectedAddress - 预期接收地址
   * @returns 验证结果
   */
  async verifyPayment(
    txHash: string,
    orderId: string,
    expectedAmount: string,
    expectedAddress: string
  ): Promise<VerificationResult> {
    try {
      // Layer 1: 检查交易哈希是否已被使用
      const existingPayment = await prisma.payment.findFirst({
        where: { tx_hash: txHash }
      })

      if (existingPayment && existingPayment.order_id !== orderId) {
        return {
          valid: false,
          reason: `Transaction hash already used for another order (${existingPayment.order_id})`,
          details: {
            txExists: true,
            amountMatches: false,
            addressMatches: false,
            confirmations: 0,
            requiredConfirmations: 3,
            isReorg: false
          }
        }
      }

      // Layer 2: 链上验证交易真实性
      const onChainTx = await getTronTransaction(txHash)
      if (!onChainTx) {
        return {
          valid: false,
          reason: 'Transaction not found on blockchain (possible fake txHash)',
          details: {
            txExists: false,
            amountMatches: false,
            addressMatches: false,
            confirmations: 0,
            requiredConfirmations: 3,
            isReorg: false
          }
        }
      }

      // Layer 3: 验证金额
      const amountMatches = this.compareAmounts(onChainTx.amount, expectedAmount)
      if (!amountMatches) {
        return {
          valid: false,
          reason: `Amount mismatch: expected ${expectedAmount}, got ${onChainTx.amount}`,
          details: {
            txExists: true,
            amountMatches: false,
            addressMatches: false,
            confirmations: 0,
            requiredConfirmations: 3,
            isReorg: false
          }
        }
      }

      // Layer 3.5: 验证接收地址
      const addressMatches = onChainTx.to_address.toLowerCase() === expectedAddress.toLowerCase()
      if (!addressMatches) {
        return {
          valid: false,
          reason: `Recipient address mismatch: expected ${expectedAddress}, got ${onChainTx.to_address}`,
          details: {
            txExists: true,
            amountMatches: true,
            addressMatches: false,
            confirmations: 0,
            requiredConfirmations: 3,
            isReorg: false
          }
        }
      }

      // Layer 4: 验证确认数
      const confirmationInfo = await getConfirmationInfo(txHash)
      const requiredConfirmations = this.getRequiredConfirmations(parseFloat(expectedAmount))

      if (confirmationInfo.confirmations < requiredConfirmations) {
        return {
          valid: false,
          reason: `Insufficient confirmations: ${confirmationInfo.confirmations}/${requiredConfirmations}`,
          details: {
            txExists: true,
            amountMatches: true,
            addressMatches: true,
            confirmations: confirmationInfo.confirmations,
            requiredConfirmations,
            isReorg: false
          }
        }
      }

      // Layer 5: 检查是否在重组中
      if (onChainTx.block_number) {
        const isInReorg = await this.checkReorgStatus(onChainTx.block_number)
        if (isInReorg) {
          return {
            valid: false,
            reason: 'Block is under reorganization, payment is not final',
            details: {
              txExists: true,
              amountMatches: true,
              addressMatches: true,
              confirmations: confirmationInfo.confirmations,
              requiredConfirmations,
              isReorg: true
            }
          }
        }
      }

      // 所有验证通过
      return {
        valid: true,
        details: {
          txExists: true,
          amountMatches: true,
          addressMatches: true,
          confirmations: confirmationInfo.confirmations,
          requiredConfirmations,
          isReorg: false
        }
      }

    } catch (error) {
      logger.error('Payment verification failed', error instanceof Error ? error : new Error(String(error)), {
        component: 'double-spend-prevention',
        action: 'verify_payment',
        txHash,
        orderId,
        metadata: { expectedAmount, expectedAddress }
      })
      return {
        valid: false,
        reason: error instanceof Error ? error.message : 'Unknown verification error'
      }
    }
  }

  /**
   * 批量验证支付
   *
   * @param payments - 支付列表
   * @returns 验证结果列表
   */
  async verifyPayments(
    payments: Array<{
      txHash: string
      orderId: string
      amount: string
      address: string
    }>
  ): Promise<Array<VerificationResult & { txHash: string }>> {
    const results = await Promise.all(
      payments.map(async (payment) => {
        const result = await this.verifyPayment(
          payment.txHash,
          payment.orderId,
          payment.amount,
          payment.address
        )
        return { ...result, txHash: payment.txHash }
      })
    )

    return results
  }

  /**
   * 检查交易是否已被使用
   *
   * @param txHash - 交易哈希
   * @returns 是否已使用
   */
  async isTransactionUsed(txHash: string): Promise<boolean> {
    const payment = await prisma.payment.findFirst({
      where: { tx_hash: txHash }
    })

    return !!payment
  }

  /**
   * 获取交易的使用历史
   *
   * @param txHash - 交易哈希
   * @returns 使用记录列表
   */
  async getTransactionHistory(txHash: string) {
    const payments = await prisma.payment.findMany({
      where: { tx_hash: txHash },
      include: {
        order: {
          select: {
            id: true,
            order_number: true,
            amount: true,
            status: true,
            created_at: true
          }
        }
      }
    })

    return payments
  }

  /**
   * 标记可疑交易
   *
   * @param txHash - 交易哈希
   * @param reason - 标记原因
   */
  async flagSuspiciousTransaction(txHash: string, reason: string) {
    // 记录到审计日志
    await prisma.auditLog.create({
      data: {
        action: 'suspicious_transaction',
        resource_type: 'payment',
        resource_id: txHash,
        details: {
          txHash,
          reason,
          flaggedAt: new Date().toISOString()
        }
      }
    })

    logger.logSecurityEvent(
      'suspicious_transaction',
      'high',
      { reason },
      {
        component: 'double-spend-prevention',
        action: 'flag_suspicious',
        txHash
      }
    )
  }

  /**
   * 比较金额（考虑浮点精度）
   *
   * @param amount1 - 金额 1
   * @param amount2 - 金额 2
   * @returns 是否匹配
   */
  private compareAmounts(amount1: string, amount2: string): boolean {
    const a1 = parseFloat(amount1)
    const a2 = parseFloat(amount2)

    // 允许 0.01 的误差（处理浮点精度问题）
    return Math.abs(a1 - a2) < 0.01
  }

  /**
   * 根据金额获取所需确认数
   *
   * 大额交易需要更多确认
   *
   * @param amount - 金额
   * @returns 所需确认数
   */
  private getRequiredConfirmations(amount: number): number {
    if (amount >= 10000) return 19    // 超大额: 19 确认
    if (amount >= 1000) return 10     // 大额: 10 确认
    if (amount >= 100) return 5       // 中额: 5 确认
    return 3                          // 小额: 3 确认
  }

  /**
   * 检查区块是否处于重组状态
   *
   * @param blockNumber - 区块号
   * @returns 是否在重组中
   */
  private async checkReorgStatus(blockNumber: number): Promise<boolean> {
    try {
      // 获取存储的区块哈希
      const storedBlock = await prisma.blockInfo.findUnique({
        where: { block_number: blockNumber }
      })

      if (!storedBlock) {
        // 首次索引该区块，不是重组
        return false
      }

      // 从链上获取当前该区块的哈希
      // 注意: 需要实现 getCurrentBlockHash 方法
      // const currentBlockHash = await this.getCurrentBlockHash(blockNumber)

      // 如果哈希不一致，说明发生了重组
      // return storedBlock.block_hash !== currentBlockHash

      // 简化版本: 检查区块时间
      const blockAge = Date.now() - storedBlock.timestamp.getTime()
      const REORG_WINDOW = 60000  // 1 分钟内的区块可能重组

      return blockAge < REORG_WINDOW

    } catch (error) {
      logger.error('Block reorganization check failed', error instanceof Error ? error : new Error(String(error)), {
        component: 'double-spend-prevention',
        action: 'check_reorg',
        metadata: { blockNumber }
      })
      // 出错时保守处理，认为可能在重组
      return true
    }
  }

  /**
   * 获取防双花统计信息
   *
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @returns 统计信息
   */
  async getStatistics(startDate: Date, endDate: Date) {
    const [totalPayments, duplicateAttempts, flaggedTransactions] = await Promise.all([
      // 总支付数
      prisma.payment.count({
        where: {
          created_at: {
            gte: startDate,
            lte: endDate
          }
        }
      }),

      // 重复尝试次数（同一 txHash 出现多次）
      prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*) as count
        FROM (
          SELECT tx_hash
          FROM payments
          WHERE created_at BETWEEN ${startDate} AND ${endDate}
          GROUP BY tx_hash
          HAVING COUNT(*) > 1
        ) as duplicates
      `,

      // 被标记的可疑交易
      prisma.auditLog.count({
        where: {
          action: 'suspicious_transaction',
          created_at: {
            gte: startDate,
            lte: endDate
          }
        }
      })
    ])

    return {
      totalPayments,
      duplicateAttempts: duplicateAttempts[0]?.count || 0,
      flaggedTransactions,
      successRate: totalPayments > 0
        ? ((totalPayments - (duplicateAttempts[0]?.count || 0)) / totalPayments) * 100
        : 100
    }
  }
}

// 导出单例实例
export const doubleSpendPreventionService = new DoubleSpendPreventionService()
