import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { commerceFailure } from "@/lib/agent/commerce-http"
import { disputeOrder } from "@/lib/agent/commerce"

export const dynamic = "force-dynamic"

export const POST = withAuth(async (request: NextRequest, owner: string) => {
  try {
    const body = await request.json()
    if (typeof body.orderId !== "string" || !body.reason?.trim()) {
      return NextResponse.json({ error: "orderId and reason are required" }, { status: 400 })
    }
    return NextResponse.json({ ok: true, order: await disputeOrder(owner, body.orderId.trim(), body.reason) })
  } catch (error) {
    return commerceFailure(error, "commerce/orders/dispute")
  }
}, { component: "commerce-orders-dispute" })
