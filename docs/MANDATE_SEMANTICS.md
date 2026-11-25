# Mandate Semantics (Agent Control Plane)

> Status: decision record for the pilot. This is the contract the code should
> converge on; it is not a claim that every rail is already unified.

## 1. One mandate, several rails

A human owner creates **one mandate** for an agent. The mandate is the
authorization envelope; the rails are how a payment or trade is executed.

```text
Mandate
  ├─ identity: owner wallet / ME ID, agent id
  ├─ policy: allowed ops, vendor allowlist, per-call/daily/monthly caps,
  │          approval threshold, expiry, revoke
  ├─ payments: AgentBudget (USDC/USDT, 6-decimal minor units)
  ├─ trading: TradingAccount budget + risk engine (not AgentBudget)
  ├─ swap: quote-only; the agent's own wallet signs the returned tx
  └─ invoice: a payment request; the payer's payment budget is checked on pay
```

`AgentBudget` is the **payment sub-ledger**, not the whole mandate. The API-key
policy is the credential scope; the mandate is the human-facing object. The
pilot keeps both, with the API-key policy as a ceiling and `AgentBudget` as the
payment ledger.

## 2. What counts as a spend

| Rail | Moves money? | Server-side control | Budget source |
|---|---|---|---|
| `POST /api/v1/agent/pay` | Yes, EIP-3009 from the payer's wallet | API-key policy + `AgentBudget` (check, reserve, refund) | `AgentBudget` |
| `POST /api/v1/agent/llm` | Yes, x402 or budget debit | API-key policy + `AgentBudget` | `AgentBudget` |
| `POST /api/v1/agent/swap` | No, quote only | API-key policy (per-call/daily/coin) | None; the agent signs from its own wallet |
| `POST /api/v1/agent/orders` | Trading PnL, not a payment | API-key policy + trading risk engine | `TradingAccount` budget |
| `POST /api/v1/agent/invoice` | No, payment request | API-key policy | None; payer's budget applies when paid |
| Commerce quotes/orders | No, until paid | API-key policy + order binding | `AgentBudget` at `/pay` with `orderId` |

## 3. Notional vs settled vs reserved

- **Notional**: the USD value the agent asks to move. Used for policy caps.
- **Reserved**: an approved payment intent that has not settled. It reduces the
  available budget so two intents cannot both pass.
- **Settled**: the on-chain transfer confirmed (or a partner rail reported
  success). It moves from reserved to spent.
- **Refunded**: a failed or rejected settlement returns the reserved amount.

The pilot's `AgentBudget` now stores integer minor units (`*_units`, 6 decimals)
and writes an `agent_budget_ledger` row for every genesis/debit/refund. The
string columns are display caches.

## 4. Trading is a separate envelope

Trading notional is not a payment. It is bounded by:

1. the API-key policy (`maxNotionalUsd`, `dailyCapUsd`, coin allowlist), and
2. the `TradingAccount` budget / risk engine.

Do **not** debit `AgentBudget` for a trade. A trade's loss is bounded by the
trading budget and the venue, not by a USDC payment ledger. If a future
"unified mandate" needs one number, add a `rail` dimension to the mandate and
aggregate per rail, not a single shared balance.

## 5. Swap is quote-only

The swap endpoint returns a route and a transaction for the agent's own wallet
to sign. The platform never holds the key and never submits the swap. Therefore
the only enforceable server-side control is the API-key policy at quote time.
If the platform later executes swaps (with a scoped signer / MPC), the swap
becomes a spend and must use `AgentBudget` with the same reserve/refund flow.

## 6. Invoice is a request, not a spend

Creating an invoice moves no money. The invoice creator is asking to be paid.
The **payer's** mandate is checked when the payer calls `/agent/pay`; the
invoice id binds the payment to the order/invoice terms. Do not reserve the
creator's `AgentBudget` for an invoice.

## 7. Approval and revoke

- Approval above the threshold is an `AgentBudget`/payment-intent concern.
- Revoke is a mandate concern: it must invalidate pending payment intents and
  stop new payments. Trading has its own pause/revoke path; a mandate revoke
  should call both.
- The audit chain records the request, the human decision, and the settlement
  (or failure) for the payment rail. Trading and swap log their own events.

## 8. What the pilot implements now

- `AgentBudget` integer units + ledger: payments and LLM.
- Atomic debit/refund against `balance_units`.
- Hash-chained audit with an atomic `audit_chain_heads` row per actor.
- API-key policy on every agent route.
- Trading uses its existing budget/risk engine.
- Swap and invoice remain policy-checked, not budget-reserved.

## 9. What a full mandate needs next

1. A first-class `Mandate` table with `owner`, `agent`, `rails`, `limits`,
   `status`, `expires_at`, and a `mandate_id` on every rail record.
2. A single `mandate_ledger` with `rail` and `asset` dimensions; `AgentBudget`
   becomes a payment-rail view.
3. Revoke fan-out to payments, trading, cards, and scheduled jobs.
4. A UI that shows one mandate with per-rail utilization, not four disconnected
   budget screens.

Until then, the rule is: **one credential, one policy ceiling; payment budgets
are per-rail ledgers, not a fake single balance.**
