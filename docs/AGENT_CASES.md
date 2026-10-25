# Technical cases

Four end-to-end walks through the Agent API, with the exact requests, the
responses, and what the server enforces. Numbers are from the live paper account
used during development.

---

## Case 1 — an agent framework tool with a hard cap

**Goal.** A LangChain/Vercel-AI-SDK agent gets a `place_trade` tool. A runaway
model loop must not be able to drain the account.

**Sequence**

```
agent loop
  └─ tool call: place_trade { coin: "BTC", side: "long", sizeUsd: 5000 }
        └─ POST /api/v1/agent/orders
              ├─ key policy: 5000 > maxNotionalUsd(100)      → 403, agent not touched
              └─ (if 50) platform envelope: notional clamped to positionNotional(equity)
```

```ts
// the tool description is part of the safety story: tell the model the limits
export const placeTrade = tool({
  description: "Open one perpetual position on Hyperliquid. The server enforces the spend cap; a size above it is refused.",
  parameters: z.object({ coin: z.string(), side: z.enum(["long", "short"]), sizeUsd: z.number().positive() }),
  execute: async ({ coin, side, sizeUsd }) => pb.agent.order({ coin, side, sizeUsd }),
})
```

**Responses**

```json
// sizeUsd 5000 → refused before the agent sees it
{ "ok": false, "error": "order of $5000.00 exceeds this key's per-call cap of $100" }   // 403

// sizeUsd 50 → executed, notional clamped by the platform to 15% of equity
{ "ok": true, "fill": { "coin": "BTC", "avgPx": 80176.07, "size": 0.000976, "notional": 78.23 }, "fee": 0.0626, "remainingTodayUsd": 150 }
```

**What is enforced**: per-call cap (403, before execution), notional clamp (the
platform reduces, it does not fail), one position per market, max 3 positions,
daily stop/kill.

**What is not**: the model can still call the tool many times. The daily cap is
the answer — the 11th $50 trade in a $500 day is refused. Set the cap to the
amount you are willing to lose in a day.

---

## Case 2 — invoice, settlement, reconciliation

**Goal.** An agent does work for a client and bills them; later it verifies
payment by invoice id.

**Sequence**

```
agent  ──POST /agent/invoice { to: 0xclient, amount: 25 }──▶ platform
                                                              └─ Invoice row (pending, 24h)
agent  ── shares invoiceId with the client ─────────────────▶ client
client ── settles USDC to 0xclient (any wallet) ────────────▶ chain
agent  ── GET /api/invoice?id=INV-…  (legacy invoice API) ──▶ platform
                                                              └─ status: paid | pending | expired
```

```json
{ "ok": true, "invoice": { "invoiceId": "INV-M8K2Q1-9F3A21B7", "status": "pending", "amount": 25, "token": "USDC", "chain": "Ethereum", "expiresAt": "…", "signed": true } }
```

**Failure modes**

| Case | Response | Note |
|---|---|---|
| amount above the key's cap | `403` | the invoice is not created |
| bad address | `400` | EVM `0x…`, TRON `T…`, Solana base58 |
| client pays the wrong chain | — | the invoice records one `chain`; reconciliation is the caller's job today |
| invoice expires | `status: "expired"` | `expiresInHours` (default 24, max 720) |

**What is enforced**: the amount against the key policy; the invoice is
**not** metered because no money moved. `signed: true` means the platform signed
the invoice with `PAYMENT_LINK_SECRET`, matching the legacy invoice verification.

---

## Case 3 — an x402-paid agent that also trades

**Goal.** An agent pays per API call with x402 and trades within a daily cap. The
audit trail must show both.

```
agent ──x402 payment──▶ /api/x402/…            (per-call payment, on-chain settlement)
agent ──POST /agent/orders { usd 20 }──▶ platform   (policy: 20 ≤ per-call, day total 20/200)
agent ──POST /agent/orders { usd 20 }──▶ platform   (day total 40/200)
…
agent ──GET /agent/state──▶ { policy.spentTodayUsd: 40 }
```

**What the partner gets**: two separate meters that never mix —
`agent_op` events for the policy's daily cap, and the x402 payment records for
what the agent paid for API access. A failed x402 payment never marks a trade as
paid, and a refused trade never charges for API access.

**What it does not do**: the platform does not pay the agent, and does not settle
the agent's x402 revenue. Interop, not custody.

---

## Case 4 — the runaway agent (what the limits actually do)

**Goal.** Show precisely what happens when a model asks for something absurd.

| Model asks | Result | Why |
|---|---|---|
| `leverage: 100` in a strategy override | clamped to 3× | `lib/trading/strategy-profile.ts` |
| `sizeUsd: 5000` with a $100 key cap | `403` | key policy, agent untouched |
| `sizeUsd: 500` with a $100 cap | `403` | same; the platform clamp only applies **under** the key cap |
| `sizeUsd: 90` on a $500 account | executed at $75 notional (15 % of equity) | platform envelope clamps |
| second BTC order | `409 "already holding BTC"` | one position per market |
| order after −8 % on the day | `409 "daily kill level reached"` | breakers |
| `coin: "NOPE"` | `409 "unknown market"` | venue universe |
| order during a venue outage | `409 "order status uncertain"`, recorded, **never retried** | cloid reconciliation |

The pattern: **policy violations are refusals; platform limits are clamps.**
A caller can tell the two apart without parsing prose — 403 is "your key said no",
409 is "the account cannot".

---

## Reading a real response

```json
{
  "ok": true,
  "fill": { "coin": "BTC", "side": "long", "avgPx": 80176.068, "size": 0.0009757587513520866, "notional": 78.23 },
  "fee": 0.0626,
  "mode": "paper",
  "remainingTodayUsd": 421.77
}
```

- `notional` is what the platform actually allowed, not what was asked.
- `fee` is 8 bps of `notional` — billed whether the position wins or loses.
- `mode` is `paper` until the account approves an agent wallet; the same code
  trades live afterwards.
- `remainingTodayUsd` = `dailyCapUsd − spentTodayUsd − thisCall`; the next call
  that would pass it is refused before execution.
