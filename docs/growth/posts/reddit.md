# Reddit — 复制即发

三版帖子，按社区调性选。**注意**：crypto 版块对推广敏感，语气要像分享
作品而不是打广告。最好用个人老账号发。

---

## 版本 A：r/CryptoCurrency（透明坦诚路线）

**标题**: I built a non-custodial AI trading agent — the AI can trade but can never withdraw. Paper mode is free.

**正文**:

Long-time lurker here. I've been burned by trading bots that promised the
moon and rugged. So I built one with the opposite philosophy:

- The AI holds a trading-only agent wallet on Hyperliquid. It physically
  cannot withdraw funds.
- Your trading budget = your maximum loss, shown on screen at all times.
- Every trade is logged in plain language with the reason ("Opened BTC
  long (momentum z=1.6, funding -0.001%/h)").
- Stop-losses ±2.5% and daily circuit breakers are enforced before orders.

Paper mode uses real market data with simulated money — free to try:
protocolbanks.com

The architecture: SIWE login, EIP-712 approveAgent, AES-256-GCM key
custody, per-user isolation. AMA about the technical side.

---

## 版本 B：r/defi（架构路线）

**标题**: Non-custodial AI trading on Hyperliquid: trading-only agent wallets, no withdrawal rights

**正文**:

Sharing an open-source project (GPL) that uses Hyperliquid's agent-wallet
system for non-custodial AI trading:

- approveAgent grants trading-only permissions — no withdrawals, revocable
- Momentum + funding-carry signals on the top perps
- Per-user paper accounts, full risk engine (TP/SL, daily circuit breakers)
- Paper mode free on real market data

Repo: github.com/everest-an/protocol-banks---web3
Live: protocolbanks.com

Feedback on the agent architecture welcome — especially the key-custody
and approval flow.

---

## 版本 C：r/ethereum（钱包/签名路线）

**标题**: Used SIWE + EIP-712 to give an AI "trade-only" permissions — sharing the design

**正文**:

The interesting piece: how to let an AI trade your funds WITHOUT giving it
withdrawal power.

Hyperliquid's agent wallets support trade-only permissions. The flow:
1. User connects MetaMask (SIWE, EIP-4361)
2. Platform generates a per-user agent key (AES-256-GCM at rest)
3. User signs an approveAgent typed message (EIP-712) in MetaMask
4. The agent signs L1 actions (phantom-agent scheme) acting on the user's
   vault — no withdraw capability
5. Revocable on-chain at any time

Live demo (paper mode, real markets): protocolbanks.com
Source: github.com/everest-an/protocol-banks---web3

---

**发帖提示**
- 用你本人的老账号发，新号会被版主删
- 每版只发一个相关版块，别同一天跨版发（会像 spam）
- 回复所有评论，提问越多帖子越热
