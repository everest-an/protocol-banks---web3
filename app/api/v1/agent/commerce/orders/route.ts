import { NextResponse } from "next/server"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import { CommerceError, getOrder, listOrders } from "@/lib/agent/commerce"

async function handler(request: AgentRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id")
    if (id) {
      return NextResponse.json({ ok: true, order: await getOrder(request.ownerAddress as string, id) })
    }
    return NextResponse.json({
      ok: true,
      orders: await listOrders(request.ownerAddress as string),
    })
  } catch (error) {
    if (error instanceof CommerceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[commerce/orders] failed:", error)
    return NextResponse.json({ error: "order request failed" }, { status: 500 })
  }
}

export const GET = withAgentAuth(handler, "read")
