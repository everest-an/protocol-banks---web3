# X Daily Content Agent (draft-only, compliant)

每天自动：**抓行业新闻 → 用 LLM 起草 ① 可评论的点（带原帖链接）② 原创推文草稿 ③ 话题标签** → 输出一份 digest。

```
node x-agent.mjs        # 产出 out/digest-YYYY-MM-DD.md（并可推送到 Telegram）
```

## x-engage — 社区参与驾驶舱（只读 + 起草，合规）

```
node x-engage.mjs --resolve               # 名单用户名 -> 数字 id + 粉丝数（缓存，$0.010/账号）
node x-engage.mjs --make-list             # 用 config.x.track_accounts 建一个 X List（$0.010 + $0.005/成员）
node x-engage.mjs [--max 6] [--budget 1]  # 扫描 + 起草回复队列 -> out/engage-YYYY-MM-DD.md + TG
```

**为什么只能"只读 + 起草"**：2026-04 起 X 从技术上封死了这条路。官方文档原文：

| 想法 | 现状 |
|---|---|
| 回复陌生人推文 | ❌ "Replies are only permitted if the original post's author has **explicitly summoned** the replying account by @mentioning them or quoting one of their posts." |
| 引用转发 | ❌ "requires an **Enterprise plan**. It is **not available on self-serve (pay-per-use) tiers**." |
| 自动点赞 | ❌ "Likes must be **directly initiated by the authenticated user**." |
| 自动关注 | ❌ "No bulk, aggressive, or automated following." |
| 浏览器脚本绕过 | ☠️ "Non-API automation (scraping, **browser automation**) results in **permanent suspension**." |
| AI 生成回复 | ⚠️ "Requires **prior approval from X**." |
| **转发 repost** | ✅ "OK for informational purposes, no bulk spam." |
| **原创帖** | ✅ "No unsolicited @mentions." |

所以本工具做**判断力那半**（找对帖子、写出真正加分的回复），**点发送留给人**。

**成本**（docs.x.com/x-api/getting-started/pricing）：读自己 mentions **$0.001/条**（Owned Read）；读 List 时间线 $0.005/条（当天去重）；起草 0 元（本地 LLM）。发出时：原创 $0.015、回复 $0.010、**带链接 $0.20（13 倍 —— 所以回复里禁止放链接）**。

**回复质量守则**（脚本强制校验，不合格打回重写，3 次仍不合格就 skip）：必须"加东西"——新数据点 / 具体经历 / 礼貌反驳 / 尖锐问题；禁止 URL、话题标签、产品推销、"Great post!" 空话、AI 腔。**宁可本轮 0 条，也不发凑数的。**

## ⚠️ 为什么是"草稿"而不是"全自动发帖"

X 的规则**明确禁止**：自动化发帖/自动回复/模拟浏览（"platform manipulation / automated engagement"）
→ **会封号**。所以本工具的边界是：

| 能做 | 不做 |
|---|---|
| 抓新闻、生成**草稿** | ❌ 自动发推 |
| 给你**可评论的点**（你人工发） | ❌ 自动评论/点赞/关注 |
| 通过 **X 官方 API 发原创推文**（如你开通） | ❌ 模拟人的浏览行为 |
| 把 digest 发到 TG/邮件提醒你 | ❌ 自动登录脚本 |

## 环境

```
LLM_API_KEY=<OpenRouter key 或任意 OpenAI 兼容 key>
LLM_BASE_URL=https://openrouter.ai/api/v1/chat/completions
LLM_MODEL=deepseek/deepseek-v4-flash
# 可选：把 digest 推送到 Telegram
TG_TOKEN=...        # 你的 Telegram bot
TG_CHAT_ID=<your chat id>
```

**自动登录？不需要**——用你本机 Chrome 的 profile，X 登录 cookie 会保持。但**自动化操作仍违规**，别做。

## x-poster — GitHub 动态 → 发帖（服务器定时，推荐）

```
node x-poster.mjs [--dry-run]
```

- 读你 **GitHub 近 7 天**的真实动态（commit message / release / 新建仓库 / 合并 PR）
- LLM 据此生成 **1 条有效原创推文**（不编造，只基于真实动态）
- **设了 X API key → 自动发**（官方 API 发原创，合规）
- **没设 key → 把草稿发到 Telegram**（你人工发）

### 服务器上每天跑（systemd timer / cron）

```bash
# Linux cron：每天 09:00
0 9 * * *  cd /opt/protocol-bank/docs/growth/x-agent && node --env-file=.env x-poster.mjs
```
```ini
# 或 systemd timer（略，见 ../../tg-discord-bridge/DEPLOY.md 的写法）
```

环境变量：`LLM_*`（必需）+ `X_CONSUMER_KEY/SECRET`、`X_ACCESS_TOKEN/SECRET`（自动发）或 `TG_TOKEN/TG_CHAT_ID`（发草稿）。

> ⚠️ 只发**自己项目的原创内容**。**不做**自动评论/自动关注/模拟浏览——那些会被封号。

## 数据源（config.json）

- **Hacker News** 热榜（公开 API）
- **GitHub** 热门仓库（用 `gh` CLI，按 star 搜索 agent memory / mcp server）
- **arXiv** 最新 cs.AI/CL/SE 论文

改 `config.json` 里的 `topics` / `queries` 即可调整选题方向。

## 每天跑（cron / 计划任务）

```bash
# Linux: 每天 09:00
0 9 * * *  cd /path/to/x-agent && node --env-file=.env x-agent.mjs
```
Windows：任务计划程序 → 每天 → `node --env-file=.env x-agent.mjs`。

## 工作流（推荐）

1. 早上收到 digest（TG/邮件）；
2. 花 10 分钟：**挑 1-2 条评论** 发出去（带真实观点，别带广告）；
3. **选 1 条原创草稿**，按你的语气润色后发；
4. 想真·自动发原创 → 开通 X API 后用 `../distribute/post.mjs` 的 X 适配器。
