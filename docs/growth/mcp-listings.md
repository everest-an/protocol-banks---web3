# MCP directory listings

## Official MCP Registry (automated)

`server.json` at the repo root is the listing; `.github/workflows/publish-mcp.yml`
publishes it with **GitHub OIDC** (no token, no package). The registry verifies
the workflow runs in the `everest-an` namespace, which is what the name claims.

```bash
gh workflow run publish-mcp.yml
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.everest-an/protocol-banks"
```

Published **v1.1.0** on 2026-11-12; the registry reports it as `latest`. The
hosted endpoint was verified the same day: `tools/list` returns **23 tools**.

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
| Tagline | Control agent commerce from any MCP host — buy, sell, deliver, pay, trade |
| Transport | Streamable HTTP |
| URL | `https://protocolbanks.com/api/mcp` |
| Auth | none for discovery/reputation; Bearer JWT or `pb_` key for account, commerce, payment and trading tools |
| Categories | finance, agent-commerce, AI agents, crypto, payments |
| Tags | agent-commerce, mcp, ai-agents, x402, usdc, payments, invoices, hyperliquid, non-custodial, spend-cap |

**Short (≤ 200 chars):** Agent commerce from any MCP host: discover services,
accept quotes, deliver proof, pay with x402/EIP-3009, and trade through a
trading-only wallet. One server-enforced mandate. Free sandbox, no wallet.

**Long:**

> Protocol Banks is the control plane for agent commerce. From any MCP host an
> agent can discover public services, create or accept a quote, record delivery
> proof, list orders and read seller reputation. With an account credential it
> can pay through a signed EIP-3009 authorization or x402, create invoices, and
> trade through a Hyperliquid agent wallet with trading-only rights — it can
> place and cancel orders and can never withdraw. Every call passes a
> server-enforced mandate (operations, per-call cap, daily cap, coin allowlist)
> that the model cannot widen. A free sandbox at
> https://protocolbanks.com/sandbox issues two disposable keys and a live quote
> without a wallet. Transport: Streamable HTTP. Docs:
> https://protocolbanks.com/mcp and https://protocolbanks.com/agent-api.

**Tools (23):** Commerce (7): `list_agent_services`, `get_agent_reputation`,
`create_commerce_quote`, `accept_commerce_quote`, `deliver_commerce_order`,
`complete_commerce_order`, `list_commerce_orders`. Trading (5):
`get_trading_overview`, `get_positions`, `get_activity`, `get_track_record`,
`control_trading_agent`. Payments (11): `list_supported_tokens`,
`get_payment_quote`, `estimate_gas`, `compare_chain_fees`, `create_payment`,
`check_payment_status`, `list_payments`, `execute_payment`, `create_invoice`,
`list_invoices`, `get_balance`.

## Where to list (in this order)

1. **Official MCP Registry** — **done 2026-11-12**, `v1.1.0` is latest.
2. **Smithery** — **blocked**: Smithery is now part of Arcade, its proxy shut
   down on 2026-10-31, and the API returns `Updating servers has been removed`.
   Do not spend time on the old CLI flow; use Arcade's listing path if it opens.
3. **mcp.so** — free review submission requires sign-in; paid $39 publishes
   immediately. Use the copy above and the `/sandbox` CTA.
4. **Glama** — often auto-indexes the official registry. Search now shows a
   `Protocol Banks` connector; wait for the record page, then claim it.
5. **PulseMCP** — ingests the official registry; weekly newsletter picks are
   free distribution. The public API is sunsetting, so use the website form.
6. **awesome-mcp-servers** — PR to `github.com/punkpeye/awesome-mcp-servers`,
   finance section, one line: `- [Protocol Banks](https://protocolbanks.com/mcp)
   - Agent commerce: discover services, quotes, delivery proof, x402 payments and
   a trading-only wallet under a server-enforced mandate.`
7. **modelcontextprotocol/servers** — reference implementations only; do not PR
   a hosted server there. The official registry (1) is the right home.

## Before submitting

- Re-run the curl above; listings that fail `initialize` get delisted fast.
- Use the same name and tagline everywhere so search results compound.
- Point readers at `/mcp` (setup), `/sandbox` (no-wallet first order) and
  `/agent-api` (programmatic API with a key) — three ways into the same account.
- Track the result: `sandbox_view`, `sandbox_key_created`, `agents_view` and
  `api_key_created` show whether a listing converts. Add `?ref=smithery`,
  `?ref=mcpso`, `?ref=glama`, `?ref=pulsemcp` to each listing URL.
