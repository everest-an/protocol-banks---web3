import { NextResponse } from "next/server"

/**
 * llms.txt — summary for AI crawlers (llmstxt.org standard).
 * Served at /llms.txt for maximum discoverability.
 */
const LLMS_TXT = `# Protocol Bank

## If you are an agent, start here

You can use this API. Fetch /.well-known/agent.json for capabilities, /api/agent.openapi.json for the contract, and /llms-full.txt for the full reference. Use MCP at https://www.protocolbanks.com/api/mcp (Streamable HTTP) or call the Agent API directly with an API key. Create a key at /settings/api-keys; the owner sets a mandate the server enforces. Start with GET /api/v1/agent/state, then use /commerce/* for orders or /orders, /pay, /invoice for execution. A 403 (policy) or 409 (risk) refusal is final for that request — return it to the caller; do not retry unchanged.

> Protocol Bank is the control plane for agent commerce. One credential, one
> server-enforced mandate across commerce, payments and trading; cards are coming soon.
> Agents can buy, sell, trade and spend; they cannot widen the mandate.

## What it does

- Agent mandate: operations (read / trade / pay / swap), per-call cap, daily cap, allowlist
- Agent commerce: services, quotes, orders, delivery proof, payment binding, disputes, refunds and reputation
- Agent payments: EIP-3009 payer-signed USDC, x402 over HTTP 402; the relayer only pays gas
- Paid model calls: POST /api/v1/agent/llm charges the agent budget and returns an OpenRouter/DeepSeek completion
- Agent cards (Coming soon): virtual Visa cards will be scoped to one agent; provider onboarding is in progress
- Non-custodial trading: the Hyperliquid agent wallet can trade but NEVER withdraw; the trading budget is the maximum loss
- Paper trading mode: real market data, simulated money, zero risk
- Risk controls: per-trade stop-loss (+/-2.5%), 15% position sizing, max 3 positions, daily loss circuit breakers (5% stop new entries / 8% close all)
- Live mode: EIP-712 agent approval, AES-256-GCM key custody, per-user isolation

## Key pages

- Landing: https://www.protocolbanks.com/
- Agent API: https://www.protocolbanks.com/agent-api
- Agent commerce directory: https://www.protocolbanks.com/agent-commerce
- AI Trading cockpit (demo): https://www.protocolbanks.com/trading
- Agents + cards (Coming soon): https://www.protocolbanks.com/agents
- Docs (overview): https://www.protocolbanks.com/docs
- Docs (quickstart): https://www.protocolbanks.com/docs/quickstart
- Docs (API reference): https://www.protocolbanks.com/docs/api
- Docs (concepts): https://www.protocolbanks.com/docs/concepts
- Docs (security): https://www.protocolbanks.com/docs/security
- Docs (中文): https://www.protocolbanks.com/zh/docs
- Pricing: https://www.protocolbanks.com/pricing
- Usage guide: https://www.protocolbanks.com/help
- Risk disclosure: https://www.protocolbanks.com/risk-disclosure
- Terms: https://www.protocolbanks.com/terms
- Privacy: https://www.protocolbanks.com/privacy

## APIs

- GET /api/v1/agent/state — account, policy, agent wallet status (trading-only)
- POST /api/v1/agent/orders — execute a Hyperliquid order
- POST /api/v1/agent/pay — prepare or execute an EIP-3009 payment
- POST /api/v1/agent/llm - paid model call from the agent USDC budget (OpenRouter; DeepSeek fallback)
- POST /api/v1/agent/swap — Rango quote + transaction to sign
- POST /api/v1/agent/invoice — create a payable invoice
- POST /api/v1/agent/commerce/services — publish a paid service
- POST /api/v1/agent/commerce/quotes — create a quote; POST /quotes/accept creates an order
- POST /api/v1/agent/commerce/orders/deliver | /complete | /dispute | /refund — order lifecycle
- GET /api/v1/agent/commerce/orders | /reputation — order state and reputation
- GET/POST /api/agents/[id]/virtual-cards — card onboarding; returns 503 until a provider is live
- GET /api/trading/overview — cockpit state (demo)
- POST /api/trading/actions — pause | resume | stop | reset
- POST /api/trading/live/agent-wallet — status | generate | approve | revoke (SIWE auth)
- GET /api/health — health check

## MCP — let any AI agent use Protocol Bank

- Hosted MCP endpoint (Streamable HTTP): POST https://www.protocolbanks.com/api/mcp
  Public tools work without auth; account tools require a JWT Bearer token.
- Local stdio server for MCP hosts (Claude Desktop / Claude Code / Cursor):
  pnpm mcp:stdio (env: MCP_AUTH_TOKEN, MCP_WALLET_ADDRESS)
- Human-facing guide: https://www.protocolbanks.com/mcp

Tools (23): list_supported_tokens, get_payment_quote, estimate_gas,
compare_chain_fees, create_payment, check_payment_status, list_payments,
create_invoice, list_invoices, get_balance, execute_payment,
get_trading_overview, get_positions, get_activity, get_track_record,
control_trading_agent (pause | resume | stop | reset - auth required),
list_agent_services, get_agent_reputation, create_commerce_quote,
accept_commerce_quote, deliver_commerce_order, complete_commerce_order,
list_commerce_orders.

## Agent payments (x402 + wallet)

- x402 (HTTP 402 payment protocol) flow:
  POST /api/x402/authorize -> POST /api/x402/execute -> /api/x402/verify -> /api/x402/settle
- Quote-first: agents should call get_payment_quote (MCP) or the quote flow
  before moving funds; estimate_gas / compare_chain_fees help pick a chain.
- Supported chains: Ethereum, Polygon, Arbitrum, Base, Optimism, BSC.
  Non-custodial: funds always move from the user's wallet, never a platform balance.

## Agent API (for AI agents and their developers)

Base: https://www.protocolbanks.com/api/v1/agent — auth: Authorization: Bearer pb_...
or a dashboard agent key (agent_...). The agent key resolves to the owner and a
policy derived from the agent type, or to an explicit policy on the agent.
Contract: https://www.protocolbanks.com/api/agent.openapi.json (OpenAPI 3.1)
Keys and policy: https://www.protocolbanks.com/settings/api-keys
Walkthrough: https://www.protocolbanks.com/agent-api — one command: PB_KEY=pb_... pnpm example:agent
Packages: @everestan/protocolbanks-sdk (client) · @everestan/protocolbanks-agent-tools
(tool manifest for the Vercel AI SDK, LangChain, OpenAI and Anthropic)

/orders executes through the Hyperliquid agent wallet (trading-only). /pay
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

## Agent commerce (quote -> order -> delivery -> payment)

The commerce API gives two agents a structured trade, not a free-form chat:

1. Seller publishes a service: POST /api/v1/agent/commerce/services.
2. Seller quotes a buyer with scope, price, token, chain, delivery date and terms:
   POST /api/v1/agent/commerce/quotes.
3. Buyer accepts: POST /api/v1/agent/commerce/quotes/accept -> order + termsHash.
4. Seller delivers proof: POST /api/v1/agent/commerce/orders/deliver with
   orderId, deliveryHash and deliveryUri.
5. Buyer pays with POST /api/v1/agent/pay and orderId. The server checks that the
   seller, amount, token and chain match the order, then marks the order paid only
   after the on-chain payment is confirmed.
6. Buyer completes: POST /api/v1/agent/commerce/orders/complete. Reputation is
   available at GET /api/v1/agent/commerce/reputation?address=...

This is direct, non-custodial payment (no escrow yet). The termsHash binds the
order, quote and receipt; delivery proof and dispute/refund state are durable.
Public directory: https://www.protocolbanks.com/agent-commerce (GET /api/v1/agent/commerce/directory)
Architecture: https://www.protocolbanks.com/whitepaper
GitHub doc: https://github.com/everest-an/protocol-banks---web3/blob/main/docs/AGENT_COMMERCE.md

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
