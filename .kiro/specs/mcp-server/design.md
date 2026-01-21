# Design Document: MCP Server Support

## Overview

本设计文档描述 ProtocolBanks MCP (Model Context Protocol) Server 的技术架构，使 AI Agent（Claude、ChatGPT、Cursor）能够自动触发和处理订阅付款。

MCP Server 将提供以下核心能力：
- 订阅管理工具（list、subscribe、check、cancel）
- HTTP 402 支付流程处理
- 与 CDP Facilitator 集成（Base 链 0 手续费）
- 按调用付费（pay-per-call）微支付支持

## Architecture

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

## Components and Interfaces

### Package Structure

```
packages/mcp-server/
├── package.json
├── tsconfig.json
├── rollup.config.js
├── src/
│   ├── index.ts              # 主入口，导出 createPaidHandler
│   ├── server.ts             # MCP Server 实现
│   ├── handler.ts            # 付费处理器 (402 响应)
│   ├── tools/
│   │   ├── index.ts          # 工具注册
│   │   ├── subscriptions.ts  # 订阅相关工具
│   │   └── payments.ts       # 支付相关工具
│   ├── services/
│   │   ├── subscription.service.ts  # 订阅业务逻辑
│   │   └── payment.service.ts       # 支付处理
│   └── types/
│       └── index.ts          # 类型定义
├── config/
│   └── claude_desktop_config.json  # Claude Desktop 配置模板
└── README.md
```

### Core Interfaces

```typescript
// src/types/index.ts

/** 订阅计划 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: string;           // USDC 金额，如 "9.99"
  interval: 'monthly' | 'yearly' | 'one-time';
  features: string[];
  maxApiCalls?: number;    // API 调用限制
}

/** 用户订阅 */
export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: 'pending' | 'active' | 'cancelled' | 'expired';
  startDate: string;
  endDate: string;
  paymentHistory: PaymentRecord[];
  autoRenew: boolean;
}

/** 支付记录 */
export interface PaymentRecord {
  id: string;
  subscriptionId: string;
  amount: string;
  token: string;
  txHash: string;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'failed';
}

/** 402 支付要求 */
export interface PaymentRequirement {
  version: string;
  network: string;
  paymentAddress: string;
  amount: string;
  token: string;
  memo?: string;
  validUntil?: number;
}

/** 付费工具配置 */
export interface PaidToolConfig {
  price: string;           // 如 "$0.001" 或 "0.001 USDC"
  recipient: string;       // 收款地址
  network?: string;        // 默认 "base"
  token?: string;          // 默认 "USDC"
  description?: string;
}

/** MCP Server 配置 */
export interface MCPServerConfig {
  name: string;
  version: string;
  recipient: {
    evm: { address: string; isTestnet?: boolean };
  };
  facilitator?: {
    url: string;           // CDP Facilitator URL
  };
  supabaseUrl?: string;
  supabaseKey?: string;
}
```

### MCP Server Implementation

```typescript
// src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import { MCPServerConfig, PaidToolConfig } from './types';

export function createPaidHandler(
  setupFn: (server: PaidServer) => void | Promise<void>,
  config: MCPServerConfig
): Server {
  const server = new PaidServer(config);
  setupFn(server);
  return server.getServer();
}

export class PaidServer {
  private server: Server;
  private config: MCPServerConfig;
  private tools: Map<string, ToolDefinition> = new Map();

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.server = new Server({
      name: config.name,
      version: config.version,
    }, {
      capabilities: { tools: {} },
    });
    this.setupHandlers();
  }

  /** 定义付费工具 */
  paidTool(
    name: string,
    description: string,
    price: string,
    inputSchema: object,
    handler: (args: any) => Promise<any>
  ): void {
    this.tools.set(name, {
      name,
      description,
      price: this.parsePrice(price),
      inputSchema,
      handler,
      isPaid: true,
    });
  }

  /** 定义免费工具 */
  tool(
    name: string,
    description: string,
    inputSchema: object,
    handler: (args: any) => Promise<any>
  ): void {
    this.tools.set(name, {
      name,
      description,
      inputSchema,
      handler,
      isPaid: false,
    });
  }

  private parsePrice(price: string): string {
    // 支持 "$0.001", "0.001 USDC", "0.001" 格式
    const match = price.match(/[\d.]+/);
    return match ? match[0] : '0';
  }

  private setupHandlers(): void {
    // ListTools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Array.from(this.tools.values()).map(t => ({
        name: t.name,
        description: t.description + (t.isPaid ? ` (Price: ${t.price} USDC)` : ''),
        inputSchema: t.inputSchema,
      })),
    }));

    // CallTool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const tool = this.tools.get(name);
      
      if (!tool) {
        return { content: [{ type: 'text', text: 'Tool not found' }] };
      }

      // 付费工具需要检查支付
      if (tool.isPaid) {
        const paymentHeader = request.params._meta?.payment;
        
        if (!paymentHeader) {
          // 返回 402 支付要求
          return this.generate402Response(tool);
        }

        // 验证支付
        const isValid = await this.verifyPayment(paymentHeader, tool.price);
        if (!isValid) {
          return this.generate402Response(tool, 'Payment verification failed');
        }
      }

      // 执行工具
      const result = await tool.handler(args);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    });
  }

  private generate402Response(tool: ToolDefinition, error?: string): ToolResponse {
    const paymentRequirement: PaymentRequirement = {
      version: '1.0',
      network: 'base',
      paymentAddress: this.config.recipient.evm.address,
      amount: tool.price!,
      token: 'USDC',
      memo: `Payment for ${tool.name}`,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 402,
          error: error || 'Payment Required',
          paymentRequired: paymentRequirement,
        }),
      }],
    };
  }

  private async verifyPayment(payment: string, expectedAmount: string): Promise<boolean> {
    // 调用 CDP Facilitator 或自建 relayer 验证支付
    try {
      const response = await fetch(`${this.config.facilitator?.url}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment, expectedAmount }),
      });
      const result = await response.json();
      return result.valid === true;
    } catch {
      return false;
    }
  }

  getServer(): Server { return this.server; }
}
```

### Subscription Tools

```typescript
// src/tools/subscriptions.ts
import { PaidServer } from '../server';
import { SubscriptionService } from '../services/subscription.service';

export function registerSubscriptionTools(
  server: PaidServer,
  subscriptionService: SubscriptionService
): void {
  // 列出可用订阅计划 (免费)
  server.tool(
    'list_subscriptions',
    'List all available subscription plans',
    { type: 'object', properties: {} },
    async () => {
      const plans = await subscriptionService.listPlans();
      return { plans };
    }
  );

  // 获取订阅详情 (免费)
  server.tool(
    'get_subscription_info',
    'Get detailed information about a subscription plan',
    {
      type: 'object',
      properties: {
        planId: { type: 'string', description: 'Plan ID' },
      },
      required: ['planId'],
    },
    async ({ planId }) => {
      const plan = await subscriptionService.getPlan(planId);
      return { plan };
    }
  );

  // 订阅 (付费 - 触发 402)
  server.paidTool(
    'subscribe',
    'Subscribe to a plan (requires payment)',
    '$9.99',  // 默认价格，实际从 plan 获取
    {
      type: 'object',
      properties: {
        planId: { type: 'string', description: 'Plan ID to subscribe' },
        walletAddress: { type: 'string', description: 'Payer wallet address' },
      },
      required: ['planId', 'walletAddress'],
    },
    async ({ planId, walletAddress }) => {
      const subscription = await subscriptionService.createSubscription(
        planId,
        walletAddress
      );
      return { subscription, message: 'Subscription created successfully' };
    }
  );

  // 检查订阅状态 (免费)
  server.tool(
    'check_subscription',
    'Check the status of a subscription',
    {
      type: 'object',
      properties: {
        subscriptionId: { type: 'string', description: 'Subscription ID' },
      },
      required: ['subscriptionId'],
    },
    async ({ subscriptionId }) => {
      const subscription = await subscriptionService.getSubscription(subscriptionId);
      return { subscription };
    }
  );

  // 取消订阅 (免费)
  server.tool(
    'cancel_subscription',
    'Cancel an active subscription',
    {
      type: 'object',
      properties: {
        subscriptionId: { type: 'string', description: 'Subscription ID' },
      },
      required: ['subscriptionId'],
    },
    async ({ subscriptionId }) => {
      await subscriptionService.cancelSubscription(subscriptionId);
      return { message: 'Subscription cancelled successfully' };
    }
  );
}
```

## Data Models

### Database Schema (Supabase)

```sql
-- 订阅计划表
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(18, 6) NOT NULL,
  token VARCHAR(10) DEFAULT 'USDC',
  interval VARCHAR(20) NOT NULL CHECK (interval IN ('monthly', 'yearly', 'one-time')),
  features JSONB DEFAULT '[]',
  max_api_calls INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用户订阅表
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,  -- 钱包地址
  plan_id UUID REFERENCES subscription_plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'active', 'cancelled', 'expired')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 支付记录表
CREATE TABLE subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES user_subscriptions(id),
  amount DECIMAL(18, 6) NOT NULL,
  token VARCHAR(10) DEFAULT 'USDC',
  tx_hash VARCHAR(66),
  network VARCHAR(20) DEFAULT 'base',
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 策略
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
  FOR SELECT USING (user_id = current_setting('app.user_id', true));

CREATE POLICY "Users can view own payments" ON subscription_payments
  FOR SELECT USING (
    subscription_id IN (
      SELECT id FROM user_subscriptions 
      WHERE user_id = current_setting('app.user_id', true)
    )
  );
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 402 Response Structure

*For any* paid tool called without valid payment, the response SHALL contain a valid PaymentRequirement object with all required fields (version, network, paymentAddress, amount, token).

**Validates: Requirements 3.1, 3.2**

### Property 2: Subscription Status Transitions

*For any* subscription, the status transitions SHALL follow the valid state machine: pending → active → (cancelled | expired). A cancelled or expired subscription SHALL NOT transition back to active without a new payment.

**Validates: Requirements 4.3, 4.4, 4.5**

### Property 3: Payment Amount Verification

*For any* payment submitted to a paid tool, the payment amount SHALL match or exceed the required amount. Payments with insufficient amounts SHALL be rejected with a 402 response.

**Validates: Requirements 5.4**

### Property 4: Price Conversion Accuracy

*For any* human-readable price string (e.g., "$0.001", "0.001 USDC"), the parsed token amount SHALL be mathematically equivalent to the input value.

**Validates: Requirements 5.2, 5.3**

### Property 5: Input Validation

*For any* tool call with invalid parameters (invalid wallet address, non-existent plan ID, etc.), the server SHALL return a structured error response without executing the tool logic.

**Validates: Requirements 9.1, 9.2**

### Property 6: Sensitive Data Protection

*For any* log entry generated by the MCP Server, the log SHALL NOT contain payment signatures, private keys, or other sensitive cryptographic material.

**Validates: Requirements 9.5**

## Error Handling

### Error Codes

```typescript
export enum MCPErrorCode {
  // 支付相关
  PAYMENT_REQUIRED = 'PAYMENT_REQUIRED',
  PAYMENT_INVALID = 'PAYMENT_INVALID',
  PAYMENT_EXPIRED = 'PAYMENT_EXPIRED',
  PAYMENT_INSUFFICIENT = 'PAYMENT_INSUFFICIENT',
  
  // 订阅相关
  SUBSCRIPTION_NOT_FOUND = 'SUBSCRIPTION_NOT_FOUND',
  SUBSCRIPTION_EXPIRED = 'SUBSCRIPTION_EXPIRED',
  PLAN_NOT_FOUND = 'PLAN_NOT_FOUND',
  
  // 验证相关
  INVALID_WALLET_ADDRESS = 'INVALID_WALLET_ADDRESS',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  
  // 系统相关
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
}

export interface MCPError {
  code: MCPErrorCode;
  message: string;
  details?: Record<string, any>;
}
```

### Error Response Format

```typescript
{
  content: [{
    type: 'text',
    text: JSON.stringify({
      error: true,
      code: 'PAYMENT_REQUIRED',
      message: 'Payment is required to use this tool',
      paymentRequired: {
        version: '1.0',
        network: 'base',
        paymentAddress: '0x...',
        amount: '0.001',
        token: 'USDC',
      },
    }),
  }],
}
```

## Testing Strategy

### Unit Tests

- Tool registration and listing
- Price parsing (various formats)
- Payment requirement generation
- Subscription CRUD operations
- Error handling for invalid inputs

### Property-Based Tests

使用 `fast-check` 进行属性测试：

1. **402 Response Property Test**: 生成随机付费工具配置，验证无支付调用始终返回有效的 402 响应
2. **Status Transition Property Test**: 生成随机订阅状态序列，验证状态转换符合状态机规则
3. **Price Conversion Property Test**: 生成随机价格字符串，验证解析结果的数学等价性
4. **Input Validation Property Test**: 生成随机无效输入，验证始终返回结构化错误

### Integration Tests

- Claude Desktop 集成测试
- CDP Facilitator 结算测试
- Supabase 数据持久化测试
- 端到端订阅流程测试

## Claude Desktop Configuration

```json
{
  "mcpServers": {
    "protocolbanks": {
      "command": "npx",
      "args": ["@protocolbanks/mcp-server"],
      "env": {
        "MERCHANT_ADDRESS": "0x...",
        "SUPABASE_URL": "https://xxx.supabase.co",
        "SUPABASE_ANON_KEY": "xxx",
        "CDP_FACILITATOR_URL": "https://api.cdp.coinbase.com/x402"
      }
    }
  }
}
```
