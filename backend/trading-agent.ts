/**
 * Standalone trading-agent worker (continuous mode).
 *
 *   pnpm trading:agent        # loop forever, one tick every 30s
 *
 * Same engine as the API tick-on-demand path — this is for running the
 * agent headlessly (e.g. a cron job or a small VPS) so it keeps trading
 * even when nobody has the dashboard open.
 *
 * Graceful shutdown on SIGINT/SIGTERM.
 */

import { getAgent } from "../lib/trading/agent"

const INTERVAL_MS = 30_000

async function main() {
  const agent = getAgent()
  console.log("[trading-agent] started (paper mode). Press Ctrl+C to stop.")

  const run = async () => {
    try {
      await agent.maybeTick()
      const s = agent.toOverview()
      const pos = s.positions.length
      const pnl = s.account.allTimePnl >= 0 ? `+$${s.account.allTimePnl.toFixed(2)}` : `-$${Math.abs(s.account.allTimePnl).toFixed(2)}`
      console.log(
        `[trading-agent] tick ok | equity $${s.account.totalEquity.toFixed(2)} | pnl ${pnl} | positions ${pos} | ${new Date().toLocaleTimeString()}`,
      )
    } catch (e) {
      console.error("[trading-agent] tick error:", e)
    }
  }

  await run()
  const timer = setInterval(run, INTERVAL_MS)

  const shutdown = () => {
    console.log("\n[trading-agent] shutting down...")
    clearInterval(timer)
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

main()
