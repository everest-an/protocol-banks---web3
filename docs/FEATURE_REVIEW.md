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
| **x402** | Design: the payer signs an **EIP-3009 `transferWithAuthorization`** (funds leave the payer's balance; a relayer only submits and pays gas). | ⚠️ challenge/authorize/verify verified (incl. an on-chain check I added); settlement needs a hosted relayer |
| **Split payments** | Same EIP-3009 design (`lib/services/eip712.service.ts`). | ⚠️ calculate/templates/create verified; execution not run |
| **Yield** (`/yield`) | The API **records** a deposit; the client executes the on-chain transfer. | ⚠️ validation verified (1 USDT minimum), real position not verified |

### Custodial — the platform (or a provider) holds the funds

| Feature | Why it is custodial | Proven |
|---|---|---|
| **Batch payments** (`/batch-payment`) | The relayer pays **from its own balance** (`executePayout` → `transfer` signed with `RELAYER_PRIVATE_KEY`). I proved this end to end: relayer 20 → 19.25 USDC, recipient 0 → 0.75, two real tx hashes. Internal ledger credits the user's account, but the platform holds the float. | ✅ real transfers on Sepolia |
| **Subscriptions** (`/subscriptions`) execution | Records only after an on-chain submission by a **hosted relayer** (`RELAYER_API_KEY`/`RELAYER_URL`) — no local-key path. Whether the funds leave the payer or the float depends on that service. | ⚠️ refuses cleanly when unconfigured |
| **Cards** (`/card`) | Issued through **Yativo** (a BaaS); the platform holds a provider balance. | ⚠️ needs `YATIVO_SECRET` |
| **Off-ramp** (`/offramp`) | Same Yativo path; fiat settlement through the provider. | ⚠️ quote returns a **mock** when no provider is configured |

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

## 3. Structural risk still open

**The RLS policies are inert.** `scripts/*.sql` predicates on Supabase's
`request.jwt.claims`, which a Prisma connection never sets, and no table
declares `FORCE ROW LEVEL SECURITY`, so the table owner bypasses every policy.
Multi-tenant isolation therefore rests **entirely on application-level WHERE
clauses** — which is exactly how the two leaks above happened.

Two ways to close it:

1. **Enforce RLS for real** — connect as a non-owner role, `set_config` the
   caller per request, and rewrite the policies against that variable.
2. **Add a CI check** — every Prisma query touching user data must carry an
   owner filter (a lint/test, so a missing `where` cannot ship).

## 4. Configuration the features need (currently missing)

| Missing | Blocks |
|---|---|
| `RELAYER_API_KEY` / `RELAYER_URL` | subscription charging, x402 settlement |
| `ASSET_DISTRIBUTOR_ADDRESS` / `..._PRIVATE_KEY` | post-payment asset (NFT/token) distribution |
| `YATIVO_SECRET` | card funding |
| off-ramp provider | off-ramp quotes (currently mock) |
| `NEXT_PUBLIC_BATCH_TRANSFER_CONTRACT` | the legacy on-chain batch-transfer contract path |
| yield deployments | yield aggregator (logs "No deployment found" per chain) |

## 5. Positioning implication

"Non-custodial" is accurate for the **trading product** and for the
direct-transfer payment surfaces (invoice, acquiring, x402, split, send/swap).
It is **not** accurate for **batch payments**, **cards** and **off-ramp**, which
hold funds with the platform or a provider.

The cleanest way to make the claim true everywhere: port batch payouts onto the
EIP-3009 authorisation path that already exists in the codebase (`erc3009.ts`,
used by x402 and split) — the user signs, the relayer only submits. Until then,
keep the distinction visible in the marketing copy.
