import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { agentService } from "@/lib/services/agent-service"
import {
  AgentWalletConfigError,
  hasAgentWalletSecret,
  signWithAgentWallet,
  type AgentWalletSignRequest,
} from "@/lib/agent/wallet"

function errorResponse(error: unknown) {
  if (error instanceof AgentWalletConfigError) {
    return NextResponse.json(
      { error: "Agent wallet custody is not configured on this deployment." },
      { status: 503 },
    )
  }
  const message = error instanceof Error ? error.message : "Signing failed"
  const status = message.includes("not found")
    ? 404
    : message.includes("revoked")
      ? 409
      : 400
  return NextResponse.json({ error: message }, { status })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async (req, address) => {
    try {
      const { id } = await params
      const agent = await agentService.get(id, address)
      if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 })

      if (!hasAgentWalletSecret()) {
        return NextResponse.json(
          { error: "AGENT_WALLET_SECRET is not configured (64 hex chars)." },
          { status: 503 },
        )
      }

      const body = await req.json().catch(() => ({}))
      let signRequest: AgentWalletSignRequest

      if (body.kind === "message") {
        signRequest = { kind: "message", message: body.message }
      } else if (body.kind === "typedData") {
        if (
          !body.domain ||
          typeof body.domain !== "object" ||
          !body.types ||
          typeof body.types !== "object" ||
          Array.isArray(body.types) ||
          !body.value ||
          typeof body.value !== "object" ||
          Array.isArray(body.value)
        ) {
          return NextResponse.json(
            { error: "typedData requires domain, types and value objects" },
            { status: 400 },
          )
        }
        signRequest = {
          kind: "typedData",
          domain: body.domain,
          types: body.types,
          value: body.value,
          primaryType: typeof body.primaryType === "string" ? body.primaryType : undefined,
        }
      } else {
        return NextResponse.json(
          { error: 'kind must be "message" or "typedData"' },
          { status: 400 },
        )
      }

      const result = await signWithAgentWallet(id, signRequest)
      return NextResponse.json({ success: true, ...result })
    } catch (error) {
      return errorResponse(error)
    }
  }, { component: "agents-id-wallet-sign" })(request)
}
