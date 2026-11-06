import { NextResponse } from "next/server"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import { CommerceError, getReputation } from "@/lib/agent/commerce"

async function handler(request: AgentRequest) {
  try {
    const address = request.nextUrl.searchParams.get("address")
    if (!address) return NextResponse.json({ error: "address is required" }, { status: 400 })
    return NextResponse.json({ ok: true, reputation: await getReputation(address) })
  } catch (error) {
    if (error instanceof CommerceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[commerce/reputation] failed:", error)
    return NextResponse.json({ error: "reputation request failed" }, { status: 500 })
  }
}

export const GET = withAgentAuth(handler, "read")
