import { NextResponse } from "next/server"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import { CommerceError, refundOrder } from "@/lib/agent/commerce"

async function handler(request: AgentRequest) {
  try {
    const body = await request.json()
    if (typeof body.orderId !== "string" || !body.orderId.trim()) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 })
    }
    if (typeof body.txHash !== "string" || !body.txHash.trim()) {
      return NextResponse.json({ error: "txHash is required" }, { status: 400 })
    }
    const order = await refundOrder(request.ownerAddress as string, body.orderId.trim(), body.txHash.trim())
    return NextResponse.json({ ok: true, order })
  } catch (error) {
    if (error instanceof CommerceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[commerce/orders/refund] failed:", error)
    return NextResponse.json({ error: "refund failed" }, { status: 500 })
  }
}

export const POST = withAgentAuth(handler, "pay")
