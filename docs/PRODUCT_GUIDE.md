# Product Guide

> The complete functional reference for Protocol Bank: every surface, what it
> does, how to use it, and where its limits are.
>
> **This guide describes behavior — it does not repeat** the PRD (spec &
> milestones), the Go-Live checklist (step-by-step operations), the MCP docs
> (integration), or the threat model (security limits). Those are linked, not
> duplicated. Last updated: September 2026.

---

## 0. One-paragraph product

Protocol Bank is a **non-custodial AI trading product** for Hyperliquid. You
connect a wallet, set a trading budget, and approve a **trading-only agent
wallet** (EIP-712 `approveAgent`). The AI trades momentum + funding-carry
signals around the clock. It **can trade but never withdraw** — your worst case
is the budget you approved, shown on screen. A free paper mode runs the same
agent on real market data.

Positioning & milestones → [PRD_V2_AI_TRADING.md](PRD_V2_AI_TRADING.md)

---

## 1. Surfaces at a glance

| Surface | Route | Purpose |
|---|---|---|
| Landing | `/` | Positioning, trust, pricing, CTAs |
| AI Trading cockpit | `/trading` | The product: status, positions, activity, controls |
| Live track record | `/live-track-record` | Public, anonymized real-money performance |
| Usage guide | `/help` | In-product onboarding & FAQ |
| Media kit | `/media-kit` | Logos, boilerplate, brand rules |
| MCP server | local stdio | Control the agent from Claude / any MCP host |
| Admin analytics | `/admin/analytics` | Internal: users, usage, feedback |

---

## 2. Landing page (`/`)

**Design intent:** lead with the category label, then the safety promise, then
proof. Not a feature list.

- **Badge:** "Non-custodial AI trading on Hyperliquid" (the category label).
- **Promise:** "The AI can trade but never withdraw — your worst case is the
  budget you choose, written on the screen."
- **Trust link:** "Every live account is public — see real PnL" → track record.
- **Product trio:** Paper / Live / Track record, each with one-line benefit and
  its own CTA.
- **Pricing block:** Paper = free; Live = **20% of profits, nothing on losses**.
- **Final CTA:** Connect Wallet / Try Paper Trading (+ Discord, help, contact).

The legacy enterprise payment suite is deliberately de-emphasized (the
`Products` nav item is hidden; the Business group is collapsed inside the
product). One story: AI trading.

## 3. The AI Trading cockpit (`/trading`)

The single source of truth for the agent. Data comes from
`GET /api/trading/overview` and refreshes every 15s (SWR).

### 3.1 Status & account cards

| Card | Shows | Notes |
|---|---|---|
| Mode badge | `Paper Trading` / `Live` | Reflects the agent's mode |
| Total Assets | Equity | Main + trading wallet |
| Main Wallet | Your untouched wallet | "AI can never touch this" |
| Trading Wallet | Trading budget | **"Max you can lose: $X"** — the risk model in one line |
| All-time Profit | Realized + unrealized PnL | Red/green; also hosts **Withdraw Profit** and **Share my PnL** |

### 3.2 Equity curve

7D / 30D views over `state.equity` (one point per day, plus intraday points
after trades). Fresh paper accounts start with a **30-day demo history** — see
§4.3.

### 3.3 Positions

Every open position lists side, leverage, size, entry/mark, unrealized PnL, and
a **plain-language reason** ("momentum z=-1.5, funding +0.001%/h, short bias").

### 3.4 Activity feed ("What the AI is doing")

Append-only, newest first: market scans, entries (with reason), exits (with
PnL), and risk-guard events ("Risk engine: daily loss at 5% — no new entries
today"). This is the transparency surface — the answer to "why did it do that?"

### 3.5 Controls

| Control | Effect |
|---|---|
| **Pause AI / Resume AI** | Stops/starts *new entries*; open positions keep being managed (stop-losses stay live) |
| **Emergency Stop** | Halts everything (no new entries; exits still enforced by risk on resume) |
| **Reset paper account** | Paper only: clean $500 slate, no demo history |
| **Entry mode** (see §5) | Toggle Automatic ↔ Manual approval |
| **Withdraw Profit** | Sweeps available profit back to your main wallet (live only) |
| **Share my PnL** | Copies an honest share card (live = real PnL + track-record link; paper = clearly labelled simulated) |

### 3.6 Go Live card

Wallet approval lifecycle: **Create** (generates + encrypts the agent key) →
**Sign** (MetaMask `approveAgent`) → **Approved**. Revoke removes local key
material; on-chain revocation happens on Hyperliquid.

Operations detail → [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md)

## 4. Paper engine

### 4.1 Strategy

Two signals, combined into one score:

| Signal | What it reads | Why |
|---|---|---|
| Momentum | 24h z-score of closes | Trend continuation, risk-adjusted |
| Funding carry | Perp funding rate | Collects the crowd's positioning bias |

Executed over the 12 most liquid Hyperliquid perps. Long/short.

### 4.2 Risk parameters (defaults)

| Parameter | Value |
|---|---|
| Position size | 15% of trading equity per position |
| Max concurrent positions | 3 |
| Take-profit / stop-loss | ±2.5% per position |
| Daily circuit breakers | 5% → no new entries; 8% → close everything |
| Leverage (paper model) | 2× |
| Costs modelled | Taker fee 0.04% + slippage 0.05% per side |
| Tick cadence | ~15s (also tick-on-demand when the cockpit is open) |

Entries require |score| above a threshold; exits trigger on TP, SL, signal fade,
or the daily kill switch.

### 4.3 Demo history (fresh paper accounts)

A brand-new paper account seeds a **deterministic 30-day equity curve** (with a
mid-window drawdown, ending ~+4%) so first-time visitors immediately see what
the agent does. It is generated locally and **labelled in the activity feed**:
*"Simulated demo history — not real trading results."* An explicit **Reset**
gives a clean $500 slate instead. Demo history is **never** carried into live
ledgers (§6.2).

### 4.4 Persistence

Paper state lives per wallet: in-memory → file store (`.data/` or `/tmp`) with
a fire-and-forget write-through to `TradingAccount.state_json` so progress
survives serverless restarts. Hydration is mode-guarded (paper state can't
overwrite live).

## 5. Manual approval mode

**What it is:** an opt-in entry gate. In `manual` mode the agent does not place
entries by itself; when a signal fires it creates a **pending trade** (symbol,
side, price, reason) and waits.

- **Approve** → the agent **re-prices at the current market** and **re-runs
  every risk limit** before placing the order. A stale signal can never bypass
  the risk engine.
- **Reject** → nothing is placed.
- **Exits (stop-loss, take-profit, signal fade, circuit breaker) always run
  automatically in both modes** — approval gates entries only, never safety.

Where: cockpit control card ("Entry mode") · API `POST /api/trading/actions
{action:"set_approval", mode:"auto"|"manual"}`, plus `approve` / `reject` ·
MCP `control_trading_agent`.

Switching back to `auto` discards any waiting trade.

## 6. Live mode

### 6.1 The authorization flow

1. Fund Hyperliquid (Arbitrum bridge). **First run: $50–100.**
2. Create the agent wallet (server generates a keypair; AES-256-GCM encrypted).
3. Sign `approveAgent` in MetaMask → on-chain, **trading-only**, revocable.

What you sign grants: place/cancel orders on your account. It does **not**
grant withdrawals. That separation is the entire safety model.

### 6.2 Promotion to a live ledger

A wallet is promoted from paper to live when its account row says
`status = live` **and** `agent_approved`. On first promotion the ledger is
rebuilt as a **clean live book**: the demo history is dropped (simulated data
must never back a live account), and the budget comes from the account row.

### 6.3 Order execution

Live entries and exits are **real IOC orders** signed by the agent key.
Responses are translated into three states:

| State | Meaning | Engine behavior |
|---|---|---|
| **ok** | Filled — real `avgPx` + size returned | Position recorded at the exchange fill |
| **rejected** | The exchange definitively refused (e.g. insufficient margin) | Logged as a guard event; nothing recorded |
| **uncertain** | Timeout / reset / unparseable body / unexpected resting order | **Agent halts itself. No retry.** Position book untouched. Owner notified to verify on Hyperliquid, then resume |

The uncertain rule exists because a retry after an ambiguous response can open
a duplicate position with real money. We prefer "stop and ask" over "risk a
double fill". Rationale & limits → [SECURITY_THREAT_MODEL.md](SECURITY_THREAT_MODEL.md) §3.1–3.2

### 6.4 Known drift

The agent keeps its own book rather than reading the exchange portfolio every
tick. Manual trades you make in the Hyperliquid UI, or an uncertain fill, can
leave the book out of sync. `GET /api/trading/live/state` shows the **real**
Hyperliquid account in the cockpit for comparison.

## 7. Live track record (`/live-track-record`)

The public trust asset. Reads `GET /api/trading/track-record` (public, no auth):

- Aggregate: live account count, total budget, total realized PnL.
- Per account: **anonymized id** (stable 8-hex FNV hash of the wallet), name,
  budget, trade count, realized PnL.
- **Wins and losses both shown** — no cherry-picking.
- Honest empty state before the first live account exists.

Wallet addresses and keys are never exposed.

## 8. MCP server

Lets Claude Desktop / Claude Code / any MCP host read and control the agent:
`get_trading_overview`, `get_positions`, `get_activity`, `get_track_record`,
`control_trading_agent` (pause/resume/stop/approve/reject/set_approval).

Auth: guest mode (no token) is read-only against the demo + public data;
`MCP_AUTH_TOKEN` + `MCP_WALLET_ADDRESS` unlock the caller's own account. The
MCP layer never touches key material.

Setup & tool reference → [MCP.md](MCP.md)

## 9. Feedback & support

| Channel | Where |
|---|---|
| In-app report | Floating **Report an issue** button (every product page) → emails the team |
| Email | e@awareness.market |
| Discord | https://discord.gg/aBeZEsfXkH (linked in footer, landing CTA, report dialog) |

## 10. Pricing

| Mode | Price |
|---|---|
| Paper | Free forever |
| Live | **20% of net profits**, charged when profits are swept out. No subscription, no upfront fee, nothing on losses. |

## 11. Business suite (payments)

The payment-era surfaces remain available but are deliberately de-emphasized —
the company's focus is the AI trading product, and several of these surfaces
are hidden from the current navigation (their URLs still resolve). Custody
differs per feature and is stated explicitly: "non-custodial" is only true
where it is true.

### Non-custodial — the platform never holds the funds

| Surface | What it does | How funds move | Proven |
|---|---|---|---|
| **Batch payments** (`/batch-payment`) | Excel/CSV import, address validation, per-item execution with progress + retry | Each payout is an EIP-3009 `transferWithAuthorization` signed by the payer; a relayer only submits and pays gas. If any item on an EIP-3009 chain is unsigned the batch is refused — no silent custody fallback | E2E on Sepolia: payer balances move, relayer balance unchanged |
| **Send / Pay** (`/send`, `/pay`) | Direct transfers | The user signs the transfer in their own wallet; the platform only displays it | UI flows covered by E2E |
| **Swap / Bridge** (`/swap`) | Cross-chain quotes (Rango, ZetaChain) across 50+ chains | The user signs; the platform never holds | Endpoints answer; providers config-gated, refusals are clean |
| **Split payments** (`/split-payments`) | One payment split across recipients | EIP-3009 authorizations signed by the payer | Calculate / templates / create verified; execution pending |
| **x402** | Machine payments over HTTP 402 for AI agents | The payer signs an EIP-3009 authorization; a relayer only submits and pays gas. An audit-era paywall bypass (any 64-hex string accepted as proof) was found and fixed | Verified with the local relayer, on-chain |
| **Subscriptions** (`/subscriptions`) | Recurring charges | Charges are pre-signed EIP-3009 authorizations, submitted by the app (a hosted relayer is optional) | Verified with the local relayer |

### Provider-custodied — a provider holds the balance

| Surface | What it does | Why it is custodial | Status |
|---|---|---|---|
| **Cards** (`/card`) | Virtual cards funded from the wallet | Issued through a provider (Yativo; a Rain client is also implemented) that holds the card balance | Yativo credentials await the provider's account approval; Rain awaits `RAIN_API_KEY` + KYB |
| **Off-ramp** (`/offramp`) | Sell crypto for fiat (Bridge / Coinbase / Transak) | Provider-executed settlement | Without a provider key the surfaces answer 503 — no fabricated mocks |

### Read-only / infrastructure — no custody at all

Balances, history, analytics, reconciliation, vendors (address book), payment
groups, webhooks, notifications, audit log, teams, MCP server, cron jobs.

> Enterprise hardening applies across the suite: Row-Level Security,
> per-user scoping on every authenticated route, request signing, replay
> protection, and the fourteen audit fixes (cross-tenant reads, wrong-chain
> fallback, error-semantics bugs) — see [FEATURE_REVIEW.md](FEATURE_REVIEW.md).

## 12. Documentation map

| Doc | Covers |
|---|---|
| [PRD_V2_AI_TRADING.md](PRD_V2_AI_TRADING.md) | Product spec, scope, milestones (ZH) |
| [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md) | Step-by-step first live run + troubleshooting |
| [SECURITY_THREAT_MODEL.md](SECURITY_THREAT_MODEL.md) | Assets, trust boundaries, known limitations |
| [MCP.md](MCP.md) | MCP setup and tool reference |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture |
| [AUTH_SYSTEM.md](AUTH_SYSTEM.md) | SIWE + JWT, Shamir, sessions |
| [TESTING_GUIDE.md](TESTING_GUIDE.md) | Jest, Playwright, property tests |
| [../README.md](../README.md) | Repo front door |
