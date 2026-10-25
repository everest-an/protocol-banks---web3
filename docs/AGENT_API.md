# Agent API — reference

The programmatic surface for AI agents and the products that run them: one
credential, one policy the server enforces, four operations.

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

---

## 1. Authentication

```
Authorization: Bearer pb_...
```

Keys are created in **Settings → API Keys**. Two permissions matter:

- `read` — `GET /state`
- `write` — `orders`, `pay`, `swap`, `invoice`

Each key also carries a **policy** (below). Rate limits are per key
(`rate_limit_per_minute`, default 60) and are enforced by the API-key middleware;
every call is logged to `api_key_usage_logs`.

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
{ "ok": true, "invoice": { "invoiceId": "INV-…", "status": "pending", "to": "0xabc…", "amount": 25, "token": "USDC", "chain": "Ethereum", "expiresAt": "…", "signed": true } }
```

Creates a pending invoice. Moves no money and is not metered; the amount is
checked against the key's policy because an invoice is a payment request.

## 4. Errors

| Status | Meaning | What to do |
|---|---|---|
| `400` | malformed body / bad address / non-positive amount | fix the request |
| `401` | missing or invalid key | re-issue the key |
| `403` | key policy refuses (op, per-call cap, daily cap, allowlist) | surface the reason; do not retry |
| `409` | platform guard refuses (positions, breakers, funds, unknown market, no route) or the key policy is invalid | surface the reason; back off |
| `429` | rate limit | back off |
| `503` | market data or the venue is unavailable | retry later |

A trade that reaches the venue but returns no confirmed response is reported as
`409` with "order status uncertain". The platform records it and resolves it on
the next reconciliation tick by client-order-id — **it is never retried**.

## 5. Metering and billing

Executed trades are metered as one `agent_op` event (`op: "trade"`, notional,
fee). Billing is `PARTNER_FEE_BPS` (default **8 bps** of notional).

```bash
# what partners owe, last 30 days
DAYS=30 npx tsx -r dotenv/config scripts/partner-usage.ts
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
import { ProtocolBanks } from "@protocolbanks/sdk"

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

**MCP** — the same capability is exposed as MCP tools (`trading-tools.ts`,
`payment-tools.ts`, `invoice-tools.ts`, `balance-tools.ts`), so an MCP host can
read state, place orders and create invoices without HTTP plumbing.

## 7. Not here yet

- fill webhooks (poll `state` for now)
- per-partner usage dashboard (the report script is the source of truth)
- invoice settlement lookup in this surface (the legacy invoice API serves it)
