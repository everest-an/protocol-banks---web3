# PRD V3 — Agent Commerce 与 Agent Payments

> 版本：v0.1（战略草案）
> 日期：2026-11
> 状态：方向文档，不是最终排期
> 关联：[PRD V2 — AI Trading](PRD_V2_AI_TRADING.md)、[Agent Commerce](AGENT_COMMERCE.md)、[Agent API](AGENT_API.md)、[Product Guide](PRODUCT_GUIDE.md)

---

## 1. 一句话结论

**Phase 3 不应该复制 PayAI，也不应该去和 Coinbase / Cloudflare 拼 x402 Facilitator。**

Protocol Banks 的正确位置是：

> **Agent Commerce 的策略、钱包与结算控制面（control plane），x402 是其中一条支付 rail。**

PayAI 解决“Agent 如何按调用付款”；Protocol Banks 解决“Agent 能花多少、能花在哪、钱从哪个账户出、花完怎么对账、出问题谁负责”。两者是上下游，不是同一个位置。

---

## 2. 为什么现在做 Phase 3

### 2.1 我们已经有的资产

| 资产 | 现状 | 对 Phase 3 的价值 |
|---|---|---|
| **Agent 凭证与策略** | `pb_...` / `agent_...`，服务端强制 ops、单笔、每日、币种白名单（`lib/agent/policy.ts`） | 这是 Agent 花钱的“授权层”，PayAI 没有 |
| **平台托管 Agent 钱包** | 每 agent 一个 EVM 地址，AES-256-GCM 加密，策略化签名（`lib/agent/wallet.ts`） | 可以成为 Agent 的“账户层” |
| **Hyperliquid trading-only 钱包** | EIP-712 `approveAgent`，可交易不可提现 | 证明“受限权限”可以产品化 |
| **Agent Commerce** | 服务、报价、订单、交付证明、付款绑定、争议、退款、声誉（`lib/agent/commerce.ts` + `/api/v1/agent/commerce/*`） | 已经是 Agent-to-Agent 交易的骨架 |
| **x402** | authorize / execute / verify / settle，EIP-3009，链上验证 + 防重放（`app/api/x402/*`） | 可以直接接 Facilitator，也可以自建小规模结算 |
| **Cards** | Yativo / Rain，agent-scoped，预算扣减，Rain webhook 已做授权/结算/预算 | Agent 的“线下/线上消费”出口 |
| **企业支付 rails** | 批量支付、发票、订阅、收单、联系人、多链余额 | 企业客户与财务对账能力 |
| **分发** | MCP、A2A、ERC-8004、SDK、OpenAPI | Agent 可以直接发现和调用 |

### 2.2 市场信号

- x402 已从 Web3 实验进入产业治理：2026 年 7 月 Linux Foundation 启动 x402 Foundation，Coinbase 把协议贡献给基金会，Cloudflare 等参与。
- Facilitator 正在商品化：Coinbase CDP、Cloudflare、thirdweb 都能提供 x402 支付验证/结算。
- Agent Commerce 的真实交易已经出现，但金额仍小：PayAI 公布的 ClawRouter 案例是 26,860 笔、160 个付款 Agent、累计 $1,825.73。
- 结论：**支付管道会越来越便宜，授权、预算、账户、卡、对账和合规会越来越值钱。**

---

## 3. PayAI Network 深度尽调（纳入 Phase 3 参考）

> 以下基于公开资料与用户提供的尽调材料，截至 2026-11。未独立验证的数据标注为“项目方披露”。

### 3.1 PayAI 是什么

PayAI 想成为 **AI Agent 经济的支付基础设施**：让 Agent 自主购买 API、数据、算力、软件服务和其他 Agent 的服务。核心切入点是 **x402**。

它的角色不是 Agent，也不是商户，而是：

- x402 Facilitator：验证支付授权、执行链上结算、返回结果；
- Agent Service Discovery：Bazaar / 生态目录；
- SDK / Middleware / Claude Code 插件；
- Payment Splitting、Token Gateway、跨网络支付（部分 Coming Soon）。

### 3.2 产品完成度

| 能力 | 状态 |
|---|---|
| x402 Facilitator | Live |
| Solana USDC | Live |
| EVM 多链 | Live（Solana、Base、BNB Chain、Polygon、Avalanche、Arbitrum、Sei、X Layer、SKALE） |
| SDK / Middleware | Live |
| Gas Sponsored Flow | 部分支持 |
| Echo Merchant 测试环境 | Live |
| Payment Splitting | Coming Soon |
| Token Gateway / 跨网络 | Coming Soon |

这说明它已经不是 PPT 项目，但“生产可用”不等于“安全审计通过”。公开 GitHub 有代码和测试，但没有找到可验证的完整第三方安全审计报告。

### 3.3 商业数据（项目方披露）

**ClawRouter × PayAI（2026-02-22 至 2026-04-27）**

| 指标 | 数值 |
|---|---|
| 成功结算 | 26,860 笔 |
| 独立付款 Agent | 160 |
| 累计支付金额 | $1,825.73 |
| 结算成功率 | 98.7% |
| 平均单笔 | $0.0679 |
| 平均结算时间 | 1.396s |
| P95 结算时间 | 2.263s |

**HoloWorld**：3,000 个 NFT Pass，约 $15 万销售额（项目方披露，属于一次性 NFT 销售，不是持续性 Agent API 微支付）。

**关键判断**：交易笔数证明场景存在，但 $1,825 的累计金额说明离“支付网络”还很远。生态目录 48 个项目 ≠ 48 个活跃商户 ≠ 真实持续交易。

### 3.4 商业模式

- 按结算笔数收费，不按金额抽成；
- 前 1,000 credits 免费；
- $1 买 1,000 credits；
- 不同网络每笔消耗不同 credits；
- 企业定制服务。

这是低毛利、规模驱动的模式。交易量越大，Gas、RPC、合规筛查、免费额度、获客成本也越大。真正的利润点在：企业 Agent Payment API、专用结算通道、Payment Splitting、资金管理、Marketplace、合规风控。

### 3.5 竞争格局

| 竞争者 | 优势 | 对 PayAI 的压力 |
|---|---|---|
| **Coinbase CDP** | 交易所、钱包、USDC、开发者生态、x402 Facilitator | 品牌、分发、资本，最强 |
| **Cloudflare** | Web 流量入口、Agents SDK、MCP、x402 集成 | 把支付嵌进基础设施，绕过独立 Facilitator |
| **thirdweb** | Web3 SDK、支付工具、开发者生态 | SDK / Facilitator 直接竞争 |
| **Stripe** | 商户收单、银行卡、法币、企业客户 | Agent Commerce 与法币支付结合后更完整 |

### 3.6 技术壁垒判断

- **中低技术壁垒**：x402 是开放标准，Solana/EVM USDC 验证与结算有开源实现，Facilitator 可复制。
- **中高运营壁垒**：多链稳定性、交易恢复、重复支付防护、Gas 赞助、商户接入、监控、合规筛查、异常处理。
- **真正的护城河**：不是“能结算”，而是“异常时资金安全 + 商户留存 + 网络效应”。

必须审计的技术点：

- Replay Protection：同一支付授权能否重复使用；
- Idempotency：重试是否重复结算；
- Settlement Recovery：RPC 超时后如何恢复；
- Private Key Security：Facilitator 私钥管理；
- Gas Sponsorship：赞助交易是否被滥用；
- Merchant Isolation：商户资金/权限隔离；
- Multi-chain：不同链确认策略是否一致；
- Compliance：地址风险、制裁名单、监控。

### 3.7 团队与代币

- 运营主体：PayAI Network, LLC（美国 Delaware，远程团队，官网披露）；
- 创始人/核心团队完整履历、机构融资公告、股权结构、独立审计：公开信息不足；
- PAYAI：Solana 代币，公开总供应量 10 亿，2025-11 发生过合约迁移；
- **没有证据证明**：支付必须用 PAYAI、Facilitator 收入回购代币、代币享有公司收入分成、代币有治理权。

**结论：PAYAI 代币和 PayAI Network 的业务价值不能直接画等号。** 代币价值捕获是 Phase 3 观察 PayAI 的核心问号。

### 3.8 PayAI 给我们的启示

1. **x402 是真需求，但 Facilitator 不是终局。**
2. **交易笔数可以很好看，金额和留存才是商业。**
3. **支付协议不等于商业网络；网络效应来自商户、Agent、服务发现、分账和信任。**
4. **代币叙事不能替代收入、毛利和现金流。**
5. **PayAI 的强项是“按调用结算”，弱项是“账户、预算、权限、卡、对账、企业合规”——正好是我们的强项。**

---

## 4. 我们项目的深度分析

### 4.1 我们真正的位置

```
Agent Applications
  Research / Coding / Trading / Automation
        │
        ▼
Agent Commerce & Payments
  PayAI / x402 / Facilitator / Settlement
        │
        ▼
Agent Mandate & Financial Control      ← Protocol Banks
  Credential · Policy · Wallet · Budget · Card · Audit · Reconciliation
        │
        ▼
Financial Assets
  USDC / Stablecoins / On-chain Accounts
```

我们不应该做“又一个 x402 Facilitator”，而应该做 **Agent 的授权、账户与结算控制面**：

- 一个 Agent 凭证；
- 一套服务端强制策略；
- 一个 agent 钱包/账户；
- 一张 agent 卡；
- 一套订单/报价/交付/争议；
- 一套预算、审计、对账、webhook；
- x402 / EIP-3009 / 卡 / 交易，都是 rail。

### 4.2 我们已经做对的

| 判断 | 代码/产品证据 |
|---|---|
| 策略必须在服务端，不在 prompt | `lib/agent/policy.ts`、API key policy、`withAgentAuth` |
| 非托管支付是可行差异点 | EIP-3009 payer-signed + relayer only gas |
| Agent 钱包可以受限 | Hyperliquid trading-only `approveAgent` |
| Agent 卡必须按 agent 隔离 | `AgentVirtualCard` + budget + Rain webhook |
| 交易需要订单绑定 | `agentOrder` + `termsHash` + `orderId` |
| 对账需要链上证明 | x402 `verify`/`settle` 链上验证 + 防重放 |
| Agent 需要被发现 | MCP、A2A、ERC-8004、commerce directory |
| 企业客户需要 rails | 批量支付、发票、订阅、收单、RLS |

### 4.3 我们还没做好的

| 缺口 | 影响 | Phase 3 动作 |
|---|---|---|
| Commerce 没有 escrow / 条件释放 | 买卖双方信任不足 | 设计 escrow 合约或托管账户 + 仲裁 |
| 没有 signed delivery attestation 的完整信任链 | 交付争议难裁决 | 交付签名 + 可选第三方见证 |
| 没有并发付款的数据库级预留 | 同一订单可能被重复支付 | `orderId` 唯一约束 + 原子状态机 |
| Commerce API 没进 OpenAPI / SDK | 开发者接入成本高 | 生成 OpenAPI、SDK tools、MCP tools |
| 没有 agent-facing UI | 只能 API-first | 轻量 commerce 面板 + 订单时间线 |
| 卡是 provider-custodied | 不能宣传“全非托管” | 明确 custody 标签；Rain 加密 secrets |
| 没有 facilitator 适配层 | 只能自建结算 | 做 PayAI/CDP/Cloudflare 适配器 |
| 没有真实 TPV / 商户数据 | 无法证明网络效应 | 设 KPI、跑 sandbox、拿 3 个灯塔客户 |

### 4.4 我们的护城河判断

- **中高**：策略引擎 + 预算 + agent 钱包 + 卡 + 交易 + 企业 rails 的组合，不是单个 SDK 能复制。
- **中**：x402/EIP-3009 本身是开放标准，支付执行会商品化。
- **低-中**：单纯 Facilitator、单纯卡发行、单纯钱包托管，都会被替代。
- **真正难复制**：商户/Agent 的接入、预算与合规流程、异常处理、对账数据、企业客户的信任。

---

## 5. Phase 3 战略：Control Plane，不是 Pipe

### 5.1 三种路径

| 路径 | 做什么 | 结论 |
|---|---|---|
| **A. Facilitator** | 自建 x402 验证/结算，按笔收费 | 不推荐作为主路径：Coinbase/Cloudflare/PayAI 已经在打价格战 |
| **B. Agent Commerce Network** | 服务发现 + 报价 + 订单 + 交付 + 声誉 + 支付绑定 | **推荐**：我们有 commerce API，缺 escrow/信任层 |
| **C. Agent Financial Infrastructure** | Agent 账户、钱包、预算、卡、分账、风控、对账 | **长期推荐**：最贴合我们的资产 |

**Phase 3 = B + C，A 只做“适配器”。**

### 5.2 产品架构

```
Agent / Merchant / Marketplace
        │
        ▼
Protocol Banks Agent API
  credential · policy · budget · audit
        │
        ├── Commerce rail
        │     services · quotes · orders · delivery · dispute · reputation
        │
        ├── Payment rail
        │     EIP-3009 pay · x402 · invoice · batch · subscription
        │
        ├── Card rail
        │     Yativo / Rain · per-agent card · budget · webhooks
        │
        ├── Trading rail
        │     Hyperliquid trading-only agent wallet
        │
        └── Settlement & reconciliation
              on-chain verify · idempotency · ledger · webhooks
        │
        ▼
Facilitators / Networks
  PayAI · Coinbase CDP · Cloudflare · relayer · chains
```

**关键设计：Facilitator 是可替换的。** 我们的策略/预算/订单层不绑定任何一家 Facilitator。

### 5.3 Phase 3 五个支柱

1. **Agent Mandate**：凭证、策略、预算、钱包、卡、撤销。
2. **Agent Commerce**：服务、报价、订单、交付、争议、退款、声誉。
3. **Payment Interop**：x402 适配器（PayAI/CDP/Cloudflare）、EIP-3009、卡、发票。
4. **Settlement & Reconciliation**：链上证明、幂等、账本、webhook、对账。
5. **Discovery & Trust**：A2A、ERC-8004、commerce directory、reputation、attestation。

### 5.4 与 PayAI 的关系

| 维度 | PayAI | Protocol Banks | 关系 |
|---|---|---|---|
| 核心 | x402 Facilitator | Agent mandate + commerce + wallet/card | 互补 |
| 收费 | 按结算笔数 | 订阅 + 按量 + 卡/企业服务 | 可叠加 |
| 客户 | 开发者 / 商户 | 企业 / Agent 平台 / 商户 | 可互相导流 |
| 强项 | 多链结算、SDK、生态目录 | 策略、预算、卡、交易、企业 rails | 互补 |
| 弱项 | 账户/预算/合规/企业财务 | Facilitator 规模/多链结算 | 可集成 |

**建议**：把 PayAI 作为 x402 Facilitator 的首批适配器之一；同时保留 CDP/Cloudflare/自建 relayer 作为备选。不要把自己锁死在一家。

---

## 6. Phase 3 路线图

### Phase 3.0（0–3 个月）：把 commerce 变成可信交易

- [ ] Commerce API 进 OpenAPI、SDK、MCP tools
- [ ] `orderId` 唯一约束 + 原子状态机 + 并发付款预留
- [ ] 交付签名/哈希/URI 的完整验证链
- [ ] Escrow 设计：合约托管或平台托管账户（明确 custody）
- [ ] x402 Facilitator 适配器：PayAI sandbox 优先，CDP/Cloudflare 备选
- [ ] 3 个灯塔商户/Agent 的 sandbox 交易
- [ ] 对账：订单 ↔ 支付 ↔ 链上 tx ↔ 预算扣减

### Phase 3.1（3–6 个月）：网络与分账

- [ ] Payment Splitting：多服务方分账
- [ ] 多 Agent 协作订单（一个订单多个 seller）
- [ ] 争议/仲裁/自动退款流程
- [ ] 商户 onboarding、服务目录、声誉 attestation
- [ ] 企业 Agent 子账户/预算/审批
- [ ] Facilitator 路由：按链、费用、成功率选择

### Phase 3.2（6–12 个月）：Agent Financial Infrastructure

- [ ] Agent 专属账户与资金权限
- [ ] 跨链 Token Gateway / 结算
- [ ] 企业财务对账、报表、审计导出
- [ ] 合规：KYB/KYC、制裁筛查、交易监控
- [ ] Marketplace / 服务发现 / 信誉网络
- [ ] 与 Awareness/OMP 等记忆/身份层组合

---

## 7. KPI（Phase 3 只看这些）

### 商业
- 月真实结算 TPV（不是测试/空转）
- 月独立付款 Agent 数
- 月活跃商户数
- 30 天商户/Agent 留存
- 平均单笔金额
- 每笔毛利（扣除 gas、RPC、合规、免费额度）
- 前十大商户收入集中度

### 技术
- 结算成功率
- P95 结算时间
- 重复支付/幂等失败数
- 不确定订单恢复时间
- 预算超支事件数
- Webhook 送达率
- 卡授权拒绝率/误拒率

### 信任
- 争议率
- 退款率
- 交付证明覆盖率
- 审计日志完整率
- 安全审计发现关闭率

---

## 8. 风险与合规

| 风险 | 说明 | 缓解 |
|---|---|---|
| Facilitator 商品化 | Coinbase/Cloudflare 免费或低价 | 不自建为主；做适配层 + 控制面 |
| 卡是 provider-custodied | 不能宣传全非托管 | custody 标签、provider disclosure、KYB |
| Escrow 托管 | 可能触发资金传输/托管监管 | 优先合约托管；法律意见；地区限制 |
| Agent 误操作 | 循环/注入/失控消费 | 服务端策略、预算、kill switch、审计 |
| 多链结算失败 | RPC 超时、重组、nonce | 幂等、对账、人工恢复、链确认策略 |
| 代币叙事 | 我们没有代币，不靠叙事 | 用 TPV/收入/留存说话 |
| 数据隐私 | KYC/PII | 最小化存储、加密、访问控制、DPA |

---

## 9. 给 PayAI 的 10 个问题（合作前尽调）

1. 当前真实月结算金额（TPV）是多少？
2. 真实活跃付款 Agent 有多少？如何剔除测试交易？
3. 当前月收入、毛利和现金流是多少？
4. 前十大商户贡献了多少交易量？
5. Facilitator 的真实市场份额是多少？
6. Coinbase/Cloudflare 免费服务是否在挤压你们？
7. PAYAI Token 与 LLC 的法律及经济关系是什么？
8. 是否有第三方智能合约和基础设施安全审计？
9. Payment Splitting 和 Token Gateway 何时真正上线？
10. 如何从 Facilitator 发展成 Agent Financial Infrastructure？

---

## 10. 给 Protocol Banks 的 10 个问题（Phase 3 启动前）

1. 我们的 commerce 交易是“真需求”还是“API 演示”？
2. 哪个垂直最先付费：Agent API 市场、数据、算力、SaaS、还是跨境？
3. Escrow 用合约还是平台账户？法律边界是什么？
4. 卡是先做 Yativo 还是 Rain？KYB 时间表？
5. 我们的 agent 钱包是热钱包，限额和保险怎么做？
6. Facilitator 选 PayAI/CDP/Cloudflare，还是多活？
7. Commerce 的抽成/订阅/卡费，哪个先收？
8. 哪些商户愿意做灯塔客户？
9. 我们的 SDK/MCP 能不能让 Agent 在 10 分钟内完成第一笔订单？
10. 出问题时，谁负责退款/仲裁/赔付？

---

## 11. 最终判断

PayAI 证明了 **Agent 按调用付款** 是真需求，也暴露了这个市场的早期特征：**笔数可以很大，金额和留存还很小；协议可以开放，商业网络很难。**

Protocol Banks 的机会不是再做一个 Facilitator，而是把 **策略、预算、钱包、卡、订单、对账** 做成 Agent Commerce 的控制面。x402 和 PayAI 是这条控制面的一条 rail；Coinbase/Cloudflare 也是 rail。谁掌握 Agent 的授权、账户、预算和信任，谁就掌握长期价值。

**Phase 3 的成功标准不是“支持 x402”，而是：一个企业敢把自己的 Agent 交给我们的策略和钱包去花钱，并且能对账、能止损、能审计。**

---

## 12. 参考入口

- PayAI 官网：https://payai.network
- PayAI GitHub：https://github.com/PayAINetwork
- x402 Foundation（Linux Foundation，2026-07 公告）
- Coinbase CDP x402 Facilitator
- Cloudflare Agents / x402 集成
- 本仓库：[Agent Commerce](AGENT_COMMERCE.md)、[Agent API](AGENT_API.md)、[Product Guide](PRODUCT_GUIDE.md)
