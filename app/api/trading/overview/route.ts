import { NextResponse } from "next/server"
import { getAgent } from "@/lib/trading/agent"

/**
 * GET /api/trading/overview
 *
 * AI Trading cockpit — single source of truth for the trading dashboard.
 *
 * Runs the agent on demand (tick-on-demand): if the agent is running and
 * the last scan is stale, a tick is executed before returning state. This
 * keeps the dashboard alive without a long-running worker, and works in
 * serverless deployments too.
 */
export async function GET() {
  const agent = getAgent()
  await agent.maybeTick()
  return NextResponse.json(agent.toOverview())
}
