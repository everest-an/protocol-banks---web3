这是一份供开发团队执行的 **ProtocolBanks 技术架构文档 (Technical Architecture Document \- TAD)**。

这份文档将之前的业务需求转化为具体的**工程实现方案**。它详细定义了 TypeScript (前端/网关) 与 Go (核心引擎) 的职责边界、数据库设计以及链上合约逻辑。

# ---

**ProtocolBanks Technical Architecture Document (TAD)**

**Version:** 1.0 (MVP)

**Date:** 2026-02-02

**Status:** Engineering Draft

## ---

**1\. 系统总体架构 (System Overview)**

本系统采用 **BFF (Backend for Frontend)** 模式与 **高性能微服务** 相结合的混合架构。

* **接入层 (TypeScript):** 处理用户交互、身份认证、参数校验。  
* **核心层 (Go):** 处理资金调度、高并发计费、链上交互、风控规则。  
* **基础设施层:** ZetaChain (全链合约)、PostgreSQL (持久化)、Redis (队列/缓存)。

### **架构拓扑图**

Code snippet

graph TD  
    User\[Web/App User\] \--\>|HTTPS| CDN\[Cloudflare\]  
    AI\_Agent\[AI Agent\] \--\>|HTTP 402| APIGateway

    subgraph "Application Layer (TypeScript)"  
        NextJS\[Next.js Client\] \--\>|API| NestJS\[NestJS API Gateway\]  
    end

    subgraph "Core Execution Layer (Go)"  
        NestJS \--\>|gRPC/NATS| PayoutEngine\[Payout Service\]  
        NestJS \--\>|gRPC/NATS| BillingEngine\[Billing Service\]  
        PayoutEngine \--\>|Events| PDFGen\[PDF Service\]  
        BillingEngine \--\>|Logs| Sentinel\[Sentinel Risk Engine\]  
    end

    subgraph "Persistence"  
        Postgres\[(PostgreSQL)\]  
        Redis\[(Redis Queue)\]  
    end

    subgraph "Blockchain & External"  
        Zeta\[ZetaChain Contracts\]  
        Rain\[Rain.xyz API\]  
        RPC\[Blockchain RPCs\]  
    end

    PayoutEngine \--\> Postgres  
    PayoutEngine \--\> Redis  
    PayoutEngine \--\> Zeta  
    PayoutEngine \--\> Rain  
    BillingEngine \--\> Redis

## ---

**2\. 技术栈详细选型 (Tech Stack Specifications)**

| 模块 | 技术选型 | 理由 |
| :---- | :---- | :---- |
| **Frontend** | **Next.js (React) \+ TailwindCSS** | SSR 利于 SEO，组件化开发 SDK 便于复用。 |
| **API Gateway** | **NestJS (TypeScript)** | 强类型 DTO 校验，作为 Go 引擎的“看门人”，处理 Auth 和限流。 |
| **Core Engine** | **Go (Golang)** | **关键决策。** 处理批量支付的高并发、Nonce 管理、二进制浮点数精度控制。 |
| **Smart Contract** | **Solidity (Foundry)** | 开发 ZetaChain 兼容的 ERC-4337 账户及 Session Key 模块。 |
| **Database** | **PostgreSQL** | 关系型数据（企业、员工、账单），支持 JSONB 存储复杂配置。 |
| **Queue/Cache** | **Redis** | 处理异步支付任务队列，存储实时汇率和 Session Key 状态。 |
| **Communication** | **gRPC / Protobuf** | TS 与 Go 之间的高性能通信协议，确保数据结构一致性。 |

## ---

**3\. 核心模块详细设计 (Component Design)**

### **3.1 模块 A：PB-Rail 批量支付引擎 (Payout Engine \- Go)**

这是系统的“心脏”，负责资金流转。

* **职责：**  
  1. 接收 NestJS 传来的批量支付请求（JSON 格式）。  
  2. **Nonce 管理器：** 在 Redis 中维护一个原子计数器，确保高并发下交易不卡死。  
  3. **Gas 估算器：** 动态获取 ZetaChain 的 Gas Price，防止交易失败。  
  4. **智能分片：** 如果一笔请求包含 500 个地址，自动拆分为 5 笔交易（每笔 100 个），并行发送。  
  5. **外部集成：** 调用 Rain API 处理法币出金逻辑。  
* **Go 代码结构建议：**  
  Go  
  /core-engine  
  ├── /cmd/payout-worker      \# 入口  
  ├── /internal  
  │   ├── /blockchain         \# 封装 abigen 生成的合约绑定  
  │   ├── /processor          \# 处理 Redis 队列的任务逻辑  
  │   ├── /rain\_client        \# Rain API 封装  
  │   └── /nonce\_manager      \# Redis Lua 脚本实现的 Nonce 锁  
  └── /pkg/proto              \# gRPC 定义

### **3.2 模块 B：PB-Guard 计费与授权引擎 (Billing Engine \- Go)**

这是系统的“收银台”，处理 AI Agent 的微支付。

* **职责：**  
  1. **Session Key 验证：** 验证请求签名是否有效，Key 是否过期。  
  2. **状态通道记账 (Off-chain Metering)：**  
     * 接收 API 调用日志。  
     * 在 Redis 中更新 usage\_count。  
     * 当 usage\_count \>= threshold 时，触发链上结算。  
  3. **Sentinel 风控 (Sentinel Service)：**  
     * 基于规则：IF calls\_per\_minute \> 100 THEN freeze\_key()。  
* **数据流：**  
  AI Agent 请求 \-\> NestJS 网关 (拦截) \-\> Go 验证签名 & 余额 \-\> 放行 \-\> Go 异步扣费。

### **3.3 模块 C：PB-Proof 审计服务 (Audit Service \- Go)**

* **职责：** 监听链上事件，生成凭证。  
* **实现：**  
  * 使用 Go 的 go-ethereum 库订阅 LogPayoutSuccess 事件。  
  * 使用 gofpdf 库，结合 HTML 模板生成 PDF。  
  * 将 PDF 上传至 S3/IPFS，并通过 SendGrid 发送邮件。

## ---

**4\. 数据库设计 (Database Schema \- PostgreSQL)**

我们采用**以企业为中心**的关系模型。

SQL

\-- 企业账户表  
CREATE TABLE organizations (  
    id UUID PRIMARY KEY,  
    name VARCHAR(255),  
    wallet\_address VARCHAR(42), \-- 企业的 AA 智能合约地址  
    kyc\_status VARCHAR(20)      \-- Rain/Transak KYC 状态  
);

\-- 员工/收款人表  
CREATE TABLE employees (  
    id UUID PRIMARY KEY,  
    org\_id UUID REFERENCES organizations(id),  
    wallet\_address VARCHAR(42),  
    email VARCHAR(255),  
    preferred\_currency VARCHAR(10), \-- 'USDT', 'BTC', 'USD'  
    split\_rule JSONB                \-- {"fiat": 20, "crypto": 80}  
);

\-- 支付流水表 (核心凭证)  
CREATE TABLE payouts (  
    id UUID PRIMARY KEY,  
    org\_id UUID,  
    tx\_hash VARCHAR(66),            \-- 链上哈希  
    rain\_ref\_id VARCHAR(100),       \-- 法币通道流水号  
    amount DECIMAL(20, 8),  
    token\_symbol VARCHAR(10),  
    status VARCHAR(20),             \-- 'PENDING', 'CONFIRMED', 'FAILED'  
    proof\_url TEXT,                 \-- PDF 下载链接  
    created\_at TIMESTAMP  
);

\-- 会话密钥表 (用于 AI 计费)  
CREATE TABLE session\_keys (  
    key\_hash VARCHAR(66) PRIMARY KEY,  
    org\_id UUID,  
    permissions JSONB,              \-- 允许调用的合约/API  
    daily\_limit DECIMAL,  
    current\_usage DECIMAL,  
    expires\_at TIMESTAMP,  
    is\_frozen BOOLEAN DEFAULT FALSE \-- Sentinel 风控状态  
);

## ---

**5\. 接口设计 (API & SDK Strategy)**

### **5.1 内部通信 (Internal API)**

使用 gRPC 定义 proto 文件，确保 TS 和 Go 对数据结构的理解一致。

Protocol Buffers

// payout.proto  
service PayoutService {  
  rpc BatchTransfer (BatchTransferRequest) returns (BatchTransferResponse);  
}

message BatchTransferRequest {  
  string org\_id \= 1;  
  repeated PaymentItem items \= 2; // 地址, 金额, 币种  
  string signature \= 3;           // 企业的 EIP-712 签名  
}

### **5.2 外部 SDK (Client SDK)**

发布 NPM 包 @protocolbanks/sdk，供 AI 公司集成。

* **Widget 组件 (React):**  
  TypeScript  
  \<ProtocolBanks.AuthButton   
     onSuccess={(sessionKey) \=\> console.log(sessionKey)}  
     limit="50 USDC"   
  /\>

* **Billing Client (Node.js):**  
  TypeScript  
  const client \= new PBClient({ apiKey: '...' });  
  // 中间件：自动验证 session key 并计费  
  app.use(client.expressMiddleware());

## ---

**6\. 安全与合规设计 (Security & Compliance)**

### **6.1 资金安全**

* **非托管原则：** Go 后端**从不**存储用户的私钥。只存储 EIP-712 签名数据，然后广播上链。  
* **重放攻击防护：** 所有 Payout 请求必须包含时间戳和一次性 Nonce，后端校验 timestamp \> now \- 5min。

### **6.2 智能合约安全**

* **Pull over Push:** 在分红/发薪合约中，优先使用“用户提款”模式或“限制 Gas 的转账”，防止恶意接收合约耗尽 Gas 导致批量交易失败。  
* **Safe 模块化:** 基于 Gnosis Safe 架构扩展，而不是重写多签逻辑。

### **6.3 基础设施安全**

* **IP 限制:** Go 核心引擎不直接暴露公网，只允许 API Gateway (NestJS) 的 IP 访问。  
* **速率限制:** API Gateway 实施基于 Redis 的 Rate Limiting (每分钟 1000 请求)。

## ---

**7\. 部署架构 (Infrastructure)**

鉴于团队规模，推荐 **Docker Compose (Dev)** \-\> **Kubernetes/K8s (Prod)** 的路线。

* **API Gateway (NestJS):** 部署 2 个 Pod，负载均衡。  
* **Go Engine:** 部署为 StatefulSet (因为涉及 Nonce 管理，最好单点写入或通过 Redis 锁控制)。  
* **Postgres/Redis:** 使用云服务商的托管服务 (AWS RDS / ElastiCache) 以减少运维成本。

---

这份文档不仅定义了“做什么”，还定义了“用什么做”和“怎么做”。它充分利用了 **TypeScript 的开发效率** 和 **Go 的并发稳定性**，是三人团队在 2 个月内交付 MVP 的最佳技术蓝图。