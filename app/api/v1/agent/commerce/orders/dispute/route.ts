import { NextResponse } from "next/server"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import { CommerceError, disputeOrder } from "@/lib/agent/commerce"

async function handler(request: AgentRequest) {
  try {
    const body = await request.json()
    if (typeof body.orderId !== "string" || !body.orderId.trim()) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 })
    }
    if (typeof body.reason !== "string" || !body.reason.trim()) {
      return NextResponse.json({ error: "reason is required" }, { status: 400 })
    }
    const order = await disputeOrder(request.ownerAddress as string, body.orderId.trim(), body.reason)
    return NextResponse.json({ ok: true, order })
  } catch (error) {
    if (error instanceof CommerceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[commerce/orders/dispute] failed:", error)
    return NextResponse.json({ error: "dispute failed" }, { status: 500 })
  }
}

export const POST = withAgentAuth(handler, "pay")
