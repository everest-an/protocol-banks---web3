import { NextResponse } from "next/server"

/**
 * llms-full.txt — full product documentation for AI crawlers.
 */
const LLMS_FULL_TXT = `# Protocol Bank — Full Product Documentation (AI-readable)

## If you are an agent, start here

You can use this API without a human UI. Discovery: /.well-known/agent.json (A2A/ERC-8004 card), /api/agent.openapi.json (OpenAPI 3.1), /llms.txt (summary), /api/mcp (MCP Streamable HTTP). Auth: Authorization: Bearer pb_... or a dashboard agent key. Start with GET /api/v1/agent/state; then use /commerce/* for orders, or POST /orders, /pay, /swap or /invoice for execution. Every key has a server-enforced mandate; a 403 (policy) or 409 (risk) refusal is final for the request. Do not ask the model to widen the mandate; the owner edits it in Settings → API Keys.

## Product overview

Protocol Bank is the control plane for agent commerce. An agent gets
one credential; the server enforces which operations it may perform
(read / trade / pay / swap), a per-call cap, a daily cap and an allowlist.
Commerce orders bind a seller, amount, token, delivery terms and a termsHash;
payments execute from the payer's own EIP-3009 authorization or x402; each
agent can have an agent-scoped virtual card issued through Yativo or Rain; availability depends on provider KYB.
Trading runs through a trading-only Hyperliquid agent wallet. The /trading cockpit is a paper demo of the same account; the
Agent API is the product.

The retail cockpit is a reference adapter, not the product. Production agents
call the Agent API (or the MCP server) under a policy their owner controls.

### Safety model (three layers)

1. On-chain: the agent wallet is approved on Hyperliquid with trading-only
   permissions (approveAgent). It physically cannot withdraw funds.
2. Platform risk engine (enforced before every order):
   - position sizing: ~15% of trading wallet per position
   - max 3 concurrent positions
   - take-profit +30% / stop-loss -15% on every position
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
- CI: GitHub Actions (tsc + Jest 1309 tests + ESLint + Go tests)
- Deployment: Vercel (auto-deploy on main)

## Agent integration — how an AI assistant calls trading and payments

Protocol Bank is agent-native: any MCP host (Claude Desktop / Claude Code /
Cursor) or web MCP client can operate it through tools instead of HTTP calls.

MCP transports:
- Hosted (Streamable HTTP): POST https://www.protocolbanks.com/api/mcp
  Public tools: list_supported_tokens, get_payment_quote, estimate_gas,
  compare_chain_fees. Everything else needs a JWT Bearer token.
- Local stdio: pnpm mcp:stdio (env MCP_AUTH_TOKEN, MCP_WALLET_ADDRESS);
  smoke-test with pnpm mcp:test (tools/list + tools/call round trip).

Payment tools (non-custodial):
- Quote -> pay: get_payment_quote -> create_payment -> execute_payment
  (funds move from the user's wallet; the platform never holds a balance)
- Status: check_payment_status, list_payments, get_balance
- Invoices: create_invoice, list_invoices
- Cost helpers: estimate_gas, compare_chain_fees, list_supported_tokens
- x402 (HTTP 402) REST equivalents:
  POST /api/x402/authorize -> /api/x402/execute -> /api/x402/verify -> /api/x402/settle

Commerce tools:
- Discovery: list_agent_services, get_agent_reputation (no auth)
- Seller (auth): create_commerce_quote, deliver_commerce_order
- Buyer (auth): accept_commerce_quote, complete_commerce_order
- Orders (auth): list_commerce_orders
- Payment is a separate pay call with orderId; the order binds seller, amount,
  token and termsHash. No escrow yet.

Trading tools:
- Read: get_trading_overview, get_positions, get_activity, get_track_record
- Control (auth required): control_trading_agent (pause | resume | stop | reset)
- The agent wallet is approved on Hyperliquid with trading-only rights and
  physically cannot withdraw; worst case is the funded budget.

## Agent API (for AI agents and the products that run them)

Base: https://www.protocolbanks.com/api/v1/agent — auth: Authorization: Bearer pb_...
or a dashboard agent key (agent_...), which resolves to the owner and a policy
derived from the agent type, or to an explicit policy on the agent.
Docs: https://www.protocolbanks.com/docs (overview) · /docs/quickstart · /docs/api ·
/docs/concepts · /docs/security · Chinese: /zh/docs
Contract: https://www.protocolbanks.com/api/agent.openapi.json (OpenAPI 3.1, CORS-open)
Keys and policy: https://www.protocolbanks.com/settings/api-keys
Sandbox (no wallet): https://www.protocolbanks.com/sandbox — POST
/api/sandbox/keys returns two disposable 24h keys (buyer + seller) and a live $1
quote; run accept and deliver against the real API. Payment is not simulated.
Walkthrough: https://www.protocolbanks.com/agent-api — PB_KEY=pb_... pnpm example:agent
Commerce directory: https://www.protocolbanks.com/agent-commerce
Packages: @everestan/protocolbanks-sdk (client) · @everestan/protocolbanks-agent-tools
(tool manifest for the Vercel AI SDK, LangChain, OpenAI and Anthropic)

/orders executes: it trades through a Hyperliquid agent wallet with
trading-only rights (it can place and cancel orders, never withdraw). /pay
prepares an EIP-712 intent and executes when the caller POSTs back a signed
EIP-3009 authorization (EVM USDC) — the payer's own USDC moves and the relayer
only pays gas. /swap and /invoice prepare something the agent signs itself.

- GET /state — mode, equity, positions, activity, the Hyperliquid agent wallet status (tradingOnly, never withdrawable), and the key's policy with spentTodayUsd
- POST /orders — { coin, side: "long"|"short", sizeUsd, reason? } -> executed fill + fee + remainingTodayUsd
- POST /pay — { to, amountUsd, token?, chain?, memo? } -> an intent + typedData; add the authorization object { ...message, v, r, s } to execute (relayer submits; the payer's own USDC moves)
- POST /llm - paid LLM call; requires pay, supports a USDC budget or an x402 X-Payment proof on Base, OpenRouter first and DeepSeek fallback
- POST /swap — { from, to, amount, amountUsd, slippage? } -> quote + transaction to sign
- POST /invoice — { to, amount, token?, chain?, description?, expiresInHours? } -> pending invoice + paymentLink (/pay?invoice=...&sig=...); read settlement back with GET /api/invoice?id=...&sig=...
- POST /commerce/services, /commerce/quotes, /commerce/quotes/accept — publish a service, create a quote, accept it into an order
- POST /commerce/orders/deliver, /complete, /dispute, /refund — delivery proof, completion, dispute, refund
- GET /commerce/orders, /commerce/reputation — order state and seller reputation

Policy, enforced by the server (the agent cannot widen it): allowedOps
(read | pay | swap | trade), maxNotionalUsd per call, dailyCapUsd per UTC day,
allowedCoins (empty = all). A new key starts read-only at 50 per call and 200 per
day and the policy is editable from the key's row; a key created before policies
existed keeps all operations at 100/500 until edited.

Errors: 400 malformed, 401 bad key, 403 policy refusal (before execution),
409 platform guard (positions, daily breakers, funds, unknown market, no route,
uncertain submission), 429 rate limit (100 requests/minute per IP). Pay adds 502
(the relayer could not submit) and 503 (payments are not configured on this
deployment). An order that reaches the venue without a confirmed response is
recorded and resolved by client-order-id reconciliation — never retried.

## Agent cards (virtual Visa, agent-scoped; coming soon)

Agent cards are in provider onboarding (Yativo today; the
Rain client is implemented and awaits a partner key). The card balance is held
by the issuing partner; funding is wallet-signed where the provider supports it.

- GET /api/agents/[id]/virtual-cards — list the agent's cards
- POST /api/agents/[id]/virtual-cards — { initialAmount, label? } -> issue

Card issuance and lifecycle depend on the provider. PAN/CVV are held by the
issuer; the app shows the last 4 digits unless the provider exposes a
card-details endpoint. Provider credentials (YATIVO_API_KEY/YATIVO_API_SECRET or
RAIN_API_KEY) are required; without them the endpoints answer 503 instead of
fabricating a card.

Billing: executed trades are metered at PARTNER_FEE_BPS (default 8 bps of
notional); every order response carries remainingTodayUsd.

References: docs/AGENT_API.md (full reference), docs/AGENT_CASES.md (four
worked cases), docs/AGENT_TOOLS.md (tool manifest for the Vercel AI SDK,
LangChain, OpenAI and Anthropic), docs/PARTNERS.md (partner integration), and
the served contract at /api/agent.openapi.json.

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
