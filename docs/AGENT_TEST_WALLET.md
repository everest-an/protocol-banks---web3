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

## Safety notes

- Treat this wallet as compromised-by-design: a private key in a file on a dev
  machine is a test-grade custody model, acceptable only because the balance is
  small and the goal is verifiable behaviour.
- Never reuse this key for anything else.
- Revoke the agent on Hyperliquid when the test is finished (`{action:"revoke"}`
  deletes the local key; revocation itself is done from the Hyperliquid UI).
