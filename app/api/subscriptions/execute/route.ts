/**
 * Subscription Execution API
 * POST /api/subscriptions/execute
 *
 * Executes due subscriptions. Should be called by a cron job.
 * Requires CRON_SECRET for authentication.
 */

import { NextRequest, NextResponse } from "next/server"
import { subscriptionService, type Subscription } from "@/lib/services/subscription-service"
import { checkAuthorizationValidity } from "@/lib/subscription-helpers"
import { webhookTriggerService, type SubscriptionEventData } from "@/lib/services/webhook-trigger-service"
import { submitBatchPayment } from "@/lib/grpc/payout-bridge"
import { getTokenAddress, CHAIN_IDS } from "@/lib/web3"
import { createClient } from "@/lib/supabase/client"

// ============================================
// Types
// ============================================

interface ExecutionResult {
  subscription_id: string
  service_name: string
  amount: string
  status: "success" | "failed" | "skipped"
  tx_hash?: string
  error?: string
}

interface ExecutionSummary {
  total_processed: number
  successful: number
  failed: number
  skipped: number
  results: ExecutionResult[]
}

// ============================================
// Cron Authentication
// ============================================

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn("[SubscriptionExecute] CRON_SECRET not configured")
    return false
  }

  if (!authHeader) {
    return false
  }

  // Support both "Bearer <secret>" and direct secret
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader

  return token === cronSecret
}

// ============================================
// Session Key Verification
// ============================================

async function getActiveSessionKey(
  ownerAddress: string,
  chainId: number
): Promise<{ sessionKeyAddress: string; privateKey: string } | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from("session_keys")
    .select("*")
    .eq("owner_address", ownerAddress.toLowerCase())
    .eq("chain_id", chainId)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return {
    sessionKeyAddress: data.session_key_address,
    privateKey: data.encrypted_private_key, // In production, decrypt this
  }
}

// ============================================
// Payment Execution
// ============================================

async function executePaymentForSubscription(
  subscription: Subscription
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  // Determine chain ID from subscription or default to Base
  const chainIdMap: Record<string, number> = {
    ethereum: CHAIN_IDS.MAINNET,
    base: CHAIN_IDS.BASE,
    arbitrum: CHAIN_IDS.ARBITRUM,
    sepolia: CHAIN_IDS.SEPOLIA,
  }
  const chainId = chainIdMap[subscription.chain?.toLowerCase() || "base"] || CHAIN_IDS.BASE

  // Check for active session key
  const sessionKey = await getActiveSessionKey(subscription.owner_address, chainId)

  if (!sessionKey) {
    // No session key - check if user has pre-authorized this subscription
    // For now, we'll use the payout bridge which may require user intervention
    console.log(
      `[SubscriptionExecute] No session key for ${subscription.owner_address}, attempting payout bridge`
    )
  }

  // Get token address
  const tokenAddress = getTokenAddress(chainId, subscription.token)
  if (!tokenAddress) {
    return {
      success: false,
      error: `Token ${subscription.token} not supported on chain ${chainId}`,
    }
  }

  try {
    // Submit payment via payout bridge
    const result = await submitBatchPayment(
      subscription.owner_address, // userId
      subscription.wallet_address || subscription.owner_address, // senderAddress
      [
        {
          address: subscription.recipient_address,
          amount: subscription.amount,
          token: tokenAddress,
          chainId,
          vendorName: subscription.service_name,
        },
      ],
      {
        priority: "medium",
      }
    )

    if (result.status === "completed" || result.status === "processing") {
      const txHash = result.transactions[0]?.txHash || result.batchId
      return {
        success: true,
        txHash,
      }
    } else if (result.status === "partial_failure" || result.status === "failed") {
      return {
        success: false,
        error: result.transactions[0]?.error || "Payment failed",
      }
    }

    // Pending - consider it success for now, will be confirmed later
    return {
      success: true,
      txHash: result.batchId,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Payment execution failed",
    }
  }
}

// ============================================
// Subscription Execution
// ============================================

async function executeSubscription(subscription: Subscription): Promise<ExecutionResult> {
  const result: ExecutionResult = {
    subscription_id: subscription.id,
    service_name: subscription.service_name,
    amount: subscription.amount,
    status: "success",
  }

  try {
    // Skip non-active subscriptions
    if (subscription.status !== "active") {
      result.status = "skipped"
      result.error = `Subscription status is ${subscription.status}`
      return result
    }

    // Authorization validity check (spending cap + expiry)
    const authCheck = checkAuthorizationValidity({
      ...subscription,
      next_payment: subscription.next_payment_date || undefined,
      last_payment: subscription.last_payment_date || undefined,
    } as any)

    if (!authCheck.valid) {
      result.status = "skipped"
      result.error = authCheck.reason || "authorization_expired"
      console.log(`[SubscriptionExecute] Skipping ${subscription.id}: ${authCheck.reason}`)
      return result
    }

    // Trigger payment_due webhook
    const eventData: SubscriptionEventData = {
      subscription_id: subscription.id,
      owner_address: subscription.owner_address,
      service_name: subscription.service_name,
      wallet_address: subscription.wallet_address,
      amount: subscription.amount,
      token: subscription.token,
      frequency: subscription.frequency,
      status: subscription.status,
      next_payment_date: subscription.next_payment_date || undefined,
      created_at: subscription.created_at,
    }

    await webhookTriggerService.triggerSubscriptionPaymentDue(subscription.owner_address, eventData)

    // Execute the actual payment
    const paymentResult = await executePaymentForSubscription(subscription)

    if (!paymentResult.success) {
      throw new Error(paymentResult.error || "Payment failed")
    }

    result.tx_hash = paymentResult.txHash

    // Record successful payment with transaction hash
    await subscriptionService.recordPayment(subscription.id, subscription.amount, paymentResult.txHash)

    // Trigger payment_completed webhook
    await webhookTriggerService.triggerSubscriptionPaymentCompleted(subscription.owner_address, {
      ...eventData,
      status: "active",
    })

    console.log(
      `[SubscriptionExecute] Successfully processed subscription ${subscription.id}, tx: ${paymentResult.txHash}`
    )
  } catch (error) {
    result.status = "failed"
    result.error = error instanceof Error ? error.message : "Unknown error"

    // Record payment failure
    try {
      await subscriptionService.recordPaymentFailure(subscription.id, result.error)

      // Trigger payment_failed webhook
      const eventData: SubscriptionEventData = {
        subscription_id: subscription.id,
        owner_address: subscription.owner_address,
        service_name: subscription.service_name,
        wallet_address: subscription.wallet_address,
        amount: subscription.amount,
        token: subscription.token,
        frequency: subscription.frequency,
        status: "failed",
        created_at: subscription.created_at,
      }

      await webhookTriggerService.triggerSubscriptionPaymentFailed(subscription.owner_address, {
        ...eventData,
        error: result.error,
      })
    } catch (recordError) {
      console.error(`[SubscriptionExecute] Failed to record failure:`, recordError)
    }

    console.error(`[SubscriptionExecute] Failed to process subscription ${subscription.id}:`, error)
  }

  return result
}

// ============================================
// API Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Verify cron authentication
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Parse optional parameters
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 100, 500) // Max 500 per execution
    const dryRun = body.dryRun === true // Allow dry run for testing

    console.log(`[SubscriptionExecute] Starting execution with limit ${limit}, dryRun: ${dryRun}`)

    // Get due subscriptions
    const dueSubscriptions = await subscriptionService.getDueSubscriptions(limit)

    console.log(`[SubscriptionExecute] Found ${dueSubscriptions.length} due subscriptions`)

    if (dryRun) {
      // Dry run - just return what would be executed
      return NextResponse.json({
        success: true,
        dryRun: true,
        summary: {
          total_due: dueSubscriptions.length,
          subscriptions: dueSubscriptions.map((s) => ({
            id: s.id,
            service_name: s.service_name,
            amount: s.amount,
            token: s.token,
            recipient: s.recipient_address,
          })),
        },
      })
    }

    // Execute each subscription
    const results: ExecutionResult[] = []
    for (const subscription of dueSubscriptions) {
      const result = await executeSubscription(subscription)
      results.push(result)

      // Small delay between executions to avoid rate limiting
      if (results.length < dueSubscriptions.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    // Calculate summary
    const summary: ExecutionSummary = {
      total_processed: results.length,
      successful: results.filter((r) => r.status === "success").length,
      failed: results.filter((r) => r.status === "failed").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      results,
    }

    console.log(
      `[SubscriptionExecute] Completed: ${summary.successful} success, ${summary.failed} failed, ${summary.skipped} skipped`
    )

    return NextResponse.json({
      success: true,
      summary,
    })
  } catch (error) {
    console.error("[SubscriptionExecute] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}

// Also support GET for health checks
export async function GET(request: NextRequest) {
  // Verify cron authentication for GET as well
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get count of due subscriptions without executing
    const dueSubscriptions = await subscriptionService.getDueSubscriptions(1000)

    return NextResponse.json({
      success: true,
      due_count: dueSubscriptions.length,
      message: "Use POST to execute due subscriptions",
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    )
  }
}
