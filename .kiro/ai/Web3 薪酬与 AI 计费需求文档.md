这份文档是基于我们之前所有讨论的结晶。它将 **“Web3 企业薪酬 (Payroll)”** 的刚需业务与 **“AI 代理计费 (Agent Billing)”** 的前沿架构完美融合，形成了一份逻辑严密、可执行、且适合三人团队落地的 **客户需求文档 (CRD)**。

你可以直接使用这份文档作为内部开发的“圣经”，或作为向投资人展示你宏大构想的“蓝图”。

# ---

**ProtocolBanks Customer Requirements Document (CRD)**

**项目名称：** ProtocolBanks Intelligent Financial Infrastructure

**版本号：** 1.0 (MVP & V2 Vision)

**日期：** 2026-02-02

**核心定位：** 基于全链架构 (Omnichain) 的下一代企业薪酬与 AI 代理计费基础设施

## ---

**1\. 执行摘要 (Executive Summary)**

ProtocolBanks 旨在解决 Web3 经济中的两大核心痛点：

1. **企业端：** 跨链薪酬发放繁琐、法币出金困难、合规凭证缺失。  
2. **开发者/AI端：** 缺乏原生的流支付、微支付及动态计费基础设施。

我们通过构建一套 **5层金融协议栈 (L1-L5)**，利用账户抽象 (AA)、ZetaChain 跨链技术及 HTTP 402 协议，打造一个**非托管、可编程、全链互通**的商业操作系统。

## ---

**2\. 目标客户画像 (User Personas)**

| 用户代号 | 角色 | 核心痛点 (Pain Points) | 我们的解决方案 |
| :---- | :---- | :---- | :---- |
| **Persona A** | **Web3 CFO / DAO 财务** | 每月发工资需要手动操作 50 次；无法处理员工想要 BTC/法币的需求；害怕审计。 | **PB-Rail 批量支付：** 一键多币种分发，自动生成合规报表。 |
| **Persona B** | **Web3 员工 / 远程开发者** | 收到 USDT 后需要繁琐的操作才能变成生活费；跨链转账 Gas 费高。 | **PB-Stream 自动分流：** 工资自动拆分，法币直达银行卡。 |
| **Persona C** | **AI 服务商 / DePIN 项目方** | 无法按秒/按量收费；订阅制门槛高导致转化率低；担心 API 被刷爆。 | **PB-Guard 计费 SDK：** 会话密钥授权，按量微支付，AI 哨兵风控。 |

## ---

**3\. 产品架构：5层协议栈 (The 5-Layer Stack)**

我们将复杂的金融逻辑封装为五个标准化模块，对外提供 SDK 与 SaaS 服务：

* **L1 身份层 (PB-Link):** 统一的链上身份认证 (DID/Wallet Connect)。  
* **L2 授权层 (PB-Guard):** 基于账户抽象的权限管理 (Session Keys, Multi-sig)。  
* **L3 通信层 (PB-Stream):** 基于 HTTP 402 的流支付与发票协议。  
* **L4 支付层 (PB-Rail):** 基于 ZetaChain 与 Rain 的全链资金结算轨道。  
* **L5 审计层 (PB-Proof):** 基于 ZKP 与链上哈希的司法级存证。

## ---

**4\. 详细功能需求 (Functional Requirements)**

### **模块一：企业薪酬 SaaS (Payroll & Treasury)**

*优先级：P0 (生存基石)*

#### **1.1 全链批量支付 (Omnichain Batch Payouts)**

* **需求描述：** 财务只需持有一种代币 (如 ETH)，即可向全球员工发放任意代币 (BTC, SOL, USDC) 或法币。  
* **核心功能：**  
  * **智能路由 (Smart Routing):** 后端 (Go) 自动计算最优跨链路径，通过 ZetaChain 合约执行。  
  * **法币通道 (Fiat Rails):** 集成 **Rain/Transak** API，支持将薪资直接结算至员工 IBAN/Visa 卡。  
  * **原子性执行:** 批量交易要么全部成功，要么全部失败并退款，杜绝资金丢失。

#### **1.2 智能薪资分流 (Salary Streaming/Splitting)**

* **需求描述：** 员工可自定义薪资接收规则，无需人工干预。  
* **核心功能：**  
  * **规则引擎:** 员工设置 "20% \-\> Bank Account (via Rain)", "30% \-\> BTC Wallet", "50% \-\> Savings Protocol"。  
  * **自动化执行:** 每次发薪时，合约自动按比例拆分资金流。

#### **1.3 合规审计报表 (Compliance & Proof)**

* **需求描述：** 企业需要应对税务审查和融资尽调。  
* **核心功能：**  
  * **PDF 生成器:** 每次支付后，自动生成包含 Tx Hash、法币对标金额、时间戳的 PDF 工资单。  
  * **链上存证:** 关键交易元数据 (Metadata) 上链，确保不可篡改。

### ---

**模块二：AI 与开发者计费 SDK (Billing & Subscription)**

*优先级：P1 (增长引擎)*

#### **2.1 会话密钥授权 (Session Key Authorization \- PB-Guard)**

* **需求描述：** AI Agent 或 DePIN 用户需要一种“免密支付”体验，同时保证资金安全。  
* **核心功能：**  
  * **临时授权:** 用户签名生成一个 Session Key，限制：*有效期 24h*，*总限额 50 U*，*仅限交互特定合约*。  
  * **静默扣款:** 在限额内，AI 调用 API 时无需再次弹窗签名。

#### **2.2 微支付网关 (Micro-Meter SDK \- PB-Stream)**

* **需求描述：** 服务商需要按 Token 或按时长 (秒) 收费。  
* **核心功能：**  
  * **HTTP 402 拦截器:** 中间件拦截 API 请求，验证 Session Key 余额。  
  * **状态通道记账:** 链下累积微小金额 (0.001 U)，达到阈值 (10 U) 后自动上链结算，节省 Gas。

#### **2.3 AI 哨兵风控 (Sentinel AI)**

* **需求描述：** 防止 Session Key 被盗用或 AI 程序死循环导致费用激增。  
* **核心功能：**  
  * **熔断机制 (Circuit Breaker):** 基于 Go 规则引擎，监测调用频率 (QPS) 和金额斜率。异常时自动冻结权限。  
  * **异常警报:** 通过 Webhook 或 Telegram 推送风险通知。

## ---

**5\. 技术规格 (Technical Specifications)**

### **5.1 前端 (TypeScript / Next.js)**

* **B2B Dashboard:** 极简风格，重点展示资产看板、员工列表、支付记录。  
* **Embeddable Widget:** 供 AI 公司集成的“连接钱包与授权”组件 (React/Vue)。

### **5.2 后端核心 (Go / Golang)**

* **Payout Engine:** 高并发任务队列，处理批量转账的 Nonce 排序与重试机制。  
* **Billing Monitor:** 高性能日志监听器，处理微支付记账与风控规则匹配。  
* **API Gateway:** 统一 REST/gRPC 接口，对外提供标准化的 SDK 调用能力。

### **5.3 区块链层 (Solidity / ZetaChain)**

* **Master Vault Contract:** 企业的 AA 智能主账户。  
* **Splitter Contract:** 处理资金分流逻辑。  
* **Session Key Validator:** 验证签名权限的链上逻辑。

## ---

**6\. 非功能性需求 (Non-Functional Requirements)**

1. **安全性 (Security):**  
   * 所有智能合约必须经过审计（初期可使用 Safe 的成熟模块）。  
   * 非托管架构：ProtocolBanks 永远不持有用户私钥。  
2. **合规性 (Compliance):**  
   * 法币出入金必须通过持牌伙伴 (Rain/Transak) 进行 KYC/KYB。  
   * 系统需通过 IP 封锁限制受制裁地区访问。  
3. **性能 (Performance):**  
   * 批量支付引擎需支持单次处理 500+ 地址。  
   * 微支付网关响应延迟需 \< 200ms。

## ---

**7\. 开发与落地路线图 (Roadmap for 3-Person Team)**

| 阶段 | 时间周期 | 核心目标 | 交付物 |
| :---- | :---- | :---- | :---- |
| **Phase 1: MVP (生存)** | Month 1-2 | 跑通企业发薪流程，获得现金流 | \- 全链批量支付 (PB-Rail) \- PDF 工资单 (PB-Proof) \- 简单的多签管理 |
| **Phase 2: Growth (差异化)** | Month 3-4 | 上线计费 SDK，拓展 AI/DePIN 客户 | \- 会话密钥组件 (PB-Guard) \- 微支付记账后端 (Go) \- 基础风控规则 |
| **Phase 3: Scale (生态)** | Month 5+ | 完善全栈，建立数据壁垒 | \- AI 哨兵模型 (Sentinel) \- 开放 API 市场 \- 移动端 App |

### ---

**附录：核心术语表**

* **AA (Account Abstraction):** 账户抽象，智能合约钱包技术。  
* **Session Key:** 会话密钥，用于临时授权的受限私钥。  
* **x402:** 基于 HTTP 402 Payment Required 的扩展协议。  
* **Omnichain:** 全链，指无需传统跨链桥即可操作多链资产的能力 (基于 ZetaChain)。