# Prisma 迁移分析报告

## 1. 当前数据库架构概览

### 1.1 技术栈
- **数据库**: PostgreSQL (通过 Supabase 托管)
- **ORM/客户端**: Supabase JavaScript Client (`@supabase/ssr`, `@supabase/supabase-js`)
- **迁移管理**: 手动 SQL 脚本 (scripts/*.sql)
- **安全机制**: Row Level Security (RLS) 策略

### 1.2 数据库表清单

| 表名 | 用途 | 关联关系 |
|------|------|----------|
| `vendors` | 供应商/收款方管理 | - |
| `payments` | 支付交易记录 | → vendors |
| `batch_payments` | 批量支付批次 | - |
| `batch_payment_items` | 批量支付明细 | → batch_payments, payments |
| `merchants` | 收单商户 | - |
| `merchant_api_keys` | 商户 API 密钥 | → merchants |
| `acquiring_orders` | 收单订单 | → merchants |
| `merchant_balances` | 商户余额 | → merchants |
| `auth_users` | 认证用户 | - |
| `magic_links` | 魔法链接登录 | - |
| `embedded_wallets` | 嵌入式钱包 | → auth_users |
| `auth_sessions` | 会话管理 | → auth_users |
| `wallet_recovery_requests` | 钱包恢复请求 | → auth_users |
| `device_shares` | 设备密钥分片 | → auth_users, embedded_wallets |
| `agents` | AI 代理 | - |
| `agent_budgets` | 代理预算 | → agents |
| `payment_proposals` | 支付提案 | → agents, agent_budgets |
| `agent_webhook_deliveries` | 代理 Webhook 投递 | → agents |
| `agent_activities` | 代理活动日志 | → agents |
| `multisig_wallets` | 多签钱包 | - |
| `multisig_signers` | 多签签名者 | → multisig_wallets |
| `multisig_transactions` | 多签交易 | → multisig_wallets |
| `multisig_confirmations` | 多签确认 | → multisig_transactions |
| `api_keys` | API 密钥 | - |
| `api_key_usage_logs` | API 使用日志 | → api_keys |
| `webhooks` | Webhook 配置 | - |
| `webhook_deliveries` | Webhook 投递记录 | → webhooks |
| `subscriptions` | 个人订阅 | - |
| `auto_payments` | 自动支付 | → vendors |
| `invoices` | 发票 | - |
| `push_subscriptions` | 推送订阅 | - |
| `system_config` | 系统配置 | - |
| `contract_deployments` | 合约部署记录 | - |
| `domain_whitelist` | 域名白名单 | - |
| `monitoring_alerts` | 监控告警 | - |
| `offramp_transactions` | 出金交易 | - |

**总计: 约 32 张表**

### 1.3 当前 Supabase 使用模式

```typescript
// 客户端调用示例
const supabase = createClient();
const { data, error } = await supabase
  .from('agents')
  .select('*')
  .eq('owner_address', address);
```

**特点**:
- 使用 Supabase 的链式查询 API
- 依赖 RLS 进行权限控制
- 无类型安全（返回 `any` 类型）
- 分散在 20+ 个服务文件中

---

## 2. 迁移成本评估

### 2.1 工作量估算

| 任务 | 预估时间 | 复杂度 |
|------|----------|--------|
| Prisma Schema 定义 | 2-3 天 | 中 |
| 数据库内省 & 同步 | 0.5 天 | 低 |
| 服务层代码重构 | 5-7 天 | 高 |
| RLS → 应用层权限迁移 | 3-4 天 | 高 |
| 测试用例更新 | 2-3 天 | 中 |
| 集成测试 & 调试 | 2-3 天 | 中 |
| **总计** | **15-20 天** | - |

### 2.2 代码影响范围

需要修改的文件（基于 grep 分析）:

```
lib/services/
├── agent-service.ts          ✗ 需重构
├── agent-activity-service.ts ✗ 需重构
├── agent-webhook-service.ts  ✗ 需重构
├── api-key-service.ts        ✗ 需重构
├── budget-service.ts         ✗ 需重构
├── proposal-service.ts       ✗ 需重构
├── subscription-service.ts   ✗ 需重构
├── webhook-service.ts        ✗ 需重构
├── vendor-service.ts         ✗ 需重构
├── notification-service.ts   ✗ 需重构
├── analytics-service.ts      ✗ 需重构
├── multisig-service.ts       ✗ 需重构
├── history-service.ts        ✗ 需重构
├── payment-service.ts        ✗ 需重构
└── ... (约 15+ 个服务文件)

services/
├── account-validator.service.ts  ✗ 需重构
├── fee-distributor.service.ts    ✗ 需重构
└── recovery-manager.service.ts   ✗ 需重构

app/api/
├── agents/                   ✗ 需重构 (多个 route.ts)
├── webhooks/                 ✗ 需重构
├── subscriptions/            ✗ 需重构
└── ... (约 20+ 个 API 路由)
```

**预估影响**: 50+ 个文件，3000+ 行代码

### 2.3 风险评估

| 风险 | 等级 | 说明 |
|------|------|------|
| RLS 策略丢失 | 🔴 高 | Prisma 不支持 RLS，需在应用层实现 |
| 数据库函数/触发器 | 🟡 中 | 需手动维护或迁移到应用层 |
| 生产环境迁移 | 🟡 中 | 需要停机或蓝绿部署 |
| 类型不匹配 | 🟢 低 | Prisma 内省可自动处理 |
| 性能差异 | 🟢 低 | Prisma 查询性能通常相当 |

---

## 3. 迁移方案

### 3.1 方案 A: 完全迁移到 Prisma（推荐）

**步骤**:

1. **安装 Prisma**
```bash
pnpm add prisma @prisma/client
pnpm add -D prisma
npx prisma init
```

2. **从现有数据库内省生成 Schema**
```bash
npx prisma db pull
```

3. **优化生成的 Schema**
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Agent {
  id                  String   @id @default(uuid())
  ownerAddress        String   @map("owner_address")
  name                String
  description         String?
  type                AgentType @default(custom)
  avatarUrl           String?  @map("avatar_url")
  apiKeyHash          String   @map("api_key_hash")
  apiKeyPrefix        String   @unique @map("api_key_prefix")
  webhookUrl          String?  @map("webhook_url")
  webhookSecretHash   String?  @map("webhook_secret_hash")
  status              AgentStatus @default(active)
  autoExecuteEnabled  Boolean  @default(false) @map("auto_execute_enabled")
  autoExecuteRules    Json     @default("{}") @map("auto_execute_rules")
  rateLimitPerMinute  Int      @default(60) @map("rate_limit_per_minute")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")
  lastActiveAt        DateTime? @map("last_active_at")

  budgets             AgentBudget[]
  proposals           PaymentProposal[]
  webhookDeliveries   AgentWebhookDelivery[]
  activities          AgentActivity[]

  @@map("agents")
  @@index([ownerAddress])
  @@index([status])
}

enum AgentType {
  trading
  payroll
  expense
  subscription
  custom
}

enum AgentStatus {
  active
  paused
  deactivated
}

// ... 其他模型定义
```

4. **创建 Prisma 客户端封装**
```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

5. **逐步重构服务层**
```typescript
// lib/services/agent-service.ts (重构后)
import { prisma } from '@/lib/prisma'

export async function getAgents(ownerAddress: string) {
  return prisma.agent.findMany({
    where: { ownerAddress: ownerAddress.toLowerCase() },
    include: {
      budgets: true,
      _count: { select: { proposals: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
}
```

6. **实现应用层权限控制**
```typescript
// lib/middleware/auth-guard.ts
export function withOwnerCheck<T extends { ownerAddress: string }>(
  data: T | null,
  currentUser: string
): T | null {
  if (!data) return null
  if (data.ownerAddress.toLowerCase() !== currentUser.toLowerCase()) {
    throw new Error('Unauthorized')
  }
  return data
}
```

**优点**:
- ✅ 完整的类型安全
- ✅ 自动生成的类型定义
- ✅ 更好的开发体验（自动补全）
- ✅ 统一的迁移管理
- ✅ 更清晰的关联关系

**缺点**:
- ❌ 需要大量代码重构
- ❌ 失去 Supabase RLS 保护
- ❌ 需要手动管理数据库函数

### 3.2 方案 B: Prisma + Supabase 混合使用

保留 Supabase 用于认证和实时功能，Prisma 用于数据访问。

```typescript
// 认证仍使用 Supabase
import { createClient } from '@/lib/supabase/server'

// 数据访问使用 Prisma
import { prisma } from '@/lib/prisma'

export async function getAgentsWithAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('Unauthorized')
  
  return prisma.agent.findMany({
    where: { ownerAddress: user.email }
  })
}
```

**优点**:
- ✅ 保留 Supabase 认证
- ✅ 渐进式迁移
- ✅ 降低风险

**缺点**:
- ❌ 两套客户端维护
- ❌ 复杂度增加

### 3.3 方案 C: 仅使用 Prisma 做类型生成（最小改动）

只用 Prisma 生成类型，继续使用 Supabase 客户端。

```typescript
// 生成类型但不使用 Prisma Client
import type { Agent, AgentBudget } from '@prisma/client'

// 继续使用 Supabase
const { data } = await supabase
  .from('agents')
  .select('*')
  .returns<Agent[]>()
```

**优点**:
- ✅ 最小改动
- ✅ 获得类型安全
- ✅ 保留所有 Supabase 功能

**缺点**:
- ❌ 类型可能不同步
- ❌ 没有 Prisma 的查询优势

---

## 4. 推荐方案

### 4.1 短期（1-2 周）: 方案 C
- 安装 Prisma，从数据库内省生成 Schema
- 使用生成的类型增强现有代码
- 不改变现有查询逻辑

### 4.2 中期（1-2 月）: 方案 B
- 新功能使用 Prisma
- 逐步迁移核心服务
- 保留 Supabase 认证

### 4.3 长期（3+ 月）: 方案 A
- 完全迁移到 Prisma
- 实现应用层权限控制
- 移除 Supabase 数据访问依赖

---

## 5. Prisma Schema 草案

基于现有数据库结构，以下是完整的 Prisma Schema 草案：

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== 核心业务 ====================

model Vendor {
  id            String    @id @default(uuid())
  walletAddress String    @unique @map("wallet_address")
  name          String
  email         String?
  notes         String?
  createdBy     String    @map("created_by")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  
  payments      Payment[]
  autoPayments  AutoPayment[]

  @@map("vendors")
  @@index([walletAddress])
  @@index([createdBy])
}

model Payment {
  id           String    @id @default(uuid())
  txHash       String?   @unique @map("tx_hash")
  fromAddress  String    @map("from_address")
  toAddress    String    @map("to_address")
  vendorId     String?   @map("vendor_id")
  tokenSymbol  String    @map("token_symbol")
  tokenAddress String    @map("token_address")
  amount       String
  amountUsd    Decimal?  @map("amount_usd") @db.Decimal(20, 2)
  status       String    @default("pending")
  blockNumber  BigInt?   @map("block_number")
  gasUsed      String?   @map("gas_used")
  gasPrice     String?   @map("gas_price")
  timestamp    DateTime  @default(now())
  notes        String?
  createdAt    DateTime  @default(now()) @map("created_at")

  vendor       Vendor?   @relation(fields: [vendorId], references: [id], onDelete: SetNull)
  batchItems   BatchPaymentItem[]

  @@map("payments")
  @@index([fromAddress])
  @@index([toAddress])
  @@index([vendorId])
  @@index([timestamp(sort: Desc)])
}

model BatchPayment {
  id              String    @id @default(uuid())
  batchName       String?   @map("batch_name")
  walletAddress   String    @map("wallet_address")
  totalRecipients Int       @default(0) @map("total_recipients")
  totalAmountUsd  Decimal?  @map("total_amount_usd") @db.Decimal(20, 2)
  status          String    @default("pending")
  createdAt       DateTime  @default(now()) @map("created_at")
  completedAt     DateTime? @map("completed_at")

  items           BatchPaymentItem[]

  @@map("batch_payments")
  @@index([walletAddress])
}

model BatchPaymentItem {
  id        String   @id @default(uuid())
  batchId   String   @map("batch_id")
  paymentId String   @map("payment_id")
  createdAt DateTime @default(now()) @map("created_at")

  batch     BatchPayment @relation(fields: [batchId], references: [id], onDelete: Cascade)
  payment   Payment      @relation(fields: [paymentId], references: [id], onDelete: Cascade)

  @@map("batch_payment_items")
  @@index([batchId])
}

// ==================== AI 代理系统 ====================

model Agent {
  id                 String      @id @default(uuid())
  ownerAddress       String      @map("owner_address")
  name               String
  description        String?
  type               String      @default("custom")
  avatarUrl          String?     @map("avatar_url")
  apiKeyHash         String      @map("api_key_hash")
  apiKeyPrefix       String      @unique @map("api_key_prefix")
  webhookUrl         String?     @map("webhook_url")
  webhookSecretHash  String?     @map("webhook_secret_hash")
  status             String      @default("active")
  autoExecuteEnabled Boolean     @default(false) @map("auto_execute_enabled")
  autoExecuteRules   Json        @default("{}") @map("auto_execute_rules")
  rateLimitPerMinute Int         @default(60) @map("rate_limit_per_minute")
  createdAt          DateTime    @default(now()) @map("created_at")
  updatedAt          DateTime    @updatedAt @map("updated_at")
  lastActiveAt       DateTime?   @map("last_active_at")

  budgets            AgentBudget[]
  proposals          PaymentProposal[]
  webhookDeliveries  AgentWebhookDelivery[]
  activities         AgentActivity[]

  @@map("agents")
  @@index([ownerAddress])
  @@index([status])
  @@index([type])
}

model AgentBudget {
  id           String    @id @default(uuid())
  agentId      String    @map("agent_id")
  ownerAddress String    @map("owner_address")
  amount       String
  token        String
  chainId      Int?      @map("chain_id")
  period       String
  usedAmount   String    @default("0") @map("used_amount")
  periodStart  DateTime  @default(now()) @map("period_start")
  periodEnd    DateTime? @map("period_end")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  agent        Agent     @relation(fields: [agentId], references: [id], onDelete: Cascade)
  proposals    PaymentProposal[]

  @@map("agent_budgets")
  @@index([agentId])
  @@index([ownerAddress])
}

model PaymentProposal {
  id                   String    @id @default(uuid())
  agentId              String    @map("agent_id")
  ownerAddress         String    @map("owner_address")
  recipientAddress     String    @map("recipient_address")
  amount               String
  token                String
  chainId              Int       @map("chain_id")
  reason               String
  metadata             Json      @default("{}")
  status               String    @default("pending")
  rejectionReason      String?   @map("rejection_reason")
  budgetId             String?   @map("budget_id")
  x402AuthorizationId  String?   @map("x402_authorization_id")
  txHash               String?   @map("tx_hash")
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")
  approvedAt           DateTime? @map("approved_at")
  executedAt           DateTime? @map("executed_at")

  agent                Agent        @relation(fields: [agentId], references: [id], onDelete: Cascade)
  budget               AgentBudget? @relation(fields: [budgetId], references: [id])

  @@map("payment_proposals")
  @@index([agentId])
  @@index([ownerAddress])
  @@index([status])
  @@index([createdAt(sort: Desc)])
}

model AgentWebhookDelivery {
  id             String    @id @default(uuid())
  agentId        String    @map("agent_id")
  eventType      String    @map("event_type")
  payload        Json
  status         String    @default("pending")
  attempts       Int       @default(0)
  lastAttemptAt  DateTime? @map("last_attempt_at")
  nextRetryAt    DateTime? @map("next_retry_at")
  responseStatus Int?      @map("response_status")
  responseBody   String?   @map("response_body")
  errorMessage   String?   @map("error_message")
  createdAt      DateTime  @default(now()) @map("created_at")
  deliveredAt    DateTime? @map("delivered_at")

  agent          Agent     @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@map("agent_webhook_deliveries")
  @@index([agentId])
  @@index([status])
}

model AgentActivity {
  id           String   @id @default(uuid())
  agentId      String   @map("agent_id")
  ownerAddress String   @map("owner_address")
  action       String
  details      Json     @default("{}")
  ipAddress    String?  @map("ip_address")
  userAgent    String?  @map("user_agent")
  createdAt    DateTime @default(now()) @map("created_at")

  agent        Agent    @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@map("agent_activities")
  @@index([agentId])
  @@index([ownerAddress])
  @@index([createdAt(sort: Desc)])
}

// ==================== 认证系统 ====================

model AuthUser {
  id            String    @id @default(uuid())
  email         String?   @unique
  googleId      String?   @unique @map("google_id")
  appleId       String?   @unique @map("apple_id")
  displayName   String?   @map("display_name")
  avatarUrl     String?   @map("avatar_url")
  emailVerified Boolean   @default(false) @map("email_verified")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  wallets       EmbeddedWallet[]
  sessions      AuthSession[]
  recoveryRequests WalletRecoveryRequest[]
  deviceShares  DeviceShare[]

  @@map("auth_users")
}

model EmbeddedWallet {
  id                     String   @id @default(uuid())
  userId                 String   @map("user_id")
  address                String
  serverShareEncrypted   String   @map("server_share_encrypted")
  serverShareIv          String   @map("server_share_iv")
  recoveryShareEncrypted String   @map("recovery_share_encrypted")
  recoveryShareIv        String   @map("recovery_share_iv")
  salt                   String
  chainType              String   @default("EVM") @map("chain_type")
  isPrimary              Boolean  @default(true) @map("is_primary")
  createdAt              DateTime @default(now()) @map("created_at")
  updatedAt              DateTime @updatedAt @map("updated_at")

  user                   AuthUser @relation(fields: [userId], references: [id], onDelete: Cascade)
  deviceShares           DeviceShare[]

  @@unique([userId, chainType, isPrimary])
  @@map("embedded_wallets")
  @@index([userId])
  @@index([address])
}

model AuthSession {
  id               String   @id @default(uuid())
  userId           String   @map("user_id")
  sessionTokenHash String   @unique @map("session_token_hash")
  deviceFingerprint String? @map("device_fingerprint")
  ipAddress        String?  @map("ip_address")
  userAgent        String?  @map("user_agent")
  expiresAt        DateTime @map("expires_at")
  lastActiveAt     DateTime @default(now()) @map("last_active_at")
  createdAt        DateTime @default(now()) @map("created_at")

  user             AuthUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("auth_sessions")
  @@index([userId])
  @@index([expiresAt])
}

// ==================== 更多模型... ====================
// (Subscription, ApiKey, Webhook, Multisig 等表结构类似)
```

---

## 6. 迁移检查清单

### 6.1 准备阶段
- [ ] 备份生产数据库
- [ ] 安装 Prisma 依赖
- [ ] 配置 DATABASE_URL 环境变量
- [ ] 运行 `prisma db pull` 内省现有数据库

### 6.2 开发阶段
- [ ] 优化生成的 Prisma Schema
- [ ] 创建 Prisma 客户端单例
- [ ] 编写权限控制中间件
- [ ] 逐个重构服务文件
- [ ] 更新单元测试

### 6.3 测试阶段
- [ ] 本地集成测试
- [ ] Staging 环境验证
- [ ] 性能基准测试
- [ ] 安全审计

### 6.4 部署阶段
- [ ] 制定回滚计划
- [ ] 选择部署窗口
- [ ] 执行迁移
- [ ] 监控错误日志

---

## 7. Prisma vs Supabase Client 详细对比

### 7.1 类型安全

**Supabase Client:**
```typescript
// ❌ 返回 any，没有类型推断
const { data } = await supabase.from('agents').select('*')
// data 类型是 any[]

// 需要手动定义类型
interface Agent { id: string; name: string; ... }
const { data } = await supabase.from('agents').select('*').returns<Agent[]>()
```

**Prisma:**
```typescript
// ✅ 自动推断完整类型
const agents = await prisma.agent.findMany()
// agents 类型是 Agent[]，包含所有字段

// 关联查询也有完整类型
const agent = await prisma.agent.findUnique({
  where: { id },
  include: { budgets: true, proposals: true }
})
// agent.budgets 和 agent.proposals 都有正确类型
```

### 7.2 查询 API 对比

**Supabase - 链式 API:**
```typescript
// 复杂查询需要字符串拼接
const { data } = await supabase
  .from('agents')
  .select('*, budgets(*), proposals(count)')
  .eq('owner_address', address)
  .in('status', ['active', 'paused'])
  .order('created_at', { ascending: false })
  .range(0, 9)
```

**Prisma - 对象式 API:**
```typescript
// 结构化查询，IDE 自动补全
const agents = await prisma.agent.findMany({
  where: {
    ownerAddress: address,
    status: { in: ['active', 'paused'] }
  },
  include: {
    budgets: true,
    _count: { select: { proposals: true } }
  },
  orderBy: { createdAt: 'desc' },
  take: 10
})
```

### 7.3 优缺点总结

| 特性 | Supabase Client | Prisma | 说明 |
|------|-----------------|--------|------|
| **类型安全** | ⭐⭐ | ⭐⭐⭐⭐⭐ | Prisma 自动生成类型，Supabase 需手动定义 |
| **开发体验** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Prisma 有更好的 IDE 支持和自动补全 |
| **学习曲线** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Supabase API 更简单直观 |
| **RLS 支持** | ⭐⭐⭐⭐⭐ | ⭐ | Supabase 原生支持，Prisma 需应用层实现 |
| **实时订阅** | ⭐⭐⭐⭐⭐ | ❌ | Supabase 内置 Realtime，Prisma 不支持 |
| **迁移管理** | ⭐⭐ | ⭐⭐⭐⭐⭐ | Prisma Migrate 自动化程度高 |
| **关联查询** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Prisma 的 include/select 更强大 |
| **事务支持** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Prisma 有更好的事务 API |
| **原始 SQL** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 两者都支持，Supabase 更直接 |
| **Edge 部署** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Supabase 更轻量，Prisma 需要 Data Proxy |
| **Bundle 大小** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Supabase ~50KB，Prisma ~200KB+ |
| **社区生态** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Prisma 社区更大，插件更多 |

### 7.4 Supabase Client 的独特优势

1. **Row Level Security (RLS)**
   - 数据库层面的权限控制，更安全
   - 即使 API 被绕过，数据仍受保护
   - Prisma 需要在每个查询中手动添加权限检查

2. **实时订阅**
   ```typescript
   // Supabase 独有功能
   supabase
     .channel('payments')
     .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payments' }, 
       (payload) => console.log('New payment:', payload))
     .subscribe()
   ```

3. **与 Supabase 生态集成**
   - Auth、Storage、Edge Functions 无缝配合
   - 统一的 Dashboard 管理

4. **更轻量**
   - 适合 Serverless/Edge 环境
   - 冷启动更快

### 7.5 Prisma 的独特优势

1. **类型安全的关联查询**
   ```typescript
   // Prisma 可以精确控制返回字段
   const agent = await prisma.agent.findUnique({
     where: { id },
     select: {
       id: true,
       name: true,
       budgets: {
         select: { amount: true, token: true },
         where: { period: 'monthly' }
       }
     }
   })
   // 返回类型精确匹配 select 的字段
   ```

2. **强大的事务支持**
   ```typescript
   // 交互式事务
   await prisma.$transaction(async (tx) => {
     const budget = await tx.agentBudget.update({
       where: { id: budgetId },
       data: { usedAmount: { increment: amount } }
     })
     
     if (parseFloat(budget.usedAmount) > parseFloat(budget.amount)) {
       throw new Error('Budget exceeded')
     }
     
     await tx.paymentProposal.create({ data: proposalData })
   })
   ```

3. **Schema 即文档**
   ```prisma
   model Agent {
     /// AI 代理的唯一标识
     id String @id @default(uuid())
     
     /// 代理所有者的钱包地址
     ownerAddress String @map("owner_address")
     
     // 关系一目了然
     budgets AgentBudget[]
     proposals PaymentProposal[]
   }
   ```

4. **迁移版本控制**
   ```bash
   # 自动生成迁移文件
   npx prisma migrate dev --name add_agent_tags
   
   # 生成的迁移可以 code review
   # migrations/20260125_add_agent_tags/migration.sql
   ```

### 7.6 你的项目适合哪个？

**继续使用 Supabase Client 如果:**
- ✅ 重度依赖 RLS 做权限控制
- ✅ 需要实时订阅功能
- ✅ 团队熟悉 Supabase 生态
- ✅ 部署在 Edge/Serverless 环境
- ✅ 不想大规模重构

**迁移到 Prisma 如果:**
- ✅ 类型安全是首要需求
- ✅ 有复杂的关联查询
- ✅ 需要更好的事务支持
- ✅ 想要自动化的迁移管理
- ✅ 团队有 Prisma 经验

### 7.7 折中方案：两者共存

```typescript
// lib/db.ts - 统一导出
export { prisma } from './prisma'           // 数据访问
export { createClient } from './supabase'   // Auth + Realtime

// 使用示例
import { prisma, createClient } from '@/lib/db'

// 认证用 Supabase
const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()

// 数据查询用 Prisma（带类型）
const agents = await prisma.agent.findMany({
  where: { ownerAddress: user.email }
})

// 实时订阅用 Supabase
supabase.channel('agents').on('postgres_changes', ...).subscribe()
```

---

## 8. 结论

| 维度 | Supabase Client | Prisma |
|------|-----------------|--------|
| 类型安全 | ❌ 弱 | ✅ 强 |
| 开发体验 | 🟡 中等 | ✅ 优秀 |
| RLS 支持 | ✅ 原生 | ❌ 需应用层 |
| 迁移管理 | ❌ 手动 SQL | ✅ 自动化 |
| 学习曲线 | ✅ 低 | 🟡 中等 |
| 社区生态 | 🟡 中等 | ✅ 丰富 |

**建议**: 采用渐进式迁移策略，先用 Prisma 增强类型安全，再逐步替换数据访问层。预计总工期 15-20 个工作日，建议分 2-3 个迭代完成。
