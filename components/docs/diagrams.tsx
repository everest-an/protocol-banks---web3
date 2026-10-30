import type { DocLocale } from "@/lib/docs/content"

type DiagramName = "architecture" | "order-flow" | "security"

const LABELS: Record<DocLocale, Record<string, string>> = {
  en: {
    architecture: "How a call flows",
    architectureCaption:
      "The key's policy is checked before the risk envelope, and both are checked before an order reaches the venue. Pay, swap and invoice never move money on the platform.",
    agent: "Your agent",
    agentSub: "LangChain · AI SDK · MCP",
    api: "Agent API",
    apiSub: "one key · five endpoints",
    apiState: "/state  /orders  /pay  /swap  /invoice",
    policy: "Key policy",
    policySub: "ops · caps · coins",
    risk: "Risk envelope",
    riskSub: "positions · breakers",
    venue: "Hyperliquid",
    venueSub: "paper · live",
    wallet: "agent wallet",
    walletSub: "trading-only",
    receipt: "Receipts",
    receiptSub: "usage log · fills",
    unsigned: "pay: signed auth · swap: unsigned",
    refused: "403 before the venue",
    orderFlow: "What happens to an order",
    orderFlowCaption:
      "Each gate answers with its own status. A refusal is final for the request; the model cannot retry its way past the policy.",
    request: "Request",
    auth: "Auth",
    authSub: "key → owner",
    policyGate: "Policy",
    policyGateSub: "op · cap · coin",
    riskGate: "Risk",
    riskGateSub: "positions · funds",
    fill: "Fill",
    fillSub: "paper or live",
    receiptStep: "Receipt",
    receiptStepSub: "usage · fill",
    security: "Trust boundaries",
    securityCaption:
      "The only path from your keys to the venue is the approval you sign. The platform holds no keys and no funds; the agent wallet can trade, never withdraw.",
    yourWallet: "Your wallet",
    yourWalletSub: "keys never leave",
    approve: "approveAgent (EIP-712)",
    platform: "Protocol Banks",
    platformSub: "policy · risk · receipts",
    platformNoKeys: "no keys · no funds",
    venueName: "Hyperliquid",
    venueAgent: "agent wallet",
    venueRights: "place / cancel orders",
    venueNoWithdraw: "cannot withdraw",
    order: "orders",
    boundary: "no withdrawal path exists",
  },
  zh: {
    architecture: "一次调用如何流动",
    architectureCaption:
      "Key 策略先于风险包络校验，两者都通过后订单才会到达交易场所。pay、swap 与 invoice 在平台侧不移动资金。",
    agent: "你的 Agent",
    agentSub: "LangChain · AI SDK · MCP",
    api: "Agent API",
    apiSub: "一个 Key · 五个端点",
    apiState: "/state  /orders  /pay  /swap  /invoice",
    policy: "Key 策略",
    policySub: "操作 · 上限 · 币种",
    risk: "风险包络",
    riskSub: "持仓 · 熔断",
    venue: "Hyperliquid",
    venueSub: "纸面 · 实盘",
    wallet: "agent 钱包",
    walletSub: "仅交易权限",
    receipt: "回执",
    receiptSub: "使用日志 · 成交",
    unsigned: "pay：签名执行 · swap：待签名",
    refused: "到达场所前 403",
    orderFlow: "一笔订单会经过什么",
    orderFlowCaption:
      "每一道关卡返回各自的错误码。拒绝对该请求是终局，模型无法靠重试绕过策略。",
    request: "请求",
    auth: "认证",
    authSub: "Key → 账户",
    policyGate: "策略",
    policyGateSub: "操作 · 上限 · 币种",
    riskGate: "风控",
    riskGateSub: "持仓 · 资金",
    fill: "成交",
    fillSub: "纸面或实盘",
    receiptStep: "回执",
    receiptStepSub: "使用 · 成交",
    security: "信任边界",
    securityCaption:
      "从你的密钥到交易场所，唯一的路径是你签署的授权。平台不持有密钥与资金；agent 钱包只能交易，永远无法提现。",
    yourWallet: "你的钱包",
    yourWalletSub: "密钥永不离开",
    approve: "approveAgent（EIP-712）",
    platform: "Protocol Banks",
    platformSub: "策略 · 风控 · 回执",
    platformNoKeys: "无密钥 · 无资金",
    venueName: "Hyperliquid",
    venueAgent: "agent 钱包",
    venueRights: "下单 / 撤单",
    venueNoWithdraw: "无法提现",
    order: "下单",
    boundary: "不存在提现路径",
  },
}

function Frame({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <figure className="rounded-lg border border-[#E4E2DD] bg-white p-4 sm:p-5">
      <figcaption>
        <p className="font-mono text-[11px] tracking-[0.08em] text-[#6F6B64]">[ {title} ]</p>
        <p className="mt-2 text-xs leading-relaxed text-[#6F6B64] max-w-[80ch]">{caption}</p>
      </figcaption>
      <div className="mt-4 overflow-x-auto">{children}</div>
    </figure>
  )
}

const BOX = { fill: "#FFFFFF", stroke: "#E4E2DD", rx: 8 } as const

function box(x: number, y: number, w: number, h: number, strong = false) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={BOX.rx}
      fill={BOX.fill}
      stroke={strong ? "#111111" : BOX.stroke}
      strokeWidth={strong ? 1.5 : 1}
    />
  )
}

function text(x: number, y: number, value: string, size = 13, fill = "#111111", anchor: "start" | "middle" = "middle") {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={fill} fontFamily="ui-monospace, monospace">
      {value}
    </text>
  )
}

function Architecture({ locale }: { locale: DocLocale }) {
  const t = LABELS[locale]
  return (
    <svg viewBox="0 0 960 400" className="min-w-[720px] w-full" role="img" aria-label={t.architecture}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#111111" />
        </marker>
        <marker id="arrow-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#8A6116" />
        </marker>
      </defs>

      {box(24, 150, 180, 110)}
      {text(114, 184, t.agent, 14)}
      {text(114, 208, t.agentSub, 11, "#6F6B64")}

      {box(250, 80, 220, 250, true)}
      {text(360, 118, t.api, 15)}
      {text(360, 142, t.apiSub, 11, "#6F6B64")}
      {text(360, 172, "/v1/agent", 12, "#6F6B64")}
      {text(360, 198, t.apiState, 10, "#6F6B64")}
      {text(360, 250, t.unsigned, 11, "#8A6116")}
      {text(360, 272, "↑", 14, "#8A6116")}

      {box(520, 80, 170, 100)}
      {text(605, 112, t.policy, 13)}
      {text(605, 136, t.policySub, 10, "#6F6B64")}
      {text(605, 162, t.refused, 10, "#8A6116")}

      {box(520, 220, 170, 100)}
      {text(605, 252, t.risk, 13)}
      {text(605, 276, t.riskSub, 10, "#6F6B64")}

      {box(740, 80, 196, 120)}
      {text(838, 112, t.venue, 14)}
      {text(838, 136, t.venueSub, 10, "#6F6B64")}
      {text(838, 162, t.wallet, 11)}
      {text(838, 184, t.walletSub, 10, "#1F7A4D")}

      {box(740, 250, 196, 80)}
      {text(838, 280, t.receipt, 13)}
      {text(838, 302, t.receiptSub, 10, "#6F6B64")}

      <line x1="204" y1="205" x2="246" y2="205" stroke="#111111" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <line x1="470" y1="130" x2="516" y2="130" stroke="#111111" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <line x1="605" y1="180" x2="605" y2="216" stroke="#111111" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <path d="M 690 270 L 716 270 L 716 140 L 736 140" fill="none" stroke="#111111" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <line x1="838" y1="200" x2="838" y2="246" stroke="#111111" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <line x1="250" y1="300" x2="208" y2="300" stroke="#8A6116" strokeWidth="1.5" strokeDasharray="5 4" markerEnd="url(#arrow-muted)" />
    </svg>
  )
}

function OrderFlow({ locale }: { locale: DocLocale }) {
  const t = LABELS[locale]
  const nodes = [
    { x: 20, title: t.request, sub: "" },
    { x: 160, title: t.auth, sub: t.authSub, status: "401" },
    { x: 310, title: t.policyGate, sub: t.policyGateSub, status: "403" },
    { x: 460, title: t.riskGate, sub: t.riskGateSub, status: "409" },
    { x: 610, title: t.fill, sub: t.fillSub },
    { x: 760, title: t.receiptStep, sub: t.receiptStepSub },
  ]
  return (
    <svg viewBox="0 0 940 300" className="min-w-[700px] w-full" role="img" aria-label={t.orderFlow}>
      <defs>
        <marker id="arrow2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#111111" />
        </marker>
        <marker id="arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#8A6116" />
        </marker>
      </defs>

      {nodes.map((node) => (
        <g key={node.title}>
          {box(node.x, 80, 130, 90, node.status ? false : true)}
          {text(node.x + 65, 112, node.title, 13)}
          {node.sub ? text(node.x + 65, 136, node.sub, 10, "#6F6B64") : null}
          {node.status ? text(node.x + 65, 158, node.status, 10, "#8A6116") : null}
        </g>
      ))}

      {nodes.slice(0, -1).map((node, index) => (
        <line
          key={`${node.title}-arrow`}
          x1={node.x + 130}
          y1={125}
          x2={nodes[index + 1].x - 4}
          y2={125}
          stroke="#111111"
          strokeWidth="1.5"
          markerEnd="url(#arrow2)"
        />
      ))}

      {[
        { x: 160, label: t.auth },
        { x: 310, label: t.policyGate },
        { x: 460, label: t.riskGate },
      ].map((refusal) => (
        <g key={refusal.label}>
          {box(refusal.x, 220, 130, 46)}
          {text(refusal.x + 65, 248, `${refusal.label} — ${["401", "403", "409"][[160, 310, 460].indexOf(refusal.x)]}`, 10, "#8A6116")}
          <line
            x1={refusal.x + 65}
            y1={174}
            x2={refusal.x + 65}
            y2={216}
            stroke="#8A6116"
            strokeWidth="1.2"
            strokeDasharray="4 3"
            markerEnd="url(#arrow-amber)"
          />
        </g>
      ))}
    </svg>
  )
}

function SecurityBoundaries({ locale }: { locale: DocLocale }) {
  const t = LABELS[locale]
  return (
    <svg viewBox="0 0 960 360" className="min-w-[720px] w-full" role="img" aria-label={t.security}>
      <defs>
        <marker id="arrow3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#111111" />
        </marker>
      </defs>

      <rect x="20" y="60" width="240" height="240" rx="10" fill="#F7F6F3" stroke="#E4E2DD" />
      {text(140, 92, t.yourWallet, 14)}
      {text(140, 116, t.yourWalletSub, 10, "#6F6B64")}

      <rect x="300" y="60" width="340" height="240" rx="10" fill="#FFFFFF" stroke="#111111" strokeWidth="1.2" />
      {text(470, 92, t.platform, 15)}
      {text(470, 116, t.platformSub, 10, "#6F6B64")}
      {text(470, 156, t.platformNoKeys, 11, "#1F7A4D")}
      {text(470, 190, "state · orders · pay · swap · invoice", 9, "#6F6B64")}

      <rect x="680" y="60" width="260" height="240" rx="10" fill="#F7F6F3" stroke="#E4E2DD" />
      {text(810, 92, t.venueName, 15)}
      {text(810, 116, t.venueAgent, 10, "#6F6B64")}
      {text(810, 152, t.venueRights, 11)}
      {text(810, 176, t.venueNoWithdraw, 11, "#1F7A4D")}

      <line x1="150" y1="180" x2="150" y2="250" stroke="#E4E2DD" strokeWidth="1" />
      <path d="M 260 140 L 676 140" fill="none" stroke="#111111" strokeWidth="1.5" strokeDasharray="6 4" markerEnd="url(#arrow3)" />
      {text(468, 130, t.approve, 10, "#111111")}
      <line x1="640" y1="250" x2="676" y2="250" stroke="#111111" strokeWidth="1.5" markerEnd="url(#arrow3)" />
      {text(600, 240, t.order, 10, "#111111")}

      <text x="470" y="330" textAnchor="middle" fontSize="11" fill="#8A6116" fontFamily="ui-monospace, monospace">
        {t.boundary}
      </text>
    </svg>
  )
}

export function DocDiagram({ name, locale }: { name: DiagramName; locale: DocLocale }) {
  const t = LABELS[locale]

  if (name === "architecture") {
    return (
      <Frame title={t.architecture} caption={t.architectureCaption}>
        <Architecture locale={locale} />
      </Frame>
    )
  }
  if (name === "order-flow") {
    return (
      <Frame title={t.orderFlow} caption={t.orderFlowCaption}>
        <OrderFlow locale={locale} />
      </Frame>
    )
  }
  return (
    <Frame title={t.security} caption={t.securityCaption}>
      <SecurityBoundaries locale={locale} />
    </Frame>
  )
}
