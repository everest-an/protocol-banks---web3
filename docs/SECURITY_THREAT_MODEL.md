# Security Threat Model

> Scope: the AI trading product (paper + live), the agent wallet flow, and the
> MCP server. Written in the "state the limits openly" style — a security doc
> that only lists strengths is marketing, not security.
> Last updated: September 2026.

## 1. Assets and trust boundaries

| Asset | Where it lives | Who can touch it |
|---|---|---|
| User's main wallet funds | User's own wallet (never custodied) | Only the user |
| Trading budget | User's Hyperliquid account | User + the approved agent (trade-only) |
| Agent private key | AES-256-GCM encrypted at rest (DB/TradingAccount) | The server process holding `TRADING_KEY_SECRET` |
| SIWE session JWT | Client (Authorization header) | The user's browser |
| `TRADING_KEY_SECRET` | Server env (Vercel) | Anyone with server env access |
| MCP access | Local stdio process | Whoever runs it on their machine |

**Core structural property:** the agent holds **trading-only** permissions on
Hyperliquid (`approveAgent`). Withdrawal rights never leave the user's wallet,
so a fully compromised agent key cannot drain the account — it can only trade
within the account.

## 2. What the design defends against

- **Agent key theft / prompt injection.** Worst case is a malicious trading
  spree inside the user's Hyperliquid account, bounded by risk limits. Funds
  cannot be moved out. The user can revoke the agent on-chain at any time.
- **Custodial rug.** There is no custodian: funds live in the user's own
  Hyperliquid account, not a platform wallet.
- **Server compromise (partial).** The DB stores only the encrypted agent key.
- **Replay / impersonation of API calls.** SIWE + JWT; the legacy
  `x-wallet-address` header is not trusted.
- **Duplicate live orders after uncertain responses.** See §3.1.

## 3. Known limitations (read these)

### 3.1 Uncertain orders halt, never retry
If an order request times out, is reset, or returns an unparseable body, we
cannot know whether it reached the matching engine. The engine therefore:
stops the agent, leaves the position book untouched (never fabricates a
position), logs an error, and asks the owner to verify on Hyperliquid.

Consequence: a genuinely failed order is **not** retried automatically.
Consequence: if the order *did* fill, the local ledger will not know until the
user checks. We chose "halt + human verify" over "retry" because a duplicate
position costs real money.

### 3.2 Local ledger vs on-chain positions can drift
The agent keeps its own book (positions, cash, PnL) rather than reading the
exchange's portfolio every tick. Mark-to-market uses live prices, but:
- Manual trades the user makes in the Hyperliquid UI are invisible to the agent.
- An uncertain fill (3.1) or a partial fill outside our assumptions can leave
  the book out of sync.
Mitigation today: manual approval mode for entries, conservative halt on
uncertainty, and `GET /api/trading/live/state` which reads the *real*
Hyperliquid account for the cockpit. A reconciliation pass (ledger vs on-chain
portfolio) is a known gap.

### 3.3 Key custody depends on `TRADING_KEY_SECRET`
Agent keys are encrypted with AES-256-GCM using a server-side secret. If an
attacker obtains **both** the database and the secret, they obtain agent keys.
What that buys them: trading rights inside users' Hyperliquid accounts — not
withdrawals. Rotating the secret requires re-approval of agents (agents remain
valid on-chain; only our local encrypted copies become unreadable).

### 3.4 The agent can lose money by trading badly
Trading-only permissions mean "cannot withdraw", **not** "cannot lose". The
worst case is the trading budget. Stop-losses, position caps and daily
circuit breakers bound the damage, but they are software rules — a bug or an
extreme market (gap, exchange outage, liquidation cascade) can exceed them.
The on-chain guarantee is only: no withdrawals.

### 3.5 Server-side risk engine is not audited
The risk engine, signing path and live executor are unit-tested (test signing
against Hyperliquid's own msgpack fixtures, response-translation tests, etc.)
but have not had an external audit. Treat live mode as beta.

### 3.6 MCP server scope
The MCP server never holds key material and control actions mutate agent state
only. It reads `MCP_AUTH_TOKEN` from the environment; anyone with access to the
machine's env can act as that user. Guest mode (no token) is read-only against
the public demo account + public track record.

### 3.7 Paper demo history is simulated
The 30-day curve seeded into fresh paper accounts is generated locally and is
labelled as such in the activity feed. It is never mixed into live ledgers,
and promoting an account to live drops it (clean live book).

## 4. Reporting

Security issues: **e@awareness.market**. We aim to acknowledge within 72 hours.
Please include reproduction steps; do not test against other users' accounts.
