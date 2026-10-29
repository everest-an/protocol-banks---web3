export type DocLocale = "en" | "zh"

export type DocBlock =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "code"; lang: string; code: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "note"; text: string }

export interface DocPage {
  id: string
  title: string
  description: string
  blocks: DocBlock[]
}

const STATE_CURL = [
  'curl -s https://protocolbanks.com/api/v1/agent/state \\',
  '  -H "Authorization: Bearer $PB_KEY"',
].join("\n")

const ORDER_CURL = [
  'curl -s https://protocolbanks.com/api/v1/agent/orders \\',
  '  -H "Authorization: Bearer $PB_KEY" -H "Content-Type: application/json" \\',
  '  -d \'{"coin":"BTC","side":"long","sizeUsd":20}\'',
].join("\n")

const INVOICE_CURL = [
  'curl -s https://protocolbanks.com/api/v1/agent/invoice \\',
  '  -H "Authorization: Bearer $PB_KEY" -H "Content-Type: application/json" \\',
  '  -d \'{"to":"0xabc…","amount":25,"description":"agent work"}\'',
].join("\n")

const SDK_SNIPPET = [
  'import { ProtocolBanks } from "@everestan/protocolbanks-sdk"',
  "",
  'const pb = new ProtocolBanks({ apiKey: process.env.PB_KEY! })',
  'const state = await pb.agent.state()',
  'const order = await pb.agent.order({ coin: "BTC", side: "long", sizeUsd: 20 })',
  'if (!order.ok) console.log(order.status, order.error) // 403 / 409 are returned',
].join("\n")

const PLANS_TABLE = {
  head: ["Plan", "Keys", "Per call", "Per day", "Fee"],
  rows: [
    ["Sandbox", "1", "$50", "$200", "8 bps"],
    ["Builder", "3", "$500", "$5,000", "—"],
    ["Growth", "10", "$2,500", "$50,000", "—"],
    ["Scale", "100", "$10,000", "$100,000", "—"],
  ],
}

const ERROR_TABLE = {
  head: ["Status", "Meaning", "What to do"],
  rows: [
    ["400", "Malformed body, bad address, non-positive amount", "Fix the request"],
    ["401", "Missing or invalid key", "Re-issue the key"],
    ["403", "The key's policy refuses (op, cap, allowlist)", "Surface it; do not retry unchanged"],
    ["409", "The platform guard refuses (positions, breakers, funds, market, no route)", "Surface it; back off"],
    ["429", "Rate limit (100 requests/minute per IP)", "Honour Retry-After"],
  ],
}

const EN: DocPage[] = [
  {
    id: "overview",
    title: "Agent execution, with a cap the model cannot raise",
    description:
      "One API key gives an AI agent a trading and payments account under a policy the server enforces. Five endpoints, paper to live without a code change.",
    blocks: [
      {
        kind: "p",
        text: "Protocol Banks is the execution layer for agents. You create one API key, set a policy (operations, per-call cap, daily cap, coin allowlist), and the server enforces it on every call. The model can ask for anything; it cannot talk its way past the cap.",
      },
      {
        kind: "note",
        text: "The platform is non-custodial. Trading executes through a Hyperliquid agent wallet with trading-only rights: it can place and cancel orders, never withdraw. The funded trading budget is the maximum loss.",
      },
      { kind: "h2", text: "What you can build" },
      {
        kind: "list",
        items: [
          "A money tool for your agent framework (LangChain, Vercel AI SDK, Mastra, elizaOS).",
          "A trading product where every user gets their own caps and audit trail.",
          "An agent that does work and invoices for it — with a payable link.",
          "A treasury agent that pays in USDC from its own wallet, while the platform only validates.",
        ],
      },
      { kind: "h2", text: "What the server enforces" },
      {
        kind: "table",
        head: ["Policy field", "Meaning", "New key"],
        rows: [
          ["allowedOps", "read | trade | pay | swap", '["read"]'],
          ["maxNotionalUsd", "per-call cap", "$50"],
          ["dailyCapUsd", "per UTC day, summed from metered calls", "$200"],
          ["allowedCoins", "allowlist; empty = every supported market", "[]"],
        ],
      },
      {
        kind: "p",
        text: "The policy lives on the key, is edited in Settings → API Keys, and takes effect on the next call. The agent can never widen it.",
      },
      { kind: "h2", text: "Execute vs prepare" },
      {
        kind: "table",
        head: ["Endpoint", "Executes?", "Returns"],
        rows: [
          ["GET /state", "—", "mode, equity, positions, activity, policy"],
          ["POST /orders", "yes (agent wallet)", "fill, fee, remainingTodayUsd"],
          ["POST /pay", "no", "a transfer intent to sign"],
          ["POST /swap", "no", "a quote and a transaction to sign"],
          ["POST /invoice", "no", "a pending invoice with a payment link"],
        ],
      },
      { kind: "h2", text: "Why teams use it" },
      {
        kind: "list",
        items: [
          "A hard cap against runaway loops — enforced outside the model.",
          "No withdrawal rights, so a leaked key cannot drain the wallet.",
          "Paper mode with real market data; the same code goes live unchanged.",
          "Receipts: every call logged, every fill recorded, spend visible.",
          "Plans from $0 to live, or pay 8 bps per executed order.",
        ],
      },
      { kind: "h2", text: "Start here" },
      { kind: "p", text: "Create a key, then read the account:" },
      { kind: "code", lang: "bash", code: STATE_CURL },
      { kind: "p", text: "Next: the quickstart walks through an order, an invoice and going live." },
    ],
  },
  {
    id: "quickstart",
    title: "Quickstart: from a key to a fill in five minutes",
    description: "Create a key, read the account, place an order, create an invoice, then decide about live mode.",
    blocks: [
      { kind: "h2", text: "1. Create a key" },
      {
        kind: "p",
        text: "Open Settings → API Keys. Name the key, grant read and trade, and set the caps you can live with. A new key starts read-only at $50 per call and $200 per day; raise it in the dialog.",
      },
      {
        kind: "p",
        text: "Copy the secret once. It is shown only at creation. Export it in your shell:",
      },
      { kind: "code", lang: "bash", code: "export PB_KEY=pb_…" },
      { kind: "h2", text: "2. Read the account" },
      { kind: "code", lang: "bash", code: STATE_CURL },
      {
        kind: "p",
        text: "A fresh wallet gets a paper account ($500 simulated) with real Hyperliquid market data. The response includes mode, equity, positions, activity and the key's policy with spentTodayUsd.",
      },
      { kind: "h2", text: "3. Place an order" },
      { kind: "code", lang: "bash", code: ORDER_CURL },
      {
        kind: "p",
        text: "On success the response carries the fill, the fee and remainingTodayUsd. Ask for more than the key's per-call cap and the server answers 403 before the agent is touched:",
      },
      {
        kind: "code",
        lang: "json",
        code: '{"ok":false,"error":"order of $5000.00 exceeds this key\'s per-call cap of $100"}',
      },
      { kind: "h2", text: "4. Create an invoice" },
      { kind: "code", lang: "bash", code: INVOICE_CURL },
      {
        kind: "p",
        text: "The invoice is created pending and returns a paymentLink (/pay?invoice=…&sig=…). Give the link to the payer; read settlement back with GET /api/invoice?id=…&sig=….",
      },
      { kind: "h2", text: "5. Use the SDK or one command" },
      { kind: "code", lang: "ts", code: SDK_SNIPPET },
      {
        kind: "p",
        text: "If you have repository access, PB_KEY=pb_… pnpm example:agent (add --invoice) walks the same flow. The tool manifest for agent frameworks is @everestan/protocolbanks-agent-tools.",
      },
      { kind: "h2", text: "6. Going live" },
      {
        kind: "p",
        text: "Approve an agent wallet on Hyperliquid from the cockpit's Go Live card. The same endpoints switch to live mode (mode: \"live\"); the wallet has trading-only permissions. Start with a budget you are willing to lose.",
      },
      {
        kind: "note",
        text: "Before live trading, read the Risk Disclosure. Automated trading can lose the entire trading wallet.",
      },
    ],
  },
  {
    id: "concepts",
    title: "Concepts: policy, plans, paper and live",
    description: "How the policy, plans, metering and the two modes fit together.",
    blocks: [
      { kind: "h2", text: "The policy" },
      {
        kind: "p",
        text: "A policy is attached to the key and enforced on every call. Values are clamped, not trusted: maxNotionalUsd 1–10 000, dailyCapUsd 1–100 000, unknown operations are refused, coins are upper-cased and capped at 50.",
      },
      {
        kind: "table",
        head: ["Field", "What it controls"],
        rows: [
          ["allowedOps", "which operations the key may perform"],
          ["maxNotionalUsd", "the largest single call"],
          ["dailyCapUsd", "the most metered notional per UTC day"],
          ["allowedCoins", "the markets the key may touch"],
        ],
      },
      { kind: "h2", text: "Two envelopes on a trade" },
      {
        kind: "p",
        text: "The key policy is the first envelope: a per-call or daily violation is 403 and the agent is never touched. The platform risk envelope is the second: max positions, position size, leverage, stop-loss/take-profit and daily breakers. A size above the platform cap is clamped; a breaker refusal is 409.",
      },
      { kind: "h2", text: "Plans and their ceilings" },
      {
        kind: "p",
        text: "The account's plan sets the maximum the key policy may ask for. The effective limit is the tighter of the two. Paid plans replace the 8 bps per-order fee.",
      },
      { kind: "table", head: PLANS_TABLE.head, rows: PLANS_TABLE.rows },
      { kind: "h2", text: "Paper and live" },
      {
        kind: "p",
        text: "Paper mode uses real market data and simulated fills; the ledger persists across cold starts. Live mode places real orders through the approved agent wallet. The same endpoints and the same policy apply to both — only the venue changes.",
      },
      { kind: "h2", text: "Metering" },
      {
        kind: "p",
        text: "Executed orders are recorded as agent_op events (notional, fee, mode). spentTodayUsd is summed from those events, and remainingTodayUsd is dailyCapUsd − spentTodayUsd − this order. Quotes and invoices are not metered because no money moves.",
      },
      { kind: "h2", text: "Errors tell you whose decision it was" },
      { kind: "table", head: ERROR_TABLE.head, rows: ERROR_TABLE.rows },
      { kind: "h2", text: "Keys and revocation" },
      {
        kind: "p",
        text: "Each key has permissions (read, write) and a policy. Delete a key and its secret stops working immediately; pause the agent in the cockpit to stop new entries while exits keep running. On Hyperliquid you can revoke the agent wallet itself.",
      },
    ],
  },
  {
    id: "api",
    title: "API reference",
    description: "The five endpoints, their payloads, the error classes and the machine-readable contract.",
    blocks: [
      {
        kind: "p",
        text: "Base URL: https://protocolbanks.com/api/v1/agent — auth: Authorization: Bearer pb_… Reads require the read permission; writes require write.",
      },
      {
        kind: "table",
        head: ["Endpoint", "Method", "Purpose"],
        rows: [
          ["/state", "GET", "account, positions, activity, policy"],
          ["/orders", "POST", "place one order (executes)"],
          ["/pay", "POST", "validate and prepare a transfer"],
          ["/swap", "POST", "quote and prepare a swap"],
          ["/invoice", "POST", "create a pending invoice"],
        ],
      },
      { kind: "h3", text: "GET /state" },
      {
        kind: "code",
        lang: "json",
        code: [
          "{",
          '  "ok": true, "mode": "paper",',
          '  "account": { "totalEquity": 500, "tradingWallet": 500, "maxLoss": 500 },',
          '  "positions": [], "activity": [],',
          '  "policy": { "allowedOps": ["read","trade"], "maxNotionalUsd": 50, "dailyCapUsd": 200, "allowedCoins": [], "spentTodayUsd": 0 }',
          "}",
        ].join("\n"),
      },
      { kind: "h3", text: "POST /orders" },
      { kind: "code", lang: "json", code: '{ "coin": "BTC", "side": "long", "sizeUsd": 20, "reason": "signal-v3" }' },
      {
        kind: "code",
        lang: "json",
        code: '{ "ok": true, "fill": { "coin": "BTC", "side": "long", "avgPx": 81062.5, "size": 0.000247, "notional": 20 }, "fee": 0.016, "mode": "paper", "remainingTodayUsd": 180 }',
      },
      {
        kind: "p",
        text: "One position per market. A size above the platform cap is clamped; above the key's cap it is 403. A second order on a held market is 409.",
      },
      { kind: "h3", text: "POST /pay" },
      {
        kind: "code",
        lang: "json",
        code: '{ "to": "0x…", "amountUsd": 25, "token": "USDC", "chain": "base", "memo": "invoice 41" }',
      },
      {
        kind: "p",
        text: "Returns an intent (kind, to, token, chain, amountUsd, remainingTodayUsd). The agent signs and submits it from its own wallet; the platform never holds funds.",
      },
      { kind: "h3", text: "POST /swap" },
      {
        kind: "code",
        lang: "json",
        code: '{ "from": {"symbol":"USDC","blockchain":"base"}, "to": {"symbol":"ETH","blockchain":"base"}, "amount": "25", "amountUsd": 25 }',
      },
      { kind: "p", text: "Returns the route and the transaction to sign. 409 when no route exists. Quotes are not metered." },
      { kind: "h3", text: "POST /invoice" },
      {
        kind: "code",
        lang: "json",
        code: '{ "to": "0x…", "amount": 25, "token": "USDC", "description": "agent work", "expiresInHours": 24 }',
      },
      {
        kind: "p",
        text: "Returns the pending invoice with paymentLink and signed. Read settlement back with GET /api/invoice?id=…&sig=… (the signature is in the link).",
      },
      { kind: "h2", text: "Errors" },
      { kind: "table", head: ERROR_TABLE.head, rows: ERROR_TABLE.rows },
      { kind: "h2", text: "Rate limits" },
      {
        kind: "p",
        text: "The platform enforces 100 requests per minute per IP. Per-key rate-limit fields are stored but not enforced yet; budget for the global limit.",
      },
      { kind: "h2", text: "The contract" },
      {
        kind: "p",
        text: "OpenAPI 3.1 is served at /api/agent.openapi.json (CORS-open) and validated offline by scripts/verify-openapi.mjs. Use it for codegen, or read the four worked cases in the docs hub.",
      },
    ],
  },
  {
    id: "security",
    title: "Security model",
    description: "What the platform can and cannot do, how keys and limits are enforced, and where the risk actually lives.",
    blocks: [
      { kind: "h2", text: "Non-custodial by construction" },
      {
        kind: "p",
        text: "The platform holds no funds. Trading happens on your Hyperliquid account through an agent wallet you approve; pay and swap return something you sign from your own wallet. We never have the ability to move your money elsewhere.",
      },
      { kind: "h2", text: "Trading-only rights" },
      {
        kind: "p",
        text: "The agent wallet is approved with place/cancel order permissions. It cannot withdraw. Revoke it on Hyperliquid at any time; the local key material can be deleted from the cockpit.",
      },
      { kind: "h2", text: "The cap is server-side" },
      {
        kind: "p",
        text: "Caps live in the key record and are checked before an order reaches the venue. A prompt injection, a bug or a loop cannot raise them; only the key owner can edit the policy in Settings.",
      },
      { kind: "h2", text: "Keys" },
      {
        kind: "list",
        items: [
          "Secrets are stored hashed; the plaintext is shown once at creation.",
          "Every call is logged to the key's usage log.",
          "Delete a key to revoke it immediately.",
          "Keys carry a policy; create one key per product or customer.",
        ],
      },
      { kind: "h2", text: "Limits and honest failure" },
      {
        kind: "list",
        items: [
          "An order that reaches the venue without a confirmed response is reported as 409, recorded, and reconciled by client-order-id. It is never retried automatically.",
          "The daily cap is metered from executed orders; a database write failure can undercount, so the per-call cap remains the hard stop.",
          "Paper ledgers are isolated per wallet and can never overwrite a live ledger.",
        ],
      },
      { kind: "h2", text: "What we do not do" },
      {
        kind: "list",
        items: [
          "We do not hold, pool or lend customer funds.",
          "We do not provide investment advice or guarantee returns.",
          "We do not run KYC on end users of your product; that stays with you where required.",
        ],
      },
      {
        kind: "note",
        text: "Automated trading can lose the entire trading wallet. Read the Risk Disclosure before funding a live account.",
      },
    ],
  },
]

const ZH: DocPage[] = [
  {
    id: "overview",
    title: "给 Agent 的执行层，上限由服务端锁定",
    description:
      "一个 API Key，让 AI Agent 拥有交易与支付账户，策略由服务端强制执行。五个端点，纸面到实盘不用改代码。",
    blocks: [
      {
        kind: "p",
        text: "Protocol Banks 是面向 Agent 的执行层。你创建一个 API Key，设置策略（可用操作、单笔上限、每日上限、币种白名单），之后每次调用都由服务端校验。模型可以提出任何请求，但无法用提示词绕过上限。",
      },
      {
        kind: "note",
        text: "平台不托管资金。交易通过你授权的 Hyperliquid agent 钱包执行，该钱包只有下单/撤单权限，永远无法提现。交易钱包余额就是最大可能亏损。",
      },
      { kind: "h2", text: "你可以构建什么" },
      {
        kind: "list",
        items: [
          "给 Agent 框架（LangChain、Vercel AI SDK、Mastra、elizaOS）增加一个“花钱工具”。",
          "给每个用户独立上限与审计记录的交易产品。",
          "完成工作后自动开发票、带可支付链接的 Agent。",
          "从自己的钱包用 USDC 付款的金库 Agent，平台只负责校验。",
        ],
      },
      { kind: "h2", text: "服务端强制执行什么" },
      {
        kind: "table",
        head: ["策略字段", "含义", "新 Key 默认"],
        rows: [
          ["allowedOps", "read | trade | pay | swap", '["read"]'],
          ["maxNotionalUsd", "单笔上限", "$50"],
          ["dailyCapUsd", "每 UTC 日累计上限", "$200"],
          ["allowedCoins", "币种白名单；空 = 全部市场", "[]"],
        ],
      },
      {
        kind: "p",
        text: "策略保存在 Key 上，在设置 → API Keys 中修改，下一次调用即生效。Agent 无法自行放宽。",
      },
      { kind: "h2", text: "执行与准备" },
      {
        kind: "table",
        head: ["端点", "是否执行", "返回"],
        rows: [
          ["GET /state", "—", "模式、净值、持仓、活动、策略"],
          ["POST /orders", "是（agent 钱包）", "成交、费用、remainingTodayUsd"],
          ["POST /pay", "否", "待签名的转账意图"],
          ["POST /swap", "否", "报价与待签名交易"],
          ["POST /invoice", "否", "待支付发票 + 支付链接"],
        ],
      },
      { kind: "h2", text: "团队为什么用" },
      {
        kind: "list",
        items: [
          "对失控循环的硬上限——在模型之外强制执行。",
          "没有提现权限，Key 泄露也搬不走资金。",
          "纸面模式使用真实行情，代码不改即可转实盘。",
          "回执：每次调用有日志，每笔成交有记录，额度随时可见。",
          "从 $0 到实盘的计划，或按成交名义额 8 bps 付费。",
        ],
      },
      { kind: "h2", text: "从这里开始" },
      { kind: "p", text: "创建一个 Key，然后读取账户：" },
      { kind: "code", lang: "bash", code: STATE_CURL },
      { kind: "p", text: "下一步：快速开始会带你走完下单、发票与上线。" },
    ],
  },
  {
    id: "quickstart",
    title: "快速开始：五分钟从 Key 到成交",
    description: "创建 Key、读取账户、下单、开发票，再决定是否上线实盘。",
    blocks: [
      { kind: "h2", text: "1. 创建 Key" },
      {
        kind: "p",
        text: "打开 设置 → API Keys，命名 Key，勾选 read 与 trade，设置你能接受的上限。新 Key 默认只读、单笔 $50、每日 $200；弹窗里可以调高。",
      },
      { kind: "p", text: "密钥只显示一次，复制后导出到环境变量：" },
      { kind: "code", lang: "bash", code: "export PB_KEY=pb_…" },
      { kind: "h2", text: "2. 读取账户" },
      { kind: "code", lang: "bash", code: STATE_CURL },
      {
        kind: "p",
        text: "新钱包会得到一个纸面账户（模拟 $500）与真实 Hyperliquid 行情。返回包含模式、净值、持仓、活动，以及策略与 spentTodayUsd。",
      },
      { kind: "h2", text: "3. 下单" },
      { kind: "code", lang: "bash", code: ORDER_CURL },
      {
        kind: "p",
        text: "成功时返回成交、费用与 remainingTodayUsd。超过 Key 单笔上限时，服务端在触达 Agent 之前就返回 403：",
      },
      {
        kind: "code",
        lang: "json",
        code: '{"ok":false,"error":"order of $5000.00 exceeds this key\'s per-call cap of $100"}',
      },
      { kind: "h2", text: "4. 创建发票" },
      { kind: "code", lang: "bash", code: INVOICE_CURL },
      {
        kind: "p",
        text: "发票以 pending 创建，并返回 paymentLink（/pay?invoice=…&sig=…）。把链接交给付款方；用 GET /api/invoice?id=…&sig=… 回读结算状态。",
      },
      { kind: "h2", text: "5. 用 SDK 或一条命令" },
      { kind: "code", lang: "ts", code: SDK_SNIPPET },
      {
        kind: "p",
        text: "如果你有仓库访问权限，PB_KEY=pb_… pnpm example:agent（加 --invoice）可以一条命令走完流程。框架工具清单在 @everestan/protocolbanks-agent-tools。",
      },
      { kind: "h2", text: "6. 转为实盘" },
      {
        kind: "p",
        text: "在驾驶舱的 Go Live 卡片中授权 agent 钱包。同样的端点切换为实盘（mode: \"live\"），钱包只有交易权限。请从小额、可承受全损的预算开始。",
      },
      { kind: "note", text: "实盘前请阅读风险披露。自动交易可能损失交易钱包的全部资金。" },
    ],
  },
  {
    id: "concepts",
    title: "概念：策略、计划、纸面与实盘",
    description: "策略、计划、计量和两种模式如何配合。",
    blocks: [
      { kind: "h2", text: "策略" },
      {
        kind: "p",
        text: "策略绑定在 Key 上，每次调用都校验。数值会被夹紧而非信任：maxNotionalUsd 1–10 000、dailyCapUsd 1–100 000，未知操作拒绝，币种大写去重并最多 50 个。",
      },
      {
        kind: "table",
        head: ["字段", "控制什么"],
        rows: [
          ["allowedOps", "该 Key 可执行的操作"],
          ["maxNotionalUsd", "单次调用上限"],
          ["dailyCapUsd", "每 UTC 日的累计名义额上限"],
          ["allowedCoins", "可触达的市场"],
        ],
      },
      { kind: "h2", text: "交易的两层限制" },
      {
        kind: "p",
        text: "第一层是 Key 策略：超过单笔或每日上限返回 403，Agent 完全不会被触达。第二层是平台风险包络：最大持仓数、单仓大小、杠杆、止盈止损与日内熔断。超过平台仓位上限会被压缩；熔断拒绝返回 409。",
      },
      { kind: "h2", text: "计划与上限" },
      {
        kind: "p",
        text: "账户的计划决定 Key 策略能申请的天花板；实际生效值取两者更小者。付费计划免收 8 bps 成交费。",
      },
      { kind: "table", head: PLANS_TABLE.head, rows: PLANS_TABLE.rows },
      { kind: "h2", text: "纸面与实盘" },
      {
        kind: "p",
        text: "纸面模式使用真实行情与模拟成交，账本可跨冷启动持久化。实盘模式通过已授权的 agent 钱包下真实订单。端点与策略完全相同，只是交易场所不同。",
      },
      { kind: "h2", text: "计量" },
      {
        kind: "p",
        text: "已执行的订单写入 agent_op 事件（名义额、费用、模式）。spentTodayUsd 由这些事件累加，remainingTodayUsd = dailyCapUsd − spentTodayUsd − 本次订单。报价与发票不计量，因为没有资金移动。",
      },
      { kind: "h2", text: "错误告诉你问题来自哪一层" },
      { kind: "table", head: ERROR_TABLE.head, rows: ERROR_TABLE.rows },
      { kind: "h2", text: "Key 与撤销" },
      {
        kind: "p",
        text: "每个 Key 有权限（read、write）与策略。删除 Key 后密钥立即失效；在驾驶舱暂停 Agent 会停止新开仓，退出逻辑继续运行；在 Hyperliquid 上可以直接撤销 agent 钱包。",
      },
    ],
  },
  {
    id: "api",
    title: "API 参考",
    description: "五个端点、请求与响应、错误分类，以及机器可读契约。",
    blocks: [
      {
        kind: "p",
        text: "Base URL：https://protocolbanks.com/api/v1/agent —— 认证：Authorization: Bearer pb_…。读操作需要 read 权限，写操作需要 write。",
      },
      {
        kind: "table",
        head: ["端点", "方法", "用途"],
        rows: [
          ["/state", "GET", "账户、持仓、活动、策略"],
          ["/orders", "POST", "下单一笔（会执行）"],
          ["/pay", "POST", "校验并准备转账"],
          ["/swap", "POST", "报价并准备兑换"],
          ["/invoice", "POST", "创建待支付发票"],
        ],
      },
      { kind: "h3", text: "GET /state" },
      {
        kind: "code",
        lang: "json",
        code: [
          "{",
          '  "ok": true, "mode": "paper",',
          '  "account": { "totalEquity": 500, "tradingWallet": 500, "maxLoss": 500 },',
          '  "positions": [], "activity": [],',
          '  "policy": { "allowedOps": ["read","trade"], "maxNotionalUsd": 50, "dailyCapUsd": 200, "allowedCoins": [], "spentTodayUsd": 0 }',
          "}",
        ].join("\n"),
      },
      { kind: "h3", text: "POST /orders" },
      { kind: "code", lang: "json", code: '{ "coin": "BTC", "side": "long", "sizeUsd": 20, "reason": "signal-v3" }' },
      {
        kind: "code",
        lang: "json",
        code: '{ "ok": true, "fill": { "coin": "BTC", "side": "long", "avgPx": 81062.5, "size": 0.000247, "notional": 20 }, "fee": 0.016, "mode": "paper", "remainingTodayUsd": 180 }',
      },
      {
        kind: "p",
        text: "每个市场只能有一个持仓。超过平台仓位上限会被压缩；超过 Key 上限返回 403；同一市场重复下单返回 409。",
      },
      { kind: "h3", text: "POST /pay" },
      {
        kind: "code",
        lang: "json",
        code: '{ "to": "0x…", "amountUsd": 25, "token": "USDC", "chain": "base", "memo": "invoice 41" }',
      },
      {
        kind: "p",
        text: "返回转账意图（kind、to、token、chain、amountUsd、remainingTodayUsd）。由 Agent 在自己的钱包里签名提交，平台不持有资金。",
      },
      { kind: "h3", text: "POST /swap" },
      {
        kind: "code",
        lang: "json",
        code: '{ "from": {"symbol":"USDC","blockchain":"base"}, "to": {"symbol":"ETH","blockchain":"base"}, "amount": "25", "amountUsd": 25 }',
      },
      { kind: "p", text: "返回路由与待签名交易；无路由时 409。报价不计量。" },
      { kind: "h3", text: "POST /invoice" },
      {
        kind: "code",
        lang: "json",
        code: '{ "to": "0x…", "amount": 25, "token": "USDC", "description": "agent work", "expiresInHours": 24 }',
      },
      {
        kind: "p",
        text: "返回待支付发票、paymentLink 与 signed。用 GET /api/invoice?id=…&sig=… 回读结算（签名在链接里）。",
      },
      { kind: "h2", text: "错误" },
      { kind: "table", head: ERROR_TABLE.head, rows: ERROR_TABLE.rows },
      { kind: "h2", text: "速率限制" },
      {
        kind: "p",
        text: "平台按 IP 限制 100 请求/分钟。Key 上的速率字段已存储但尚未强制执行，请按全局限制规划。",
      },
      { kind: "h2", text: "契约" },
      {
        kind: "p",
        text: "OpenAPI 3.1 契约在 /api/agent.openapi.json（开放 CORS），可用 scripts/verify-openapi.mjs 离线校验，也可用于代码生成。",
      },
    ],
  },
  {
    id: "security",
    title: "安全模型",
    description: "平台能做什么、不能做什么，Key 与上限如何执行，风险究竟在哪里。",
    blocks: [
      { kind: "h2", text: "结构上非托管" },
      {
        kind: "p",
        text: "平台不持有资金。交易发生在你自己的 Hyperliquid 账户上，通过你授权的 agent 钱包执行；pay 与 swap 返回你在自己钱包里签名的内容。我们没有任何能力把资金转走。",
      },
      { kind: "h2", text: "仅交易权限" },
      {
        kind: "p",
        text: "agent 钱包只获授权下单/撤单，无法提现。你随时可以在 Hyperliquid 撤销；驾驶舱也可以删除本地密钥材料。",
      },
      { kind: "h2", text: "上限在服务端" },
      {
        kind: "p",
        text: "上限保存在 Key 记录中，在订单到达交易场所之前校验。提示注入、Bug 或循环都无法放宽；只有 Key 的所有者能在设置里修改策略。",
      },
      { kind: "h2", text: "密钥" },
      {
        kind: "list",
        items: [
          "密钥以哈希存储，明文只在创建时显示一次。",
          "每次调用写入 Key 的使用日志。",
          "删除 Key 立即撤销。",
          "每个产品/客户使用独立 Key，并各自携带策略。",
        ],
      },
      { kind: "h2", text: "限制与诚实失败" },
      {
        kind: "list",
        items: [
          "订单到达交易场所但没有确认响应时返回 409，记录并按 client-order-id 对账，绝不自动重试。",
          "每日上限由已执行订单计量；数据库写入失败可能少计，因此单笔上限始终是硬止损。",
          "纸面账本按钱包隔离，永远不会覆盖实盘账本。",
        ],
      },
      { kind: "h2", text: "我们不做什么" },
      {
        kind: "list",
        items: [
          "不持有、归集或出借客户资金。",
          "不提供投资建议，不保证收益。",
          "不对你产品的终端用户做 KYC；需要时由你负责。",
        ],
      },
      {
        kind: "note",
        text: "自动交易可能损失整个交易钱包。实盘入金前请阅读风险披露。",
      },
    ],
  },
]

export const DOC_PAGES: Record<DocLocale, DocPage[]> = { en: EN, zh: ZH }

export function getDocPage(locale: DocLocale, id: string): DocPage | undefined {
  return DOC_PAGES[locale].find((page) => page.id === id)
}

export function docHref(locale: DocLocale, id: string): string {
  const base = locale === "en" ? "/docs" : "/zh/docs"
  return id === "overview" ? base : `${base}/${id}`
}

export function otherLocale(locale: DocLocale): DocLocale {
  return locale === "en" ? "zh" : "en"
}
