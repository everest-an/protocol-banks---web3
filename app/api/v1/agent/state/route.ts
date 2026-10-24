import { NextResponse } from "next/server"
import { withAPIKeyAuth, type AuthenticatedRequest } from "@/lib/middleware/api-key-auth"
import { resolveAgentForWallet } from "@/lib/trading/agent"

/**
 * GET /api/v1/agent/state — the account behind this API key: mode, equity,
 * open positions and the effective risk envelope (post-clamp), so a partner
 * can render the same numbers the platform enforces.
 */
export const dynamic = "force-dynamic"

async function handler(request: AuthenticatedRequest) {
  const wallet = request.ownerAddress
  if (!wallet) return NextResponse.json({ error: "this key has no owner address" }, { status: 403 })

  const agent = await resolveAgentForWallet(wallet)
  return NextResponse.json({ ok: true, ...agent.toOverview() })
}

export const GET = withAPIKeyAuth(handler, { requiredPermissions: ["read"] })
