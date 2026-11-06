import { NextResponse } from "next/server"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import { CommerceError, completeOrder } from "@/lib/agent/commerce"

async function handler(request: AgentRequest) {
  try {
    const body = await request.json()
    if (typeof body.orderId !== "string" || !body.orderId.trim()) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 })
    }
    const order = await completeOrder(request.ownerAddress as string, body.orderId.trim())
    return NextResponse.json({ ok: true, order })
  } catch (error) {
    if (error instanceof CommerceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[commerce/orders/complete] failed:", error)
    return NextResponse.json({ error: "completion failed" }, { status: 500 })
  }
}

export const POST = withAgentAuth(handler, "pay")
