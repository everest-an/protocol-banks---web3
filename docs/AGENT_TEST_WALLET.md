# Agent Test Wallet — live-mode end-to-end run

A dedicated, owner-funded wallet used by the agent to exercise the **real-money
live path** end to end (SIWE login → agent-wallet approval → funded budget →
live order → settlement), instead of only testing paper mode.

> The owner funds this wallet with a deliberately small amount. The product's
> risk model is "worst case = the funded budget", so the test amount IS the
> maximum exposure. Do not fund beyond what you are willing to lose.

## Wallet

| | |
|---|---|
| Address | `0xBf0D7119F553eB5f85C9806f0849f9c86a9B768C` |
| Created | 2026-09-29 |
| Key custody | Local only — **`.env.local`** (gitignored), keys `AGENT_TEST_WALLET_ADDRESS` / `AGENT_TEST_WALLET_PRIVATE_KEY` |
| In the repo? | **No.** The private key must never be committed, pasted into docs, chat, issues, or logs. Only the address (public) is recorded here. |

If the key is ever lost, generate a new wallet — there is nothing to recover;
the address is only meaningful while the key exists.

## Funding path (Hyperliquid)

1. Send **USDC on Arbitrum** to the address above (owner action).
2. Deposit it into Hyperliquid from that address (Hyperliquid deposit bridge —
   the same flow the app's "Fund your trading wallet" step describes).
3. The app then shows the trading budget; the agent's max loss equals it.

Keep the amount small (suggested: **$50–100**) — this is a plumbing test, not a
strategy test.

## What gets verified

| Step | Endpoint / code path | Expected |
|---|---|---|
| 1. SIWE login with the wallet key | `lib/auth/siwe.ts` → `/api/auth/siwe*` | JWT issued for the wallet address |
| 2. Generate agent wallet | `POST /api/trading/live/agent-wallet {action:"generate"}` | EIP-712 `approveAgent` typed data returned, agent key encrypted at rest (`lib/trading/keys.ts`) |
| 3. Sign approval with the main key | EIP-712 signature over the typed data | `recoverSigner` matches the wallet |
| 4. Submit approval | `{action:"approve", signature}` | `submitApproveAgent` accepted by Hyperliquid; `approved: true` |
| 5. Set a small budget + go live | `app/api/trading/*` + cockpit | Agent trades with real IOC orders (`lib/trading/live-executor.ts`) |
| 6. Verify safety rails | live executor + risk engine | SL/TP honoured, circuit breaker halts, uncertain orders halt instead of retrying |
| 7. Emergency stop | `POST /api/trading/actions` + `{action:"revoke"}` | Positions close / agent key deleted |

Steps 1–4 can be driven by a script (the wallet key signs SIWE + EIP-712
directly); the browser has no wallet extension installed, so anything requiring
MetaMask must be scripted or done by the owner.

## Testnet alternative (not done yet)

Hyperliquid runs a testnet (`api.hyperliquid-testnet.xyz`) with faucet funds.
Supporting it would mean making the API base URL + `hyperliquidChain` /
`source` fields configurable in `lib/trading/hyperliquid.ts` and
`lib/trading/exchange.ts`. That is the safer, repeatable option for CI-style
testing, but it does not exercise real deposits, real fills or real settlement
— which is why the funded-wallet path above was chosen first.

---

## Testnet mode — implemented, and where it stops (2026-09-29)

The network switch now exists: `HYPERLIQUID_NETWORK=testnet` moves both the
info and exchange clients to `api.hyperliquid-testnet.xyz`, signs user-signed
actions with `hyperliquidChain: "Testnet"` and L1 actions with the testnet
phantom-agent source `"b"` ([lib/trading/network.ts](../lib/trading/network.ts),
10 tests, verified against the official Python SDK).

Driver: [`scripts/testnet-e2e.ts`](../scripts/testnet-e2e.ts) —

```bash
# terminal 1
$env:HYPERLIQUID_NETWORK='testnet'; pnpm dev
# terminal 2
$env:HYPERLIQUID_NETWORK='testnet'; $env:DOTENV_CONFIG_PATH='.env.local'
npx tsx -r dotenv/config scripts/testnet-e2e.ts
```

**What it proved against the real venue:**

| Step | Result |
|---|---|
| SIWE login (EIP-191) | ✅ JWT issued for the wallet address |
| Agent key generation | ✅ keypair created, encrypted at rest |
| EIP-712 `approveAgent` submission | ✅ Hyperliquid parsed it and named *our* address as the signer |
| `approveAgent` acceptance | ✅ **`{"status":"ok","response":{"type":"default"}}`** — accepted on testnet once the account was funded |
| Asset context / account read (`getAssetContext`, `getUserState`) | ✅ `{"coin":"BTC","index":3,"szDecimals":5,"midPx":84316.5}`, accountValue 0 |
| IOC order submission (unfunded smoke run) | ✅ **the venue recovered our agent address from the signature** and rejected only on registration: `"User or API Wallet 0xa543… does not exist."` — no price, size or format complaint |
| **Funded IOC order** | ✅ filled: `{"totalSz":"0.00013","avgPx":"84374.6","oid":61371478924}` |
| **reduceOnly close** | ✅ filled `0.00012`, one tick left, dust pass closed it → **account flat** |
| Round-trip cost | ~$0.01 per $11 round trip (≈0.1%, testnet fees) |

### Two real-world behaviours worth knowing

1. **An uncertain order actually happened.** One run failed with `fetch failed`
   after the venue had already filled the order — the HTTP response was lost,
   not the order. That is precisely the case the live executor treats as
   *uncertain* (halt, never retry). The position it left behind was found by
   re-reading `clearinghouseState`, which is also why every run starts with a
   state read.
2. **A reduce-only close can leave one tick of dust.** The venue reports sizes
   rounded to `szDecimals` while the real position can be marginally larger than
   what is orderable, so an exact-size close may stop one tick short
   (0.00014 → 0.00013 → 0.00001). Closing that dust *is* accepted even though it
   is far below the $10 minimum order value. `scripts/flatten-test-wallet.ts`
   and the E2E's dust loop handle it by closing until the account is flat.

That last row is the strongest pre-funding signal available: the order body parses
and the L1 signature recovers to the intended agent **on the live venue**, so the
only thing standing between us and a filled order is funding the account and
registering the agent.

**The gate:** Hyperliquid requires a funded account before it will accept ANY
action, including an agent approval — on testnet as well. And testnet funds
only come from the faucet, which (per the official docs) **only serves
addresses that have deposited on mainnet before**:

> "To use the testnet faucet, you need to have deposited on mainnet with the
> same address. You can then claim 1,000 mock USDC."
> — https://hyperliquid.gitbook.io/hyperliquid-docs/onboarding/testnet-faucet

So there is no free path to a working testnet account: the address needs one
real mainnet deposit (≥ 5 USDC on Arbitrum). After that one deposit:

1. the faucet credits 1,000 mock USDC on testnet, and
2. every later run is free, repeatable and risk-free.

**The faucet itself needs no wallet interaction.** Reading the web app's own
`assets/Drip-*.js` chunk shows the Claim button just POSTs
`{ type: "claimDrip", user }` to the testnet info endpoint — no signature, no
connection. So the claim is scriptable and is wired into the funding flow
(`scripts/lib/testnet-faucet.ts`, `scripts/claim-drip.ts`). The gate is on the
venue's side and is not bypassable; verified by calling it:

```
Cannot claim drip because user 0xbf0d7119… does not exist on mainnet.
```

**Is there a free path? No — checked exhaustively.**

| Candidate | Verdict |
|---|---|
| Testnet faucet without a mainnet account | ✗ refused (live call above) |
| Depositing testnet USDC via a testnet bridge | ✗ Bridge2 has **no contract** on Arbitrum Sepolia (`eth_getCode` → `0x`); it exists only on Arbitrum One (19,394 bytes of bytecode) |
| Older advice about an Arbitrum-Sepolia faucet granting 10,000 USDC | ✗ stale, not offered by the venue today |

So one real mainnet deposit (≥ 5 USDC) is genuinely unavoidable. Two ways to
satisfy it:

1. **Bridge deposit** — send USDC (Arbitrum) + a little ETH for gas to the
   wallet, then `scripts/fund-hyperliquid.ts`.
2. **Internal transfer** — if the owner already holds USDC on Hyperliquid
   mainnet, send ~5 USDC to the wallet *inside* Hyperliquid (no gas, instant).
   That also makes the address "exist on mainnet", which is all the faucet
   checks.

**Bugs found and fixed while wiring this up:**

- `POST /api/trading/live/agent-wallet {action:"approve"}` called
  `markApproved()` even when Hyperliquid answered `{status:"err"}`, so the
  cockpit showed "agent approved" while the venue had refused. It now returns
  502 with the venue's message and leaves the record unapproved.
- The driver initially sent `v = sig.v + 27`. ethers v6 already returns 27/28,
  so the venue recovered an unrelated address — a good reminder that the
  *local* `recoverSigner` check cannot catch a `v`-encoding mistake (it
  normalises 54/55 back to 27/28).
- **The order path could never have matched anything.** Reviewing it against
  the SDK while preparing this test surfaced three independent errors in the
  live order path:
  1. the price was sent as `"1e15"` (buy) / `"1"` (sell) — market orders ARE
     aggressive limit orders on Hyperliquid and must sit inside the allowed
     band;
  2. the size field carried the **USD notional** instead of the size in coins,
     so an $11 BTC order was being sent as 11 BTC;
  3. the order carried the user's **own account as `vaultAddress`**, whose
     documented meaning is "if trading on behalf of a vault or subaccount" —
     the reference implementations omit it for a normal account.

  All three are fixed (`aggressivePrice` = mid ± slippage, venue-rounded to ≤5
  significant figures and ≤ 6 − szDecimals decimals; size = notional / mid,
  floored to szDecimals with the $10 minimum enforced; `resolveVaultAddress`
  passes a vault through only when it is genuinely a different account). The
  signing path itself is now pinned to the SDK's own published test vectors, so
  the wire format is verified independently of our own tests. These would only
  ever have surfaced on the first real order.
- **The paper → live promotion silently reverted manual approval.** The
  promotion rebuilt the ledger with `Object.assign(state, seedState(...))`,
  which also reset `approvalMode` to the seed default `"auto"` — so a user who
  had switched manual approval on (the mode the help page recommends for a
  first real-money run) would have had it quietly turned off at the exact
  moment real orders start. Extracted as the pure `promoteToLiveLedger()`
  (which carries `approvalMode` across and still drops paper positions, pending
  trades and the simulated curve), covered by 8 tests.

### Minimal-cost unlock

Send ~USDC 6–10 on Arbitrum to the wallet above. Then either:

- **Testnet route (recommended, one-time cost ≈ $6):** deposit ~5.5 USDC into
  Hyperliquid mainnet (satisfies the faucet gate) → claim the 1,000 mock USDC
  on testnet → all further testing uses mock funds; or
- **Mainnet route (≈ $6 at risk):** deposit and run the real path with a tiny
  budget in manual-approval mode.

### Runbook — exactly what runs once the address is funded

Four scripts, all safe by default and re-runnable. No browser or wallet
extension is involved at any point.

```powershell
# 0a. (owner) if the funds sit elsewhere, move them onto this wallet first:
#     scripts/bridge-funding-to-testnet.ts converts ETH (Ethereum) → USDC + gas
#     ETH on Arbitrum via LI.FI. Dry-run by default; CONFIRM_BRIDGE=1 to send.
#
# 0b. the address then needs USDC (Arbitrum) AND a little ETH for gas
#     wallet: 0xBf0D7119F553eB5f85C9806f0849f9c86a9B768C

# 1. deposit into Hyperliquid — DRY RUN first (prints balances, sends nothing)
$env:DOTENV_CONFIG_PATH='.env.local'
npx tsx -r dotenv/config scripts/fund-hyperliquid.ts

# 2. same command, armed (enforces the docs' 5 USDC floor: below it the venue
#    keeps the money, so the script refuses anything smaller)
$env:CONFIRM_DEPOSIT='1'; npx tsx -r dotenv/config scripts/fund-hyperliquid.ts
#    -> polls until the account is credited, then claims the testnet drip
#       (1,000 mock USDC) automatically. To re-claim later:
#       npx tsx -r dotenv/config scripts/claim-drip.ts

# 3. full end-to-end against testnet
$env:HYPERLIQUID_NETWORK='testnet'; pnpm dev          # terminal 1
$env:HYPERLIQUID_NETWORK='testnet'; npx tsx -r dotenv/config scripts/testnet-e2e.ts   # terminal 2

# 4. if a run is interrupted mid-trade, flatten before the next one
$env:HYPERLIQUID_NETWORK='testnet'; npx tsx -r dotenv/config scripts/flatten-test-wallet.ts
```

`scripts/testnet-e2e.ts` runs SIWE → agent generate (self-healing: it revokes
and regenerates when a previous attempt left an unapproved key, because the API
only issues an approval nonce at generate time) → EIP-712 approve → status →
**order round-trip**: it places a real IOC order through the app's own
`placeMarketOrder`, reads the position back from `clearinghouseState`, then
flattens it with `reduceOnly` and verifies the account is flat again.

Tunables: `E2E_COIN` (default BTC), `E2E_SIZE_USD` (default 11 — Hyperliquid's
minimum order value is $10), `E2E_BASE_URL`, `ALLOW_MAINNET=1` to permit a
mainnet run.



## Safety notes

- Treat this wallet as compromised-by-design: a private key in a file on a dev
  machine is a test-grade custody model, acceptable only because the balance is
  small and the goal is verifiable behaviour.
- Never reuse this key for anything else.
- Revoke the agent on Hyperliquid when the test is finished (`{action:"revoke"}`
  deletes the local key; revocation itself is done from the Hyperliquid UI).
