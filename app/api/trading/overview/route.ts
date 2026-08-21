import { NextResponse } from "next/server"
import { getAgentForWallet } from "@/lib/trading/agent"

/**
 * GET /api/trading/overview?wallet=<address>
 *
 * AI Trading cockpit — single source of truth for the trading dashboard.
 *
 * Paper state is isolated per connected wallet: pass ?wallet=0x... to get
 * that user's account. Without a wallet the shared guest demo is used.
 *
 * Runs the agent on demand (tick-on-demand): if the agent is running and
 * the last scan is stale, a tick is executed before returning state. This
 * keeps the dashboard alive without a long-running worker, and works in
 * serverless deployments too.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const wallet = url.searchParams.get("wallet")
  const agent = getAgentForWallet(wallet)
  await agent.maybeTick()
  return NextResponse.json(agent.toOverview())
}
