import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { resolveAgentForWallet } from "@/lib/trading/agent"
import { requireAuth } from "@/lib/middleware/api-auth"

/**
 * GET /api/trading/overview?wallet=<address>
 *
 * AI Trading cockpit — single source of truth for the trading dashboard.
 *
 * Isolation model:
 * - No credentials, no ?wallet= → shared guest demo account
 * - ?wallet=0x… → REQUIRES a valid SIWE identity matching that address
 *   (a user can only view their own paper account)
 *
 * Runs the agent on demand (tick-on-demand): if the agent is running and
 * the last scan is stale, a tick is executed before returning state.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const walletParam = url.searchParams.get("wallet")

  let wallet: string | null | undefined = null
  if (walletParam) {
    // Per-wallet access must be authenticated and match the caller
    const auth = await requireAuth(request, { component: "trading-overview" })
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

  // Live accounts are promoted to the real-order agent; others stay on paper.
  const agent = await resolveAgentForWallet(wallet)

  // Hydrate per-user state from the database when available (best effort —
  // serverless restarts would otherwise lose paper progress). The mode guard
  // prevents a stale paper ledger from overwriting a promoted live state.
  if (wallet) {
    const { loadStateFromDb } = await import("@/lib/trading/db-store")
    const dbState = await loadStateFromDb(wallet)
    const expectedMode = agent.isLive() ? "live" : "paper"
    if (dbState && dbState.mode === expectedMode && dbState.activity && dbState.activity.length > 0) {
      agent.hydrateState(dbState)
    }
  }

  await agent.maybeTick()
  return NextResponse.json(agent.toOverview())
}
