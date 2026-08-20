import { NextResponse } from "next/server"

/**
 * llms.txt — summary for AI crawlers (llmstxt.org standard).
 * Served at /llms.txt for maximum discoverability.
 */
const LLMS_TXT = `# Protocol Bank

> Protocol Bank is an AI automated trading product. Connect a wallet, fund a
> trading budget on Hyperliquid, approve a trading-only agent wallet, and an
> AI agent trades perpetual markets 24/7 with strict risk controls, full
> transparency, and instant revocation.

## What it does

- AI automated trading on Hyperliquid perpetual markets (momentum + funding-carry signals)
- Non-custodial: the agent wallet can trade but NEVER withdraw; the trading budget is the maximum loss
- Paper trading mode: real market data, simulated money, zero risk
- Risk controls: per-trade stop-loss (+/-2.5%), 15% position sizing, max 3 positions, daily loss circuit breakers (5% stop new entries / 8% close all)
- Live mode: EIP-712 agent approval, AES-256-GCM key custody, per-user isolation

## Key pages

- Landing: https://protocolbanks.com/
- AI Trading cockpit: https://protocolbanks.com/trading
- Usage guide: https://protocolbanks.com/help
- Risk disclosure: https://protocolbanks.com/risk-disclosure
- Terms: https://protocolbanks.com/terms
- Privacy: https://protocolbanks.com/privacy

## APIs

- GET /api/trading/overview — cockpit state (tick-on-demand paper engine)
- POST /api/trading/actions — pause | resume | stop | reset
- POST /api/trading/live/agent-wallet — status | generate | approve | revoke (SIWE auth)
- GET /api/trading/live/state — user's Hyperliquid account state
- GET /api/health — health check

## Legal

Automated trading can lose the entire trading wallet. Protocol Bank provides no
investment advice and holds no financial-services license. See the Risk
Disclosure before using live mode.
`

export async function GET() {
  return new NextResponse(LLMS_TXT, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  })
}
