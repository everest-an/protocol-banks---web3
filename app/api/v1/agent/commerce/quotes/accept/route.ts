import { NextResponse } from "next/server"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import { acceptQuote, CommerceError } from "@/lib/agent/commerce"

async function handler(request: AgentRequest) {
  try {
    const body = await request.json()
    if (typeof body.quoteId !== "string" || !body.quoteId.trim()) {
      return NextResponse.json({ error: "quoteId is required" }, { status: 400 })
    }
    const order = await acceptQuote(request.ownerAddress as string, body.quoteId.trim())
    return NextResponse.json({
      ok: true,
      order,
      payment: {
        endpoint: "POST /api/v1/agent/pay",
        orderId: order.id,
        seller: order.seller,
        amountUsd: order.amountUsd,
        token: order.token,
        chain: order.chain,
        termsHash: order.termsHash,
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof CommerceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[commerce/quotes/accept] failed:", error)
    return NextResponse.json({ error: "quote accept failed" }, { status: 500 })
  }
}

export const POST = withAgentAuth(handler, "pay")
