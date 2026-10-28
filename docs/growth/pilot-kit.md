# Pilot kit

Everything to sell the first 10 accounts. One page, five emails, one demo, one
price anchor. Copy, adjust the name and the specific detail, send.

## The offer (one paragraph)

> Protocol Banks gives your agent a trading account with a **cap the model cannot
> raise**: one key, one policy the server enforces (operations, per-call cap,
> daily cap, coin allowlist). Trading goes through a Hyperliquid agent wallet
> with trading-only rights — it can place and cancel orders, never withdraw.
> Start in the sandbox in 10 minutes with simulated money; the same code goes
> live unchanged. Pilot: **$1,000 for 30 days**, then $999/mo (Growth) if it
> earns its place.

## Who to send it to

The 20 names in [`partner-targets.md`](partner-targets.md). Start with agent
frameworks and trading-bot vendors — they already have users and no risk layer.

## Five-email sequence

**1 — the specific observation (day 0, 70 words)**

Subject: `{{product}} + a spend cap your model can't talk past`

> Hi {{name}} — {{product}} agents can call tools but there is nothing between a
> runaway loop and the wallet. We built the execution layer: one key, one policy
> enforced server-side (per-call + daily caps), trading through a wallet that can
> never withdraw. Sandbox is free and takes 10 minutes: protocolbanks.com/agent-api
>
> Worth 15 minutes to see the $5,000-request-gets-403 demo? — {{you}}

**2 — the proof (day 3)**

Subject: `the exact refusal a runaway agent gets`

> Short version: the model asked for $5,000 against a $100 cap. The server
> answered `403 {"error":"order of $5000.00 exceeds this key's per-call cap of
> $100"}` and the agent was never touched. Same endpoint, same code, cap set on
> the key. Reply with your stack and I'll size a policy for it.

**3 — the integration (day 7)**

Subject: `one tool manifest, your framework`

> If you use the Vercel AI SDK, LangChain or Mastra, the wiring is a manifest +
> `jsonSchema()`. Runnable starters: github.com/everest-an/protocol-banks---web3/tree/main/integrations
> Sandbox keys are free. If it's easier, I'll do the first integration with you
> on a call.

**4 — the pilot (day 12)**

Subject: `a $1k pilot, 30 days`

> Proposal: $1,000 for 30 days, one live account with a budget you choose, caps
> set together, weekly usage + fee report. If it doesn't earn its place, we stop.
> If it does, $999/mo (Growth). No annual lock-in for the pilot.

**5 — the close (day 18)**

Subject: `close the loop?`

> I'll stop here. If timing is wrong, tell me the month that works and I'll come
> back then. If someone else owns this, point me at them.

## Demo script (5 minutes)

1. **Show the cap, not the product.** Create a sandbox key at
   `/settings/api-keys` with `read` + `trade`, $50 per call. One screen.
2. **Read the account.** `GET /v1/agent/state` — mode, equity, policy with
   `spentTodayUsd`.
3. **Place a $20 order.** Show the fill, fee, `remainingTodayUsd`.
4. **Ask for $5,000.** Show the `403` verbatim. "The model cannot retry its way
   past this; the policy lives on the key."
5. **Show the invoice.** `pnpm invoice:create` → payment link. "That's how your
   customer pays you; this is how you pay us."
6. **Close:** "What would you need to see to run this with real money for 30
   days?"

## Objections

| Objection | Answer |
|---|---|
| "We'll build it ourselves." | "You can — the exchange API is public. The work is the policy layer, the receipts, and the 3 a.m. reconciliation. You're buying the boring part." |
| "It's only Hyperliquid." | "That's where the liquidity and the agent wallet permissions are. One venue done properly beats six done badly." |
| "8 bps is expensive." | "Against a runaway fill it's free. If volume is real, take a plan and the per-order fee goes away." |
| "We need custody." | "We don't hold funds. The agent wallet can trade, never withdraw; worst case is the budget on screen." |
| "Cards, not crypto." | "For the pilot, invoice in USDC or pay by card via Stripe once we set it up. Tell me which your finance team needs." |

## Pilot terms (outline, not legal advice)

- 30 days, $1,000, one account, caps agreed in writing.
- Cancel anytime; unused days are not refunded (or pro-rate — your call).
- Convert to Growth $999/mo; usage report monthly.
- The platform is non-custodial; the customer funds the trading wallet.
- Live trading requires the customer's own `approveAgent` signature.

## Weekly cadence

- Monday: 10 new emails (sequence steps + 3 new targets).
- Tuesday/Thursday: demos.
- Friday: update the sheet (sent / replies / demos / pilots / MRR) and run
  `pnpm funnel:agents`; kill the channel that produced nothing two weeks running.
