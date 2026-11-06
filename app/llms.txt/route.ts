import { NextResponse } from "next/server"

/**
 * llms.txt — summary for AI crawlers (llmstxt.org standard).
 * Served at /llms.txt for maximum discoverability.
 */
const LLMS_TXT = `# Protocol Bank

> Protocol Bank is the control plane for agent money. One
> credential, one server-enforced policy across trading, payments and
> agent-scoped cards. Trading runs through a trading-only Hyperliquid agent
> wallet; payments execute from the payer's own EIP-3009 signature.

## What it does

- Agent execution + policy: operations (read / trade / pay / swap), per-call cap, daily cap, coin allowlist
- Non-custodial trading: the agent wallet can trade but NEVER withdraw; the trading budget is the maximum loss
- Agent payments: EIP-3009 payer-signed USDC; the relayer only pays gas
- Agent cards: virtual Visa cards scoped to one agent, with issue/fund/freeze/close and budget enforcement
- Paper trading mode: real market data, simulated money, zero risk
- Risk controls: per-trade stop-loss (+/-2.5%), 15% position sizing, max 3 positions, daily loss circuit breakers (5% stop new entries / 8% close all)
- Live mode: EIP-712 agent approval, AES-256-GCM key custody, per-user isolation

## Key pages

- Landing: https://protocolbanks.com/
- Agent API: https://protocolbanks.com/agent-api
- AI Trading cockpit (demo): https://protocolbanks.com/trading
- Agents + cards: https://protocolbanks.com/agents
- Docs (overview): https://protocolbanks.com/docs
- Docs (quickstart): https://protocolbanks.com/docs/quickstart
- Docs (API reference): https://protocolbanks.com/docs/api
- Docs (concepts): https://protocolbanks.com/docs/concepts
- Docs (security): https://protocolbanks.com/docs/security
- Docs (中文): https://protocolbanks.com/zh/docs
- Pricing: https://protocolbanks.com/pricing
- Usage guide: https://protocolbanks.com/help
- Risk disclosure: https://protocolbanks.com/risk-disclosure
- Terms: https://protocolbanks.com/terms
- Privacy: https://protocolbanks.com/privacy

## APIs

- GET /api/v1/agent/state — account, policy, agent wallet status (trading-only)
- POST /api/v1/agent/orders — execute a Hyperliquid order
- POST /api/v1/agent/pay — prepare or execute an EIP-3009 payment
- POST /api/v1/agent/swap — Rango quote + transaction to sign
- POST /api/v1/agent/invoice — create a payable invoice
- GET /api/v1/agent/wallet — platform-custodied agent wallet status (agent key required)
- POST /api/v1/agent/wallet/sign — sign a message or allowlisted EIP-712 typed data
- GET/POST /api/agents/[id]/virtual-cards — list/issue agent cards
- GET/PATCH/DELETE /api/agents/[id]/virtual-cards/[cardId] — details, fund, freeze, close
- GET /api/trading/overview — cockpit state (demo)
- POST /api/trading/actions — pause | resume | stop | reset
- POST /api/trading/live/agent-wallet — status | generate | approve | revoke (SIWE auth)
- GET /api/health — health check

## MCP — let any AI agent use Protocol Bank

- Hosted MCP endpoint (Streamable HTTP): POST https://protocolbanks.com/api/mcp
  Public tools work without auth; account tools require a JWT Bearer token.
- Local stdio server for MCP hosts (Claude Desktop / Claude Code / Cursor):
  pnpm mcp:stdio (env: MCP_AUTH_TOKEN, MCP_WALLET_ADDRESS)
- Human-facing guide: https://protocolbanks.com/mcp

Tools (16): list_supported_tokens, get_payment_quote, estimate_gas,
compare_chain_fees, create_payment, check_payment_status, list_payments,
create_invoice, list_invoices, get_balance, execute_payment,
get_trading_overview, get_positions, get_activity, get_track_record,
control_trading_agent (pause | resume | stop | reset — auth required).

## Agent payments (x402 + wallet)

- x402 (HTTP 402 payment protocol) flow:
  POST /api/x402/authorize -> POST /api/x402/execute -> /api/x402/verify -> /api/x402/settle
- Quote-first: agents should call get_payment_quote (MCP) or the quote flow
  before moving funds; estimate_gas / compare_chain_fees help pick a chain.
- Supported chains: Ethereum, Polygon, Arbitrum, Base, Optimism, BSC.
  Non-custodial: funds always move from the user's wallet, never a platform balance.

## Agent API (for AI agents and their developers)

Base: https://protocolbanks.com/api/v1/agent — auth: Authorization: Bearer pb_...
or a dashboard agent key (agent_...). The agent key resolves to the owner and a
policy derived from the agent type, or to an explicit policy on the agent.
Contract: https://protocolbanks.com/api/agent.openapi.json (OpenAPI 3.1)
Keys and policy: https://protocolbanks.com/settings/api-keys
Walkthrough: https://protocolbanks.com/agent-api — one command: PB_KEY=pb_... pnpm example:agent
Packages: @everestan/protocolbanks-sdk (client) · @everestan/protocolbanks-agent-tools
(tool manifest for the Vercel AI SDK, LangChain, OpenAI and Anthropic)

Only /orders executes through the Hyperliquid agent wallet (trading-only). /pay
prepares an EIP-712 intent and executes when the caller POSTs back a signed
EIP-3009 authorization (EVM USDC); /swap returns something the agent signs;
/invoice creates a payment request and moves nothing.

- POST /orders — { coin, side: "long"|"short", sizeUsd, reason? } -> executed fill + fee + remainingTodayUsd
- GET /state — mode, equity, positions, activity, agent wallet status (trading-only, never withdrawable), and the key's policy with spentTodayUsd
- POST /pay — { to, amountUsd, token?, chain?, memo? } -> an intent + typedData; add the authorization object { ...message, v, r, s } to execute (relayer submits, the payer's own USDC moves)
- POST /swap — { from, to, amount, amountUsd, slippage? } -> a quote and the transaction to sign
- POST /invoice — { to, amount, token?, chain?, description?, expiresInHours? } -> pending invoice + a payable paymentLink (/pay?invoice=...&sig=...)

Every key carries a policy the server enforces, not the agent: allowedOps
(read | pay | swap | trade), maxNotionalUsd (per call), dailyCapUsd (per UTC day),
allowedCoins (empty = all). A new key starts read-only at $50 per call and $200
per day; the policy is editable from the key's row. Trading also passes the
platform risk envelope — position cap, stop-loss, daily breakers — and a sizeUsd
above the cap is clamped, not rejected. Swap and invoice never move funds; pay
moves the payer's own USDC only through their signature, and the relayer only
pays gas.

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
