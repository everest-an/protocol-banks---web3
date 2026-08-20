# HTTP 402 微支付网关使用指南

**PB-Stream** 是 ProtocolBanks 的 HTTP 402 微支付网关实现，允许 AI Agent 和 API 消费者通过支付通道进行自动化微支付。

---

## 核心概念

### 1. Payment Channel (支付通道)

支付通道是链下的账户余额系统，允许在不频繁上链的情况下累积多个小额支付。

**特点**：
- 链下余额追踪（快速、低 Gas）
- 达到阈值后自动批量结算
- 支持 Session Key 自动授权

### 2. HTTP 402 Payment Required

标准 HTTP 状态码 402，表示"需要支付"。当 API 请求到达时：
- 如果支付通道余额充足 → 继续处理请求
- 如果余额不足 → 返回 402 响应，要求充值

### 3. 状态通道累积

多个小额支付在链下累积，达到预设阈值（默认 $10）后统一上链结算，大幅降低 Gas 费用。

---

## 快速开始

### 对于 API 服务商（收款方）

#### 1. 在 API 路由中启用 HTTP 402

```typescript
// app/api/ai/generate/route.ts
import { withPaymentRequired } from "@/lib/middleware/http-402-middleware"
import { NextRequest, NextResponse } from "next/server"

export const POST = withPaymentRequired({
  providerId: "provider_ai_generate", // 你的服务 ID
  pricePerRequest: "0.01", // 每次请求 $0.01 USDC
})(async (request, paymentContext) => {
  // 支付成功后才会执行这里的逻辑

  const body = await request.json()

  // 你的 AI 生成逻辑
  const result = await generateAIResponse(body.prompt)

  return NextResponse.json({
    result,
    // 支付信息会自动添加到响应头中
    // X-Payment-Id, X-Payment-Amount, X-Remaining-Balance
  })
})
```

#### 2. 动态定价

```typescript
export const POST = withPaymentRequired({
  providerId: "provider_ai_generate",
  // 根据请求内容动态计算价格
  pricingFunction: async (request) => {
    const body = await request.json()
    const tokens = estimateTokens(body.prompt)

    // $0.001 per 1000 tokens
    return (tokens / 1000 * 0.001).toFixed(6)
  },
})(async (request, paymentContext) => {
  // ...
})
```

#### 3. 跳过支付（测试模式）

```typescript
export const POST = withPaymentRequired({
  providerId: "provider_ai_generate",
  pricePerRequest: "0.01",
  skipPaymentCheck: (request) => {
    // 跳过本地测试
    return request.headers.get("x-test-mode") === "true"
  },
})(async (request, paymentContext) => {
  // ...
})
```

---

### 对于 API 消费者（AI Agent / 付款方）

#### 1. 安装 PB-Stream Client SDK

```typescript
import { PBStreamClient } from "@/lib/sdk/pb-stream-client"

const client = new PBStreamClient({
  baseUrl: "https://api.protocolbanks.com",
  sessionKey: "sk_xxx_your_session_key", // 从 ProtocolBanks 获取
  autoRetry: true, // 余额不足时自动重试
  onPaymentSuccess: (paymentId, amount) => {
    console.log(`支付成功: ${paymentId}, 金额: ${amount} USDC`)
  },
  onLowBalance: (balance) => {
    console.warn(`余额不足警告: 剩余 ${balance} USDC`)
  },
})
```

#### 2. 打开支付通道

```typescript
// 开通支付通道，存入 $50
const channel = await client.openChannel({
  providerId: "provider_ai_generate",
  depositAmount: "50", // $50 USDC
  settlementThreshold: "10", // 累积 $10 后自动结算
  durationSeconds: 30 * 24 * 3600, // 30 天有效期
})

console.log(`通道已开通: ${channel.id}`)
```

#### 3. 发起请求（自动支付）

```typescript
// 使用 client.fetch() 替代 fetch()
const response = await client.fetch("/api/ai/generate", {
  method: "POST",
  body: JSON.stringify({
    prompt: "What is the meaning of life?",
  }),
})

// 如果余额充足，会自动扣款并返回结果
const data = await response.json()
console.log(data.result)

// 检查剩余余额
console.log(`剩余余额: ${client.getRemainingBalance()} USDC`)
```

#### 4. 便捷 JSON 请求

```typescript
const data = await client.fetchJson("/api/ai/generate", {
  method: "POST",
  body: JSON.stringify({
    prompt: "Explain quantum physics",
  }),
})

console.log(data.result)
```

#### 5. 手动结算

```typescript
// 手动触发结算（将累积的小额支付上链）
const settlement = await client.settle()

console.log(`结算成功: ${settlement.settlementId}`)
console.log(`结算金额: ${settlement.settledAmount} USDC`)
console.log(`交易哈希: ${settlement.transactionHash}`)
```

#### 6. 关闭通道

```typescript
// 关闭通道并结算剩余余额
const result = await client.closeChannel()

console.log(`通道已关闭，结算金额: ${result.settledAmount} USDC`)
```

---

## API 端点

### 支付通道管理

#### `POST /api/pb-stream/channels`
创建新支付通道

**请求体**：
```json
{
  "providerId": "provider_xxx",
  "depositAmount": "50",
  "settlementThreshold": "10",
  "durationSeconds": 2592000
}
```

**响应**：
```json
{
  "success": true,
  "channel": {
    "id": "ch_abc123",
    "providerId": "provider_xxx",
    "depositAmount": "50",
    "spentAmount": "0",
    "pendingAmount": "0",
    "status": "open",
    "expiresAt": "2026-03-05T00:00:00Z"
  }
}
```

---

#### `GET /api/pb-stream/channels/:id`
获取通道信息

**响应**：
```json
{
  "success": true,
  "channel": {
    "id": "ch_abc123",
    "depositAmount": "50",
    "spentAmount": "15.32",
    "pendingAmount": "2.45",
    "status": "open"
  },
  "stats": {
    "totalPayments": 1523,
    "avgPaymentAmount": "0.01",
    "pendingSettlement": "2.45"
  }
}
```

---

#### `DELETE /api/pb-stream/channels/:id`
关闭通道并结算

**响应**：
```json
{
  "success": true,
  "settledAmount": "2.45",
  "transactionHash": "0xabc..."
}
```

---

### 微支付处理

#### `POST /api/pb-stream/pay`
手动支付

**请求体**：
```json
{
  "channelId": "ch_abc123",
  "amount": "0.01",
  "resource": "/api/ai/generate"
}
```

**响应**：
```json
{
  "success": true,
  "paymentId": "mp_xyz789",
  "remainingBalance": "47.54",
  "requiresSettlement": false
}
```

---

#### `POST /api/pb-stream/settle`
手动结算

**请求体**：
```json
{
  "channelId": "ch_abc123"
}
```

**响应**：
```json
{
  "success": true,
  "settlementId": "stl_def456",
  "settledAmount": "9.87",
  "transactionHash": "0x..."
}
```

---

## 高级用法

### 1. 自定义支付逻辑

```typescript
import {
  checkPaymentRequired,
  processMicropayment,
  generatePaymentRequiredResponse,
} from "@/lib/services/pb-stream-service"

export async function POST(request: NextRequest) {
  const channelId = request.headers.get("x-payment-channel-id")

  // 自定义检查逻辑
  const check = await checkPaymentRequired("my_provider", channelId!, "0.05")

  if (check.required) {
    return NextResponse.json(
      generatePaymentRequiredResponse({
        amount: "0.05",
        recipient: "my_provider",
        message: "请充值支付通道",
      }),
      { status: 402 }
    )
  }

  // 处理微支付
  const payment = await processMicropayment({
    channelId: check.channel!.id,
    amount: "0.05",
    resource: "/api/my-service",
  })

  // 你的业务逻辑
  return NextResponse.json({ success: true })
}
```

---

### 2. Session Key 自动化

```typescript
// 创建 Session Key
const sessionKey = await createSessionKey({
  spendingLimit: "100", // $100 限额
  allowedTokens: ["USDC"],
  expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000), // 30 天
})

// 在支付通道中使用 Session Key
const client = new PBStreamClient({
  baseUrl: "https://api.protocolbanks.com",
  sessionKey: sessionKey.publicKey,
})

// 后续所有支付自动授权，无需人工签名
await client.fetch("/api/ai/generate", {...})
```

---

### 3. 错误处理

```typescript
import { PaymentRequiredError } from "@/lib/sdk/pb-stream-client"

try {
  const response = await client.fetch("/api/ai/generate", {...})
} catch (error) {
  if (error instanceof PaymentRequiredError) {
    console.error("支付失败:", error.paymentInfo)
    console.error("需要金额:", error.paymentInfo.amount)
    console.error("收款方:", error.paymentInfo.recipient)

    // 处理余额不足
    await client.openChannel({
      providerId: error.paymentInfo.recipient,
      depositAmount: "50",
    })

    // 重试请求
    return client.fetch("/api/ai/generate", {...})
  }
  throw error
}
```

---

## 配置选项

### 中间件配置

```typescript
interface PaymentMiddlewareConfig {
  providerId: string                // 服务商 ID（必填）
  pricePerRequest?: string          // 固定价格
  pricingFunction?: (request) => Promise<string> // 动态定价函数
  skipPaymentCheck?: (request) => boolean // 跳过支付检查条件
  onPaymentSuccess?: (channelId, amount) => void // 支付成功回调
  onPaymentFailure?: (error) => void // 支付失败回调
}
```

### 客户端配置

```typescript
interface PBStreamConfig {
  baseUrl: string                   // API 基础 URL（必填）
  sessionKey?: string               // Session Key
  channelId?: string                // 支付通道 ID
  autoRetry?: boolean               // 自动重试（默认: true）
  maxRetries?: number               // 最大重试次数（默认: 3）
  onPaymentSuccess?: (paymentId, amount) => void
  onPaymentFailure?: (error) => void
  onLowBalance?: (balance) => void  // 低余额警告
  lowBalanceThreshold?: number      // 低余额阈值（默认: 1 USDC）
}
```

---

## 数据库表结构

需要运行迁移脚本创建以下表：

```sql
-- 支付通道
CREATE TABLE payment_channels (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  consumer_id TEXT NOT NULL,
  consumer_address TEXT NOT NULL,
  session_key_public_key TEXT,
  deposit_amount TEXT NOT NULL,
  spent_amount TEXT DEFAULT '0',
  pending_amount TEXT DEFAULT '0',
  settlement_threshold TEXT DEFAULT '10',
  auto_settle_interval INTEGER DEFAULT 3600,
  status TEXT DEFAULT 'open',
  expires_at TIMESTAMP NOT NULL,
  last_settlement_at TIMESTAMP,
  last_activity_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 微支付记录
CREATE TABLE channel_payments (
  id TEXT PRIMARY KEY,
  channel_id TEXT REFERENCES payment_channels(id),
  amount TEXT NOT NULL,
  resource TEXT NOT NULL,
  metadata JSONB,
  status TEXT DEFAULT 'accumulated',
  settled_in_batch TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 结算记录
CREATE TABLE channel_settlements (
  id TEXT PRIMARY KEY,
  channel_id TEXT REFERENCES payment_channels(id),
  amount TEXT NOT NULL,
  status TEXT DEFAULT 'processing',
  transaction_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

---

## 最佳实践

### 1. 选择合适的结算阈值

- **低频大额 API**：设置较高阈值（$50-$100）
- **高频小额 API**：设置中等阈值（$10-$20）
- **超高频微支付**：设置较低阈值（$5-$10）

### 2. 监控余额

```typescript
const client = new PBStreamClient({
  baseUrl: "https://api.protocolbanks.com",
  sessionKey: "sk_xxx",
  lowBalanceThreshold: 5, // 低于 $5 发出警告
  onLowBalance: async (balance) => {
    console.warn(`余额不足: ${balance} USDC`)

    // 自动充值
    await client.openChannel({
      providerId: "provider_ai",
      depositAmount: "50",
    })
  },
})
```

### 3. 处理过期通道

```typescript
// 定期检查通道状态
const channel = await client.getChannel()

if (new Date(channel.expiresAt) < new Date()) {
  // 关闭旧通道
  await client.closeChannel()

  // 开通新通道
  await client.openChannel({
    providerId: "provider_ai",
    depositAmount: "50",
  })
}
```

### 4. 生产环境安全

- 使用 HTTPS
- 保护 Session Key 安全（不要提交到代码库）
- 限制 API 速率（防止恶意消费）
- 监控异常支付模式

---

## 故障排除

### 问题 1: 402 Payment Required 持续出现

**原因**：支付通道余额不足或已过期

**解决**：
```typescript
// 检查通道状态
const channel = await client.getChannel()
console.log("余额:", channel.depositAmount)
console.log("已用:", channel.spentAmount)
console.log("待结算:", channel.pendingAmount)
console.log("状态:", channel.status)

// 充值
await client.openChannel({
  providerId: "provider_xxx",
  depositAmount: "100",
})
```

---

### 问题 2: 支付成功但 API 返回错误

**原因**：支付成功但 API 逻辑执行失败

**解决**：检查 API 日志，支付已扣除不会回滚

---

### 问题 3: 结算失败

**原因**：链上交易失败或 Gas 不足

**解决**：查看 `channel_settlements` 表的 `status` 和错误信息

```sql
SELECT * FROM channel_settlements
WHERE status = 'failed'
ORDER BY created_at DESC LIMIT 10;
```

---

## 示例项目

完整示例项目：[examples/pb-stream-demo/](../examples/pb-stream-demo/)

```bash
cd examples/pb-stream-demo
npm install
npm run dev
```

---

## 联系支持

- GitHub Issues: https://github.com/everest-an/protocol-banks---web3/issues
- Twitter: [@0xPrococolBank](https://x.com/0xPrococolBank)
- Email: everest9812@gmail.com

---

**Happy Building! 🚀**
