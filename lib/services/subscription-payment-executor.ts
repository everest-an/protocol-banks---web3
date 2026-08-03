/**
 * Subscription Payment Executor
 *
 * Processes due subscription payments using ERC-3009 (gasless USDC transfers)
 * or x402 protocol with direct service calls (no HTTP fetch for server-side).
 *
 * Execution: ERC-3009 transferWithAuthorization submitted through a relayer,
 * using an authorization the user signed ahead of time.
 *
 * Non-custodial: funds always move directly from the user's wallet under a
 * signature they produced. The relayer only pays gas — it never holds funds and
 * there is no server-side substitute for the user's signature. If no valid
 * authorization exists, the charge fails rather than being faked.
 */

import { subscriptionService, type Subscription } from './subscription-service'
import { checkAuthorizationValidity } from '@/lib/subscription-helpers'
import { isERC3009Supported } from '../erc3009'
import { assessTransaction } from './risk-service'
import { planNextAttempt, dunningMessage } from './subscription-dunning'
import { notificationService } from './notification-service'
import { relayerService, isRelayerConfigured } from './relayer-service'
import { checkIdempotency, completeIdempotency, failIdempotency } from './idempotency-service'
import { prisma } from '@/lib/prisma'
import {
  SUBSCRIPTION_MANAGER_ABI,
  isSubscriptionId,
} from './subscription-manager-contract'
import { createPublicClient, encodeFunctionData, http, type Hex, type Address } from 'viem'
import { getNetworkByChainId } from '@/lib/networks'

export interface PaymentExecutionResult {
  subscriptionId: string
  success: boolean
  txHash?: string
  error?: string
  method: 'contract' | 'erc3009' | 'x402' | 'direct'
  skipped?: boolean
  skipReason?: 'authorization_expired' | 'cap_exceeded'
  /** When the next dunning retry is scheduled. Absent once retries stop. */
  retryScheduledAt?: string
  /** 1-based number of the attempt that just failed. */
  attempt?: number
  /** True when no further attempts will be made without payer action. */
  gaveUp?: boolean
  /**
   * The charge was submitted but is not yet confirmed on-chain. It has not been
   * counted as a completed payment; settlement reconciliation decides.
   */
  pending?: boolean
  /**
   * The notice period was started rather than a charge being made. No funds
   * moved and the billing period is still open.
   */
  announced?: boolean
}

/**
 * Outcome of handing a charge to the relayer.
 *
 * `confirmed` distinguishes a transaction that is on-chain from one that has
 * merely been accepted for submission. A relayer task id is not a transaction,
 * and a submitted transaction can still revert or be dropped — so an
 * unconfirmed charge must not be recorded as a completed payment.
 */
interface ChargeSubmission {
  txHash: string
  confirmed: boolean
  /**
   * `announcement` means the notice period was started, not that a charge was
   * attempted. No funds move, so it must not produce a payment record or count
   * as a failed attempt.
   */
  kind: 'charge' | 'announcement'
}

function toChargeSubmission(
  result: { status: string; transactionHash?: string; taskId: string; error?: string },
  failureMessage: string
): ChargeSubmission {
  if (result.status === 'failed') {
    throw new Error(result.error || failureMessage)
  }

  return {
    // Fall back to the task id only so the submission remains traceable; it is
    // never treated as proof of payment.
    txHash: result.transactionHash || result.taskId,
    confirmed: result.status === 'confirmed' && !!result.transactionHash,
    kind: 'charge',
  }
}

export interface PaymentExecutorConfig {
  maxRetries: number
  relayerUrl?: string
  signerAddress?: string
}

const DEFAULT_CONFIG: PaymentExecutorConfig = {
  maxRetries: 3,
  relayerUrl: process.env.RELAYER_URL,
  signerAddress: process.env.RELAYER_ADDRESS,
}

/**
 * Subscription Payment Executor Service
 */
export class SubscriptionPaymentExecutor {
  private config: PaymentExecutorConfig

  constructor(config: Partial<PaymentExecutorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Process all due subscriptions
   */
  async processDueSubscriptions(limit: number = 50): Promise<PaymentExecutionResult[]> {
    const results: PaymentExecutionResult[] = []

    try {
      // Get due subscriptions
      const dueSubscriptions = await subscriptionService.getDueSubscriptions(limit)
      console.log(`[SubscriptionExecutor] Found ${dueSubscriptions.length} due subscriptions`)

      for (const subscription of dueSubscriptions) {
        const result = await this.executePayment(subscription)
        results.push(result)

        // Small delay between payments to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Also process retry-due subscriptions
      const retrySubscriptions = await subscriptionService.getRetryDueSubscriptions(limit)
      console.log(`[SubscriptionExecutor] Found ${retrySubscriptions.length} retry-due subscriptions`)

      for (const subscription of retrySubscriptions) {
        const result = await this.executePayment(subscription)
        results.push(result)
        await new Promise(resolve => setTimeout(resolve, 100))
      }

    } catch (error) {
      console.error('[SubscriptionExecutor] Error processing subscriptions:', error)
    }

    return results
  }

  /**
   * Execute a single subscription payment.
   * Uses idempotency key (subscription ID + billing period) to prevent
   * duplicate charges if the cron runs multiple times.
   */
  async executePayment(subscription: Subscription): Promise<PaymentExecutionResult> {
    console.log(`[SubscriptionExecutor] Processing subscription ${subscription.id}`)

    // Build idempotency key from subscription ID + next payment date
    const billingPeriod = subscription.next_payment_date
      ? new Date(subscription.next_payment_date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
    const idempotencyKey = `sub:${subscription.id}:${billingPeriod}`

    // Check idempotency — if already processed for this billing period, return cached result
    const idempotencyCheck = await checkIdempotency(
      idempotencyKey,
      subscription.owner_address,
      `/cron/subscriptions/${subscription.id}`,
      { subscriptionId: subscription.id, period: billingPeriod }
    )

    if (idempotencyCheck.isDuplicate && idempotencyCheck.existingResponse) {
      console.log(`[SubscriptionExecutor] Idempotent skip for ${subscription.id} (period ${billingPeriod})`)
      return idempotencyCheck.existingResponse.body as PaymentExecutionResult
    }

    // Authorization gating: check expiry and spending cap before execution
    const authCheck = checkAuthorizationValidity({
      ...subscription,
      next_payment: subscription.next_payment_date || undefined,
      last_payment: subscription.last_payment_date || undefined,
    } as any)

    if (!authCheck.valid) {
      console.log(`[SubscriptionExecutor] Skipping ${subscription.id}: ${authCheck.reason}`)
      const skipReason = authCheck.reason?.includes('expired') ? 'authorization_expired' as const : 'cap_exceeded' as const
      const result: PaymentExecutionResult = {
        subscriptionId: subscription.id,
        success: false,
        error: authCheck.reason,
        method: 'direct',
        skipped: true,
        skipReason,
      }
      await failIdempotency(idempotencyKey)
      return result
    }

    // Risk screening. A recurring charge runs without the payer present, so this
    // is the only point at which an anomalous charge can be stopped before the
    // funds move.
    const risk = await assessTransaction({
      referenceType: 'subscription_payment',
      referenceId: subscription.id,
      userAddress: subscription.owner_address,
      recipient: subscription.recipient_address,
      amount: subscription.amount,
      token: subscription.token,
      chain: subscription.chain || String(subscription.chain_id),
    }).catch((error) => {
      // Screening must not silently pass a charge it failed to evaluate, but it
      // also should not take down every subscription if the service is down.
      console.error('[SubscriptionExecutor] Risk screening failed:', error)
      return null
    })

    if (risk?.decision === 'block') {
      const reason =
        `Charge blocked by risk screening (score ${risk.riskScore}, ${risk.riskLevel}): ` +
        risk.factors.map((f) => f.reason).join('; ')
      console.warn(`[SubscriptionExecutor] ${subscription.id} — ${reason}`)
      await failIdempotency(idempotencyKey)
      return this.recordFailure(subscription, new Error(reason))
    }

    if (risk?.decision === 'review') {
      // Not blocked, but worth a trail: an unattended charge that trips review
      // is exactly what an operator wants to see after the fact.
      console.warn(
        `[SubscriptionExecutor] ${subscription.id} flagged for review ` +
        `(score ${risk.riskScore}): ${risk.factors.map((f) => f.name).join(', ')}`
      )
    }

    try {
      // Determine payment method
      const useERC3009 = isERC3009Supported(subscription.chain_id, subscription.token)
      const relayerReady = isRelayerConfigured()
      let method: PaymentExecutionResult['method'] = 'direct'
      let submission: ChargeSubmission

      if (!relayerReady) {
        // Fail the attempt loudly rather than recording a charge that never
        // happened on-chain.
        throw new Error(
          'No relayer configured (set RELAYER_API_KEY / RELAYER_URL). ' +
          'Refusing to record a subscription payment that was never submitted on-chain.'
        )
      }

      // Preferred path: the SubscriptionManager contract already holds the
      // payer's authorisation and enforces the terms itself, so a charge is a
      // single call with no per-period signature.
      if (subscription.onchain_subscription_id && subscription.manager_address) {
        method = 'contract'
        submission = await this.executeContractCharge(subscription)
      } else if (useERC3009) {
        // Fallback: the payer pre-signed one authorization per period.
        method = 'erc3009'
        submission = await this.executeERC3009Payment(subscription)
      } else {
        // Charging without the user present requires an authorisation they gave
        // ahead of time — either on-chain via the contract, or as a pre-signed
        // ERC-3009 authorization. Neither is available here.
        throw new Error(
          `${subscription.token} on chain ${subscription.chain_id} does not support ERC-3009, ` +
          'and this subscription is not registered with a SubscriptionManager contract. ' +
          'Recurring charges require one of the two.'
        )
      }

      const txHash = submission.txHash

      // The notice period was started; the charge itself happens on a later run
      // once the window closes. Nothing was paid and nothing failed, so this
      // leaves the billing period, the payment history, and the dunning counter
      // all untouched.
      if (submission.kind === 'announcement') {
        console.log(
          `[SubscriptionExecutor] Charge announced for ${subscription.id}: ${txHash} — ` +
          'awaiting notice period before it can execute.'
        )

        const announcedResult: PaymentExecutionResult = {
          subscriptionId: subscription.id,
          success: true,
          txHash,
          method,
          announced: true,
        }
        // Not cached as a completed period: the charge still has to run.
        await failIdempotency(idempotencyKey)
        return announcedResult
      }

      // An unconfirmed submission is not a payment. Record it as pending and
      // leave the billing period open — the settlement reconciliation job marks
      // it paid once the transaction is on-chain.
      //
      // Double-charging is prevented by the chain, not by this record: the
      // contract advances nextChargeAt, and an ERC-3009 nonce is single-use, so
      // a duplicate submission reverts rather than moving funds twice.
      if (!submission.confirmed) {
        console.log(
          `[SubscriptionExecutor] Charge submitted but not yet confirmed for ` +
          `${subscription.id}: ${txHash} — awaiting settlement.`
        )

        await prisma.subscriptionPayment.create({
          data: {
            subscription_id: subscription.id,
            amount: subscription.amount,
            tx_hash: txHash,
            status: 'pending',
          },
        }).catch((error) => {
          console.error('[SubscriptionExecutor] Failed to record pending payment:', error)
        })

        const pendingResult: PaymentExecutionResult = {
          subscriptionId: subscription.id,
          success: true,
          txHash,
          method,
          pending: true,
        }
        await completeIdempotency(idempotencyKey, 202, pendingResult)
        return pendingResult
      }

      // Record successful payment
      await subscriptionService.recordPayment(
        subscription.id,
        subscription.amount,
        txHash
      )

      // Clear dunning state: the schedule counts *consecutive* failures, so a
      // stale count would cut short the retries of an unrelated failure later.
      if ((subscription.failed_attempts ?? 0) > 0) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { failed_attempts: 0, last_failure_reason: null, last_failure_at: null },
        }).catch((error) => {
          console.error('[SubscriptionExecutor] Failed to clear dunning state:', error)
        })
      }

      // Send success notification
      await this.sendPaymentNotification(subscription, txHash, true)

      console.log(`[SubscriptionExecutor] Payment successful for ${subscription.id}: ${txHash}`)

      const result: PaymentExecutionResult = {
        subscriptionId: subscription.id,
        success: true,
        txHash,
        method,
      }

      // Store result in idempotency cache
      await completeIdempotency(idempotencyKey, 200, result)

      return result

    } catch (error) {
      // Mark idempotency as failed so the scheduled retry is allowed to run.
      await failIdempotency(idempotencyKey)
      return this.recordFailure(subscription, error)
    }
  }

  /**
   * Apply the dunning schedule to a failed charge.
   *
   * Retries a transient failure on a widening schedule and stops after the last
   * attempt; a failure that cannot succeed on retry stops immediately. Either
   * way the payer is told what happens next, because a silent failure leaves a
   * subscription that looks active but never charges.
   */
  private async recordFailure(
    subscription: Subscription,
    error: unknown
  ): Promise<PaymentExecutionResult> {
    const errorMessage = error instanceof Error ? error.message : String(error ?? 'Unknown error')
    const failedAttempts = subscription.failed_attempts ?? 0
    const decision = planNextAttempt(failedAttempts, error)

    console.error(
      `[SubscriptionExecutor] Charge failed for ${subscription.id} ` +
      `(attempt ${decision.attempt}, ${decision.kind}, ${decision.outcome}): ${errorMessage}`
    )

    try {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          failed_attempts: decision.attempt,
          last_failure_reason: errorMessage.slice(0, 500),
          last_failure_at: new Date(),
          // Giving up leaves the subscription in a state the payer must act on;
          // a scheduled retry keeps it live with the next attempt date set.
          status: decision.outcome === 'give_up' ? 'payment_failed' : subscription.status,
          ...(decision.nextAttemptAt ? { next_payment_date: decision.nextAttemptAt } : {}),
        },
      })
    } catch (updateError) {
      console.error('[SubscriptionExecutor] Failed to record dunning state:', updateError)
    }

    await this.sendPaymentNotification(
      subscription,
      '',
      false,
      dunningMessage(decision, subscription.service_name)
    )

    return {
      subscriptionId: subscription.id,
      success: false,
      error: errorMessage,
      method: 'direct',
      retryScheduledAt: decision.nextAttemptAt?.toISOString(),
      attempt: decision.attempt,
      gaveUp: decision.outcome === 'give_up',
    }
  }

  /**
   * Charge via the SubscriptionManager contract.
   *
   * The contract re-checks the amount, the interval, the recipient, and the
   * cancellation flag, so a rejected charge means the terms genuinely were not
   * met — this call carries no authority of its own and only pays gas.
   */
  private async executeContractCharge(subscription: Subscription): Promise<ChargeSubmission> {
    const managerAddress = subscription.manager_address as Address
    const subscriptionId = subscription.onchain_subscription_id as Hex

    if (!isSubscriptionId(subscriptionId)) {
      throw new Error(
        `Subscription ${subscription.id} has a malformed on-chain id: ${subscriptionId}`
      )
    }

    // Pre-flight against the contract's own view. Submitting a charge the
    // contract would reject just burns relayer gas and produces a failed
    // transaction, and the revert reason is far less useful after the fact.
    //
    // When the subscription carries a notice period, this also decides whether
    // the charge still needs announcing — the notice window is what lets the
    // payer cancel without racing the merchant, so it cannot be skipped.
    const action = await this.resolveChargeAction(subscription, managerAddress, subscriptionId)

    const data = encodeFunctionData({
      abi: SUBSCRIPTION_MANAGER_ABI,
      functionName: action,
      args: [subscriptionId],
    })

    const result = await relayerService.relay({
      chainId: subscription.chain_id,
      target: managerAddress,
      data,
    })

    const submission = toChargeSubmission(
      result,
      action === 'announceCharge'
        ? 'SubscriptionManager announceCharge failed'
        : 'SubscriptionManager charge failed'
    )

    if (action === 'announceCharge') {
      // Money has not moved: the notice period has only just started.
      return { ...submission, confirmed: false, kind: 'announcement' }
    }

    return submission
  }

  /**
   * Reject a charge the contract would reject anyway.
   *
   * `isChargeable` covers the schedule, the cancellation flag, the period cap,
   * and whether the payer can actually cover the amount.
   */
  private async resolveChargeAction(
    subscription: Subscription,
    managerAddress: Address,
    subscriptionId: Hex
  ): Promise<'charge' | 'announceCharge'> {
    const network = getNetworkByChainId(subscription.chain_id)
    // No RPC configured — let the relayer be the judge.
    if (!network?.rpcUrl) return 'charge'

    let chargeable: boolean
    let announceable: boolean
    try {
      const client = createPublicClient({ transport: http(network.rpcUrl) })
      const [c, a] = await Promise.all([
        client.readContract({
          address: managerAddress,
          abi: SUBSCRIPTION_MANAGER_ABI,
          functionName: 'isChargeable',
          args: [subscriptionId],
        }),
        client.readContract({
          address: managerAddress,
          abi: SUBSCRIPTION_MANAGER_ABI,
          functionName: 'isAnnounceable',
          args: [subscriptionId],
        }),
      ])
      chargeable = c as boolean
      announceable = a as boolean
    } catch (error) {
      // A failed pre-flight is not evidence the charge is invalid.
      console.warn('[SubscriptionExecutor] Pre-flight check failed, submitting anyway:', error)
      return 'charge'
    }

    if (chargeable) return 'charge'
    if (announceable) return 'announceCharge'

    throw new Error(
      `SubscriptionManager reports subscription ${subscriptionId} is neither chargeable nor ` +
      'announceable right now (not due, cancelled, expired, paused, budget exhausted, ' +
      'awaiting its notice period, or the payer lacks balance/allowance).'
    )
  }

  /**
   * Execute payment using ERC-3009 (gasless USDC transfer)
   */
  private async executeERC3009Payment(subscription: Subscription): Promise<ChargeSubmission> {
    if (!isRelayerConfigured()) {
      throw new Error('Relayer not configured')
    }

    // An ERC-3009 signature commits to (from, to, value, validAfter, validBefore,
    // nonce). We must submit the exact tuple the user signed — generating fresh
    // parameters here would make ecrecover return a different address and the
    // transfer would revert on-chain.
    const auth = await this.getStoredAuthorization(subscription)

    const result = await relayerService.executeERC3009Transfer({
      chainId: auth.chain_id,
      token: auth.token_address,
      from: auth.user_address as Address,
      to: auth.recipient_address as Address,
      value: auth.amount,
      validAfter: Math.floor(auth.valid_after.getTime() / 1000),
      validBefore: Math.floor(auth.valid_before.getTime() / 1000),
      nonce: auth.nonce as Hex,
      signature: auth.signature as Hex,
    })

    const submission = toChargeSubmission(result, 'Relayer execution failed')
    const txHash = submission.txHash

    // Burn the authorization even when the transaction is not yet confirmed:
    // the signature has been handed to the relayer, and re-submitting it later
    // would either double-charge or revert on a consumed nonce.
    await prisma.subscriptionAuthorization.update({
      where: { id: auth.id },
      data: { status: 'used', used_at: new Date(), tx_hash: txHash },
    })

    return submission
  }

  /**
   * Find the pre-signed authorization covering this charge.
   *
   * The user signs one authorization per billing period when they set up the
   * subscription. We take the unused one whose validity window covers now —
   * never a freshly generated tuple, which no signature would match.
   */
  private async getStoredAuthorization(subscription: Subscription) {
    const now = new Date()

    // owner_address is the payer; wallet_address/recipient_address is the
    // service being paid.
    const auth = await prisma.subscriptionAuthorization.findFirst({
      where: {
        subscription_id: subscription.id,
        user_address: subscription.owner_address.toLowerCase(),
        recipient_address: subscription.recipient_address.toLowerCase(),
        amount: subscription.amount,
        chain_id: subscription.chain_id,
        status: 'active',
        valid_after: { lte: now },
        valid_before: { gt: now },
      },
      // Consume in billing order; period_index is null on legacy rows, so fall
      // back to the soonest-expiring window.
      orderBy: [{ period_index: 'asc' }, { valid_before: 'asc' }],
    })

    if (!auth) {
      throw new Error(
        `No valid pre-signed authorization available for subscription ${subscription.id}. ` +
        'ERC-3009 authorizations are single-use and time-bounded — the user must sign ' +
        'authorizations covering this billing period before it can be charged.'
      )
    }

    // Rows created before migration 034 have no ERC-3009 tuple. Submitting a
    // partial one would build a signature payload the payer never signed, so it
    // would revert on-chain — refuse it here where the reason is still legible.
    const missing = (
      [
        ['user_address', auth.user_address],
        ['recipient_address', auth.recipient_address],
        ['amount', auth.amount],
        ['token_address', auth.token_address],
        ['chain_id', auth.chain_id],
        ['nonce', auth.nonce],
        ['valid_after', auth.valid_after],
        ['valid_before', auth.valid_before],
      ] as const
    )
      .filter(([, value]) => value === null || value === undefined)
      .map(([field]) => field)

    if (missing.length > 0) {
      throw new Error(
        `Authorization ${auth.id} for subscription ${subscription.id} is missing ` +
        `${missing.join(', ')} — it predates the full ERC-3009 tuple and cannot be ` +
        'submitted. The payer must re-authorize.'
      )
    }

    return auth as typeof auth & {
      user_address: string
      recipient_address: string
      amount: string
      token_address: string
      chain_id: number
      nonce: string
      valid_after: Date
      valid_before: Date
    }
  }

  /**
   * Send payment notification
   */
  private async sendPaymentNotification(
    subscription: Subscription,
    txHash: string,
    success: boolean,
    /**
     * Failure detail from the dunning schedule. Without it the payer cannot
     * tell a charge that will be retried from one that has stopped for good.
     */
    failureDetail?: string
  ): Promise<void> {
    try {
      await notificationService.send(
        subscription.owner_address,
        'subscription_payment',
        {
          title: success ? 'Subscription Payment Successful' : 'Subscription Payment Failed',
          body: success
            ? `Your ${subscription.service_name} subscription payment of ${subscription.amount} ${subscription.token} was successful.`
            : failureDetail ||
              `Your ${subscription.service_name} subscription payment failed.`,
          data: {
            subscription_id: subscription.id,
            service_name: subscription.service_name,
            amount: subscription.amount,
            token: subscription.token,
            tx_hash: txHash,
            status: success ? 'completed' : 'failed',
          },
        }
      )
    } catch (error) {
      console.warn('[SubscriptionExecutor] Failed to send notification:', error)
    }
  }

}

// Export singleton
export const subscriptionPaymentExecutor = new SubscriptionPaymentExecutor()

/**
 * Cron job handler for processing subscriptions
 * Called by /api/cron/subscriptions
 */
export async function processSubscriptionsCron(): Promise<{
  processed: number
  successful: number
  failed: number
}> {
  const results = await subscriptionPaymentExecutor.processDueSubscriptions()

  return {
    processed: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
  }
}
