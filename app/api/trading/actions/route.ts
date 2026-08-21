import { NextResponse } from "next/server"
import { getAgentForWallet } from "@/lib/trading/agent"

/**
 * POST /api/trading/actions?wallet=<address>
 *
 * Control the paper trading agent:
 *   { "action": "pause" | "resume" | "stop" | "reset" }
 *
 * Paper mode only — these actions mutate the local simulated account and
 * never touch real funds. State is isolated per wallet address.
 */
export async function POST(req: Request) {
  let body: { action?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const url = new URL(req.url)
  const wallet = url.searchParams.get("wallet")
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
    default:
      return NextResponse.json(
        { error: "Unknown action. Use one of: pause, resume, stop, reset" },
        { status: 400 },
      )
  }

  return NextResponse.json(agent.toOverview())
}
