
# ProtocolBanks 集成架构计划

## 概述

本文档详细描述三个核心集成模块的技术架构和实施计划：
1. **Coinbase CDP Facilitator** - 支付结算基础设施 ✅ 已完成
2. **MCP Server 支持** - AI Agent 订阅付款 ✅ 已完成
3. **API Monetizer** - API 变现中间件 ✅ 已完成

**所有三个阶段已完成实施！**

---

## 一、整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ProtocolBanks 平台                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   官网      │    │    SDK      │    │  MCP Server │    │ API         │  │
│  │  /pay       │    │ TypeScript  │    │   支持      │    │ Monetizer   │  │
│  │  /receive   │    │ Python/Go   │    │             │    │             │  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│         │                  │                  │                  │         │
│         └──────────────────┴──────────────────┴──────────────────┘         │
│                                    │                                        │
│                        ┌───────────▼───────────┐                           │
│                        │   x402 Core Service   │                           │
│                        │  (统一支付处理层)      │                           │
│                        └───────────┬───────────┘                           │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
           ┌────────▼────────┐ ┌─────▼─────┐ ┌───────▼───────┐
           │ CDP Facilitator │ │  自建     │ │   其他        │
           │ (Coinbase)      │ │  Relayer  │ │  Facilitator  │
           │ Base 链免费     │ │  (备用)   │ │  (扩展)       │
           └────────┬────────┘ └─────┬─────┘ └───────┬───────┘
                    │                │                │
                    └────────────────┼────────────────┘
                                     │
                            ┌────────▼────────┐
                            │   Blockchain    │
                            │  Base/Ethereum  │
                            │  Polygon/etc    │
                            └─────────────────┘
```


---

## 二、Coinbase CDP Facilitator 集成

### 2.1 什么是 Facilitator？

Facilitator 是 x402 协议中的可选但推荐的服务，负责：
- **验证支付**: 确认客户端的支付 payload 符合服务器的要求
- **结算支付**: 代表服务器将支付提交到区块链
- **返回结果**: 向服务器返回验证和结算结果

**Coinbase CDP Facilitator 优势**:
- ✅ Base 链上 USDC 支付**完全免费**（0 手续费）
- ✅ 无需自建区块链基础设施
- ✅ 高性能结算，快速确认
- ✅ 与 MCPay 生态兼容

### 2.2 集成架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        支付流程                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 用户发起支付                                                  │
│     ┌─────────┐                                                  │
│     │  /pay   │ ──────► 生成 EIP-712 授权                        │
│     │  页面   │                                                  │
│     └────┬────┘                                                  │
│          │                                                       │
│  2. 用户签名                                                      │
│          │                                                       │
│          ▼                                                       │
│     ┌─────────────────┐                                          │
│     │ 钱包签名        │ ──────► 返回 signature                   │
│     │ (MetaMask等)    │                                          │
│     └────────┬────────┘                                          │
│              │                                                   │
│  3. 提交到 Facilitator                                           │
│              │                                                   │
│              ▼                                                   │
│     ┌─────────────────────────────────────────────────────┐      │
│     │           /api/x402/settle (新增)                   │      │
│     │                                                     │      │
│     │  ┌─────────────────┐    ┌─────────────────────┐    │      │
│     │  │ 验证 payload    │───►│ 调用 CDP Facilitator│    │      │
│     │  │ 检查有效期      │    │ POST /settle        │    │      │
│     │  └─────────────────┘    └──────────┬──────────┘    │      │
│     │                                    │               │      │
│     └────────────────────────────────────┼───────────────┘      │
│                                          │                       │
│  4. CDP 结算到链上                                                │
│                                          ▼                       │
│     ┌─────────────────────────────────────────────────────┐      │
│     │              Coinbase CDP Facilitator               │      │
│     │                                                     │      │
│     │  • 验证签名                                         │      │
│     │  • 检查余额                                         │      │
│     │  • 提交交易到 Base 链                               │      │
│     │  • 返回 txHash                                      │      │
│     └─────────────────────────────────────────────────────┘      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```


### 2.3 需要新增/修改的文件

| 文件路径 | 操作 | 说明 |
|---------|------|------|
| `services/cdp-facilitator.service.ts` | 新增 | CDP Facilitator 客户端 |
| `app/api/x402/settle/route.ts` | 新增 | 新的结算 API 端点 |
| `app/api/x402/submit-to-relayer/route.ts` | 修改 | 添加 CDP 作为首选 |
| `packages/sdk/src/modules/x402.ts` | 修改 | 添加 facilitator 选项 |
| `lib/x402-client.ts` | 修改 | 支持 CDP 结算 |
| `.env.local` | 修改 | 添加 CDP API 密钥 |

### 2.4 核心代码结构

```typescript
// services/cdp-facilitator.service.ts
interface CDPFacilitatorConfig {
  apiKey: string;
  apiSecret: string;
  network: 'base' | 'base-sepolia';
  endpoint?: string;
}

interface SettleRequest {
  paymentPayload: {
    signature: string;
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: number;
      validBefore: number;
      nonce: string;
    };
  };
  paymentRequirements: {
    scheme: 'exact';
    network: string;
    maxAmountRequired: string;
    resource: string;
    description?: string;
  };
}

interface SettleResponse {
  success: boolean;
  transactionHash?: string;
  network?: string;
  error?: string;
}

class CDPFacilitatorService {
  constructor(config: CDPFacilitatorConfig);
  
  // 验证支付 payload
  async verify(request: SettleRequest): Promise<{ valid: boolean; error?: string }>;
  
  // 结算支付到链上
  async settle(request: SettleRequest): Promise<SettleResponse>;
  
  // 查询交易状态
  async getStatus(txHash: string): Promise<TransactionStatus>;
}
```

### 2.5 环境变量配置

```env
# .env.local
CDP_API_KEY=your_cdp_api_key
CDP_API_SECRET=your_cdp_api_secret
CDP_NETWORK=base  # 或 base-sepolia 用于测试
CDP_FACILITATOR_ENDPOINT=https://api.cdp.coinbase.com/x402
```


---

## 三、MCP Server 支持 (订阅付款)

### 3.1 应用场景

将 MCP (Model Context Protocol) 集成到订阅功能，让用户可以：
- 通过 AI Agent (Claude/ChatGPT) 自动发起订阅付款
- 实现 Pay-per-call 微支付模式
- 替换现有 demo 数据为真实订阅服务

### 3.2 架构设计

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      MCP 订阅付款流程                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────┐                                                   │
│   │  AI Agent       │                                                   │
│   │  (Claude/GPT)   │                                                   │
│   └────────┬────────┘                                                   │
│            │ 1. 调用 MCP Tool                                           │
│            │    "subscribe_to_service"                                  │
│            ▼                                                            │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │              ProtocolBanks MCP Server                       │       │
│   │                                                             │       │
│   │  Tools:                                                     │       │
│   │  ┌─────────────────────────────────────────────────────┐   │       │
│   │  │ • list_subscriptions    - 列出可用订阅              │   │       │
│   │  │ • get_subscription_info - 获取订阅详情              │   │       │
│   │  │ • subscribe             - 发起订阅 (触发 402)       │   │       │
│   │  │ • check_subscription    - 检查订阅状态              │   │       │
│   │  │ • cancel_subscription   - 取消订阅                  │   │       │
│   │  └─────────────────────────────────────────────────────┘   │       │
│   │                                                             │       │
│   └────────────────────────────┬────────────────────────────────┘       │
│                                │                                        │
│            2. 返回 HTTP 402    │                                        │
│               Payment Required │                                        │
│                                ▼                                        │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │                    x402 Payment Flow                        │       │
│   │                                                             │       │
│   │  X-Payment-Request Header:                                  │       │
│   │  {                                                          │       │
│   │    "version": "1.0",                                        │       │
│   │    "network": "base",                                       │       │
│   │    "paymentAddress": "0x...",                               │       │
│   │    "amount": "9.99",                                        │       │
│   │    "token": "USDC",                                         │       │
│   │    "memo": "Monthly Pro Subscription"                       │       │
│   │  }                                                          │       │
│   └────────────────────────────┬────────────────────────────────┘       │
│                                │                                        │
│            3. Agent 自动签名   │                                        │
│               并支付           │                                        │
│                                ▼                                        │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │                CDP Facilitator 结算                         │       │
│   └────────────────────────────┬────────────────────────────────┘       │
│                                │                                        │
│            4. 订阅激活         │                                        │
│                                ▼                                        │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │              订阅服务激活 + Webhook 通知                    │       │
│   └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```


### 3.3 需要新增的文件

| 文件路径 | 说明 |
|---------|------|
| `packages/mcp-server/` | 新的 MCP Server 包 |
| `packages/mcp-server/src/index.ts` | MCP Server 入口 |
| `packages/mcp-server/src/tools/subscriptions.ts` | 订阅相关 Tools |
| `packages/mcp-server/src/tools/payments.ts` | 支付相关 Tools |
| `packages/mcp-server/src/x402-handler.ts` | 402 响应处理 |
| `app/api/mcp/` | MCP API 端点 |
| `app/subscriptions/` | 更新订阅页面，使用真实数据 |

### 3.4 MCP Server 代码结构

```typescript
// packages/mcp-server/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';

const server = new Server({
  name: 'protocolbanks-mcp',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// 注册订阅工具
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_subscriptions',
      description: 'List available subscription plans',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'subscribe',
      description: 'Subscribe to a plan (requires payment)',
      inputSchema: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'Subscription plan ID' },
          walletAddress: { type: 'string', description: 'Payer wallet address' },
        },
        required: ['planId', 'walletAddress'],
      },
    },
    // ... 更多工具
  ],
}));

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'subscribe':
      // 返回 402 Payment Required
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 402,
            paymentRequired: {
              version: '1.0',
              network: 'base',
              paymentAddress: MERCHANT_ADDRESS,
              amount: getPlanPrice(args.planId),
              token: 'USDC',
            },
          }),
        }],
      };
    // ...
  }
});
```

### 3.5 订阅数据模型

```typescript
// 替换 demo 数据的真实订阅模型
interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: string;           // USDC 金额
  interval: 'monthly' | 'yearly' | 'one-time';
  features: string[];
  maxApiCalls?: number;    // API 调用限制
}

interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  startDate: Date;
  endDate: Date;
  paymentHistory: PaymentRecord[];
  autoRenew: boolean;
}
```


---

## 四、API Monetizer (API 变现中间件)

### 4.1 应用场景

API Monetizer 让你可以：
- 将任意 REST API 包装为付费端点
- 支持多种定价模式（按请求、按 token、动态定价）
- 作为产品功能提供给其他开发者使用

### 4.2 架构设计

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      API Monetizer 架构                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────┐                                                   │
│   │  Client         │                                                   │
│   │  (任意应用)     │                                                   │
│   └────────┬────────┘                                                   │
│            │                                                            │
│            │ 1. 请求 API                                                │
│            ▼                                                            │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │              API Monetizer Middleware                       │       │
│   │                                                             │       │
│   │  ┌─────────────────────────────────────────────────────┐   │       │
│   │  │                检查支付状态                          │   │       │
│   │  │                                                     │   │       │
│   │  │  X-Payment Header 存在?                             │   │       │
│   │  │       │                                             │   │       │
│   │  │       ├── 是 ──► 验证支付 ──► 转发到上游 API        │   │       │
│   │  │       │                                             │   │       │
│   │  │       └── 否 ──► 返回 402 + 支付要求                │   │       │
│   │  └─────────────────────────────────────────────────────┘   │       │
│   │                                                             │       │
│   │  定价策略:                                                  │       │
│   │  • perRequest: 每次请求固定价格                            │       │
│   │  • perToken: 按 AI token 计费                              │       │
│   │  • dynamic: 根据请求内容动态定价                           │       │
│   │  • tiered: 阶梯定价                                        │       │
│   │                                                             │       │
│   └────────────────────────────┬────────────────────────────────┘       │
│                                │                                        │
│            2. 支付验证通过     │                                        │
│                                ▼                                        │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │                    Upstream API                             │       │
│   │              (OpenAI / 自建服务 / 第三方)                   │       │
│   └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 需要新增的文件

| 文件路径 | 说明 |
|---------|------|
| `packages/sdk/src/modules/monetizer.ts` | Monetizer 核心模块 |
| `packages/sdk/src/modules/pricing.ts` | 定价策略 |
| `app/api/monetize/[...path]/route.ts` | 动态代理路由 |
| `app/vendors/monetize/` | Monetizer 配置 UI |
| `services/usage-tracker.service.ts` | 使用量追踪 |

### 4.4 核心代码结构

```typescript
// packages/sdk/src/modules/monetizer.ts
interface MonetizeConfig {
  // 上游 API 配置
  upstream: {
    url: string;
    headers?: Record<string, string>;
    timeout?: number;
  };
  
  // 定价配置
  pricing: PricingConfig;
  
  // 收款地址
  recipient: string;
  
  // 支持的链和代币
  network?: 'base' | 'ethereum' | 'polygon';
  token?: 'USDC' | 'USDT';
  
  // 可选配置
  rateLimit?: RateLimitConfig;
  analytics?: boolean;
}

interface PricingConfig {
  model: 'perRequest' | 'perToken' | 'dynamic' | 'tiered';
  
  // 按请求定价
  perRequest?: string;  // e.g., "0.001" USDC
  
  // 按 token 定价 (AI API)
  perInputToken?: string;
  perOutputToken?: string;
  
  // 动态定价函数
  dynamic?: (req: Request) => Promise<string>;
  
  // 阶梯定价
  tiers?: Array<{
    upTo: number;
    price: string;
  }>;
}

class APIMonetizer {
  constructor(config: MonetizeConfig);
  
  // Next.js/Express 中间件
  middleware(): (req: Request, res: Response, next: Function) => void;
  
  // 处理请求
  async handleRequest(req: Request): Promise<Response>;
  
  // 生成 402 响应
  private generate402Response(price: string): Response;
  
  // 验证支付
  private async verifyPayment(paymentHeader: string): Promise<boolean>;
  
  // 转发到上游
  private async forwardToUpstream(req: Request): Promise<Response>;
}
```


### 4.5 使用示例

```typescript
// 示例 1: 包装 OpenAI API
import { APIMonetizer } from '@protocolbanks/sdk';

const openaiMonetizer = new APIMonetizer({
  upstream: {
    url: 'https://api.openai.com/v1',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  },
  pricing: {
    model: 'perToken',
    perInputToken: '0.00001',   // $0.00001 per input token
    perOutputToken: '0.00003',  // $0.00003 per output token
  },
  recipient: '0x1234...',
  network: 'base',
  token: 'USDC',
});

// Next.js API Route
export async function POST(req: Request) {
  return openaiMonetizer.handleRequest(req);
}
```

```typescript
// 示例 2: 包装自建 API
const myApiMonetizer = new APIMonetizer({
  upstream: {
    url: 'https://my-internal-api.com',
  },
  pricing: {
    model: 'perRequest',
    perRequest: '0.01',  // $0.01 per request
  },
  recipient: '0x1234...',
});

// Express 中间件
app.use('/api/paid', myApiMonetizer.middleware());
```

---

## 五、实施计划

### Phase 1: CDP Facilitator 集成 (优先级最高) ✅ 已完成

**时间**: 1-2 周

**任务清单**:
- [x] 1.1 注册 Coinbase Developer Platform 账号
- [x] 1.2 获取 API credentials (API Key + Secret)
- [x] 1.3 创建 `services/cdp-facilitator.service.ts`
- [x] 1.4 创建 `app/api/x402/settle/route.ts`
- [x] 1.5 修改 `app/api/x402/submit-to-relayer/route.ts` 添加 CDP 支持
- [x] 1.6 更新 `packages/sdk/src/modules/x402.ts` 添加 facilitator 选项
- [x] 1.7 更新 `/pay` 页面使用 CDP 结算
- [x] 1.8 更新 `lib/x402-client.ts` 支持 CDP
- [x] 1.9 更新 `ENV_SETUP.md` 添加 CDP 环境变量说明
- [ ] 1.10 测试 Base Sepolia 测试网
- [ ] 1.11 测试 Base 主网

**交付物**:
- ✅ CDP Facilitator 服务集成 (`services/cdp-facilitator.service.ts`)
- ✅ 新的结算 API 端点 (`app/api/x402/settle/route.ts`)
- ✅ 更新的 submit-to-relayer 路由 (CDP 优先，Relayer 备用)
- ✅ SDK x402 模块支持 CDP (`packages/sdk/src/modules/x402.ts`)
- ✅ x402 客户端支持 CDP (`lib/x402-client.ts`)
- ✅ /pay 页面 CDP 集成 (显示 "CDP Free" 徽章)
- ✅ 环境变量文档更新 (`ENV_SETUP.md`)

**实现亮点**:
- Base 链 USDC 支付 0 手续费
- 自动回退到自建 Relayer (非 Base 链或 CDP 不可用时)
- SDK 支持 `'cdp' | 'relayer' | 'auto'` 三种结算模式
- /pay 页面自动检测并显示 CDP 可用状态

### Phase 2: MCP Server 支持 (订阅功能) ✅ 已完成

**时间**: 2-3 周

**任务清单**:
- [x] 2.1 创建 `packages/mcp-server/` 包结构
- [x] 2.2 安装 `@modelcontextprotocol/sdk` 依赖
- [x] 2.3 实现订阅相关 MCP Tools
- [x] 2.4 实现 402 响应处理
- [x] 2.5 创建订阅数据模型 (替换 demo 数据)
- [x] 2.6 更新 `/subscriptions` 页面 (添加 MCP 订阅 hook)
- [x] 2.7 创建 MCP Server 配置文件 (Claude Desktop 兼容)
- [x] 2.8 编写使用文档
- [ ] 2.9 测试与 Claude Desktop 集成

**交付物**:
- ✅ 完整的 MCP Server 包 (`packages/mcp-server/`)
- ✅ 真实订阅功能 (数据库迁移 + API 路由)
- ✅ Claude Desktop 集成指南 (`packages/mcp-server/README.md`)

**实现亮点**:
- PaidServer 类支持 `paidTool()` 和 `tool()` 方法
- 自动 402 Payment Required 响应生成
- 订阅服务支持 Supabase 数据库和 Mock 模式
- 支付服务集成 CDP Facilitator (Base 链 0 手续费)
- 完整的输入验证和错误处理
- CLI 入口支持 stdio transport

### Phase 3: API Monetizer ✅ 已完成

**时间**: 1-2 周

**任务清单**:
- [x] 3.1 创建 `packages/sdk/src/modules/monetizer.ts`
- [x] 3.2 实现定价策略模块 (`packages/sdk/src/modules/pricing.ts`)
- [x] 3.3 实现 Next.js/Express 中间件
- [x] 3.4 创建使用量追踪服务 (`services/usage-tracker.service.ts`)
- [x] 3.5 创建 Monetizer 配置 UI (`/vendors/monetize`)
- [x] 3.6 创建数据库迁移 (`migrations/005_usage_tracking_schema.sql`)
- [x] 3.7 更新 SDK 导出

**交付物**:
- ✅ API Monetizer 核心模块 (`packages/sdk/src/modules/monetizer.ts`)
- ✅ 定价策略模块 (`packages/sdk/src/modules/pricing.ts`)
  - PerRequestPricing: 固定价格
  - PerTokenPricing: AI API 按 token 计费
  - DynamicPricing: 自定义定价函数
  - TieredPricing: 阶梯定价
- ✅ 使用量追踪服务 (`services/usage-tracker.service.ts`)
  - 支持内存和 Supabase 后端
  - 自动批量写入
- ✅ API 路由
  - `app/api/monetize/configs/route.ts` - 配置 CRUD
  - `app/api/monetize/usage/route.ts` - 使用统计
  - `app/api/monetize/proxy/[...path]/route.ts` - 动态代理
- ✅ 配置 UI (`app/vendors/monetize/page.tsx`)
- ✅ 数据库迁移 (`migrations/005_usage_tracking_schema.sql`)
- ✅ React Hook (`hooks/use-monetizer-config.ts`)

**实现亮点**:
- 支持 4 种定价模式 (perRequest, perToken, dynamic, tiered)
- AI API 预设定价 (GPT-4, GPT-3.5, Claude 3)
- 自动 402 Payment Required 响应
- 支持订阅检查 (绕过支付)
- 支持钱包白名单/黑名单
- 速率限制 (每分钟/小时/天)
- 使用统计和收入分析
- Next.js 和 Express 中间件适配器

**任务清单**:
- [ ] 3.1 创建 `packages/sdk/src/modules/monetizer.ts`
- [ ] 3.2 实现定价策略模块
- [ ] 3.3 实现 Next.js/Express 中间件
- [ ] 3.4 创建使用量追踪服务
- [ ] 3.5 创建 Monetizer 配置 UI (`/vendors/monetize`)
- [ ] 3.6 编写示例项目
- [ ] 3.7 更新 SDK 文档

**交付物**:
- API Monetizer 模块
- 配置 UI
- 示例项目和文档


---

## 六、技术依赖

### 新增依赖

```json
// package.json (根目录)
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}

// packages/mcp-server/package.json
{
  "name": "@protocolbanks/mcp-server",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@protocolbanks/sdk": "workspace:*"
  }
}
```

### 环境变量

```env
# CDP Facilitator
CDP_API_KEY=
CDP_API_SECRET=
CDP_NETWORK=base
CDP_FACILITATOR_ENDPOINT=https://api.cdp.coinbase.com/x402

# MCP Server
MCP_SERVER_PORT=3001
MCP_MERCHANT_ADDRESS=0x...

# API Monetizer
MONETIZER_DEFAULT_RECIPIENT=0x...
```

---

## 七、风险和注意事项

### 7.1 CDP Facilitator

| 风险 | 缓解措施 |
|------|---------|
| CDP API 不可用 | 保留自建 relayer 作为备用 |
| 仅支持 USDC | 其他代币使用自建 relayer |
| 仅支持 Base 链 | 其他链使用自建 relayer |

### 7.2 MCP Server

| 风险 | 缓解措施 |
|------|---------|
| MCP 协议变更 | 关注官方更新，保持兼容 |
| 钱包集成复杂 | 提供详细文档和示例 |

### 7.3 API Monetizer

| 风险 | 缓解措施 |
|------|---------|
| 定价计算错误 | 完善测试覆盖 |
| 上游 API 超时 | 实现重试和超时处理 |

---

## 八、预期收益

### 技术收益
- ✅ 免费 USDC 结算 (Base 链)
- ✅ 与 MCPay 生态兼容
- ✅ AI Agent 自动付费能力
- ✅ API 变现基础设施

### 产品收益
- ✅ 降低用户支付成本 (0 手续费)
- ✅ 支持 AI Agent 订阅场景
- ✅ 为开发者提供 API 变现工具
- ✅ 扩展产品使用场景

---

## 九、确认事项

请确认以下内容后开始实施：

1. **CDP Facilitator**: 是否已有 Coinbase Developer Platform 账号？
2. **优先级**: 是否按 Phase 1 → 2 → 3 顺序实施？
3. **测试网**: 是否先在 Base Sepolia 测试？
4. **订阅数据**: 现有订阅页面的 demo 数据结构是否需要保留兼容？

---

## 十、功能适用性矩阵

### 10.1 各功能与集成模块的适用关系

| 功能 | CDP Facilitator | MCP Server | API Monetizer | 自建 Relayer | 说明 |
|------|-----------------|------------|---------------|--------------|------|
| **单笔支付 (/pay)** | ✅ 主要 | ✅ 可触发 | ✅ 可包装 | ⚠️ 备用 | 核心场景，Base 链免费 |
| **收款链接 (/receive)** | ✅ 主要 | ❌ | ❌ | ⚠️ 备用 | 生成的链接最终走 CDP |
| **批量支付** | ⚠️ 逐笔调用 | ❌ | ❌ | ✅ Multicall | 见下方详细说明 |
| **x402 Gasless** | ✅ 主要 | ✅ 可触发 | ✅ 可包装 | ⚠️ 备用 | CDP 专为 x402 设计 |
| **订阅付款** | ✅ 结算 | ✅ 主要 | ❌ | ⚠️ 备用 | MCP 触发，CDP 结算 |
| **API 变现** | ✅ 结算 | ❌ | ✅ 主要 | ⚠️ 备用 | Monetizer 包装，CDP 结算 |
| **Checkout Widget** | ✅ 主要 | ❌ | ❌ | ⚠️ 备用 | 嵌入式组件走 CDP |
| **Offramp (出金)** | ❌ | ❌ | ❌ | ❌ | 独立流程，法币出金 |
| **Swap** | ❌ | ❌ | ❌ | ❌ | DEX 直连，不走结算 |
| **Omnichain** | ⚠️ Base only | ❌ | ❌ | ✅ 跨链桥 | 跨链需要桥接 |

**图例**: ✅ 主要方案 | ⚠️ 部分适用/备用 | ❌ 不适用

### 10.2 批量支付特殊处理

CDP Facilitator 没有批量 API，但 Base 链 USDC 每笔 0 手续费，可以采用以下策略：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        批量支付路由架构                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   批量支付请求 (N 笔)                                                    │
│         │                                                               │
│         ▼                                                               │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │              Batch Router (智能路由)                        │       │
│   │                                                             │       │
│   │  1. 验证所有收款人地址                                       │       │
│   │  2. 按链和代币分组                                          │       │
│   │  3. 选择最优结算方式                                        │       │
│   └─────────────────────────────────────────────────────────────┘       │
│         │                                                               │
│         ├─── Base 链 + USDC ────────────────────────────────────┐       │
│         │                                                       │       │
│         │    ┌─────────────────────────────────────────────┐   │       │
│         │    │         CDP Facilitator                     │   │       │
│         │    │                                             │   │       │
│         │    │  • 并发调用 (Promise.all)                   │   │       │
│         │    │  • 每笔 0 手续费                            │   │       │
│         │    │  • 并发限制: 10-20 笔/批                    │   │       │
│         │    │  • 总成本: $0                               │   │       │
│         │    └─────────────────────────────────────────────┘   │       │
│         │                                                       │       │
│         ├─── 其他 EVM 链 ───────────────────────────────────────┐       │
│         │                                                       │       │
│         │    ┌─────────────────────────────────────────────┐   │       │
│         │    │         Multicall 合约                      │   │       │
│         │    │                                             │   │       │
│         │    │  • 批量执行，1 笔 gas                       │   │       │
│         │    │  • 支持 ERC-20 批量转账                     │   │       │
│         │    │  • 节省 ~80% gas                            │   │       │
│         │    └─────────────────────────────────────────────┘   │       │
│         │                                                       │       │
│         ├─── Solana ────────────────────────────────────────────┐       │
│         │                                                       │       │
│         │    ┌─────────────────────────────────────────────┐   │       │
│         │    │         Solana 批量交易                     │   │       │
│         │    │                                             │   │       │
│         │    │  • 单交易多指令                             │   │       │
│         │    │  • 原生支持批量                             │   │       │
│         │    └─────────────────────────────────────────────┘   │       │
│         │                                                       │       │
│         └─── 非 USDC 代币 ──────────────────────────────────────┐       │
│                                                                 │       │
│              ┌─────────────────────────────────────────────┐   │       │
│              │         自建 Relayer                        │   │       │
│              │                                             │   │       │
│              │  • 标准 ERC-20 转账                         │   │       │
│              │  • 或 Multicall 批量                        │   │       │
│              └─────────────────────────────────────────────┘   │       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.3 批量支付代码实现

```typescript
// services/batch-router.service.ts
interface BatchRecipient {
  address: string;
  amount: string;
  token: string;
  chainId: number;
}

interface BatchResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

class BatchRouterService {
  private cdpFacilitator: CDPFacilitatorService;
  private multicallService: MulticallService;
  
  async processBatch(recipients: BatchRecipient[]): Promise<BatchResult[]> {
    // 1. 按链和代币分组
    const groups = this.groupByChainAndToken(recipients);
    
    // 2. 并行处理各组
    const results = await Promise.all(
      groups.map(group => this.processGroup(group))
    );
    
    return this.flattenResults(results);
  }
  
  private async processGroup(group: GroupedRecipients): Promise<BatchResult[]> {
    const { chainId, token, recipients } = group;
    
    // Base 链 USDC → CDP Facilitator (并发调用)
    if (chainId === 8453 && token === 'USDC') {
      return this.processViaCDP(recipients);
    }
    
    // 其他 EVM 链 → Multicall 合约
    if (this.isEVMChain(chainId)) {
      return this.processViaMulticall(group);
    }
    
    // Solana → 批量交易
    if (chainId === 'solana') {
      return this.processViaSolana(group);
    }
    
    // 默认 → 自建 Relayer
    return this.processViaRelayer(group);
  }
  
  // CDP 并发处理 (Base USDC)
  private async processViaCDP(recipients: BatchRecipient[]): Promise<BatchResult[]> {
    const CONCURRENCY_LIMIT = 10;
    const results: BatchResult[] = [];
    
    // 分批并发
    for (let i = 0; i < recipients.length; i += CONCURRENCY_LIMIT) {
      const batch = recipients.slice(i, i + CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(
        batch.map(r => this.cdpFacilitator.settle({
          paymentPayload: this.buildPayload(r),
          paymentRequirements: this.buildRequirements(r),
        }))
      );
      results.push(...batchResults.map(this.mapToResult));
    }
    
    return results;
  }
  
  // Multicall 批量处理 (其他 EVM 链)
  private async processViaMulticall(group: GroupedRecipients): Promise<BatchResult[]> {
    const { chainId, token, recipients } = group;
    
    // 构建 Multicall 数据
    const calls = recipients.map(r => ({
      target: this.getTokenAddress(chainId, token),
      callData: this.encodeTransfer(r.address, r.amount),
    }));
    
    // 执行 Multicall
    const txHash = await this.multicallService.execute(chainId, calls);
    
    return recipients.map(() => ({ success: true, txHash }));
  }
}
```

### 10.4 成本对比

| 场景 | CDP Facilitator | Multicall | 逐笔转账 |
|------|-----------------|-----------|----------|
| **100 笔 Base USDC** | $0 | N/A | $0 |
| **100 笔 Ethereum USDC** | N/A | ~$5-10 | ~$50-100 |
| **100 笔 Polygon USDC** | N/A | ~$0.5-1 | ~$5-10 |
| **100 笔 Arbitrum USDC** | N/A | ~$1-2 | ~$10-20 |

**结论**: 
- Base 链 USDC 批量支付使用 CDP，成本为 $0
- 其他链使用 Multicall，节省 ~80% gas
- 推荐用户优先使用 Base 链进行批量支付

### 10.5 需要新增的文件 (批量支付优化)

| 文件路径 | 说明 |
|---------|------|
| `services/batch-router.service.ts` | 批量支付智能路由 |
| `services/multicall.service.ts` | Multicall 合约调用 |
| `contracts/BatchTransfer.sol` | 批量转账合约 (可选) |
| `app/api/batch/route.ts` | 更新批量支付 API |

---

## 十一、不适用功能说明

### 11.1 Offramp (出金)

Offramp 是将加密货币兑换为法币的流程，不走 x402/CDP：

```
用户 USDC → Offramp Provider (MoonPay/Transak) → 银行账户
```

**原因**: 
- 涉及法币，需要 KYC/AML
- 使用第三方出金服务商
- 独立的合规流程

### 11.2 Swap

Swap 是代币兑换，直接与 DEX 交互：

```
用户 ETH → DEX (Uniswap/1inch) → USDC
```

**原因**:
- 直接调用 DEX 合约
- 不需要中间结算层
- 用户自己支付 gas

### 11.3 Omnichain

跨链转账需要桥接协议：

```
用户 USDC (Ethereum) → Bridge (LayerZero/Wormhole) → USDC (Base)
```

**CDP 限制**: 仅支持 Base 链
**解决方案**: 跨链部分使用桥接，目标链结算可用 CDP

---

*文档版本: 1.2*
*更新日期: 2026-01-22*
*Phase 1 完成: CDP Facilitator 集成*
*新增: 功能适用性矩阵、批量支付优化方案*
