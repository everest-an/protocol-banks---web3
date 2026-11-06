import { NextResponse } from "next/server"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import { CommerceError, createService, listServices } from "@/lib/agent/commerce"

async function getHandler(request: AgentRequest) {
  try {
    const query = request.nextUrl.searchParams
    return NextResponse.json({
      ok: true,
      services: await listServices({
        category: query.get("category"),
        q: query.get("q"),
        limit: Number.parseInt(query.get("limit") || "50", 10),
      }),
    })
  } catch (error) {
    return failure(error)
  }
}

async function postHandler(request: AgentRequest) {
  try {
    const body = await request.json()
    const service = await createService(request.ownerAddress as string, request.agentId, body)
    return NextResponse.json({ ok: true, service }, { status: 201 })
  } catch (error) {
    return failure(error)
  }
}

function failure(error: unknown) {
  if (error instanceof CommerceError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error("[commerce/services] failed:", error)
  return NextResponse.json({ error: "service request failed" }, { status: 500 })
}

export const GET = withAgentAuth(getHandler, "read")
export const POST = withAgentAuth(postHandler, "pay")
