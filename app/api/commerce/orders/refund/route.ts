import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { commerceFailure } from "@/lib/agent/commerce-http"
import { refundOrder } from "@/lib/agent/commerce"

export const dynamic = "force-dynamic"

export const POST = withAuth(async (request: NextRequest, owner: string) => {
  try {
    const body = await request.json()
    if (typeof body.orderId !== "string" || typeof body.txHash !== "string") {
      return NextResponse.json({ error: "orderId and txHash are required" }, { status: 400 })
    }
    return NextResponse.json({ ok: true, order: await refundOrder(owner, body.orderId.trim(), body.txHash.trim()) })
  } catch (error) {
    return commerceFailure(error, "commerce/orders/refund")
  }
}, { component: "commerce-orders-refund" })
