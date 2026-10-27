# Agent API — reference

The programmatic surface for AI agents and the products that run them: one
credential, one policy the server enforces, five endpoints.

**Two of them execute; two of them prepare.** The platform holds no keys, so it
can trade through a Hyperliquid agent wallet (trading-only rights) but it can
never move an agent's funds elsewhere. `pay` and `swap` return what the agent
must sign itself.

| Operation | Endpoint | Executes? |
|---|---|---|
| `read` | `GET /api/v1/agent/state` | — |
| `trade` | `POST /api/v1/agent/orders` | **yes** (agent wallet, trading-only) |
| `invoice` | `POST /api/v1/agent/invoice` | no (creates a payment request) |
| `pay` | `POST /api/v1/agent/pay` | no (returns a signed-ready intent) |
| `swap` | `POST /api/v1/agent/swap` | no (returns a quote + transaction) |

### The contract

[`api/agent.openapi.json`](api/agent.openapi.json) is the machine-readable
version of this document: OpenAPI 3.1, all five paths, the policy schema with
its clamp ranges, one response per error class with a real example body, and
the exact field names each route returns. It is also served at
**`https://protocolbanks.com/api/agent.openapi.json`** (CORS-open), so tooling
can fetch it without cloning the repo.

It is **JSON** rather than YAML on purpose — the repo has no YAML parser, so
the contract validates offline with plain `node`: no install, no network, no
linter to trust. The payment-era [`api/openapi.yaml`](api/openapi.yaml) stays
byte-identical for existing integrations.

---

## 1. Authentication

```
Authorization: Bearer pb_...
```

Keys are created in **Settings → API Keys**. The dialog also sets the key's
**policy** (below): a new key starts read-only (`["read"]`, $50 per call, $200
per day), and the policy can be changed from the key's row at any time — the
next call is enforced with the new limits. A key created before policies existed
carries no stored policy and runs under the legacy defaults.

Two permissions matter:

- `read` — `GET /state`
- `write` — `orders`, `pay`, `swap`, `invoice`

Every call is logged to `api_key_usage_logs`. The enforced limit today is the
global one: **100 requests/minute per IP** (`middleware.ts`). The per-key
`rate_limit_per_minute` value is stored on the key but is not enforced yet.

A key with no owner address is rejected (`403`) — the key belongs to an account.

## 2. The policy (enforced by the server)

This is the contract between the partner and the platform. It lives on the key;
the agent cannot read it as authority and cannot widen it.

| Field | Meaning | New key | Key without a policy (legacy) |
|---|---|---|---|
| `allowedOps` | subset of `read`, `pay`, `swap`, `trade` | `["read"]` | all four |
| `maxNotionalUsd` | per call | `50` | `100` |
| `dailyCapUsd` | per UTC day, summed from metered ops | `200` | `500` |
| `allowedCoins` | allowlist; empty = every supported market | `[]` | `[]` |

```json
{ "allowedOps": ["read", "trade"], "maxNotionalUsd": 100, "dailyCapUsd": 250, "allowedCoins": ["BTC", "ETH"] }
```

Values are **clamped**, not trusted: `maxNotionalUsd` 1–10 000, `dailyCapUsd`
1–100 000, unknown ops are a `409` at authentication time, coins are upper-cased
and capped at 50. See `lib/agent/policy.ts`.

Two enforcement layers act on a trade:

1. **Key policy** — op allowed, amount ≤ per-call cap, today + amount ≤ daily cap,
   coin on the allowlist. A violation is `403` and the agent is never touched.
2. **Platform risk envelope** — max 3 positions, 15 % of equity per position,
   2× leverage, stop-loss/take-profit at 2.5 % of margin (1.25 % of price),
   daily stop 5 % / kill 8 %, taker fee 0.04 %. A `sizeUsd` above
   `positionNotional(equity)` is **clamped, not rejected**; the breakers can
   refuse outright (`409`).

## 3. Endpoints

### `GET /api/v1/agent/state`

The account behind the key, plus what the policy still allows today.

```json
{
  "ok": true,
  "mode": "paper",
  "account": { "totalEquity": 521.55, "tradingWallet": 521.55, "maxLoss": 521.55, "todayPnl": 0 },
  "positions": [],
  "activity": [{ "time": "…", "type": "info", "text": "Paper account ready…" }],
  "policy": { "allowedOps": ["read", "trade"], "maxNotionalUsd": 100, "dailyCapUsd": 250, "allowedCoins": [], "spentTodayUsd": 0 }
}
```

### `POST /api/v1/agent/orders`

```json
{ "coin": "BTC", "side": "long", "sizeUsd": 150, "reason": "my-signal-v3" }
```

```json
{
  "ok": true,
  "fill": { "coin": "BTC", "side": "long", "avgPx": 81062, "size": 0.00185, "notional": 150 },
  "fee": 0.12,
  "mode": "live",
  "remainingTodayUsd": 100
}
```

One position per market. `sizeUsd` above the platform cap is reduced to
`positionNotional(equity)`; above the **key's** cap it is refused (403).

### `POST /api/v1/agent/pay`

```json
{ "to": "0xabc…", "amountUsd": 25, "token": "USDC", "chain": "base", "memo": "invoice 41" }
```

```json
{
  "ok": true,
  "intent": { "kind": "evm-transfer", "to": "0xabc…", "token": "USDC", "chain": "base", "amountUsd": 25, "remainingTodayUsd": 75 },
  "note": "sign and submit from the agent's own wallet; the platform never holds funds"
}
```

Destination must be EVM (`0x` + 40 hex), TRON (`T` + 33 base58) or Solana
(base58 32–44).

### `POST /api/v1/agent/swap`

```json
{ "from": { "symbol": "USDC", "blockchain": "base" }, "to": { "symbol": "ETH", "blockchain": "base" }, "amount": "25", "amountUsd": 25 }
```

Returns the Rango route and the transaction to sign. `409` when no route exists.
Quotes are not metered — nothing is spent.

### `POST /api/v1/agent/invoice`

```json
{ "to": "0xabc…", "amount": 25, "token": "USDC", "description": "agent work", "expiresInHours": 24 }
```

```json
{ "ok": true, "invoice": { "invoiceId": "INV-…", "status": "pending", "to": "0xabc…", "amount": 25, "token": "USDC", "chain": "Ethereum", "expiresAt": "…", "signed": true, "paymentLink": "https://protocolbanks.com/pay?invoice=INV-…&sig=…" } }
```

Creates a pending invoice. Moves no money and is not metered; the amount is
checked against the key's policy because an invoice is a payment request.
Give `paymentLink` to the payer. To check settlement, read the invoice back
with the id and signature from that link:
`GET /api/invoice?id=INV-…&sig=…` (without the signature a signed invoice
answers `403`).

## 4. Errors

| Status | Meaning | What to do |
|---|---|---|
| `400` | malformed body / bad address / non-positive amount | fix the request |
| `401` | missing or invalid key | re-issue the key |
| `403` | key policy refuses (op, per-call cap, daily cap, allowlist) | surface the reason; do not retry |
| `409` | platform guard refuses (positions, breakers, funds, unknown market, no route) or the key policy is invalid | surface the reason; back off |
| `429` | rate limit | back off |

A trade that reaches the venue but returns no confirmed response is reported as
`409` with "order status uncertain". The platform records it and resolves it on
the next reconciliation tick by client-order-id — **it is never retried**.

## 5. Metering and billing

Executed trades are metered as one `agent_op` event (`op: "trade"`, notional,
fee). Billing is `PARTNER_FEE_BPS` (default **8 bps** of notional).

```bash
# what partners owe, last 30 days
DAYS=30 npx tsx -r dotenv/config scripts/partner-usage.ts

# the agent-API funnel: views → keys → first order, plus npm downloads
DAYS=30 pnpm funnel:agents
```

`remainingTodayUsd` in every response is `dailyCapUsd − spentTodayUsd − thisCall`.

## 6. Clients

**curl**

```bash
curl -X POST https://protocolbanks.com/api/v1/agent/orders \
  -H "Authorization: Bearer pb_…" -H "Content-Type: application/json" \
  -d '{"coin":"BTC","side":"long","sizeUsd":150,"reason":"signal-v3"}'
```

**TypeScript (SDK)**

```ts
import { ProtocolBanks } from "@everestan/protocolbanks-sdk"

const pb = new ProtocolBanks({ apiKey: process.env.PB_KEY!, baseUrl: "https://protocolbanks.com" })
const state = await pb.agent.state()
const res = await pb.agent.order({ coin: "BTC", side: "long", sizeUsd: 150 })
```

**Python**

```python
import os, requests

key = os.environ["PB_KEY"]
r = requests.post(
    "https://protocolbanks.com/api/v1/agent/orders",
    headers={"Authorization": f"Bearer {key}"},
    json={"coin": "BTC", "side": "long", "sizeUsd": 150},
    timeout=30,
)
print(r.status_code, r.json())
```

**Framework tools**

`@everestan/protocolbanks-agent-tools` exports the five operations as JSON-Schema tool
definitions, plus OpenAI and Anthropic converters — one manifest for the Vercel
AI SDK, LangChain, or a raw function-calling loop. Only `place_order` executes;
the descriptions tell the model not to retry a `403`/`409`. See
[AGENT_TOOLS.md](AGENT_TOOLS.md).

**MCP** — the same capability is exposed as MCP tools (`trading-tools.ts`,
`payment-tools.ts`, `invoice-tools.ts`, `balance-tools.ts`), so an MCP host can
read state, place orders and create invoices without HTTP plumbing.

## 7. Not here yet

- fill webhooks (poll `state` for now)
- per-partner usage dashboard (the report script is the source of truth)
- invoice settlement lookup in this surface (the legacy invoice API serves it)

## 8. Run it

```bash
PB_KEY=pb_… pnpm example:agent
PB_KEY=pb_… pnpm example:agent --invoice
```

One command walks the surface with nothing but a key: it prints the mode and
equity, the effective policy, places a $20 BTC order (`PB_USD` changes the
size), and with `--invoice` creates a pending invoice. `PB_BASE` points it at a
local server; `PB_TO` sets the invoice destination. A run with `--invoice`
looks like this:

```text
mode: paper · equity: $500.00
policy: read, trade, pay · per-call $100.00 · daily $200.00 · spent today $0.00
fill: BTC long 0.000248 @ $81062.50 · notional $20.00
fee: $0.0080 · mode: paper · remainingTodayUsd: $180.00
invoice: INV-M8K2Q1-9F3A21B7 · pending · expires 2026-10-26T04:00:00.000Z
pay: https://protocolbanks.com/pay?invoice=INV-M8K2Q1-9F3A21B7&sig=3f9a1c2b7d4e5f60
not called: pay and swap return something you sign from your own wallet — this example cannot execute them
```

A refusal is printed, not thrown — `REFUSED (403): …` — and the run still exits
0, because the refusal *is* the answer. The example never calls `pay` or
`swap`: both return something the agent must sign from its own wallet, so there
is nothing this script could execute.

## 9. Verify the contract

```bash
node scripts/verify-openapi.mjs                        # offline, Node built-ins only
npx tsx -r dotenv/config scripts/example-agent-qa.ts   # needs a dev server on :3200
```

The first checks the path list, the twelve named schemas, every `$ref`, the
per-endpoint status lists and every non-200 body; it prints
`OK 5 paths · … schemas · … refs` or exactly one `FAIL …` line. The second
provisions a paper account and a scoped key, runs the example (fill, an
over-cap `403`, an invoice), asserts what the API reported, and deletes every
row and file it created. `PB_QA_BASE` points it at another origin;
`--read-only` proves a policy refusal with a read-only key.
