# Partner execution API

For products that already have traders and want the execution + risk layer
without building it: place orders for an account, under the platform's risk
envelope, and read back exactly what is enforced.

## Auth

Create a key in **Settings → API Keys**. `write` places orders, `read` reads state.

```
Authorization: Bearer pb_...
```

## Endpoints

### `POST /api/v1/agent/orders`

```bash
curl -X POST https://protocolbanks.com/api/v1/agent/orders \
  -H "Authorization: Bearer pb_..." -H "Content-Type: application/json" \
  -d '{"coin":"BTC","side":"long","sizeUsd":150,"reason":"my-signal-v3"}'
```

```json
{ "ok": true, "fill": { "coin": "BTC", "side": "long", "avgPx": 81062, "size": 0.00185, "notional": 150 }, "fee": 0.12, "mode": "live" }
```

Failures return `409` with the guard that refused:

```json
{ "ok": false, "error": "max positions reached (3)" }
```

Guards: agent paused/stopped · market already held · max positions · daily loss
stop (5%) · daily kill (8%) · insufficient free funds · market data unavailable ·
uncertain submission (recorded for reconciliation, never retried).

### `GET /api/v1/agent/state`

Mode, equity, open positions, activity and the effective risk config (post-clamp).

## What the partner controls, and what they do not

| Partner chooses | Platform decides |
|---|---|
| market (`coin`) | notional cap: `positionNotional(equity)` — the requested `sizeUsd` is clamped |
| side (`long`/`short`) | leverage, fee rate, slippage |
| reason (free text, 120 chars) | max concurrent positions, stop-loss, take-profit |
| — | daily stop/kill breakers, paper vs live |

A partner cannot disable a guard, exceed the cap, or reach a market the platform
does not trade. `sizeUsd` above the cap is clamped, not rejected.

## Sandbox

A key that belongs to a **paper** account executes at mark ± slippage with
simulated money: same endpoints, same guards, `"mode": "paper"` in the response.
Switch the account to live (agent wallet approved) and the same code goes live.

## Billing

Per executed order: `PARTNER_FEE_BPS` (default **8 bps** of notional), metered as a
`partner_order` event. See what is owed:

```bash
DAYS=30 npx tsx -r dotenv/config scripts/partner-usage.ts
```

## SDK

```ts
import { ProtocolBanks } from "@protocolbanks/sdk"

const pb = new ProtocolBanks({ apiKey: process.env.PB_KEY!, baseUrl: "https://protocolbanks.com" })
const res = await pb.agent.order({ coin: "BTC", side: "long", sizeUsd: 150, reason: "my-signal-v3" })
const state = await pb.agent.state()
```
