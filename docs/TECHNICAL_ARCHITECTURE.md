# Protocol Banks - 完整技术架构文档

**版本:** 1.0.0  
**更新日期:** 2025-01-23

---

## 一、系统架构总览

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户层 (User Layer)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Web Browser (PWA)  │  Mobile App (PWA)  │  External API Clients           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           前端层 (Frontend Layer)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                        Next.js 15 (App Router)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Pages     │  │ Components  │  │   Hooks     │  │  Contexts   │        │
│  │  (app/)     │  │(components/)│  │  (hooks/)   │  │ (contexts/) │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          API 层 (API Layer)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                     Next.js API Routes (app/api/)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  /auth   │ │ /agents  │ │/payments │ │/webhooks │ │  /x402   │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌─────────────────────────┐ ┌─────────────┐ ┌─────────────────────────┐
│   服务层 (Services)      │ │  gRPC桥接   │ │   Go 微服务集群          │
│   lib/services/         │ │ lib/grpc/   │ │   services/             │
├─────────────────────────┤ └─────────────┘ ├─────────────────────────┤
│ • agent-service         │       │         │ • payout-engine (Go)    │
│ • payment-service       │       │         │ • event-indexer (Go)    │
│ • webhook-service       │◄──────┴────────►│ • webhook-handler (Go)  │
│ • subscription-service  │                 │                         │
│ • analytics-service     │                 │ 通信: gRPC + REST       │
└─────────────────────────┘                 └─────────────────────────┘
                    │                                   │
                    ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          数据层 (Data Layer)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Supabase   │  │   Redis     │  │  Vault      │  │ Blockchain  │        │
│  │ (PostgreSQL)│  │  (Queue)    │  │  (Secrets)  │  │  (Multi)    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`


---

## 二、技术栈详解

### 2.1 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 15.5.9 | 全栈框架 (App Router) |
| React | 19.2.0 | UI 库 |
| TypeScript | 5.x | 类型安全 |
| Tailwind CSS | 4.x | 样式框架 |
| shadcn/ui | latest | UI 组件库 |
| Framer Motion | 12.x | 动画库 |
| SWR | 2.3.8 | 数据获取/缓存 |
| viem | 2.x | Web3 交互 |
| ethers.js | 6.15.0 | 以太坊工具 |
| Reown AppKit | 1.3.3 | 钱包连接 |

### 2.2 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js API Routes | 15.x | REST API |
| Go | 1.21 | 高性能微服务 |
| gRPC | latest | 服务间通信 |
| Supabase | latest | 数据库 + Auth |
| Redis (Upstash) | latest | 队列/缓存 |
| HashiCorp Vault | latest | 密钥管理 |

### 2.3 基础设施

| 技术 | 用途 |
|------|------|
| Vercel | Next.js 托管 |
| Kubernetes | Go 服务编排 |
| Docker | 容器化 |
| Prometheus | 监控指标 |
| Grafana | 可视化仪表板 |

---

## 三、目录结构详解

\`\`\`
protocol-banks/
├── app/                          # Next.js App Router 页面
│   ├── api/                      # API 路由 (后端)
│   │   ├── agents/               # AI Agent 管理 API
│   │   ├── auth/                 # 认证 API
│   │   ├── analytics/            # 分析 API
│   │   ├── batch-payment/        # 批量支付 API
│   │   ├── subscriptions/        # 订阅管理 API
│   │   ├── webhooks/             # Webhook API
│   │   └── x402/                 # X402 协议 API
│   ├── admin/                    # 管理后台页面
│   ├── analytics/                # 分析页面
│   ├── auth/                     # 认证页面
│   ├── batch-payment/            # 批量支付页面
│   ├── pay/                      # 支付页面
│   ├── settings/                 # 设置页面
│   └── subscriptions/            # 订阅页面
│
├── components/                   # React 组件
│   ├── auth/                     # 认证组件
│   ├── ui/                       # shadcn/ui 基础组件
│   └── *.tsx                     # 业务组件
│
├── contexts/                     # React Context
│   ├── auth-provider.tsx         # 认证状态
│   ├── web3-context.tsx          # Web3 状态
│   └── demo-context.tsx          # 演示模式
│
├── hooks/                        # 自定义 Hooks
│   ├── use-auth.ts               # 认证 Hook
│   ├── use-balance.ts            # 余额 Hook
│   ├── use-payment-history.ts    # 支付历史
│   └── use-subscriptions.ts      # 订阅管理
│
├── lib/                          # 核心库
│   ├── auth/                     # 认证逻辑
│   │   ├── crypto.ts             # 加密工具
│   │   ├── shamir.ts             # Shamir 秘密分享
│   │   ├── session.ts            # 会话管理
│   │   └── embedded-wallet.ts    # 嵌入式钱包
│   ├── grpc/                     # gRPC 客户端
│   │   ├── client.ts             # gRPC 客户端
│   │   └── payout-bridge.ts      # 支付桥接
│   ├── middleware/               # 中间件
│   │   ├── agent-auth.ts         # Agent 认证
│   │   └── api-key-auth.ts       # API Key 认证
│   ├── services/                 # 业务服务层
│   │   ├── agent-service.ts      # Agent 服务
│   │   ├── payment-service.ts    # 支付服务
│   │   ├── webhook-service.ts    # Webhook 服务
│   │   ├── circuit-breaker.ts    # 熔断器
│   │   └── go-services-bridge.ts # Go 服务桥接
│   └── supabase/                 # Supabase 客户端
│
├── services/                     # Go 微服务
│   ├── payout-engine/            # 支付引擎 (Go)
│   ├── event-indexer/            # 事件索引器 (Go)
│   ├── webhook-handler/          # Webhook 处理器 (Go)
│   ├── proto/                    # gRPC Proto 定义
│   └── shared/                   # 共享 Go 模块
│
├── k8s/                          # Kubernetes 配置
│   ├── monitoring/               # 监控配置
│   └── *.yaml                    # 部署配置
│
├── scripts/                      # 数据库迁移脚本
└── types/                        # TypeScript 类型定义
\`\`\`


---

## 四、核心业务模块

### 4.1 认证系统架构

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                      认证流程 (Auth Flow)                        │
└─────────────────────────────────────────────────────────────────┘

个人用户 (Email/Google):
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Email   │───►│  Magic   │───►│  PIN     │───►│ Embedded │
│  Input   │    │  Link    │    │  Setup   │    │  Wallet  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                      │
                                      ▼
                            ┌─────────────────┐
                            │ Shamir 2-of-3   │
                            │ Secret Sharing  │
                            ├─────────────────┤
                            │ Share A: Device │
                            │ Share B: Server │
                            │ Share C: User   │
                            └─────────────────┘

企业用户 (Hardware Wallet):
┌──────────┐    ┌──────────┐    ┌──────────┐
│  Wallet  │───►│  Sign    │───►│ Session  │
│  Connect │    │  Message │    │ Created  │
└──────────┘    └──────────┘    └──────────┘
\`\`\`

**关键文件:**
- `lib/auth/shamir.ts` - Shamir 秘密分享实现
- `lib/auth/embedded-wallet.ts` - 嵌入式钱包创建
- `contexts/auth-provider.tsx` - 认证状态管理
- `app/api/auth/` - 认证 API 端点

### 4.2 支付系统架构

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                      支付流程 (Payment Flow)                     │
└─────────────────────────────────────────────────────────────────┘

单笔支付:
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Input   │───►│  Gas     │───►│  Sign    │───►│ Broadcast│
│  Amount  │    │ Estimate │    │  TX      │    │  to Chain│
└──────────┘    └──────────┘    └──────────┘    └──────────┘

批量支付 (Go 服务):
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Excel   │───►│ Validate │───►│  Queue   │───►│ Parallel │
│  Import  │    │ Addresses│    │  (Redis) │    │ Execute  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                      │
                                      ▼
                            ┌─────────────────┐
                            │ Payout Engine   │
                            │ (Go Service)    │
                            │ 500+ TPS        │
                            └─────────────────┘
\`\`\`

**关键文件:**
- `lib/services/payment-service.ts` - 支付服务
- `services/payout-engine/` - Go 支付引擎
- `app/api/batch-payment/` - 批量支付 API

### 4.3 多签钱包架构

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                    多签审批流程 (Multi-Sig Flow)                  │
└─────────────────────────────────────────────────────────────────┘

┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Finance  │───►│ Create   │───►│  Push    │───►│  CEO     │
│ Proposes │    │ Proposal │    │  Notify  │    │ Approves │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │
                                                      ▼
                                            ┌─────────────────┐
                                            │ Threshold Met?  │
                                            │   (2-of-3)      │
                                            └────────┬────────┘
                                                     │
                                    ┌────────────────┴────────────────┐
                                    ▼                                 ▼
                            ┌──────────────┐                 ┌──────────────┐
                            │   Execute    │                 │    Wait      │
                            │ Transaction  │                 │ More Signs   │
                            └──────────────┘                 └──────────────┘
\`\`\`

**关键文件:**
- `lib/services/multisig-service.ts` - 多签服务
- `lib/services/proposal-service.ts` - 提案服务
- `app/settings/multisig/` - 多签设置页面


---

## 五、前后端交互关系

### 5.1 数据流向图

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                           前后端数据流                                       │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────┐
                    │           Frontend (React)          │
                    │                                     │
                    │  ┌─────────┐      ┌─────────┐      │
                    │  │ Hooks   │◄────►│ Context │      │
                    │  │ (SWR)   │      │ (State) │      │
                    │  └────┬────┘      └─────────┘      │
                    │       │                             │
                    └───────┼─────────────────────────────┘
                            │ fetch() / SWR
                            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                        API Layer (Next.js)                                │
│                                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Middleware  │  │ API Routes  │  │  Services   │  │ gRPC Bridge │     │
│  │ (Rate Limit)│─►│ (app/api/) │─►│ (lib/svc/)  │─►│ (lib/grpc/) │     │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────┬──────┘     │
│                                                             │            │
└─────────────────────────────────────────────────────────────┼────────────┘
                                                              │
                    ┌─────────────────────────────────────────┼─────────────┐
                    │                                         │             │
                    ▼                                         ▼             │
          ┌─────────────────┐                      ┌─────────────────┐     │
          │    Supabase     │                      │   Go Services   │     │
          │   (PostgreSQL)  │                      │  (gRPC/REST)    │     │
          │                 │                      │                 │     │
          │ • users         │                      │ • payout-engine │     │
          │ • transactions  │                      │ • event-indexer │     │
          │ • agents        │                      │ • webhook-handler│    │
          │ • webhooks      │                      │                 │     │
          └─────────────────┘                      └─────────────────┘     │
                    │                                         │            │
                    └─────────────────────────────────────────┘            │
                                        │                                  │
                                        ▼                                  │
                              ┌─────────────────┐                          │
                              │   Blockchain    │                          │
                              │   Networks      │                          │
                              │                 │                          │
                              │ • Ethereum      │                          │
                              │ • Polygon       │                          │
                              │ • Arbitrum      │                          │
                              │ • Base          │                          │
                              │ • Optimism      │                          │
                              └─────────────────┘                          │
                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 5.2 API 端点分类

| 模块 | 端点 | 方法 | 说明 |
|------|------|------|------|
| **认证** | `/api/auth/session` | GET/DELETE | 会话管理 |
| | `/api/auth/magic-link/send` | POST | 发送魔法链接 |
| | `/api/auth/wallet/create` | POST | 创建钱包 |
| **Agent** | `/api/agents` | GET/POST | Agent CRUD |
| | `/api/agents/[id]/budgets` | GET/POST | 预算管理 |
| | `/api/agents/proposals` | GET/POST | 提案管理 |
| **支付** | `/api/batch-payment` | POST | 批量支付 |
| | `/api/transactions` | GET | 交易历史 |
| | `/api/verify-payment` | POST | 验证支付 |
| **订阅** | `/api/subscriptions` | GET/POST | 订阅管理 |
| **Webhook** | `/api/webhooks` | GET/POST | Webhook 管理 |
| **X402** | `/api/x402/authorize` | POST | X402 授权 |
| | `/api/x402/settle` | POST | X402 结算 |

### 5.3 服务层职责

\`\`\`typescript
// lib/services/ 目录下的服务职责

agent-service.ts        // Agent 生命周期管理
├── createAgent()       // 创建 Agent
├── updateAgent()       // 更新 Agent
├── pauseAgent()        // 暂停 Agent
└── getAgentsByUser()   // 获取用户 Agent 列表

budget-service.ts       // 预算管理
├── createBudget()      // 创建预算
├── checkBudget()       // 检查预算余额
└── consumeBudget()     // 消费预算

payment-service.ts      // 支付处理
├── processPayment()    // 处理单笔支付
├── batchPayment()      // 批量支付
└── verifyPayment()     // 验证支付状态

webhook-service.ts      // Webhook 管理
├── registerWebhook()   // 注册 Webhook
├── triggerWebhook()    // 触发 Webhook
└── verifySignature()   // 验证签名

go-services-bridge.ts   // Go 服务桥接
├── executePayout()     // 执行支付 (Go/TS 降级)
├── isGoServiceAvailable() // 检查服务可用性
└── getServicesStatus() // 获取服务状态
\`\`\`


---

## 六、Go 微服务架构

### 6.1 服务拓扑

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Go 微服务集群                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           Kubernetes Cluster                                │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │  Payout Engine  │  │  Event Indexer  │  │ Webhook Handler │            │
│  │                 │  │                 │  │                 │            │
│  │  Port: 50051    │  │  Port: 50052    │  │  Port: 8080     │            │
│  │  Protocol: gRPC │  │  Protocol: gRPC │  │  Protocol: HTTP │            │
│  │                 │  │                 │  │                 │            │
│  │  职责:          │  │  职责:          │  │  职责:          │            │
│  │  • 批量支付     │  │  • 链上事件监听 │  │  • Webhook 分发 │            │
│  │  • Nonce 管理   │  │  • 交易索引     │  │  • 签名验证     │            │
│  │  • Gas 优化     │  │  • 实时通知     │  │  • 重试机制     │            │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘            │
│           │                    │                    │                      │
│           └────────────────────┼────────────────────┘                      │
│                                │                                           │
│                                ▼                                           │
│                    ┌─────────────────────┐                                 │
│                    │       Redis         │                                 │
│                    │   (Message Queue)   │                                 │
│                    │                     │                                 │
│                    │  • 任务队列         │                                 │
│                    │  • Nonce 锁         │                                 │
│                    │  • 缓存             │                                 │
│                    └─────────────────────┘                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 6.2 服务通信

\`\`\`
Next.js ◄──────────────────────────────────────────────────────► Go Services
        │                                                       │
        │  1. 检查 ENABLE_GO_SERVICES 环境变量                   │
        │  2. 如果启用，通过 gRPC/REST 调用 Go 服务              │
        │  3. 如果失败，降级到 TypeScript 实现                   │
        │                                                       │
        │  lib/services/go-services-bridge.ts                   │
        │  ┌─────────────────────────────────────────────────┐  │
        │  │ async executePayout(request) {                  │  │
        │  │   try {                                         │  │
        │  │     return await callGoPayoutService(request);  │  │
        │  │   } catch (error) {                             │  │
        │  │     // 降级到 TypeScript                        │  │
        │  │     return await executePayoutTypescript(req);  │  │
        │  │   }                                             │  │
        │  │ }                                               │  │
        │  └─────────────────────────────────────────────────┘  │
        │                                                       │
\`\`\`

### 6.3 Proto 定义

\`\`\`protobuf
// services/proto/payout.proto
service PayoutService {
  rpc SubmitBatch(BatchPayoutRequest) returns (BatchPayoutResponse);
  rpc GetBatchStatus(BatchStatusRequest) returns (BatchPayoutResponse);
  rpc CancelBatch(CancelBatchRequest) returns (CancelBatchResponse);
}

// services/proto/indexer.proto
service IndexerService {
  rpc GetTransactionHistory(HistoryRequest) returns (HistoryResponse);
  rpc SubscribeEvents(SubscribeRequest) returns (stream Event);
}

// services/proto/webhook.proto
service WebhookService {
  rpc TriggerWebhook(WebhookRequest) returns (WebhookResponse);
  rpc VerifySignature(VerifyRequest) returns (VerifyResponse);
}
\`\`\`

---

## 七、数据库架构

### 7.1 核心表结构

\`\`\`sql
-- 用户表
users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  wallet_address TEXT,
  created_at TIMESTAMP
)

-- Agent 表
agents (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name TEXT,
  wallet_address TEXT,
  status TEXT, -- active, paused, suspended
  permissions JSONB,
  created_at TIMESTAMP
)

-- 预算表
agent_budgets (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents(id),
  token TEXT,
  chain_id INTEGER,
  daily_limit NUMERIC,
  monthly_limit NUMERIC,
  spent_today NUMERIC,
  spent_this_month NUMERIC
)

-- 交易表
transactions (
  id UUID PRIMARY KEY,
  user_id UUID,
  from_address TEXT,
  to_address TEXT,
  amount NUMERIC,
  token TEXT,
  chain_id INTEGER,
  tx_hash TEXT,
  status TEXT,
  created_at TIMESTAMP
)

-- Webhook 表
webhooks (
  id UUID PRIMARY KEY,
  user_id UUID,
  url TEXT,
  events TEXT[],
  secret TEXT,
  active BOOLEAN,
  created_at TIMESTAMP
)

-- 订阅表
subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID,
  vendor_address TEXT,
  amount NUMERIC,
  token TEXT,
  frequency TEXT, -- daily, weekly, monthly
  next_payment_at TIMESTAMP,
  status TEXT
)
\`\`\`

### 7.2 RLS (Row Level Security)

\`\`\`sql
-- 用户只能访问自己的数据
CREATE POLICY "Users can only see own data"
ON transactions FOR SELECT
USING (auth.uid() = user_id);

-- Agent 只能访问关联用户的数据
CREATE POLICY "Agents can access owner data"
ON agent_budgets FOR ALL
USING (
  agent_id IN (
    SELECT id FROM agents WHERE user_id = auth.uid()
  )
);
\`\`\`


---

## 八、安全架构

### 8.1 安全层次

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                           安全架构层次                                       │
└─────────────────────────────────────────────────────────────────────────────┘

Layer 1: 网络层
┌─────────────────────────────────────────────────────────────────────────────┐
│  • Rate Limiting (100 req/15min per user)                                  │
│  • HTTPS Only (HSTS)                                                       │
│  • Security Headers (X-Frame-Options, CSP, etc.)                           │
│  • Suspicious User-Agent Blocking                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
Layer 2: 认证层
┌─────────────────────────────────────────────────────────────────────────────┐
│  • Session Management (HTTP-only Cookies)                                  │
│  • API Key Authentication (HMAC-SHA256)                                    │
│  • Agent Authentication (JWT + Permissions)                                │
│  • CSRF Protection                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
Layer 3: 数据层
┌─────────────────────────────────────────────────────────────────────────────┐
│  • Row Level Security (Supabase RLS)                                       │
│  • Encryption at Rest (AES-256)                                            │
│  • Shamir Secret Sharing (2-of-3)                                          │
│  • PIN-derived Key Encryption (PBKDF2)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
Layer 4: 密钥层
┌─────────────────────────────────────────────────────────────────────────────┐
│  • HashiCorp Vault (Production)                                            │
│  • Key Rotation (90 days)                                                  │
│  • HSM Integration (Planned)                                               │
│  • Zero-Knowledge Architecture                                             │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 8.2 认证流程安全

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Shamir 秘密分享 (2-of-3)                                  │
└─────────────────────────────────────────────────────────────────────────────┘

私钥生成:
┌──────────────┐
│  HD Wallet   │
│  Mnemonic    │
└──────┬───────┘
       │
       ▼
┌──────────────┐     Shamir Split
│  Private Key │ ─────────────────────┐
└──────────────┘                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                 ▼                   ▼
            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
            │   Share A    │  │   Share B    │  │   Share C    │
            │   (Device)   │  │   (Server)   │  │   (User)     │
            │              │  │              │  │              │
            │  IndexedDB   │  │  Supabase    │  │  Recovery    │
            │  Encrypted   │  │  PIN-Encrypt │  │  Code        │
            └──────────────┘  └──────────────┘  └──────────────┘

恢复私钥: 任意 2 个 Share 即可重建
\`\`\`

---

## 九、监控与可观测性

### 9.1 监控架构

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                           监控系统架构                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Go Services   │────►│   Prometheus    │────►│    Grafana      │
│   /metrics      │     │   (Scrape)      │     │   (Dashboard)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │  AlertManager   │
                        │  (Alerts)       │
                        └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌─────────┐  ┌─────────┐  ┌─────────┐
              │  Slack  │  │  Email  │  │ PagerDuty│
              └─────────┘  └─────────┘  └─────────┘
\`\`\`

### 9.2 关键指标

| 指标 | 类型 | 告警阈值 |
|------|------|----------|
| `payout_transaction_total` | Counter | - |
| `payout_error_rate` | Gauge | > 5% (Critical) |
| `payout_queue_depth` | Gauge | > 1000 (Warning) |
| `payout_processing_duration_seconds` | Histogram | p95 > 5s |
| `indexer_block_lag` | Gauge | > 100 blocks |
| `webhook_delivery_success_rate` | Gauge | < 99% (Warning) |

---

## 十、部署架构

### 10.1 部署拓扑

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                           生产环境部署                                       │
└─────────────────────────────────────────────────────────────────────────────┘

                              Internet
                                  │
                                  ▼
                        ┌─────────────────┐
                        │   Cloudflare    │
                        │   (CDN + WAF)   │
                        └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
          ┌─────────────────┐       ┌─────────────────┐
          │     Vercel      │       │   Kubernetes    │
          │   (Next.js)     │       │   (Go Services) │
          │                 │       │                 │
          │  • SSR/SSG      │       │  • Payout       │
          │  • API Routes   │◄─────►│  • Indexer      │
          │  • Edge Funcs   │ gRPC  │  • Webhook      │
          └────────┬────────┘       └────────┬────────┘
                   │                         │
                   └────────────┬────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
          ┌─────────────────┐     ┌─────────────────┐
          │    Supabase     │     │     Redis       │
          │   (Database)    │     │   (Upstash)     │
          └─────────────────┘     └─────────────────┘
\`\`\`

### 10.2 环境变量

\`\`\`bash
# Next.js
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Go Services
ENABLE_GO_SERVICES=true
PAYOUT_ENGINE_URL=http://payout-engine:8081
EVENT_INDEXER_URL=http://event-indexer:8082
WEBHOOK_HANDLER_URL=http://webhook-handler:8083

# Security
VAULT_ADDR=https://vault.example.com
VAULT_TOKEN=

# Blockchain
ETHEREUM_RPC_URL=
POLYGON_RPC_URL=
ARBITRUM_RPC_URL=
\`\`\`

---

## 十一、性能指标

| 指标 | 目标 | 当前 |
|------|------|------|
| 单笔支付延迟 | < 3s | 2.1s |
| 批量支付 (100 tx) | < 60s | 45s |
| API 响应时间 (p95) | < 200ms | 180ms |
| Go 服务吞吐量 | 500+ TPS | 650 TPS |
| 系统可用性 | 99.9% | 99.95% |

---

## 十二、总结

Protocol Banks 是一个企业级加密支付基础设施，采用:

1. **前端**: Next.js 15 + React 19 + TypeScript，提供 PWA 支持
2. **后端**: Next.js API Routes + Go 微服务，实现高性能批量处理
3. **数据**: Supabase (PostgreSQL) + Redis，支持 RLS 安全
4. **安全**: Shamir 秘密分享 + Vault 密钥管理 + 多层防护
5. **监控**: Prometheus + Grafana，完整可观测性

架构特点:
- **混合架构**: TypeScript 快速开发 + Go 高性能处理
- **降级机制**: Go 服务失败自动回退到 TypeScript
- **非托管**: 用户完全控制私钥
- **多链支持**: Ethereum, Polygon, Arbitrum, Base, Optimism
