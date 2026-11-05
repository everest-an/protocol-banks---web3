// rls:system — cron route: delivers queued webhooks (payment receipts etc.).
import { NextRequest, NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron-auth"
import { processWebhookDeliveries } from "@/lib/services/webhook-trigger-service"

export const dynamic = "force-dynamic"

/** GET /api/cron/webhooks — process pending/retrying webhook deliveries. */
export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  try {
    const result = await processWebhookDeliveries()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[cron/webhooks] failed:", error)
    return NextResponse.json({ ok: false, error: "webhook delivery failed" }, { status: 500 })
  }
}
