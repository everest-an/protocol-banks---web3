import { NextResponse } from "next/server"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import { CommerceError, createQuote, listQuotes } from "@/lib/agent/commerce"

async function getHandler(request: AgentRequest) {
  try {
    const role = request.nextUrl.searchParams.get("role") || "all"
    return NextResponse.json({
      ok: true,
      quotes: await listQuotes(request.ownerAddress as string, role),
    })
  } catch (error) {
    return failure(error)
  }
}

async function postHandler(request: AgentRequest) {
  try {
    const body = await request.json()
    const quote = await createQuote(request.ownerAddress as string, body)
    return NextResponse.json({ ok: true, quote }, { status: 201 })
  } catch (error) {
    return failure(error)
  }
}

function failure(error: unknown) {
  if (error instanceof CommerceError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error("[commerce/quotes] failed:", error)
  return NextResponse.json({ error: "quote request failed" }, { status: 500 })
}

export const GET = withAgentAuth(getHandler, "read")
export const POST = withAgentAuth(postHandler, "pay")
