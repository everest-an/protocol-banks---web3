# 技术内容 — "Trading-Only Permissions"（Hyperliquid 圈层发布用）

> 站内版本：https://protocolbanks.com/guides/trading-only-permissions（含 FAQ schema + TL;DR，SEO 已优化）
> 本文件是圈层发帖版：按 X thread + Reddit 两种格式备好，复制即发。

---

## 主题一句话

**AI 交易的安全不来自"相信平台"，而来自权限分离：AI 有交易权，你没有给过它提币权。**

---

## 版本 A：X Thread（4 条）

### 1/4
Every "AI trading bot" rug has one root cause: the bot held full custody.

There's a better architecture. On Hyperliquid, you can approve an agent with **trading-only permissions** (approveAgent, EIP-712).

It can open/close positions. It **cannot withdraw**. Structurally.

### 2/4
What approveAgent actually grants:
✅ Place/cancel orders, manage positions
❌ Withdraw or move funds — needs YOUR signature
⚡ Revoke on-chain anytime, no cooldown

The worst case of a compromised agent becomes "the budget you chose" — not "everything".

### 3/4
Four questions to ask any AI trading product:

1. Who holds the withdrawal key? (You, and only you)
2. Is trading scope revocable **on-chain**? (Not a support ticket)
3. Is your maximum loss written down before deposit?
4. Can you verify risk-free first? (Paper mode, same engine)

### 4/4
We built Protocol Bank on exactly this: non-custodial, trading-only agent, worst case printed on the screen.

Watch the agent trade real markets with fake money free, then decide:
https://protocolbanks.com

---

## 版本 B：Reddit（r/defi 或 r/Hyperliquid 技术帖）

**标题**: Trading-only permissions are the actual safety model for AI trading — sharing the architecture

**正文**:

The recurring question with AI trading agents is "how do I know it won't rug me?"
The honest answer isn't "trust us" — it's "it structurally can't."

Hyperliquid's agent system supports approveAgent: an EIP-712 signature from
your wallet that authorizes an agent address for **order placement only**.
Withdrawals still require your own signature.

What that means mechanically:
- Agent keys are trading-scoped. Worst case of key compromise = losses capped
  by your own risk config (stop-losses, position caps, circuit breakers).
- Revocation is on-chain and instant — one signature, no custodian, no cooldown.
- Your main wallet is never reachable by the agent at all.

We built a non-custodial AI trader on this (paper mode free on real market
data: protocolbanks.com). The interesting engineering bits: SIWE login,
AES-256-GCM agent key custody, per-user isolation, and a plain-language feed
of every trade + reason.

Happy to answer questions about the approval flow, key custody, or the risk
engine. What would you want to see audited first?

---

## 发布提示
- **X**：发 thread 后把站内指南页链接放最后一条（https://protocolbanks.com/guides/trading-only-permissions）
- **Reddit**：优先 r/defi（技术向宽容）；r/Hyperliquid 如果有；避免 r/CryptoCurrency（对推广敏感 + 账号 karma 门槛，见 reddit.md）
- 这篇是**技术内容**不是营销贴——语气保持"分享设计"，回复评论时只谈架构不谈"买"
- 这是给 Hyperliquid 圈层建立"我们懂安全架构"认知的帖子，转化靠后续互动，不靠直接引流
