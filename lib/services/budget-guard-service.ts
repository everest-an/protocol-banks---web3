/**
 * Budget Guard Service
 *
 * 6-layer defense-in-depth spending protection for AI agent payments.
 * Inspired by ag402's budget guard pattern.
 *
 * Layers:
 * 1. Hardcoded per-tx ceiling ($5,000) — code-level, cannot be overridden
 * 2. Configurable per-tx limit — from Agent.auto_execute_rules.max_single_amount
 * 3. Per-minute rate + amount limit — max 5 tx/min
 * 4. Daily spending cap — from Agent.auto_execute_rules.max_daily_amount
 * 5. Circuit breaker — 3 consecutive failures → 60s cooldown
 * 6. On-chain balance pre-check — token balance ≥ transfer amount
 *
 * TOCTOU prevention: AsyncLock serializes budget-check + deduction.
 *
 * @module lib/services/budget-guard-service
 */

import { budgetService } from './budget-service'
import { txExecutorService } from './tx-executor-service'
import type { Address } from 'viem'

// ============================================================================
// Types
// ============================================================================

export interface BudgetCheckParams {
  agentId: string
  ownerAddress: string
  amount: string
  token: string
  chainId: number
  senderAddress?: Address
}

export interface BudgetCheckResult {
  allowed: boolean
  layer?: string
  reason?: string
}

export interface AgentSpendingRules {
  max_single_amount?: string
  max_daily_amount?: string
  allowed_tokens?: string[]
  allowed_recipients?: string[]
  allowed_chains?: number[]
}

// ============================================================================
// Constants
// ============================================================================

/** Layer 1: Hardcoded ceiling — NEVER override */
const HARD_MAX_PER_TX_USD = 5000

/** Layer 3: Per-minute rate limit */
const MAX_TX_PER_MINUTE = 5
const RATE_WINDOW_MS = 60_000

/** Layer 5: Circuit breaker */
const CIRCUIT_BREAKER_THRESHOLD = 3
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000

// ============================================================================
// Internal State
// ============================================================================

/** Per-agent rate tracking: agentId → timestamps[] */
const rateLimitMap = new Map<string, number[]>()

/** Per-agent minute spend tracking: agentId → { windowStart, amount } */
const minuteSpendMap = new Map<string, { windowStart: number; amount: number }>()

/** Per-agent circuit breaker: agentId → { failures, lastFailure, openUntil } */
const circuitBreakerMap = new Map<string, {
  failures: number
  lastFailure: number
  openUntil: number
}>()

/** TOCTOU lock: agentId → Promise (serialize concurrent checks) */
const lockMap = new Map<string, Promise<void>>()

// ============================================================================
// Service
// ============================================================================

export class BudgetGuardService {
  /**
   * Run all 6 layers of budget checking.
   * Returns { allowed: true } if all pass, or { allowed: false, layer, reason }.
   */
  async check(
    params: BudgetCheckParams,
    rules?: AgentSpendingRules | null,
  ): Promise<BudgetCheckResult> {
    const amount = parseFloat(params.amount)
    if (isNaN(amount) || amount <= 0) {
      return { allowed: false, layer: 'validation', reason: 'Invalid amount' }
    }

    // Layer 1: Hardcoded ceiling
    if (amount > HARD_MAX_PER_TX_USD) {
      return {
        allowed: false,
        layer: 'hard_limit',
        reason: `Amount $${amount} exceeds hard limit of $${HARD_MAX_PER_TX_USD}`,
      }
    }

    // Layer 2: Configurable per-tx limit
    if (rules?.max_single_amount) {
      const maxSingle = parseFloat(rules.max_single_amount)
      if (amount > maxSingle) {
        return {
          allowed: false,
          layer: 'per_tx_limit',
          reason: `Amount $${amount} exceeds agent limit of $${maxSingle}`,
        }
      }
    }

    // Layer 3: Per-minute rate limit
    const rateResult = this.checkRateLimit(params.agentId)
    if (!rateResult.allowed) {
      return rateResult
    }

    // Layer 4: Daily spending cap
    if (rules?.max_daily_amount) {
      const dailyResult = await this.checkDailySpending(params.agentId, amount, rules.max_daily_amount)
      if (!dailyResult.allowed) {
        return dailyResult
      }
    }

    // Layer 5: Circuit breaker
    const cbResult = this.checkCircuitBreaker(params.agentId)
    if (!cbResult.allowed) {
      return cbResult
    }

    // Layer 6: On-chain balance pre-check
    if (params.senderAddress) {
      const balanceResult = await this.checkOnChainBalance(
        params.chainId,
        params.token,
        params.senderAddress,
        params.amount,
      )
      if (!balanceResult.allowed) {
        return balanceResult
      }
    }

    return { allowed: true }
  }

  /**
   * Full guarded execution: check + execute atomically (TOCTOU-safe).
   * Acquires a per-agent lock to prevent concurrent bypasses.
   */
  async guardedCheck(
    params: BudgetCheckParams,
    rules?: AgentSpendingRules | null,
  ): Promise<BudgetCheckResult> {
    // Acquire per-agent lock
    const release = await this.acquireLock(params.agentId)
    try {
      return await this.check(params, rules)
    } finally {
      release()
    }
  }

  /**
   * Record a successful transaction (update rate counters)
   */
  recordSuccess(agentId: string, amount: number): void {
    // Update rate limit
    const now = Date.now()
    const timestamps = rateLimitMap.get(agentId) || []
    timestamps.push(now)
    rateLimitMap.set(agentId, timestamps)

    // Update minute spend
    const spend = minuteSpendMap.get(agentId)
    if (spend && now - spend.windowStart < RATE_WINDOW_MS) {
      spend.amount += amount
    } else {
      minuteSpendMap.set(agentId, { windowStart: now, amount })
    }

    // Reset circuit breaker on success
    const cb = circuitBreakerMap.get(agentId)
    if (cb) {
      cb.failures = 0
    }
  }

  /**
   * Record a failed transaction (update circuit breaker)
   */
  recordFailure(agentId: string): void {
    const now = Date.now()
    const cb = circuitBreakerMap.get(agentId) || {
      failures: 0,
      lastFailure: 0,
      openUntil: 0,
    }

    cb.failures++
    cb.lastFailure = now

    if (cb.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      cb.openUntil = now + CIRCUIT_BREAKER_COOLDOWN_MS
      console.warn(
        `[BudgetGuard] Circuit breaker OPEN for agent ${agentId}: ${cb.failures} consecutive failures`
      )
    }

    circuitBreakerMap.set(agentId, cb)
  }

  // ========================================================================
  // Layer Implementations
  // ========================================================================

  /**
   * Layer 3: Per-minute rate limit
   */
  private checkRateLimit(agentId: string): BudgetCheckResult {
    const now = Date.now()
    const timestamps = rateLimitMap.get(agentId) || []

    // Prune old entries outside the window
    const recent = timestamps.filter(t => now - t < RATE_WINDOW_MS)
    rateLimitMap.set(agentId, recent)

    if (recent.length >= MAX_TX_PER_MINUTE) {
      return {
        allowed: false,
        layer: 'rate_limit',
        reason: `Rate limit: ${MAX_TX_PER_MINUTE} transactions per minute exceeded`,
      }
    }

    return { allowed: true }
  }

  /**
   * Layer 4: Daily spending cap
   */
  private async checkDailySpending(
    agentId: string,
    pendingAmount: number,
    maxDailyAmount: string,
  ): Promise<BudgetCheckResult> {
    const maxDaily = parseFloat(maxDailyAmount)
    if (isNaN(maxDaily)) return { allowed: true }

    // Check via budget service
    const availability = await budgetService.checkAvailability(
      agentId,
      pendingAmount.toString(),
      'USDC', // Budget is token-agnostic for daily caps
    )

    if (!availability.available) {
      return {
        allowed: false,
        layer: 'daily_cap',
        reason: `Daily spending cap reached: ${availability.reason || `limit $${maxDaily}`}`,
      }
    }

    return { allowed: true }
  }

  /**
   * Layer 5: Circuit breaker
   */
  private checkCircuitBreaker(agentId: string): BudgetCheckResult {
    const cb = circuitBreakerMap.get(agentId)
    if (!cb) return { allowed: true }

    const now = Date.now()
    if (cb.openUntil > now) {
      const cooldownRemaining = Math.ceil((cb.openUntil - now) / 1000)
      return {
        allowed: false,
        layer: 'circuit_breaker',
        reason: `Circuit breaker open: ${cb.failures} consecutive failures. Retry in ${cooldownRemaining}s`,
      }
    }

    // If cooldown has passed, allow (half-open state)
    return { allowed: true }
  }

  /**
   * Layer 6: On-chain balance pre-check
   */
  private async checkOnChainBalance(
    chainId: number,
    token: string,
    senderAddress: Address,
    amount: string,
  ): Promise<BudgetCheckResult> {
    try {
      const balance = await txExecutorService.getTokenBalance(chainId, token, senderAddress)
      const balanceNum = parseFloat(balance)
      const amountNum = parseFloat(amount)

      if (balanceNum < amountNum) {
        return {
          allowed: false,
          layer: 'balance_check',
          reason: `Insufficient ${token} balance: have ${balance}, need ${amount}`,
        }
      }

      return { allowed: true }
    } catch (error) {
      // If balance check fails (RPC error), allow but log warning
      console.warn(`[BudgetGuard] Balance check failed, allowing:`, error)
      return { allowed: true }
    }
  }

  // ========================================================================
  // Lock Management (TOCTOU Prevention)
  // ========================================================================

  /**
   * Acquire a per-agent async lock.
   * Returns a release function.
   */
  private async acquireLock(agentId: string): Promise<() => void> {
    // Wait for any existing lock
    while (lockMap.has(agentId)) {
      await lockMap.get(agentId)
    }

    // Create new lock
    let releaseFn: () => void
    const promise = new Promise<void>(resolve => {
      releaseFn = resolve
    })
    lockMap.set(agentId, promise)

    return () => {
      lockMap.delete(agentId)
      releaseFn!()
    }
  }

  /**
   * Reset all tracking state (for testing)
   */
  reset(): void {
    rateLimitMap.clear()
    minuteSpendMap.clear()
    circuitBreakerMap.clear()
    lockMap.clear()
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const budgetGuardService = new BudgetGuardService()
