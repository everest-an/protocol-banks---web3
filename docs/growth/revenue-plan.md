# Revenue plan — first $10k, then $100k MRR

**Honest starting point (2026-10-28):** 0 paying customers, 0 API keys, npm
downloads not indexed yet. The product is integrable; revenue is now a sales
problem, not a code problem. Nothing below happens without conversations.

## The arithmetic (no rounding up)

| Path to $100k MRR | Accounts needed |
|---|---|
| Builder $199/mo | 500 |
| Growth $999/mo | 100 |
| Scale from $4,999/mo | 20 |
| Pay-as-you-go (8 bps) | $125M notional **per month** (~$4.1M/day) |

The 8 bps alone cannot get there soon — plans must carry the revenue. A realistic
mix at $100k: **60 Growth ($59.9k) + 8 Scale ($40k) ≈ 68 accounts.**

For scale: the first **$10k MRR** is 6 pilots at $1k + 4 converted at $999.

## Who buys (ICP, in order)

1. **Agent frameworks / tooling teams** that need a money tool (LangChain,
   Vercel AI, Mastra, Eliza). Buyer: founder/CTO. Trigger: they have agents and
   no execution layer.
2. **Trading-bot vendors** with users but weak risk controls (Telegram bots,
   Hyperliquid tooling). Buyer: founder. Trigger: a runaway-spend incident or a
   support-ticket pile.
3. **Wallet/agent platforms** that want execution inside their app. Buyer:
   product lead. Trigger: an enterprise customer asking for limits + audit.

The pitch in one line: *sandbox in 10 minutes, a spend cap the model cannot
raise, 8 bps or a plan.*

## Channels (ranked by time-to-first-dollar)

1. **Outbound design partners** — 20 named targets in
   [`partner-targets.md`](partner-targets.md), 10 emails/week, one ask: a 15-minute
   demo against the sandbox.
2. **Inbound intent** — MCP Registry listing, npm packages, `/agent-api`,
   `llms.txt`. Already live; measure weekly.
3. **Framework presence** — Mastra/Vercel AI issues open; eliza plugin published.
   Each accepted integration is a permanent lead source.
4. **Content** — the runaway-agent demo (model asks $5,000 → 403). One post per
   week on X / r/LocalLLaMA / r/algotrading, with the real output.

## Weekly funnel and targets

`agents_view → api_key_created → first order → pilot call → paid`

| Stage | Weekly target |
|---|---|
| Personalized emails | 10 |
| Replies | 3–4 |
| Demos | 2 |
| Pilots started | 1 |
| Pilots converted | 1 per two weeks |

Track events with `pnpm funnel:agents`. Keep a separate sheet for the human
stages (emails, demos, pilots) — the database cannot see a phone call.

## What is already built

- `/pricing` and `/agent-api` (offer + docs), sandbox keys with policy
- Contract + SDK + tool manifest + MCP registry entry
- **Stripe checkout + plan enforcement**: paid plans replace the 8 bps fee and
  clamp the key's caps; key count is checked at creation; customer portal for
  cancellation/cards. Needs `STRIPE_*` env vars (see `ENV_SETUP.md` §11).
- **Invoices with a payable link**: `pnpm invoice:create --to … --amount 1000 --description "Builder plan, November"`
- **Usage + fees owed**: `DAYS=30 pnpm partner-usage`-equivalent script
  (`scripts/partner-usage.ts`) and `pnpm funnel:agents`

## 90-day milestones

| Weeks | Outcome |
|---|---|
| 1–2 | Pilot kit done; 30 targets loaded; invoice flow tested; first 10 emails |
| 3–4 | 4 demos; first paid pilot ($1k); fix the top integration objection |
| 5–6 | 3 pilots ($3k); first conversion to Growth ($999) |
| 7–8 | $5k MRR; case study #1 (numbers + refusal example) |
| 9–12 | **$10k MRR**; 2 Scale conversations; decide on Stripe vs invoice-only |

$100k MRR is a 9–12 month target with one seller (you) and one engineer (me):
~68 Growth/Scale accounts, or a handful of white-label deals. Any promise
faster than that is fiction.

## Only the founder can do

- Choose the payment rail (Stripe vs invoice-only vs crypto) and the legal
  entity that signs the order form.
- 10 conversations per week. I can write the emails; I cannot make the calls.
- Legal review of live-trading language and the risk disclosure before the
  first paid live account.
