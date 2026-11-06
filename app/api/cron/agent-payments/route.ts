// rls:system — cron route: reconciles agent payments without a wallet context.
import { NextRequest, NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron-auth"
import { paymentEventData, reconcileAgentPayments } from "@/lib/agent/payment-store"
import { markOrderPaid, releaseOrderPayment } from "@/lib/agent/commerce"
import { webhookTriggerService } from "@/lib/services/webhook-trigger-service"

export const dynamic = "force-dynamic"

/**
 * GET /api/cron/agent-payments
 *
 * Every few minutes: check submitted agent payments against the chain receipt,
 * advance them to confirmed/failed, and queue the matching webhook.
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  try {
    const changes = await reconcileAgentPayments(50)
    let webhooksQueued = 0

    for (const change of changes) {
      try {
        const data = paymentEventData(change.payment)
        if (change.payment.order_id) {
          if (change.status === "confirmed") {
            await markOrderPaid(change.payment.order_id, change.payment.id).catch(() => {})
          } else {
            await releaseOrderPayment(change.payment.order_id, change.payment.id).catch(() => {})
          }
        }
        if (change.status === "confirmed") {
          await webhookTriggerService.triggerPaymentCompleted(change.payment.owner_address, data)
        } else {
          await webhookTriggerService.triggerPaymentFailed(change.payment.owner_address, data)
        }
        webhooksQueued++
      } catch (error) {
        console.error("[cron/agent-payments] webhook queue failed:", error)
      }
    }

    return NextResponse.json({ ok: true, reconciled: changes.length, webhooksQueued })
  } catch (error) {
    console.error("[cron/agent-payments] failed:", error)
    return NextResponse.json({ ok: false, error: "reconciliation failed" }, { status: 500 })
  }
}
