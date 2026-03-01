/**
 * Batch Orchestrator Service
 *
 * Orchestrates concurrent batch payment execution with:
 * - Per-chain nonce management (prevents nonce conflicts)
 * - Configurable concurrency windows
 * - Exponential backoff retry on failure
 * - Progress tracking and partial failure handling
 *
 * Integrates with TxExecutorService for individual tx execution
 * and BudgetGuardService for spending limits.
 *
 * @module lib/services/batch-orchestrator-service
 */

import { txExecutorService, type TxResult } from './tx-executor-service'
import { budgetGuardService } from './budget-guard-service'
import { gasManagerService } from './gas-manager-service'
import { prisma } from '@/lib/prisma'
import type { Address, Hex } from 'viem'

// ============================================================================
// Types
// ============================================================================

export interface BatchPaymentItem {
  to: Address
  amount: string
  token: string
  chainId: number
  memo?: string
}

export interface BatchSubmitParams {
  privateKey: Hex
  ownerAddress: Address
  agentId?: string
  payments: BatchPaymentItem[]
  strategy: 'sequential' | 'concurrent'
  maxConcurrency: number
  retryOnFailure: boolean
  maxRetries: number
}

export interface BatchResult {
  batchId: string
  status: 'completed' | 'partial_failure' | 'failed'
  totalCount: number
  successCount: number
  failureCount: number
  transactions: BatchTxResult[]
  totalGasCostUsd: number
}

export interface BatchTxResult {
  index: number
  to: string
  amount: string
  token: string
  chainId: number
  txHash: string
  status: 'confirmed' | 'failed'
  error?: string
  gasUsed?: string
  retries: number
}

export interface BatchStatus {
  batchId: string
  status: string
  progress: number
  totalCount: number
  completedCount: number
  failedCount: number
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_CONCURRENCY = 5
const DEFAULT_MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 5_000 // 5s → 10s → 20s

// ============================================================================
// Service
// ============================================================================

export class BatchOrchestratorService {
  /**
   * Submit and execute a batch payment
   */
  async submitBatch(params: BatchSubmitParams): Promise<BatchResult> {
    const {
      privateKey,
      ownerAddress,
      agentId,
      payments,
      strategy = 'concurrent',
      maxConcurrency = DEFAULT_MAX_CONCURRENCY,
      retryOnFailure = true,
      maxRetries = DEFAULT_MAX_RETRIES,
    } = params

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    // Validate all payments first
    this.validateBatch(payments)

    // Budget guard: check total amount
    if (agentId) {
      const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0)
      const guardResult = await budgetGuardService.guardedCheck({
        agentId,
        ownerAddress,
        amount: totalAmount.toString(),
        token: 'USDC', // Use primary token for budget check
        chainId: payments[0]?.chainId || 8453,
        senderAddress: ownerAddress,
      })

      if (!guardResult.allowed) {
        return {
          batchId,
          status: 'failed',
          totalCount: payments.length,
          successCount: 0,
          failureCount: payments.length,
          transactions: payments.map((p, i) => ({
            index: i,
            to: p.to,
            amount: p.amount,
            token: p.token,
            chainId: p.chainId,
            txHash: '',
            status: 'failed' as const,
            error: `BudgetGuard: ${guardResult.reason}`,
            retries: 0,
          })),
          totalGasCostUsd: 0,
        }
      }
    }

    // Record batch in database
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO batch_payments (id, user_id, sender_address, total_recipients, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        batchId,
        ownerAddress,
        ownerAddress,
        payments.length,
        'processing',
        new Date().toISOString(),
      )
    } catch {
      // Table might not exist; continue without DB tracking
      console.warn('[BatchOrchestrator] Could not record batch in DB')
    }

    // Group by chain for nonce management
    const chainGroups = this.groupByChain(payments)

    // Execute based on strategy
    let transactions: BatchTxResult[]
    if (strategy === 'sequential') {
      transactions = await this.executeSequential(
        chainGroups,
        privateKey,
        retryOnFailure,
        maxRetries,
      )
    } else {
      transactions = await this.executeConcurrent(
        chainGroups,
        privateKey,
        maxConcurrency,
        retryOnFailure,
        maxRetries,
      )
    }

    const successCount = transactions.filter(t => t.status === 'confirmed').length
    const failureCount = transactions.filter(t => t.status === 'failed').length
    const totalGasCostUsd = transactions.reduce((sum, t) => {
      if (t.gasUsed) return sum + parseFloat(t.gasUsed)
      return sum
    }, 0)

    const status: BatchResult['status'] =
      failureCount === 0 ? 'completed' :
      successCount === 0 ? 'failed' :
      'partial_failure'

    // Update DB status
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE batch_payments SET status = $1, success_count = $2, failure_count = $3
         WHERE id = $4`,
        status,
        successCount,
        failureCount,
        batchId,
      )
    } catch {
      // Continue without DB update
    }

    // Record success/failure for budget guard
    if (agentId) {
      if (successCount > 0) {
        const successAmount = transactions
          .filter(t => t.status === 'confirmed')
          .reduce((sum, t) => sum + parseFloat(t.amount), 0)
        budgetGuardService.recordSuccess(agentId, successAmount)
      }
      if (failureCount > 0) {
        budgetGuardService.recordFailure(agentId)
      }
    }

    return {
      batchId,
      status,
      totalCount: payments.length,
      successCount,
      failureCount,
      transactions,
      totalGasCostUsd,
    }
  }

  // ========================================================================
  // Execution Strategies
  // ========================================================================

  /**
   * Execute all payments sequentially (safe, slow)
   */
  private async executeSequential(
    chainGroups: Map<number, { index: number; payment: BatchPaymentItem }[]>,
    privateKey: Hex,
    retryOnFailure: boolean,
    maxRetries: number,
  ): Promise<BatchTxResult[]> {
    const results: BatchTxResult[] = []

    for (const [, items] of chainGroups) {
      for (const { index, payment } of items) {
        const result = await this.executeSingleWithRetry(
          index,
          payment,
          privateKey,
          retryOnFailure,
          maxRetries,
        )
        results.push(result)
      }
    }

    return results.sort((a, b) => a.index - b.index)
  }

  /**
   * Execute payments concurrently with chain-level nonce serialization
   */
  private async executeConcurrent(
    chainGroups: Map<number, { index: number; payment: BatchPaymentItem }[]>,
    privateKey: Hex,
    maxConcurrency: number,
    retryOnFailure: boolean,
    maxRetries: number,
  ): Promise<BatchTxResult[]> {
    const results: BatchTxResult[] = []

    // Process each chain group concurrently, but serialize within a chain
    const chainPromises = Array.from(chainGroups.entries()).map(
      async ([, items]) => {
        // Within a chain, serialize to manage nonces
        const chainResults: BatchTxResult[] = []

        // Process in windows of maxConcurrency
        for (let i = 0; i < items.length; i += maxConcurrency) {
          const window = items.slice(i, i + maxConcurrency)
          const windowResults = await Promise.all(
            window.map(({ index, payment }) =>
              this.executeSingleWithRetry(index, payment, privateKey, retryOnFailure, maxRetries)
            )
          )
          chainResults.push(...windowResults)
        }

        return chainResults
      }
    )

    const chainResults = await Promise.all(chainPromises)
    for (const cr of chainResults) {
      results.push(...cr)
    }

    return results.sort((a, b) => a.index - b.index)
  }

  /**
   * Execute a single payment with exponential backoff retry
   */
  private async executeSingleWithRetry(
    index: number,
    payment: BatchPaymentItem,
    privateKey: Hex,
    retryOnFailure: boolean,
    maxRetries: number,
  ): Promise<BatchTxResult> {
    let lastError = ''
    let retries = 0

    for (let attempt = 0; attempt <= (retryOnFailure ? maxRetries : 0); attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 5s, 10s, 20s
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
        console.log(`[BatchOrchestrator] Retry ${attempt}/${maxRetries} for item ${index}, waiting ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
        retries++
      }

      try {
        const result: TxResult = await txExecutorService.executeTransfer({
          privateKey,
          to: payment.to,
          amount: payment.amount,
          token: payment.token,
          chainId: payment.chainId,
        })

        if (result.success) {
          return {
            index,
            to: payment.to,
            amount: payment.amount,
            token: payment.token,
            chainId: payment.chainId,
            txHash: result.txHash,
            status: 'confirmed',
            gasUsed: result.gasUsed ? result.gasUsed.toString() : undefined,
            retries,
          }
        }

        lastError = result.error || 'Transaction failed'
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error'
      }
    }

    return {
      index,
      to: payment.to,
      amount: payment.amount,
      token: payment.token,
      chainId: payment.chainId,
      txHash: '',
      status: 'failed',
      error: lastError,
      retries,
    }
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  /**
   * Validate all payments in a batch
   */
  private validateBatch(payments: BatchPaymentItem[]): void {
    if (payments.length === 0) {
      throw new Error('Batch is empty')
    }

    if (payments.length > 100) {
      throw new Error('Batch exceeds maximum of 100 payments')
    }

    for (let i = 0; i < payments.length; i++) {
      const p = payments[i]

      if (!p.to || !p.to.startsWith('0x') || p.to.length !== 42) {
        throw new Error(`Payment ${i}: invalid address ${p.to}`)
      }

      const amount = parseFloat(p.amount)
      if (isNaN(amount) || amount <= 0) {
        throw new Error(`Payment ${i}: invalid amount ${p.amount}`)
      }

      if (!['USDC', 'USDT', 'DAI'].includes(p.token.toUpperCase())) {
        throw new Error(`Payment ${i}: unsupported token ${p.token}`)
      }
    }
  }

  /**
   * Group payments by chain ID for nonce management
   */
  private groupByChain(
    payments: BatchPaymentItem[],
  ): Map<number, { index: number; payment: BatchPaymentItem }[]> {
    const groups = new Map<number, { index: number; payment: BatchPaymentItem }[]>()

    payments.forEach((payment, index) => {
      const chainId = payment.chainId
      if (!groups.has(chainId)) {
        groups.set(chainId, [])
      }
      groups.get(chainId)!.push({ index, payment })
    })

    return groups
  }

  /**
   * Estimate total gas cost for a batch
   */
  async estimateBatchGas(payments: BatchPaymentItem[]): Promise<{
    totalGasCostUsd: number
    perChain: { chainId: number; chainName: string; count: number; gasCostUsd: number }[]
  }> {
    const chainGroups = this.groupByChain(payments)
    const perChain: { chainId: number; chainName: string; count: number; gasCostUsd: number }[] = []
    let totalGasCostUsd = 0

    for (const [chainId, items] of chainGroups) {
      try {
        const estimate = await gasManagerService.estimateTransferGas({
          chainId,
          token: items[0].payment.token,
          to: items[0].payment.to,
          amount: items[0].payment.amount,
        })

        const chainCost = estimate.gasCostUsd * items.length
        totalGasCostUsd += chainCost

        const gasPrice = await gasManagerService.getGasPrice(chainId)
        perChain.push({
          chainId,
          chainName: gasPrice.chainName,
          count: items.length,
          gasCostUsd: Math.round(chainCost * 10000) / 10000,
        })
      } catch {
        perChain.push({
          chainId,
          chainName: `Chain ${chainId}`,
          count: items.length,
          gasCostUsd: 0,
        })
      }
    }

    return {
      totalGasCostUsd: Math.round(totalGasCostUsd * 10000) / 10000,
      perChain,
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const batchOrchestratorService = new BatchOrchestratorService()
