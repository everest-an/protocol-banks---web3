# Partner targets — agent developers, not traders

The positioning changed: we sell **execution + policy infrastructure for AI
agents**, so the buyer is whoever builds agents and needs money tools — not a
retail trader. Ranked by "they already have agents and no money layer".

Send one line, not a pitch. The offer in every case: *one credential, a policy the
server enforces (ops, per-call cap, daily cap, coin allowlist), and an audit trail
per operation — trade executes, pay/swap return what the agent signs.*

## 1. Agent frameworks (highest leverage: one integration, many agents)

| # | Target | Why they fit | Opener |
|---|---|---|---|
| 1 | **Vercel AI SDK** (tool ecosystem) | Every TS agent defines tools here; money is the missing category | "Your tools cover text and data; there is no money tool. We ship one with hard caps baked in." |
| 2 | **LangChain / LangGraph** | Toolkit + tool-calling is their core surface | "A trading/payments toolkit with a server-enforced spend cap, so a runaway agent cannot empty a wallet." |
| 3 | **CrewAI** | Multi-agent crews need a treasurer role | "Give the finance agent a wallet it cannot overdraw." |
| 4 | **Microsoft AutoGen** | Multi-agent conversations include tool use | "Tool adapter for trading/transfers where the limit is enforced outside the model." |
| 5 | **Mastra** (TypeScript agents) | Young, TS-native, shipping fast | "One tool, four ops (state/trade/pay/swap), caps enforced server-side." |
| 6 | **Pydantic AI** | Typed Python agents, strong tool story | "Typed tool surface for money, with a policy object your runtime cannot widen." |
| 7 | **Eliza OS** (ai16z) | Crypto-native agents already want wallets | "Eliza agents get a Hyperliquid execution wallet with trading-only rights." |
| 8 | **Olas / Autonolas** | On-chain agent services with payments built in | "Execution plugin for agents that already earn; caps + audit included." |
| 9 | **OpenAI Agents SDK** | Tool/MCP integration path | "MCP server exposing trading/payments with per-key limits." |
| 10 | **Google ADK** | Tool + MCP support | Same as above, but the enterprise angle: policy + audit. |

## 2. MCP distribution (discovery, not revenue — do it anyway)

| # | Target | Why | Opener |
|---|---|---|---|
| 11 | **modelcontextprotocol/servers** | The default list every MCP client reads | "Adding a trading/payments server with server-side spend caps." |
| 12 | **Smithery** | Largest MCP directory | Listing + verified install badge. |
| 13 | **mcp.so** | Directory with traffic | Listing. |
| 14 | **Glama** | Directory + ratings | Listing. |

## 3. Agent-payment ecosystem (interop, and some are competitors)

| # | Target | Angle |
|---|---|---|
| 15 | **Coinbase CDP / x402** | We already expose `/api/x402`; interop means our endpoints are payable by x402 agents. |
| 16 | **thirdweb** | Their x402 tooling + our execution layer = agent that pays per call and trades. |
| 17 | **Nevermined** | Agent payment plans; complement, not compete (they meter access, we enforce limits). |
| 18 | **Payman AI** | Agent→human payments; we are agent→market. Cross-referral, not integration. |

## 4. Trading-bot vendors (they have users, weak risk/audit)

| # | Target | Why | Opener |
|---|---|---|---|
| 19 | **Hyperliquid tooling** (Hyperdash, Hypurrscan) | They have the audience and the data; no execution/caps | "White-label execution: your users keep your UI, we carry the caps and the audit." |
| 20 | **Telegram trading bots** (Banana Gun, Trojan, Maestro, BONKbot) | Huge volume, minimal per-user risk controls | "Per-user spend caps and an audit log — the thing support tickets are made of." |

## How to qualify a conversation (3 questions, no pitch)

1. Who executes for your agents today — your own keys, a custodian, or nothing?
2. What breaks first: a runaway spend, a key leak, or an audit request?
3. Would a per-call cap + audit trail be worth 8 bps, or does it have to be free?

A "no" to 3 is information: it means the market wants this bundled, not sold —
which changes who we integrate with, not whether the layer is needed.
