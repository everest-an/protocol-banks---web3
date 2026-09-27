import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getAgentForWallet } from "@/lib/trading/agent"
import { requireAuth } from "@/lib/middleware/api-auth"

/**
 * POST /api/trading/actions?wallet=<address>
 *
 * Control the paper trading agent:
 *   { "action": "pause" | "resume" | "stop" | "reset" }
 *   { "action": "approve" | "reject" }   — resolve a pending trade (manual approval mode)
 *
 * Isolation model:
 * - No credentials, no ?wallet= → shared guest demo account
 * - ?wallet=0x… → REQUIRES a valid SIWE identity matching that address
 *
 * Paper mode only — these actions mutate the local simulated account and
 * never touch real funds.
 */
export async function POST(request: NextRequest) {
  let body: { action?: string; mode?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const url = new URL(request.url)
  const walletParam = url.searchParams.get("wallet")

  let wallet: string | null | undefined = null
  if (walletParam) {
    const auth = await requireAuth(request, { component: "trading-actions" })
    if (!auth.address) {
      return (
        auth.error ??
        NextResponse.json({ error: "Authentication required for per-wallet paper accounts" }, { status: 401 })
      )
    }
    if (auth.address.toLowerCase() !== walletParam.toLowerCase()) {
      return NextResponse.json(
        { error: "wallet parameter does not match the authenticated identity" },
        { status: 403 },
      )
    }
    wallet = auth.address
  }

  const agent = getAgentForWallet(wallet)
  switch (body.action) {
    case "pause":
      agent.pause()
      break
    case "resume":
      agent.resume()
      break
    case "stop":
      agent.stop()
      break
    case "reset":
      agent.reset()
      break
    case "approve": {
      const result = await agent.approvePendingTrade()
      if (!result.ok) {
        return NextResponse.json({ ...agent.toOverview(), actionNote: result.note }, { status: 409 })
      }
      break
    }
    case "reject": {
      const result = agent.rejectPendingTrade()
      if (!result.ok) {
        return NextResponse.json({ ...agent.toOverview(), actionNote: result.note }, { status: 409 })
      }
      break
    }
    case "set_approval": {
      if (body.mode !== "auto" && body.mode !== "manual") {
        return NextResponse.json({ error: 'set_approval requires mode: "auto" | "manual"' }, { status: 400 })
      }
      agent.setApprovalMode(body.mode)
      break
    }
    default:
      return NextResponse.json(
        { error: "Unknown action. Use one of: pause, resume, stop, reset, approve, reject, set_approval" },
        { status: 400 },
      )
  }

  return NextResponse.json(agent.toOverview())
}
