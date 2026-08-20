import { NextResponse } from "next/server"

/**
 * llms-full.txt — full product documentation for AI crawlers.
 */
const LLMS_FULL_TXT = `# Protocol Bank — Full Product Documentation (AI-readable)

## Product overview

Protocol Bank is an AI automated trading product for retail crypto users.
The core loop: connect a wallet (MetaMask or any injected EVM wallet) ->
fund a trading budget on Hyperliquid -> approve a trading-only agent wallet
-> the AI agent trades perpetual futures around the clock -> watch, sweep
profits, or stop it with one click.

### Safety model (three layers)

1. On-chain: the agent wallet is approved on Hyperliquid with trading-only
   permissions (approveAgent). It physically cannot withdraw funds.
2. Platform risk engine (enforced before every order):
   - position sizing: ~15% of trading wallet per position
   - max 3 concurrent positions
   - take-profit +2.5% / stop-loss -2.5% on every position
   - signal-fade exit when the combined score turns against the position
   - daily loss circuit breakers: 5% stops new entries, 8% closes everything
   - fees (4bps taker) and slippage (5bps) modeled in every fill
3. User controls: Pause AI (stops new entries), Emergency Stop (halts
   trading), Reset (paper mode), and on-chain revocation at any time.

### Trading strategy (robust leg, v1)

- Universe: top-12 Hyperliquid perpetuals by 24h notional volume
- Signal: 60% momentum (24h risk-adjusted return z-score) + 40% funding
  carry (Hyperliquid hourly funding rate, normalized)
- Entry: |combined score| >= 0.45
- Paper mode uses REAL market data with simulated fills

### Experimental leg (off by default)

A factor-mining research module: 12-factor library (returns, liquidity
score, buy/sell pressure, volume acceleration, deviation z-score, volume
clustering, momentum reversal, relative strength, high-low range, close
position, volume trend) + a postfix formula language (10 operators) +
turnover-aware backtest scoring + deterministic random formula search.
Not a production signal until it passes paper-trading validation.

## Wallet & custody architecture

- Main wallet: user's own Hyperliquid account — deposits/withdrawals only,
  never touched by the AI
- Trading wallet: the budget the AI may trade (also the maximum loss)
- Agent key: per-user secp256k1 keypair, AES-256-GCM encrypted at rest,
  stored per user, revocable
- Upgrade path: Hyperliquid sub-accounts for hard separation once a user
  passes $100k trading volume (sub-account transfer support implemented)

## Authentication

- SIWE (EIP-4361) + JWT sessions for wallet users
- Server-side identity cross-checking (headers never trusted alone)
- Rate limiting, CSRF, replay protection, security headers

## API reference

### Trading (paper engine)

- GET /api/trading/overview
  Returns cockpit state: mode, agent status, account balances/PnL, equity
  curve, open positions, activity feed. Runs the agent on demand
  (tick-on-demand; 8s response cap).
- POST /api/trading/actions
  Body: {"action": "pause" | "resume" | "stop" | "reset"} — paper mode.

### Live mode (SIWE auth required)

- POST /api/trading/live/agent-wallet
  Actions:
  - status: current agent wallet state
  - generate: creates the agent keypair, returns EIP-712 typed data for
    the user to sign in their wallet (approveAgent)
  - approve: verifies the user signature locally, submits approveAgent to
    Hyperliquid, marks the agent approved
  - revoke: deletes local key material
- GET /api/trading/live/state
  Returns the user's Hyperliquid clearinghouse state: account value,
  margin, open positions.

## Infrastructure

- Frontend: Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui
- Trading engine: TypeScript (lib/trading), Hyperliquid public info API
  for data, signed exchange API for live orders
- Persistence: Prisma 7 + PostgreSQL (TradingAccount/TradeRecord models)
  with file-store fallback; paper state is file-based by design
- Go microservices: payout-engine, event-indexer, webhook-handler
  (legacy payment infrastructure, retained for the Business feature set)
- CI: GitHub Actions (tsc + Jest 1050 tests + ESLint + Go tests)
- Deployment: Vercel (auto-deploy on main)

## Legal

Automated trading can lose the entire trading wallet balance. Protocol Bank
is not a licensed investment adviser, broker, or asset manager, and provides
no investment advice. Read the Risk Disclosure (/risk-disclosure) before
enabling live mode. Terms of Service: /terms. Privacy Policy: /privacy.
`

export async function GET() {
  return new NextResponse(LLMS_FULL_TXT, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  })
}
