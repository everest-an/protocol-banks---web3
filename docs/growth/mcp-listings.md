# MCP directory listings

## Official MCP Registry (automated)

`server.json` at the repo root is the listing; `.github/workflows/publish-mcp.yml`
publishes it with **GitHub OIDC** (no token, no package). The registry verifies
the workflow runs in the `everest-an` namespace, which is what the name claims.

```bash
gh workflow run publish-mcp.yml
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.everest-an/protocol-banks"
```

Most directories (Glama, PulseMCP, and part of mcp.so) ingest this registry or
GitHub, so this is the highest-leverage listing.

The hosted MCP server is live and verified:

```bash
curl -s https://protocolbanks.com/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
# {"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{},"resources":{}},"serverInfo":{"name":"protocol-banks","version":"1.0.0"}}}
```

## Copy-paste listing

| Field | Value |
|---|---|
| Name | Protocol Banks |
| Tagline | Trade and pay from any MCP host — with a cap the model cannot raise |
| Transport | Streamable HTTP |
| URL | `https://protocolbanks.com/api/mcp` |
| Auth | none for read/quote tools; Bearer JWT (wallet session) for account and trading tools |
| Categories | finance, trading, crypto, payments |
| Tags | hyperliquid, trading, non-custodial, spend-cap, payments, invoices, x402 |

**Short (≤ 200 chars):** Non-custodial Hyperliquid trading and crypto payments
from any MCP host. Read positions, place orders under a server-enforced spend
cap, create invoices. Trading-only wallet: it can trade, never withdraw.

**Long:**

> Protocol Banks exposes a trading account to any MCP host. Public tools work
> without auth (token list, price quotes, gas estimates, fee comparison, public
> track record). With a wallet session, the account tools read open positions and
> the plain-language activity feed, create invoices and payment links, and place
> or control the AI trading agent. Every order passes the platform risk envelope
> (position cap, stop-loss, daily breakers) and the agent wallet has trading-only
> rights on Hyperliquid — it can place and cancel orders and can never withdraw.
> Worst case is the funded trading budget, shown on screen. Transport: Streamable
> HTTP. Docs: https://protocolbanks.com/mcp and https://protocolbanks.com/agent-api.

**Tools (16):** `list_supported_tokens`, `get_payment_quote`, `estimate_gas`,
`compare_chain_fees`, `create_payment`, `check_payment_status`, `list_payments`,
`create_invoice`, `list_invoices`, `get_balance`, `execute_payment`,
`get_trading_overview`, `get_positions`, `get_activity`, `get_track_record`,
`control_trading_agent`.

## Where to list (in this order)

1. **Official MCP Registry** — automated above (`publish-mcp.yml`).
2. **Smithery** — smithery.ai. Dashboard → add server; the hosted URL is enough
   (no local command). Use the copy above.
3. **mcp.so** — mcp.so. Submit form; paste the endpoint and the short text.
4. **Glama** — glama.ai/mcp/servers. Submit; Glama also scores servers, so add
   the tool list and the docs links. It often auto-indexes the official registry.
5. **PulseMCP** — pulsemcp.com. Submit form; weekly newsletter picks are free
   distribution. It ingests the official registry.
6. **awesome-mcp-servers** — PR to `github.com/punkpeye/awesome-mcp-servers`,
   finance section, one line: `- [Protocol Banks](https://protocolbanks.com/mcp)
   - Non-custodial Hyperliquid trading + payments with a server-enforced spend cap.`
7. **modelcontextprotocol/servers** — reference implementations only; do not PR
   a hosted server there. The official registry (1) is the right home.

## Before submitting

- Re-run the curl above; listings that fail `initialize` get delisted fast.
- Use the same name and tagline everywhere so search results compound.
- Point readers at `/mcp` (setup) and `/agent-api` (programmatic API with a key)
  — two different ways into the same account.
- Track the result: `agents_view` and `api_key_created` in
  `pnpm funnel:agents` show whether a listing converts.
