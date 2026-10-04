# Feature Review — what exists, who holds the funds, and what has been proven

Written after a full walk of the product's surfaces with testnet tokens, the
on-chain verifications in `scripts/`, and the security audit. Every row states
the custody model explicitly, because the answer is not the same across the
product, and "non-custodial" is only true where it is true.

Legend for **Proven**: ✅ verified against real infrastructure · ⚠️ partially
verified / config-gated · ❌ unverified.

---

## 1. Custody model per feature

### Non-custodial — the platform never holds the funds

| Feature | How funds move | Proven |
|---|---|---|
| **AI Trading** (`/trading`) | The agent holds a **trading-only** wallet approved via Hyperliquid `approveAgent`; it can open/close positions but **cannot withdraw**. Funds sit in the user's own Hyperliquid account; revocation is on-chain. | ✅ approve + real orders + exits + autonomous sessions on testnet |
| **Send** (`/send`, `/pay`) | The user signs the transfer in their own wallet; the platform only displays it. | ⚠️ UI flows covered by E2E; on-chain send is wallet-signed (not agent-runnable) |
| **Swap / Bridge** (`/swap`) | Rango / ZetaChain quotes; the user signs. | ⚠️ endpoints answer; providers not configured, refusals are clean |
| **Invoice** (`/invoice`) | The payer transfers **directly to the recipient's address**; the platform records status and tx hash only. | ✅ full flow incl. a real Sepolia payment |
| **Acquiring** (`/acquiring`) | The payer pays the **merchant's own wallet**; the platform tracks the order. | ⚠️ reads verified; create is cookie-session only |
| **x402** | Design: the payer signs an **EIP-3009 `transferWithAuthorization`** (funds leave the payer's balance; a relayer only submits and pays gas). | ✅ the local relayer key now submits these on-chain (`lib/services/relayer-submit.ts`, verified in `scripts/local-relayer-e2e.ts`) |
| **Split payments** | Same EIP-3009 design (`lib/services/eip712.service.ts`). | ⚠️ calculate/templates/create verified; execution not run |
| **Yield** (`/yield`) | The API **records** a deposit; the client executes the on-chain transfer. | ⚠️ validation verified (1 USDT minimum), real position not verified |

### Mixed — non-custodial when the payer signs, custodial otherwise

| Feature | Split | Proven |
|---|---|---|
| **Batch payments** (`/batch-payment`) | **EIP-3009 path (non-custodial)** — the payer's wallet signs one `transferWithAuthorization` per item; the relayer only submits and pays gas, so the funds never touch the platform. The execute endpoint validates every signature (signer = batch owner, recipient/amount/window pinned) and refuses the batch if any pending item on an EIP-3009-capable chain is unsigned — no silent fallback to custody. **Legacy path (custodial)** — items without an authorization (tokens without EIP-3009 support) are still paid by the relayer from its own balance, as before. | ✅ E2E on Sepolia: payer 0.55 → 0.45, relayer unchanged (19.25), two recipients 0 → 0.05 each; 12 unit tests on the validator; earlier float run: relayer 20 → 19.25 |

| **Subscriptions** (`/subscriptions`) execution | Charges are EIP-3009 authorizations the payer signed ahead of time; with the **local relayer key** the app submits them itself (the same path as batch payouts), so the funds leave the payer's balance. A hosted relayer is optional, not a requirement. | ✅ local-key submission verified (`scripts/local-relayer-e2e.ts`) |

### Custodial — the platform (or a provider) holds the funds

| Feature | Why it is custodial | Proven |
|---|---|---|
| **Cards** (`/card`) | Issued through a provider (Yativo today; a **Rain client is implemented**). The provider holds the card balance. | ⚠️ Yativo credentials answer **401** (invalid); Rain awaits `RAIN_API_KEY` + partner/KYB (`lib/services/rain-card.service.ts`) |
| **Off-ramp** (`/offramp`) | Bridge / Coinbase / Transak settlement; provider-custodied. | ⚠️ without a provider key quotes/execution answer **503** — no fabricated mocks (mocks require `ALLOW_MOCK_EXECUTION` outside production) |

### Read-only / infrastructure (no custody at all)

Dashboard, analytics, history, balances, reconciliation, ledger, settlements,
authorizations, transactions, audit log, notifications, webhooks, teams, vendors
(address book), payment groups, MCP server, cron jobs.

---

## 2. What the audit changed

Fourteen findings, all fixed and re-verified (`git log` has the detail):

- 🔴 **x402 paywall bypass** — a public endpoint accepted any 64-hex string as
  proof of payment and released the paid resource.
- 🔴 **Batch execution silently fell back to Ethereum mainnet** — any chain name
  missing from the worker's map sent the payout to chain 1, i.e. real mainnet
  funds on the wrong chain.
- 🔴 **Two unauthenticated cross-tenant reads** — `batch/status` and
  `payment-groups/[id]` served other users' data (the latter including every
  payment in the group) and could be edited.
- Plus error-semantics bugs that reported client errors as 500 (invoice PATCH,
  webhook verify fail-open, payment-link verify, a2a JSON-RPC, cards, asset
  distribution), two case-sensitivity bugs that made whole features unusable
  (billing lookup, vendor owner lookup), a settlement id collision, and a
  retired Etherscan endpoint that had broken transaction history for everyone.

## 3. Tenant isolation — moving to database-enforced RLS

**The old policies were inert — and on the current database they were absent.**
The Supabase-era scripts predicated on `request.jwt.claims`, which a Prisma
connection never sets. The app now runs on Prisma Postgres, where the database
had **zero** policies and the connection role (`prisma_migration`) is a
restricted superuser that bypasses RLS by definition. Multi-tenant isolation
therefore rested entirely on application-level WHERE clauses — exactly how the
two leaks above happened.

**The enforcement foundation is now in place** (behind `RLS_MODE`, off by
default):

- `lib/rls/context.ts` carries the caller's wallet per request; `withAuth` sets it.
- `lib/rls/scoped-prisma.ts` runs each user-context operation inside a
  transaction that does `SET LOCAL ROLE prisma_application` (the platform's
  non-superuser role, pre-granted DML on every table) and
  `set_config('app.wallet', <caller>, true)`.
- `scripts/034_enable_rls_all_tables.sql` enables `FORCE ROW LEVEL SECURITY`
  and adds policies for 76 user-scoped tables (child tables via `EXISTS` on the
  parent). Policies are inert for the superuser, so applying them changed
  nothing until `RLS_MODE=enforce`.
- Verified on the real database: the owner sees their rows, a stranger sees
  none, and un-scoped system access is unaffected
  (`scripts/rls-isolation-check.ts`).
- `scopedTransaction()` covers interactive transactions (which Prisma
  extensions cannot intercept); a guard test fails on raw `$transaction` in
  `app/`, and system paths carry an explicit `rls:system` marker.

**Enforcement is live in production.** Twenty system routes (pre-session auth,
cron, public endpoints) carry explicit `rls:system` markers and the guard test
keeps new ones honest; `RLS_MODE=enforce` is set in Vercel for production and
preview. `GET /api/status` reports the posture (`rls: enforce — database
policies active`) and `scripts/prod-smoke.ts` asserts cross-wallet isolation
against the live site — a fresh wallet sees none of the test wallet's rows.

Measured limit: scoped operations each open a transaction, and Prisma Postgres
occasionally answered `P2028` under bursts. The scoped transaction now waits up
to 10s and retries once; endpoint-heavy flows were re-verified under enforce
(the 98-step harness matched its pre-enforce baseline).

## 4. Configuration status

| Item | State |
|---|---|
| `RELAYER_PRIVATE_KEY` (local-key relayer) | ✅ set in production; **funded on Ethereum, Base and Polygon**; `scripts/relayer-readiness.ts` lists per-chain gaps |
| `RELAYER_API_KEY` / `RELAYER_URL` (hosted relayer) | — optional: the local key already covers batch payouts, subscription charges and x402 settlement |
| `ASSET_DISTRIBUTOR_ADDRESS` / `..._PRIVATE_KEY` | ✅ provisioned locally and in Vercel (`scripts/setup-asset-distributor.ts`); fund the wallet before use |
| `YATIVO_API_KEY` / `YATIVO_API_SECRET` | ⚠️ present but invalid (401) — needs fresh credentials |
| `RAIN_API_KEY` (+ partner access / KYB) | ⚠️ missing — outbound client ready (`lib/services/rain-card.service.ts`) |
| Off-ramp provider (Bridge / Coinbase / Transak) | ⚠️ missing — answers 503 with an actionable message until configured |
| `NEXT_PUBLIC_BATCH_TRANSFER_CONTRACT` | — not needed: USDC batches settle via EIP-3009 |
| Yield deployments | ⚠️ missing — the aggregator logs "No deployment found" per chain and the API answers **503** (not 500) until deployed |
| `RLS_MODE` | ✅ `enforce` in production and preview |

Ops helpers: `scripts/config-status.ts --probe`, `scripts/relayer-readiness.ts`,
`scripts/prod-smoke.ts`, `scripts/rls-isolation-check.ts`,
`scripts/drain-compromised-relayer.ts`; `GET /api/status` reports `database`,
`relayer` and `rls` components.

## 5. Positioning implication

"Non-custodial" is accurate for the **trading product**, the direct-transfer
surfaces (invoice, acquiring, x402, split, send/swap), **batch payments
whenever the payer signs the batch** — both the recipients editor and the
file-upload flow now execute this way — and **subscription charges** (the payer
signs ahead; the app submits via the local relayer key). Tenant isolation is
enforced by the database itself (`RLS_MODE=enforce`), not just by query filters.

It is still **not** accurate for **cards** and **off-ramp** (provider custody),
nor for batch items on tokens without EIP-3009 support (the legacy
relayer-funded path); keep that distinction visible in the marketing copy.
