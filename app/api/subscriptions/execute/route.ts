/**
 * Subscription Execution API
 * POST /api/subscriptions/execute
 * 
 * Executes due subscriptions. Should be called by a cron job.
 * Requires CRON_SECRET for authentication.
 */

import { NextRequest, NextResponse } from "next/server"
import { subscriptionService, type Subscription } from "@/lib/services/subscription-service"
import { webhookTriggerService, type SubscriptionEventData } from "@/lib/services/webhook-trigger-service"
import { executeSubscriptionPayment } from "@/lib/services/payment-service" // Declare the variable here

// ============================================
// Types
// ============================================

interface ExecutionResult {
  subscription_id: string
  service_name: string
  amount: string
  status: "success" | "failed" | "skipped"
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
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader

  return token === cronSecret
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

    await webhookTriggerService.triggerSubscriptionPaymentDue(
      subscription.owner_address,
      eventData
    )

    // Execute the actual payment
    // In production, this calls the payment execution service
    // For now, we record the payment and trigger webhooks
    const paymentResult = await executeSubscriptionPayment(subscription)
    
    if (!paymentResult.success) {
      throw new Error(paymentResult.error || 'Payment execution failed')
    }

    // Record successful payment and reset failure count
    await subscriptionService.recordPayment(subscription.id, subscription.amount)
    await subscriptionService.resetFailureCount(subscription.id)

    // Trigger payment_completed webhook
    await webhookTriggerService.triggerSubscriptionPaymentCompleted(
      subscription.owner_address,
      {
        ...eventData,
        status: "active",
      }
    )

    console.log(`[SubscriptionExecute] Successfully processed subscription ${subscription.id}`)
  } catch (error) {
    result.status = "failed"
    result.error = error instanceof Error ? error.message : "Unknown error"

    // Record payment failure
    try {
      await subscriptionService.recordPaymentFailure(subscription.id, result.error)
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
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Parse optional parameters
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 100, 500) // Max 500 per execution

    console.log(`[SubscriptionExecute] Starting execution with limit ${limit}`)

    // Get due subscriptions
    const dueSubscriptions = await subscriptionService.getDueSubscriptions(limit)

    console.log(`[SubscriptionExecute] Found ${dueSubscriptions.length} due subscriptions`)

    // Execute each subscription
    const results: ExecutionResult[] = []
    for (const subscription of dueSubscriptions) {
      const result = await executeSubscription(subscription)
      results.push(result)

      // Small delay between executions to avoid rate limiting
      if (results.length < dueSubscriptions.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Calculate summary
    const summary: ExecutionSummary = {
      total_processed: results.length,
      successful: results.filter(r => r.status === "success").length,
      failed: results.filter(r => r.status === "failed").length,
      skipped: results.filter(r => r.status === "skipped").length,
      results,
    }

    console.log(`[SubscriptionExecute] Completed: ${summary.successful} success, ${summary.failed} failed, ${summary.skipped} skipped`)

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
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    )
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
