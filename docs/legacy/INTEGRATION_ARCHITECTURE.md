# 功能集成架构说明

**更新日期:** 2026-02-08

---

## 📋 现有功能与新功能集成关系

### 1. 架构集成图

```
┌─────────────────────────────────────────────────────────────────┐
│                      Protocol Banks 完整架构                       │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │  用户 (Merchant)  │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  Dashboard UI     │
                    │  (已存在 ✅)      │
                    └────────┬─────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼─────┐      ┌──────▼──────┐     ┌────▼─────┐
    │支付管理   │      │订单管理      │     │对账管理   │
    │(已存在✅) │      │(已存在✅)    │     │(已存在✅) │
    └────┬─────┘      └──────┬──────┘     └────┬─────┘
         │                   │                   │
         │             ┌─────▼─────┐             │
         │             │新增:自动生息│             │
         │             │YieldAggregator          │
         │             └─────┬─────┘             │
         │                   │                   │
    ┌────▼─────────────────▼──────────────────▼─────┐
    │          Payment Service (已存在 ✅)            │
    │   - processSinglePayment()                     │
    │   - processBatchPayments()                     │
    │   - TRON/EVM 自动路由 ✅                       │
    └────┬──────────────────────────────────────────┘
         │
    ┌────▼──────────────────────────────────┐
    │  新增: PaymentQueueService (Redis)     │
    │  - 高并发处理                          │
    │  - 防双花验证                          │
    └────┬──────────────────────────────────┘
         │
    ┌────▼──────────────────────────────────┐
    │  TRON Payment Service (已存在 ✅)      │
    │  - sendTRC20()                         │
    │  - getTRC20Balance()                   │
    │  - getAccountResources()               │
    └────┬──────────────────────────────────┘
         │
         ▼
    TRON Network
```

---

## 2. 关键集成点

### 2.1 自动生息 ↔ 订单管理

**集成位置:** 订单确认后自动存入

```typescript
// lib/services/payment-service.ts (现有文件，添加钩子)

export async function processSinglePayment(
  recipient: Recipient,
  wallet: string,
  chain: string,
): Promise<PaymentResult> {
  // ... 现有支付逻辑 ...

  if (result.success) {
    // ✅ 现有: 触发 Webhook
    webhookTriggerService.triggerPaymentCompleted(...)

    // 🆕 新增: 自动存入生息 (可选功能)
    if (merchant.enableAutoYield) {
      await yieldAggregatorService.autoDeposit({
        merchantId: merchant.id,
        amount: recipient.amount,
        token: recipient.token
      })
    }
  }

  return result
}
```

**工作流程:**
```
订单支付成功 (已有功能)
    ↓
订单状态更新为 'confirmed' (已有功能)
    ↓
检查商户是否启用自动生息 (新增判断)
    ↓
如果启用 → 调用智能合约存入 JustLend (新增功能)
    ↓
生息记录保存到数据库 (新增表)
    ↓
Dashboard 显示利息收益 (新增 UI)
```

---

### 2.2 高并发队列 ↔ 现有支付系统

**集成位置:** 在支付验证前加入队列

```typescript
// app/api/v1/merchant/payments/[txHash]/verify/route.ts (现有文件)

export async function POST(req: NextRequest, { params }: { params: { txHash: string } }) {
  // ... 现有验证逻辑 ...

  // ✅ 现有: 直接验证
  // const result = await verifyPayment(txHash)

  // 🆕 新增: 加入队列处理
  const paymentQueue = new PaymentQueueService()
  const job = await paymentQueue.enqueuePayment({
    paymentId: payment.id,
    orderId: order.id,
    txHash: params.txHash,
    amount: payment.amount,
    priority: parseFloat(payment.amount) > 1000 ? 1 : 10  // 大额优先
  })

  return NextResponse.json({
    success: true,
    data: {
      jobId: job.id,
      status: 'queued',
      estimatedProcessTime: '2-5 seconds'
    }
  })
}
```

**优势:**
- ✅ 不修改现有验证逻辑
- ✅ 仅在前端加入队列层
- ✅ 高并发时自动排队
- ✅ 失败自动重试

---

### 2.3 防双花 ↔ 对账系统

**集成位置:** 对账匹配前验证

```typescript
// lib/services/reconciliation/auto-reconciliation.service.ts (现有文件)

async findMatchingOrder(payment: any, orders: any[]) {
  // 🆕 新增: 防双花检查
  const doubleSpendCheck = await doubleSpendPreventionService.verifyPayment(
    payment.tx_hash,
    payment.to_address,
    payment.amount
  )

  if (!doubleSpendCheck.valid) {
    console.warn(`[Reconciliation] Double spend detected: ${doubleSpendCheck.reason}`)
    return null  // 拒绝匹配
  }

  // ✅ 现有: 三种匹配策略
  // 策略 1: Memo 匹配
  if (payment.memo) {
    // ...
  }

  // 策略 2: 地址匹配
  // ...

  // 策略 3: 金额+时间匹配
  // ...
}
```

---

### 2.4 结构化日志 ↔ 所有服务

**集成位置:** 替换现有 console.log

```typescript
// lib/services/tron-payment.ts (现有文件，逐步替换日志)

import { StructuredLogger } from '@/lib/logger/structured-logger'
const logger = new StructuredLogger('tron-payment')

export async function sendTRC20(...) {
  // ❌ 旧代码: console.log('[TRON] Sending TRC20...')

  // ✅ 新代码:
  logger.logPayment('trc20_send_start', {
    paymentId: generatePaymentId(),
    tokenAddress,
    toAddress,
    amount,
    decimals
  })

  try {
    const txHash = await tronWeb.transactionBuilder.triggerSmartContract(...)

    logger.logPayment('trc20_send_success', {
      paymentId,
      txHash,
      confirmations: 0
    })

    return txHash

  } catch (error) {
    logger.logPayment('trc20_send_failed', { paymentId }, error)
    throw error
  }
}
```

**迁移策略:**
- 逐步替换，不影响现有功能
- 保留关键 console.log 用于调试
- 生产环境仅输出结构化日志

---

## 3. 数据库集成

### 3.1 新增表结构

```sql
-- 自动生息记录表
CREATE TABLE yield_deposits (
  id VARCHAR(255) PRIMARY KEY,
  merchant_id VARCHAR(255) NOT NULL,
  amount DECIMAL(20, 6) NOT NULL,
  token VARCHAR(10) NOT NULL DEFAULT 'USDT',
  principal DECIMAL(20, 6) NOT NULL,
  interest DECIMAL(20, 6) NOT NULL DEFAULT 0,
  apy DECIMAL(5, 2) NOT NULL,
  deposited_at TIMESTAMP NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, withdrawn
  tx_hash VARCHAR(255),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id),
  INDEX idx_merchant_status (merchant_id, status),
  INDEX idx_deposited_at (deposited_at)
);

-- 支付处理队列状态表 (Redis 的持久化备份)
CREATE TABLE payment_queue_jobs (
  id VARCHAR(255) PRIMARY KEY,
  payment_id VARCHAR(255) NOT NULL,
  order_id VARCHAR(255) NOT NULL,
  tx_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP,
  error_message TEXT,
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  INDEX idx_status (status),
  INDEX idx_tx_hash (tx_hash)
);
```

### 3.2 Prisma Schema 更新

```prisma
// prisma/schema.prisma (追加到现有 schema)

model YieldDeposit {
  id           String   @id @default(cuid())
  merchantId   String   @map("merchant_id")
  amount       Decimal  @db.Decimal(20, 6)
  token        String   @default("USDT")
  principal    Decimal  @db.Decimal(20, 6)
  interest     Decimal  @default(0) @db.Decimal(20, 6)
  apy          Decimal  @db.Decimal(5, 2)
  depositedAt  DateTime @default(now()) @map("deposited_at")
  withdrawnAt  DateTime? @map("withdrawn_at")
  status       String   @default("active")
  txHash       String?  @map("tx_hash")

  merchant     Merchant @relation(fields: [merchantId], references: [id])

  @@index([merchantId, status])
  @@index([depositedAt])
  @@map("yield_deposits")
}

model PaymentQueueJob {
  id           String   @id @default(cuid())
  paymentId    String   @map("payment_id")
  orderId      String   @map("order_id")
  txHash       String   @map("tx_hash")
  status       String   @default("pending")
  attempts     Int      @default(0)
  maxAttempts  Int      @default(3) @map("max_attempts")
  createdAt    DateTime @default(now()) @map("created_at")
  processedAt  DateTime? @map("processed_at")
  errorMessage String?  @map("error_message") @db.Text

  payment      Payment  @relation(fields: [paymentId], references: [id])
  order        Order    @relation(fields: [orderId], references: [id])

  @@index([status])
  @@index([txHash])
  @@map("payment_queue_jobs")
}
```

---

## 4. API 集成

### 4.1 Dashboard 新增 API 端点

```typescript
// 自动生息相关 (新增)
GET    /api/v1/merchant/yield/balance          // 查询生息余额
POST   /api/v1/merchant/yield/deposit          // 手动存入
POST   /api/v1/merchant/yield/withdraw         // 提取本金+利息
GET    /api/v1/merchant/yield/history          // 生息历史
PATCH  /api/v1/merchant/yield/settings         // 启用/禁用自动生息

// 队列管理 (新增)
GET    /api/v1/merchant/queue/status           // 查询队列状态
GET    /api/v1/merchant/queue/jobs             // 查询任务列表
POST   /api/v1/merchant/queue/retry/:jobId     // 手动重试失败任务
```

### 4.2 与现有 API 的关系

```
现有 API                          新增功能
─────────────────────────────────────────────────
/api/v1/merchant/orders           ✅ 不变
/api/v1/merchant/payments         ✅ 不变，但内部加入队列
/api/v1/merchant/reconciliation   ✅ 不变，但增加防双花检查
/api/v1/merchant/webhooks         ✅ 不变
/api/v1/merchant/dashboard/stats  ✅ 新增生息数据字段
```

---

## 5. UI 集成

### 5.1 Dashboard 页面布局

```typescript
// app/(products)/merchant-dashboard/page.tsx (现有文件)

export default function MerchantDashboardPage() {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">概览</TabsTrigger>          {/* ✅ 已存在 */}
        <TabsTrigger value="orders">订单管理</TabsTrigger>        {/* ✅ 已存在 */}
        <TabsTrigger value="payments">支付记录</TabsTrigger>      {/* ✅ 已存在 */}
        <TabsTrigger value="reconciliation">对账</TabsTrigger>    {/* ✅ 已存在 */}
        <TabsTrigger value="yield">自动生息</TabsTrigger>         {/* 🆕 新增 */}
        <TabsTrigger value="webhooks">Webhooks</TabsTrigger>      {/* ✅ 已存在 */}
      </TabsList>

      {/* ✅ 现有标签页保持不变 */}
      <TabsContent value="overview">
        <DashboardOverview />
      </TabsContent>

      {/* 🆕 新增生息标签页 */}
      <TabsContent value="yield">
        <YieldManagementPage />
      </TabsContent>
    </Tabs>
  )
}
```

### 5.2 概览页面增加生息卡片

```typescript
// components/dashboard/overview.tsx (现有文件)

export function DashboardOverview() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* ✅ 现有卡片 */}
      <StatCard title="今日收入" value="$1,234" />
      <StatCard title="今日订单" value="45" />
      <StatCard title="待确认" value="8" />

      {/* 🆕 新增生息卡片 */}
      <StatCard
        title="生息收益"
        value="+$12.50"
        icon={<TrendingUp className="text-green-600" />}
        trend="+8.5% APR"
      />
    </div>
  )
}
```

---

## 6. 环境配置集成

### 6.1 新增环境变量

```bash
# .env.local (追加到现有配置)

# ✅ 现有配置 (不变)
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_TRON_NETWORK="mainnet"

# 🆕 新增配置
# Redis (用于队列)
REDIS_URL="redis://localhost:6379"

# JustLend 合约地址
NEXT_PUBLIC_JUSDT_ADDRESS="TBcGYZDDzQSfG1oSrkoFPyXLJwUBCNLHLK"

# 自动生息合约地址
NEXT_PUBLIC_YIELD_AGGREGATOR_ADDRESS="TYourContractAddress"

# 日志级别
LOG_LEVEL="info"  # debug, info, warn, error

# ELK Stack (可选)
ELASTICSEARCH_URL="http://localhost:9200"
```

---

## 7. 部署集成

### 7.1 Docker Compose 更新

```yaml
# docker-compose.yml (现有文件，追加服务)

version: '3.8'
services:
  # ✅ 现有服务
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}

  postgres:
    image: postgres:14
    # ...

  # 🆕 新增服务
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  # 🆕 队列 Worker
  queue-worker:
    build: .
    command: node dist/workers/payment-queue-worker.js
    environment:
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      - redis
      - postgres

volumes:
  redis-data:
```

---

## 8. 迁移策略

### 8.1 零停机迁移

**阶段 1: 准备阶段 (1 天)**
```bash
# 1. 安装新依赖
pnpm add bullmq ioredis winston

# 2. 数据库迁移
pnpm prisma db push

# 3. 启动 Redis
docker-compose up -d redis
```

**阶段 2: 灰度发布 (3 天)**
```typescript
// 使用特性开关控制新功能
const ENABLE_QUEUE = process.env.ENABLE_QUEUE === 'true'
const ENABLE_AUTO_YIELD = process.env.ENABLE_AUTO_YIELD === 'true'

if (ENABLE_QUEUE) {
  await paymentQueue.enqueuePayment(...)
} else {
  await verifyPaymentDirectly(...)  // 现有逻辑
}
```

**阶段 3: 全量发布 (1 天)**
```bash
# 所有流量切换到新系统
export ENABLE_QUEUE=true
export ENABLE_AUTO_YIELD=true

# 重启服务
pm2 restart all
```

---

## 9. 监控集成

### 9.1 新增监控指标

```typescript
// lib/monitoring/metrics.ts (新增文件)

import { Registry, Counter, Histogram } from 'prom-client'

const register = new Registry()

// 队列指标
export const queueJobsTotal = new Counter({
  name: 'queue_jobs_total',
  help: 'Total number of queued jobs',
  labelNames: ['status'],
  registers: [register]
})

export const queueProcessingTime = new Histogram({
  name: 'queue_processing_time_seconds',
  help: 'Time to process a job',
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
})

// 生息指标
export const yieldDepositsTotal = new Counter({
  name: 'yield_deposits_total',
  help: 'Total amount deposited for yield',
  registers: [register]
})
```

### 9.2 Grafana Dashboard

在现有 Dashboard 基础上新增面板:
- 队列任务数
- 队列处理延迟
- 生息总额
- 生息 APY 趋势

---

## 10. 测试集成

### 10.1 现有测试保持不变

```bash
# ✅ 现有测试套件继续工作
pnpm test lib/services/tron-payment.test.ts
pnpm test lib/services/payment-service.test.ts
```

### 10.2 新增测试

```bash
# 🆕 队列测试
pnpm test lib/services/queue/payment-queue.test.ts

# 🆕 防双花测试
pnpm test lib/services/security/double-spend-prevention.test.ts

# 🆕 生息合约测试
pnpm test:contracts
```

---

## 总结

### ✅ 集成优势

1. **非侵入式**: 新功能不破坏现有代码
2. **渐进式**: 可以逐步开启新功能
3. **可回滚**: 出问题可立即关闭新功能
4. **高复用**: 充分利用现有基础设施

### 🎯 集成原则

- **保持向后兼容**: 现有 API 不变
- **特性开关控制**: 新功能可独立开关
- **灰度发布**: 先小流量测试
- **监控先行**: 新功能必须有监控

---

**下一步:** 开始实施 Week 1 开发计划
