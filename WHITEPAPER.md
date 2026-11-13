# Protocol Bank — Agent Commerce 控制面白皮书

**版本:** 3.1.0
**日期:** 2026-11

---

## 一、执行摘要

Protocol Bank 是面向 AI Agent 的 **Agent Commerce 控制面**。一个 agent 凭证，一套由服务端强制的 mandate，覆盖 **commerce / payments / cards / trading**：可执行的操作、单笔上限、每日上限、白名单、预算与审计。Agent 可以购买服务、接受报价、交付证明、付款、刷卡或交易，但无法放宽 mandate，也无法掏空账户。

与传统支付网关和纯 x402 Facilitator 的关键区别：

| 传统产品 / Facilitator | Protocol Bank |
|---|---|
| 只处理支付管道 | **控制面**：凭证、策略、预算、钱包、卡、订单、对账 |
| 模型可以自己决定花多少 | **mandate 在服务端强制**，模型无法放宽 |
| 支付与订单脱节 | **订单绑定**：seller、amount、token、termsHash、orderId |
| 卡和钱包各自为政 | **一个 agent 一个钱包、一张卡、一套预算** |
| 出问题只有 tx hash | **审计、争议、退款、声誉、对账** |

## 二、产品架构

```
Agent / Merchant / Marketplace
        │
        ▼
Agent API
  credential · mandate · budget · audit
        │
        ├── Commerce   services · quotes · orders · delivery · reputation
        ├── Payments   EIP-3009 · x402 · invoice · batch · subscription
        ├── Cards      Yativo / Rain · agent-scoped · budgeted
        └── Trading    Hyperliquid trading-only agent wallet
        │
        ▼
Settlement & reconciliation
  on-chain verify · idempotency · ledger · webhooks
```

四种 rail 共享同一个凭证、同一套预算和同一个审计流。Trading 是参考垂直，不是产品边界。

## 三、参考垂直：AI Trading

v1 的交易策略刻意选择"数学上站得住的简单策略"，而非黑盒模型：

**信号组合**（60% 动量 + 40% 资金费率）：

- **动量**：24 小时风险调整收益（mean return × √n / σ 的 z-score），捕捉趋势
- **资金费率**：Hyperliquid 每小时资金费率的方向与强度，捕捉 carry 机会

**执行与风控**：

- 标的池：Hyperliquid 24h 成交量前 12 的永续合约，过滤低流动性标的
- 入场：|综合分数| ≥ 0.45；离场：止盈 +30% / 止损 -15% / 信号反向衰减
- 成本建模：taker 费 4bps + 滑点 5bps 计入每次模拟/真实成交

这条垂直用于证明 mandate、预算、审计和 trading-only 钱包可以产品化；它不代表 Protocol Bank 只做交易。

## 四、Agent Commerce

支付本身不构成市场，订单才是。Commerce API 增加：

1. 卖家发布服务（价格、token、链、条款）
2. 买家接受签名报价，生成订单
3. 卖家提交交付证明（hash / URI / 签名）
4. 买家通过 `pay` 携带 `orderId` 付款
5. 订单进入 paid / completed / disputed / refunded，并累计声誉

订单携带 canonical `termsHash`（seller、buyer、amount、token、chain、scope、deliveryDue、terms）。付款 intent 回显 `orderId` 和 `termsHash`，收据可以对照订单验证，而不是依赖自由文本 memo。

**当前限制**：没有 escrow / 条件释放；付款是直接的；争议和退款是记录，不是自动仲裁。Escrow 是 Phase 3 的下一条 rail。

## 五、安全模型

- **认证**：SIWE（EIP-4361）+ JWT；服务端强制身份匹配
- **Mandate**：API key / agent key 上的 ops、单笔、每日、白名单；服务端强制，调用方无法放宽
- **非托管支付**：EIP-3009 由付款方签名，relayer 只付 gas；平台不持有资金
- **Trading-only**：Hyperliquid agent 钱包仅交易权限，物理上无法提现
- **Agent 钱包**：平台托管 EVM 钱包，AES-256-GCM 加密；这是热钱包，生产建议 KMS/HSM 或 MPC
- **Cards**：由 Yativo / Rain 发行，卡余额由发卡方持有；开卡/充值/结算消耗 agent 预算
- **审计**：每次调用、订单、付款、卡事件写入活动流；RLS 在数据库层隔离租户
- **撤销**：暂停、轮换 key、冻结卡、链上撤销 agent

## 六、商业模式

- 订阅：Builder / Growth / Scale
- 按量：执行订单 8 bps；无订阅时按月结算
- Cards：发卡/充值/结算服务费（provider 成本另计）
- Commerce：订单/分账/企业服务费（规划中）

我们不发行代币；价值来自真实 TPV、商户留存、预算与合规，而不是叙事。

## 七、路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| v1 已交付 | Agent API、驾驶舱、paper 引擎、live 签名与批准流、风控、用户隔离、CI/测试/部署 | ✅ |
| v2 | Agent 钱包、Agent 卡（Yativo/Rain）、Rain KYC/contract/issue、卡 webhook、预算扣减 | ✅ |
| v3.0 | Commerce API 可信化、escrow 设计、PayAI/CDP/Cloudflare Facilitator 适配、3 个灯塔客户 | 🔜 |
| v3.1 | Payment Splitting、多 Agent 订单、争议/仲裁、企业子账户 | 📋 |
| v3.2 | Agent 金融基础设施、跨链结算、合规、Marketplace | 📋 |

## 八、风险提示

- 自动交易可能导致交易钱包全部损失；AI 是工具，不是收益保证
- Agent 钱包是热钱包；卡余额由 provider 持有，不是银行存款
- Commerce 尚无 escrow；付款是直接的，争议需要人工处理
- x402 Facilitator 会商品化；护城河在 mandate、预算、钱包、卡、对账和信任
- 本白皮书是技术与产品说明，不构成投资建议
