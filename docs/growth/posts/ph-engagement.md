# Product Hunt — 发布当天评论应对手册

> 📅 **发布状态：已上线（2026-08-28）**
> 评论区内置 Maker 评论已自动发布。
> **前 2 小时活跃度决定排名**——发布后立刻开始互动，每条评论都回。

---

## 一、通用互动节奏（发布当天）

| 时间（约） | 动作 |
|---|---|
| 发布后立即 | 回复自己的 Maker 评论，加一条产品亮点补充（见下） |
| 0-2 小时 | **每 10 分钟刷新**，回复每条新评论 |
| 2-24 小时 | 每小时回一次，保持活跃 |
| 次日 | 回复留言 + 如需可追加一条"感谢"评论 |

## 二、Maker 评论下的自回复（发布后立即贴）

Thanks for checking it out! A few things I'm most proud of that make
this different from the usual "AI trading bot":

- **The AI physically cannot withdraw.** Its agent wallet only has
  trade permissions on Hyperliquid, approved via EIP-712. Worst case
  is the budget you set, and that's written on the screen.
- **Every trade is explained in plain language** — "Opened BTC long
  (momentum z=1.6, funding -0.001%/h)", not a black box.
- **Paper mode is free on real market data.** You can watch the agent
  trade Hyperliquid perps with simulated money before risking anything.

Happy to answer anything about the strategy, the risk engine, or the
key-custody architecture. Ask away!

---

## 三、常见评论 × 回复话术

### 1. "How is this different from other AI bots?"
> The bots I've seen either (a) hold your funds directly, or (b) have no
> real protection. Here the agent has a **trading-only** wallet — it can
> enter/exit positions but literally has no withdrawal permission. Your
> max loss = the budget you approved, shown on screen. And every trade
> is explained in plain language, so you're not trusting a black box.

### 2. "Is this a scam / how do I know you won't run away with funds?"
> Fair question, and it's the whole design point. The agent keys are
> trading-only on Hyperliquid — no withdraw capability, ever. The
> restoration keys are encrypted with your PIN (AES-256-GCM) and never
> leave the platform unencrypted. You can also revoke the agent
> on-chain at any time. Paper mode is free, so you can watch it trade
> real markets with fake money before you risk a single cent.

### 3. "What are the fees?"
> Paper mode is completely free. Live mode only charges a small fee on
> profits — no upfront cost, no subscription. You can try everything
> risk-free first. (If there's a promo/Discord offer, mention it here.)

### 4. "What if the AI goes on a losing streak?"
> That's what the risk engine is for. Each trade has a ±2.5%
> stop-loss, max 3 positions at once, and there's a daily circuit
> breaker: at 5% daily loss it stops trading, at 8% it closes all
> positions. The absolute worst case is the trading wallet balance.
> You can also pause or emergency-stop with one click, anytime.

### 5. "Which chains/markets do you support?"
> Live mode is on Hyperliquid perps — the 12 most liquid markets
> (BTC, ETH, SOL, etc.), using momentum + funding-carry signals. We
> integrate with MetaMask (any EVM wallet). Multi-chain support is on
> the roadmap.

### 6. "Why did you build this?"
> I got burned by trading bots that promised the moon and rugged. So I
> built one with the opposite philosophy: non-custodial, transparent,
> boring math instead of magic. Took a while, but I'd rather it be
> safe than flashy.

### 7. Negative / skeptical comment (e.g. "AI trading is a scam")
> Totally fair to be skeptical — the space is full of it. That's why
> paper mode is free on real market data: you don't have to trust me,
> just watch what the agent does with simulated money. If the strategy
> doesn't hold up, you've lost nothing. And it's non-custodial, so even
> live, your funds stay in your own account.

### 8. "How do I start?" (follow-up after you reply)
> 1. Go to protocolbanks.com
> 2. Click "Try Paper Trading" (free, real market data, fake money)
> 3. Watch the agent work for a few days
> 4. When you're ready, connect MetaMask, set a budget, approve the
>    trading-only agent, and go live.

---

## 四、通用回复原则

- **每条都回**——PH 把"maker 是否回复"当作互动信号，不回会掉排名
- **回复要快**：前 2 小时每 10 分钟看一次
- **语气**：诚实、技术向、不吹牛。承认局限反而加分
- **别硬推销**：先答问题，再给一个简单的 CTA（如 paper mode）
- 遇到攻击性评论：礼貌回应、简短，不要争论。正面例子就是最好的反驳

## 五、如果上了 PH "Featured" / 爆火
- 尽快在 X 发一条感谢帖（蹭热度）
- 评论区置顶一条 FAQ 类评论
- 准备好 Discord 承接涌入的用户（邀请链接在官网页脚）
