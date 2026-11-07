import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { commerceFailure } from "@/lib/agent/commerce-http"
import { completeOrder } from "@/lib/agent/commerce"

export const dynamic = "force-dynamic"

export const POST = withAuth(async (request: NextRequest, owner: string) => {
  try {
    const body = await request.json()
    if (typeof body.orderId !== "string" || !body.orderId.trim()) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 })
    }
    return NextResponse.json({ ok: true, order: await completeOrder(owner, body.orderId.trim()) })
  } catch (error) {
    return commerceFailure(error, "commerce/orders/complete")
  }
}, { component: "commerce-orders-complete" })
