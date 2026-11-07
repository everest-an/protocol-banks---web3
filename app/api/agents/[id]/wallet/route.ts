import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { agentService } from "@/lib/services/agent-service"
import {
  AgentWalletConfigError,
  createAgentWallet,
  getAgentWallet,
  hasAgentWalletSecret,
  revokeAgentWallet,
  rotateAgentWallet,
  toPublicWallet,
} from "@/lib/agent/wallet"

function errorResponse(error: unknown) {
  if (error instanceof AgentWalletConfigError) {
    return NextResponse.json(
      { error: "Agent wallet custody is not configured on this deployment." },
      { status: 503 },
    )
  }
  const message = error instanceof Error ? error.message : "Wallet operation failed"
  const status = message.includes("not found")
    ? 404
    : message.includes("revoked")
      ? 409
      : 400
  return NextResponse.json({ error: message }, { status })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async (_req, address) => {
    try {
      const { id } = await params
      const agent = await agentService.get(id, address)
      if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 })

      const wallet = await getAgentWallet(id)
      return NextResponse.json({
        wallet: toPublicWallet(wallet),
        configured: hasAgentWalletSecret(),
      })
    } catch (error) {
      return errorResponse(error)
    }
  }, { component: "agents-id-wallet" })(request)
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

      const body = await req.json().catch(() => ({}))
      const action = typeof body.action === "string" ? body.action : "create"

      if (!hasAgentWalletSecret()) {
        return NextResponse.json(
          { error: "AGENT_WALLET_SECRET is not configured (64 hex chars)." },
          { status: 503 },
        )
      }

      if (action === "create") {
        const wallet = await createAgentWallet(id, address, body.label)
        return NextResponse.json({ success: true, wallet: toPublicWallet(wallet) }, { status: 201 })
      }
      if (action === "rotate") {
        const wallet = await rotateAgentWallet(id, address, body.label)
        return NextResponse.json({ success: true, wallet: toPublicWallet(wallet) }, { status: 201 })
      }
      if (action === "revoke") {
        await revokeAgentWallet(id)
        return NextResponse.json({ success: true })
      }

      return NextResponse.json(
        { error: "Unknown action. Use one of: create, rotate, revoke" },
        { status: 400 },
      )
    } catch (error) {
      return errorResponse(error)
    }
  }, { component: "agents-id-wallet" })(request)
}
