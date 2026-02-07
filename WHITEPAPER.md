# Protocol Banks - 技术白皮书 (Technical Whitepaper)
**版本:** 2.0.0
**日期:** 2026-02-08

---

## 一、 执行摘要 (Executive Summary)

Protocol Banks 是一个非托管、多链支付解决基础设施，专为 DAO、AI Agent 和企业级用户设计。随着去中心化组织和智能代理成为主要的经济行为体，传统的银行架构已无法满足需求。Protocol Banks 引入了一个可编程的、跨链的资金管理层，通过抽象链特有的复杂性，并结合链上事件与标准会计实践，为下一代数字企业提供无缝的金融操作体验。

我们的专有集成 **x402 协议** (基于 ERC-3009) 允许无 Gas 费用的委托结算，为完全自主的 Agent-to-Agent 商业铺平了道路。

本白皮书详细阐述了 Protocol Banks 的技术架构、核心协议 (x402)、安全机制以及针对 AI 时代的资金管理解决方案。

---

## 二、 市场分析 (Market Analysis)

### 2.1 问题：运营碎片化 (The Problem: Operational Fragmentation)

现代 Web3 财务团队面临**"碎片化三难困境"**：

1.  **链碎片化 (Chain Fragmentation)**: 资产分散在 Ethereum、L2、Solana、Bitcoin 和 Tron 等多条链上，团队需要在不同的区块浏览器和钱包之间反复切换。
2.  **工具碎片化 (Tool Fragmentation)**: 团队使用电子表格跟踪、Gnosis Safe 签名、Etherscan 审计——工具各自为政，无法形成统一的工作流。
3.  **上下文碎片化 (Context Fragmentation)**: 区块链交易缺乏业务上下文（如 "发票 #2024-001" 对应 `0x3f...2a`），导致审计和回溯极为困难。

这种碎片化导致操作风险增加、合规成本上升，并严重阻碍了 Web3 组织的规模化发展。

### 2.2 机遇：Agent 经济 (The Opportunity: The Agent Economy)

预计到 **2030 年，AI Agent 将处理超过 40% 的数字交易**。当前的钱包界面是为人类设计的，而非 Agent。市场迫切需要一个**"语义金融层" (Semantic Financial Layer)**，让 AI Agent 能够附带上下文地发起支付提案，由人类简单审批即可。

Protocol Banks 正是为这一时代设计的：一个 Agent 原生的、可编程的金融操作系统。

---

## 三、 系统架构总览

Protocol Banks 采用分层架构设计，确保系统的安全性、可扩展性和互操作性。

### 3.1 架构分层图

```
┌────────────────────────────────────────────────────────┐
│                      用户层 (User Layer)               │
├────────────────────────────────────────────────────────┤
│  Web Browser (PWA)  │  Mobile App (PWA)  │  API Clients│
└───────────┬──────────────────────┬─────────────┬───────┘
            │                      │             │
            ▼                      ▼             ▼
┌────────────────────────────────────────────────────────┐
│                      前端层 (Frontend Layer)           │
├────────────────────────────────────────────────────────┤
│                       Next.js 15 (App Router)          │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐ │
│ │    Pages     │ │  Components  │ │  Security SDK    │ │
│ └──────────────┘ └──────────────┘ └──────────────────┘ │
└───────────┬──────────────────────┬─────────────┬───────┘
            │                      │             │
            ▼                      ▼             ▼
┌────────────────────────────────────────────────────────┐
│                      API 层 (API Layer)                │
├────────────────────────────────────────────────────────┤
│                    Next.js API Routes / gRPC           │
│ ┌───────┐ ┌────────┐ ┌──────────┐ ┌─────────┐ ┌──────┐│
│ │ /auth │ │/agents │ │/payments │ │/webhooks│ │/x402 ││
│ └───────┘ └────────┘ └──────────┘ └─────────┘ └──────┘│
└───────────┬──────────────────────┬─────────────┬───────┘
            │                      │             │
            ▼                      ▼             ▼
┌────────────────────────────────────────────────────────┐
│                      服务层 (Services Layer)           │
├────────────────────────────────────────────────────────┤
│  Go 微服务集群 (Microservices)                         │
│ ┌────────────────┐ ┌────────────────┐ ┌──────────────┐ │
│ │ Payout Engine  │ │ Event Indexer  │ │ Agent Service│ │
│ └────────────────┘ └────────────────┘ └──────────────┘ │
│ ┌────────────────┐ ┌────────────────┐ ┌──────────────┐ │
│ │ Webhook Handler│ │ Subscription   │ │ Settlement   │ │
│ └────────────────┘ └────────────────┘ └──────────────┘ │
└───────────┬──────────────────────┬─────────────┬───────┘
            │                      │             │
            ▼                      ▼             ▼
┌────────────────────────────────────────────────────────┐
│                      数据与基础设施层                   │
├────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐ │
│ │ PostgreSQL │ │ Redis     │ │ Vault    │ │Blockchain│ │
│ └────────────┘ └───────────┘ └──────────┘ └──────────┘ │
└────────────────────────────────────────────────────────┘
```

### 3.2 统一结算层 (The Unified Settlement Layer)

Protocol Banks 作为现有结算网络之上的**聚合层**，无论底层链是什么，都创建统一的"商户视图"。

-   **EVM 支持**: 原生集成 Ethereum Mainnet 和 L2 (Arbitrum, Optimism, Base, Polygon, BSC)。
-   **Solana 支持**: 高速低成本结算。
-   **Bitcoin 支持**: 原生 BTC 脚本支持。
-   **Tron 支持**: **[新增]** TRC20-USDT 高通量稳定币转账，满足亚洲及全球市场支付需求。
-   **HashKey Chain**: RWA 结算与合规优先的法币退出通道。

---

## 四、 核心协议与功能

### 4.1 x402 协议 (GASLESS 企业结算)

x402 协议通过将**支付授权**与**支付执行**分离，实现了无 Gas 费用的企业级结算流程。

**工作原理:**
1.  **提案 (Propose)**: AI Agent 或初级财务人员创建支付批次。
2.  **授权 (Authorize)**: 授权签名者签署严格类型化的 EIP-712 消息（无需广播交易、无需花费 Gas）。
3.  **结算 (Settle)**: 签名授权提交给中继器（或接收方），由其支付 Gas 执行链上转账。

**技术标准**: 基于 ERC-3009 (`TransferWithAuthorization`) 和 EIP-712。

**优势**:
-   **财务审批无感化**: CFO 审批付款时无需持有 ETH 或支付 Gas，仅需对结构化数据进行签名。
-   **延迟结算**: 可收集审批后在 Gas 费用较低时批量结算。
-   **代付执行**: 由 Protocol Banks 的中继器或第三方服务商代付 Gas 并上链执行。
-   **安全性**: 签名包含特定金额、接收方、有效期限制，防止重放攻击。

### 4.2 Agent Link (AI 代理金融接口)

专为 AI Agent 设计的金融交互标准，使 AI 能够自主发起、管理和核算交易。

- **鉴权**: 采用 API Key (`agent_xxxxxx`) 与会话签名的双重验证机制。
- **能力**:
    - **预算请求**: Agent 可根据任务需求申请资金预算（日/周/月限额）。
    - **自动执行**: 在授权额度内，Agent 可自主完成供应商支付。
    - **链上行为证明**: Agent 的每一笔交易都与其链上身份 (DID) 绑定。
    - **紧急暂停**: 一键暂停所有 Agent 操作。

**Agent 类型**:

| Agent 类型 | 用途 |
|-----------|------|
| Trading Agent | 自动化交易操作 |
| Payroll Agent | 定期薪资发放 |
| Expense Agent | 供应商与费用管理 |
| Subscription Agent | 定期支付自动化 |
| Custom Agent | 用户自定义自动化 |

### 4.3 Settlement Checkout (统一结算收银台)

企业级的聚合支付收银台，支持多币种、多网络的混合结算。
- **混合支付**: 单次结算可包含 ETH、USDC、USDT 等多种资产。
- **智能路由**: 自动计算最优兑换路径和跨链桥接方案。
- **状态同步**: 实时监听链上状态，确保订单支付状态的原子性更新。

### 4.4 多链与跨链支持

Protocol Banks 致力于打破链孤岛，通过统一的接口支持主流公链。

- **EVM 兼容链**: Ethereum, Arbitrum, Optimism, Base, Polygon, BSC.
- **非 EVM 链**:
    - **Solana**: 支持高频低成本支付。
    - **Bitcoin**: 支持原生 BTC 转账。
    - **Tron (波场)**: **[新增]** 深度集成 TRC20-USDT 网络，支持高通量稳定币转账。
- **跨链桥接**: 集成 CCTP (Circle Cross-Chain Transfer Protocol) 和 Rango Exchange，实现无缝资产跨链。

### 4.5 Network Support Matrix (Technical Specification)

Protocol Banks currently supports the following networks with specific capabilities:

| Network | Chain ID | Type | Batch Payment Support | Contract Status |
|---------|----------|------|-----------------------|-----------------|
| **Ethereum** | 1 | EVM | ✅ Active | Verified (Disperse) |
| **Arbitrum One** | 42161 | EVM L2 | ✅ Active | Verified (Disperse) |
| **Base** | 8453 | EVM L2 | ✅ Active | Verified (Disperse) |
| **BNB Chain** | 56 | EVM | ✅ Active | Verified (Disperse) |
| **Polygon** | 137 | EVM L2 | ✅ Active | Verified (Disperse) |
| **Optimism** | 10 | EVM L2 | 🚧 Planned | Pending |
| **Solana** | - | SVM | 🚧 Planned | In Development |
| **HashKey** | 177 | EVM | 🚧 Planned | Pending |
| **Tron** | - | TVM | 🚧 Planned | In Development |

---

## 五、 产品功能 (Product Functions)

### 5.1 企业仪表板 (Enterprise Dashboard)

财务健康的指挥中心，具备以下核心能力：
-   **实时燃烧率 (Burn Rate)**: 自动计算组织的资金消耗速率。
-   **跑道估算 (Runway Estimation)**: 基于当前燃烧率预测资金可维持时长。
-   **跨链资产聚合**: 将分散在多条链上的资产统一展示为一个合并视图。
-   **预算与实际对比**: 可视化预算执行情况，及时发现偏差。

### 5.2 实体网络图 (Entity Network Graph)

**"太空扇区" (Sector Space)** 交互式图形可视化工具：
-   将原始交易列表转换为直观的关系网络图。
-   揭示资本在子公司、合作伙伴、供应商之间的流动路径。
-   支持按时间维度回放，分析资金流向变化趋势。
-   支持节点钻取 (Drill-down)，查看任意实体的详细交易记录。

### 5.3 批量支付引擎 (Batch Payment Engine)

多代币调度系统，每会话可路由数千笔交易：
-   **混合币种薪资**: 同时用 USDC 支付开发团队、用 USDT 支付市场团队。
-   **CSV 导入**: 支持从电子表格批量导入收款人和金额。
-   **审批流**: 多级审批机制，大额支付需 M/N 多签确认。
-   **失败重试**: 自动检测和重试失败交易，确保支付完整性。

### 5.4 订阅管理 (Subscription Management)

自动化的定期支付管理，支持：
-   **周期性扣款**: 支持日/周/月/年等灵活的扣款周期。
-   **金额动态调整**: 可根据用量或商户通知自动调整扣款金额。
-   **到期提醒**: 提前通知授权方即将到期的订阅。

### 5.5 发票系统 (Invoice System)

链上/链下集成的发票管理：
-   **链上锚定**: 发票摘要哈希上链存证，确保不可篡改。
-   **多币种支持**: 支持 ETH、USDC、USDT 等多币种结算。
-   **自动对账**: 发票支付后自动匹配交易与发票状态。

---

## 六、 安全架构

Protocol Banks 遵循**"零信任"**和**"非托管"**的安全原则。

### 6.1 资金安全
- **非托管模式**: 用户资金始终保留在自己的钱包或智能合约中，平台无法触碰用户资产。
- **多重签名**: 集成 Gnosis Safe (Safe) 协议，支持 M/N 多签审批流，适用于大额资金管理。
- **地址校验**: 强制执行 EIP-55 校验和检查，并集成防钓鱼地址库。

### 6.2 数据隐私
- **本地优先 (Local-First)**: 敏感的财务备注、供应商标签等元数据优先在本地加密存储。
- **行级安全 (RLS)**: 数据库层启用强制的 Row-Level Security，确保用户只能访问其授权范围内的数据。
- **隐私计算**: (路线图) 引入零知识证明 (ZK) 技术，实现交易金额和接收方的链上隐私保护。

### 6.3 风险控制
- **反洗钱 (AML) 筛查**: 集成 Chainalysis 预言机，自动拦截黑名单地址交易。
- **速率限制**: 针对异常高频的 API 调用和支付请求触发自动熔断机制。
- **审计日志**: 全链路操作留痕，支持不可篡改的链上/链下审计追踪。

### 6.4 密钥管理
- **Shamir 秘密共享**: 2-of-3 密钥分片，单点泄露不影响安全。
- **HashiCorp Vault**: 生产环境密钥托管。
- **密钥轮换**: 90 天强制密钥轮换策略。
- **零知识架构**: 平台永远不知道用户的完整私钥。

---

## 七、 技术栈详解

### 7.1 前端技术栈
| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 15.5.9 | 全栈框架 (App Router) |
| React | 19.x | UI 库 |
| TypeScript | 5.x | 类型安全 |
| Tailwind CSS | 4.x | 样式框架 |
| shadcn/ui | Latest | UI 组件库 |
| Framer Motion | Latest | 动画引擎 |
| viem / ethers | 2.x / 6.x | Web3 交互 |
| Reown AppKit | 1.3.3 | 钱包连接 |

### 7.2 后端技术栈
| 技术 | 版本 | 用途 |
|------|------|------|
| Go | 1.21 | 高性能微服务 (Payout Engine, Event Indexer) |
| gRPC | Latest | 服务间通信 |
| Prisma | 7 | Serverless ORM (pg adapter) |
| Supabase | Latest | 数据库 (PostgreSQL) + Auth + RLS |
| Redis | Latest | 队列/缓存 (Upstash) |
| Vercel Cron | Latest | 定时任务 |

### 7.3 基础设施
| 技术 | 用途 |
|------|------|
| Kubernetes | 容器编排 |
| Docker | 容器化 |
| Prometheus | 监控指标 |
| Grafana | 可视化仪表板 |
| HashiCorp Vault | 密钥管理 |

### 7.4 性能指标

| 指标 | 目标 | 当前 |
|------|------|------|
| 单笔支付延迟 | <3s | 2.1s |
| 批量支付 (100 笔) | <60s | 45s |
| API 响应时间 (p95) | <200ms | 180ms |
| Go 服务吞吐量 | 500+ TPS | 650 TPS |
| 系统可用性 | 99.9% | 99.95% |

---

## 八、 路线图 (Roadmap)

### 已完成
- [x] **Q4 2024** - 核心支付功能 (单笔支付、批量支付、多签)
- [x] **Q1 2025** - 多签钱包、AI Agent API、x402 协议
- [x] **Q2 2025** - 发票系统、POS 收单、供应商安全加固
- [x] **Q3 2025** - Prisma 迁移、Vercel Cron、多链余额仪表板
- [x] **Q4 2025** - Omnichain Vault、Session Keys、订阅 MCP
- [x] **Q1 2026** - Agent Link API、Settlement Checkout、HashKey Chain 集成

### 计划中
- [ ] **Q2 2026** - Tron TRC20 完整支持、移动端原生应用、法币出入金
- [ ] **Q3 2026** - 智能预算分析 (AI 驱动)、ZK 隐私支付
- [ ] **Q4 2026** - HSM 硬件安全模块、MSafe (Aptos) 集成

---

## 九、 联系方式 (Contact)

- **Website**: [protocolbanks.com](https://protocolbanks.com)
- **GitHub**: [github.com/everest-an/protocol-banks---web3](https://github.com/everest-an/protocol-banks---web3)
- **Email**: everest9812@gmail.com

---

**免责声明**: 本文档仅用于技术交流和项目介绍，不构成任何投资建议。Protocol Banks 作为技术服务提供方，不持有用户密钥，不对因用户私钥泄露或区块链网络故障导致的损失承担责任。
