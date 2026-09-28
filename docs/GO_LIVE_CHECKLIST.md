# Go-Live Checklist

> Step-by-step guide to running your first **real-money** account.
> Recommended first run: **$50–100 budget + manual approval mode** so every
> entry passes your eyes while you build trust in the agent.
> Last updated: September 2026.

---

## Phase 0 — Prepare (5 min)

- [ ] **MetaMask installed** (or another injected EVM wallet). This is the only
      supported login path.
- [ ] **Disable conflicting wallet extensions** for this session (TronLink,
      TokenPocket, etc.). The app rejects TronLink's injected provider, but a
      clean browser profile avoids surprises.
- [ ] **USDC ready on Arbitrum** (the bridge Hyperliquid uses). Any amount; you
      can always add more later.

## Phase 1 — Connect & sanity-check (2 min)

- [ ] Open <https://protocolbanks.com/trading>
- [ ] Click **Connect Wallet** → approve in MetaMask
- [ ] The header now shows your address (0x…); no red "program exception"
- [ ] You are in **Paper Trading · Agent running** mode

**Expected:** paper account with a simulated demo curve. Nothing here touches
real funds yet.

## Phase 2 — Watch it work in paper (recommended: 1–3 days)

- [ ] Leave the cockpit open. Watch the **"What the AI is doing"** feed:
      market scans, entries with a plain-language reason, exits with PnL.
- [ ] Read `Entry $X · Max you can lose $X` on the trading wallet card — that
      is the risk model in one line.
- [ ] Try the controls: **Pause AI** → **Resume AI**. Confirm you understand them.
- [ ] Optional: switch **Entry mode → Require my approval** and watch a pending
      trade appear, then approve or reject it.

**Why this matters:** you should only fund live trading after you've seen the
agent's behavior and understand *why* it opens trades.

## Phase 3 — Fund Hyperliquid (5 min)

- [ ] Go to <https://app.hyperliquid.xyz> and connect the **same wallet**
- [ ] Deposit USDC (Arbitrum bridge). **Start with $50–100** for the first
      real-money run.
- [ ] Confirm the balance shows up on Hyperliquid

**Worst case, restated:** the AI can trade but can never withdraw. Your maximum
loss is the trading budget — never your main wallet.

## Phase 4 — Create & approve the agent wallet (2 min)

- [ ] Back on <https://protocolbanks.com/trading>, find the **Go Live** card
- [ ] Click **Create** — we generate an agent keypair and encrypt it
      (AES-256-GCM) on the server
- [ ] MetaMask pops an **approveAgent** signature request → **confirm**
- [ ] The card now shows the agent as **Approved**

**What you just signed:** trading-only permissions. The agent can open/close
positions. It cannot withdraw. Ever. Revoke it on Hyperliquid at any time.

## Phase 5 — First live run (do this)

- [ ] Switch **Entry mode → Require my approval**
      *(you'll switch it on the cockpit's control card)*
- [ ] The agent starts scanning. When a signal fires you'll see an amber
      **"Trade awaiting your approval"** card: symbol, side, price, reason.
- [ ] Read the reason. Approve if it makes sense; reject if it doesn't.
      - **Approve** → the agent places a real order and re-prices at the
        current market, re-running every risk limit first.
      - **Reject** → nothing is placed.
- [ ] After a few days of approvals that look sane, decide whether to switch to
      **Automatic** (the agent places entries itself; exits were always automatic).

**Exits are always automatic** — stop-loss, take-profit, signal fade and the
daily circuit breaker run in both modes. Manual approval only gates *entries*.

## Phase 6 — Monitor & operate

- [ ] `/live-track-record` updates automatically — your account appears there
      (anonymized) with real PnL
- [ ] The activity feed tells you everything the agent did, in plain language
- [ ] **Withdraw Profit** sweeps available profit back to your main wallet
- [ ] **Pause AI** stops new entries (keeps managing open positions)
- [ ] **Emergency Stop** halts everything

### If the agent halts itself with an "UNCERTAIN" notice

This means an order request failed in a way where we can't tell whether it
reached the exchange. Safety behavior: the agent **stops** and does **not**
retry (a retry could open a duplicate position).

- [ ] Go to Hyperliquid and check your positions
- [ ] If the order did fill, the position is on Hyperliquid (our ledger may not
      show it — a known limitation, see `SECURITY_THREAT_MODEL.md` §3.2)
- [ ] Once verified, **Resume AI**

### Withdrawing / walking away

- [ ] Revoke the agent: **Hyperliquid → your account → agent permissions →
      revoke**. Trading stops instantly (on-chain, no cooldown).
- [ ] Optional: also click **Revoke** in our Go Live card to delete the local
      key material.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Wallet not found" toast | No MetaMask in this browser | Install MetaMask; disable TronLink |
| approveAgent popup never appears | Wallet didn't get the request | Re-click Create; check MetaMask isn't locked |
| Agent shows "Approved" but never trades | Paused / stopped / no signals / risk circuit breaker | Check Entry mode + the activity feed for guard messages |
| Pending trade sits for a long time | Manual mode + you haven't acted; no new entries are needed | Approve, reject, or switch to Automatic |
| "Trade not executed" after Approve | Risk limits re-checked and rejected (funds, max positions) | Read the guard message in the activity feed |
| Agent self-halted (UNCERTAIN) | Order outcome unknown | Verify on Hyperliquid → Resume |
| Cockpit shows Paper Trading after approval | You're in a different browser/profile than the approved wallet | Connect the same wallet that approved the agent |

## Cost recap

- **Paper mode:** free forever
- **Live mode:** 20% of net profits, charged when you sweep profits out.
  No subscription, no upfront fee, nothing on losses.
