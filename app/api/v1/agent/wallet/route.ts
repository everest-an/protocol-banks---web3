import { NextResponse } from "next/server"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import {
  AgentWalletConfigError,
  getAgentWallet,
  hasAgentWalletSecret,
  toPublicWallet,
} from "@/lib/agent/wallet"

export const dynamic = "force-dynamic"

async function handler(request: AgentRequest) {
  if (!request.agentId) {
    return NextResponse.json(
      { error: "This endpoint requires a dashboard agent key (agent_...)." },
      { status: 409 },
    )
  }

  try {
    const wallet = await getAgentWallet(request.agentId)
    return NextResponse.json({
      ok: true,
      wallet: toPublicWallet(wallet),
      configured: hasAgentWalletSecret(),
    })
  } catch (error) {
    if (error instanceof AgentWalletConfigError) {
      return NextResponse.json(
        { error: "Agent wallet custody is not configured on this deployment." },
        { status: 503 },
      )
    }
    throw error
  }
}

export const GET = withAgentAuth(handler, "read")
