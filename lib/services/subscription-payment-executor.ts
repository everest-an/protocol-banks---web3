/**
 * Subscription Payment Executor
 *
 * Processes due subscription payments using ERC-3009 (gasless USDC transfers)
 * or x402 protocol with direct service calls (no HTTP fetch for server-side).
 *
 * Execution paths:
 * 1. ERC-3009 + Relayer: Gasless USDC transfer using pre-stored authorization
 * 2. x402 Service: Direct service call via agentX402Service
 * 3. Development fallback: Mock tx hash when no relayer configured
 */

import { subscriptionService, type Subscription } from './subscription-service'
import {
  isERC3009Supported,
  createTransferAuthorization,
  type TransferWithAuthorization,
} from '../erc3009'
import { agentX402Service } from './agent-x402-service'
import { notificationService } from './notification-service'
import { relayerService, isRelayerConfigured } from './relayer-service'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'
import type { Hex, Address } from 'viem'

export interface PaymentExecutionResult {
  subscriptionId: string
  success: boolean
  txHash?: string
  error?: string
  method: 'erc3009' | 'x402' | 'direct'
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
   * Execute a single subscription payment
   */
  async executePayment(subscription: Subscription): Promise<PaymentExecutionResult> {
    console.log(`[SubscriptionExecutor] Processing subscription ${subscription.id}`)

    try {
      // Determine payment method
      const useERC3009 = isERC3009Supported(subscription.chain_id, subscription.token)
      const relayerReady = isRelayerConfigured()
      let method: PaymentExecutionResult['method'] = 'direct'
      let txHash: string

      if (useERC3009 && relayerReady) {
        // Use ERC-3009 gasless transfer via relayer
        method = 'erc3009'
        txHash = await this.executeERC3009Payment(subscription)
      } else if (relayerReady) {
        // Use x402 protocol via direct service call
        method = 'x402'
        txHash = await this.executeX402Payment(subscription)
      } else {
        // Fallback: simulate for development
        console.warn('[SubscriptionExecutor] No relayer configured, simulating payment')
        method = 'direct'
        txHash = this.generateMockTxHash()
      }

      // Record successful payment
      await subscriptionService.recordPayment(
        subscription.id,
        subscription.amount,
        txHash
      )

      // Send success notification
      await this.sendPaymentNotification(subscription, txHash, true)

      console.log(`[SubscriptionExecutor] Payment successful for ${subscription.id}: ${txHash}`)

      return {
        subscriptionId: subscription.id,
        success: true,
        txHash,
        method,
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[SubscriptionExecutor] Payment failed for ${subscription.id}:`, errorMessage)

      // Record failure
      await subscriptionService.recordPaymentFailure(subscription.id, errorMessage)

      // Send failure notification
      await this.sendPaymentNotification(subscription, '', false)

      return {
        subscriptionId: subscription.id,
        success: false,
        error: errorMessage,
        method: 'erc3009',
      }
    }
  }

  /**
   * Execute payment using ERC-3009 (gasless USDC transfer)
   */
  private async executeERC3009Payment(subscription: Subscription): Promise<string> {
    if (!isRelayerConfigured()) {
      throw new Error('Relayer not configured')
    }

    // Create authorization
    const authorization = createTransferAuthorization({
      from: subscription.wallet_address,
      to: subscription.recipient_address,
      amount: subscription.amount,
      validityMinutes: 60,
    })

    // Retrieve pre-stored authorization signature from database
    const signature = await this.getStoredAuthorization(subscription.id, authorization)

    // Execute via relayer service
    const result = await relayerService.executeERC3009Transfer({
      chainId: subscription.chain_id,
      token: subscription.token,
      from: subscription.wallet_address as Address,
      to: subscription.recipient_address as Address,
      value: subscription.amount,
      validAfter: authorization.validAfter,
      validBefore: authorization.validBefore,
      nonce: authorization.nonce as Hex,
      signature: signature as Hex,
    })

    if (result.status === 'failed') {
      throw new Error(result.error || 'Relayer execution failed')
    }

    return result.transactionHash || result.taskId
  }

  /**
   * Execute payment using x402 protocol via direct service call.
   * No HTTP fetch - calls agentX402Service directly for server-side execution.
   */
  private async executeX402Payment(subscription: Subscription): Promise<string> {
    // Build a proposal-like object for the x402 service
    const proposalLike = {
      id: subscription.id,
      status: 'approved' as const,
      recipient_address: subscription.recipient_address,
      amount: subscription.amount,
      token: subscription.token,
      chain_id: subscription.chain_id,
      reason: `Subscription payment: ${subscription.service_name}`,
    }

    // Execute via x402 service directly (no HTTP roundtrip)
    const result = await agentX402Service.processProposalPayment(
      proposalLike as any,
      subscription.wallet_address
    )

    if (!result.success) {
      throw new Error(result.error || 'x402 execution failed')
    }

    return result.tx_hash || ''
  }

  /**
   * Get stored authorization signature for subscription.
   * Retrieves pre-signed authorizations from the database (stored when user
   * initially approved the subscription).
   */
  private async getStoredAuthorization(
    subscriptionId: string,
    authorization: TransferWithAuthorization
  ): Promise<string> {
    try {
      const supabase = await createClient()

      // Look up stored authorization signature for this subscription
      const { data, error } = await supabase
        .from('subscription_authorizations')
        .select('signature')
        .eq('subscription_id', subscriptionId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!error && data?.signature) {
        return data.signature
      }

      // Fallback: check x402_authorizations table for a matching pre-authorization
      const { data: x402Data } = await supabase
        .from('x402_authorizations')
        .select('signature')
        .eq('from_address', authorization.from.toLowerCase())
        .eq('to_address', authorization.to.toLowerCase())
        .eq('status', 'signed')
        .gt('valid_before', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (x402Data?.signature) {
        return x402Data.signature
      }
    } catch (error) {
      console.error('[SubscriptionExecutor] Failed to get stored authorization:', error)
    }

    // If no stored authorization, this subscription needs manual re-authorization
    throw new Error('Subscription requires re-authorization by the user')
  }

  /**
   * Send payment notification
   */
  private async sendPaymentNotification(
    subscription: Subscription,
    txHash: string,
    success: boolean
  ): Promise<void> {
    try {
      await notificationService.send(
        subscription.owner_address,
        'subscription_payment',
        {
          title: success ? 'Subscription Payment Successful' : 'Subscription Payment Failed',
          body: success
            ? `Your ${subscription.service_name} subscription payment of ${subscription.amount} ${subscription.token} was successful.`
            : `Your ${subscription.service_name} subscription payment failed. We will retry automatically.`,
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

  /**
   * Generate mock transaction hash for development
   */
  private generateMockTxHash(): string {
    return '0x' + randomBytes(32).toString('hex')
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
