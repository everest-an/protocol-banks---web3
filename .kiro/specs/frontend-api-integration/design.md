# Design Document

## Overview

本设计文档描述了前端 API 统一集成的技术实现方案。主要目标是将所有前端组件从直接 Supabase 访问迁移到 REST API，并完成数据库迁移、支付流程 Webhook 集成、Dashboard 活动组件更新和订阅执行引擎设置。

### 设计原则

1. **API 优先**: 所有前端数据操作通过 REST API 进行
2. **向后兼容**: 保持现有 demo 模式和 API 接口不变
3. **错误隔离**: Webhook 触发失败不影响主业务流程
4. **渐进式迁移**: 逐个组件迁移，确保每步可测试

## Architecture

```mermaid
graph TB
    subgraph Frontend
        AKP[API Keys Page]
        SP[Subscriptions Page]
        WP[Webhooks Page]
        DA[Dashboard Activity]
    end
    
    subgraph Hooks
        UAK[useApiKeys Hook]
        US[useSubscriptions Hook]
        UW[useWebhooks Hook]
        UDA[useDashboardActivity Hook]
    end
    
    subgraph API Routes
        AKR[/api/settings/api-keys]
        SR[/api/subscriptions]
        WR[/api/webhooks]
        AR[/api/agents/activities]
        SE[/api/subscriptions/execute]
    end
    
    subgraph Services
        AKS[APIKeyService]
        SS[SubscriptionService]
        WS[WebhookService]
        PS[PaymentService]
        WTS[WebhookTriggerService]
        DAS[DashboardActivityService]
    end
    
    subgraph Database
        DB[(Supabase)]
        PST[push_subscriptions]
        PT[payments + vendor_id]
    end
    
    AKP --> UAK --> AKR --> AKS --> DB
    SP --> US --> SR --> SS --> DB
    WP --> UW --> WR --> WS --> DB
    DA --> UDA --> AR --> DAS --> DB
    
    PS --> WTS --> WS
    SS --> SE
```

## Components and Interfaces

### 1. useApiKeys Hook

新建 Hook 用于 API Keys 页面的数据管理。

```typescript
// hooks/use-api-keys.ts
interface UseApiKeysReturn {
  apiKeys: ApiKey[];
  loading: boolean;
  error: string | null;
  createKey: (params: CreateKeyParams) => Promise<{ key: ApiKey; secret: string }>;
  deleteKey: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

interface CreateKeyParams {
  name: string;
  permissions: string[];
  rate_limit_per_minute?: number;
  rate_limit_per_day?: number;
  expires_at?: string;
}

export function useApiKeys(): UseApiKeysReturn {
  // 实现通过 fetch 调用 REST API
}
```

### 2. useSubscriptions Hook 更新

修改现有 Hook，将 Supabase 直接调用替换为 REST API 调用。

```typescript
// hooks/use-subscriptions.ts (更新)
const loadSubscriptions = async () => {
  if (isDemoMode) {
    setSubscriptions(DEMO_SUBSCRIPTIONS);
    return;
  }
  
  // 替换 Supabase 直接调用
  const response = await fetch('/api/subscriptions');
  if (!response.ok) throw new Error('Failed to load subscriptions');
  const data = await response.json();
  setSubscriptions(data.subscriptions);
};
```

### 3. useWebhooks Hook

新建 Hook 用于 Webhooks 页面的数据管理。

```typescript
// hooks/use-webhooks.ts
interface UseWebhooksReturn {
  webhooks: Webhook[];
  loading: boolean;
  error: string | null;
  createWebhook: (params: CreateWebhookParams) => Promise<{ webhook: Webhook; secret: string }>;
  updateWebhook: (id: string, params: UpdateWebhookParams) => Promise<void>;
  deleteWebhook: (id: string) => Promise<void>;
  testWebhook: (id: string) => Promise<TestResult>;
  getDeliveries: (id: string) => Promise<Delivery[]>;
  refresh: () => Promise<void>;
}
```

### 4. useDashboardActivity Hook

新建 Hook 用于 Dashboard 活动组件。

```typescript
// hooks/use-dashboard-activity.ts
interface UseDashboardActivityReturn {
  activities: Activity[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface Activity {
  id: string;
  type: 'sent' | 'received';
  amount: string;
  token: string;
  counterparty: string;
  counterpartyName?: string; // 供应商名称
  timestamp: string;
  txHash?: string;
}
```

### 5. Payment Service Webhook 集成

在 PaymentService 中集成 WebhookTriggerService。

```typescript
// lib/services/payment-service.ts (更新)
import { webhookTriggerService } from './webhook-trigger-service';

class PaymentService {
  async createPayment(params: CreatePaymentParams): Promise<Payment> {
    const payment = await this.savePayment(params);
    
    // 触发 webhook（不阻塞主流程）
    this.triggerWebhookSafe('created', payment);
    
    return payment;
  }
  
  private async triggerWebhookSafe(event: string, payment: Payment): Promise<void> {
    try {
      const eventData = this.buildPaymentEventData(payment);
      switch (event) {
        case 'created':
          await webhookTriggerService.triggerPaymentCreated(payment.from_address, eventData);
          break;
        case 'completed':
          await webhookTriggerService.triggerPaymentCompleted(payment.from_address, eventData);
          break;
        case 'failed':
          await webhookTriggerService.triggerPaymentFailed(payment.from_address, eventData);
          break;
      }
    } catch (error) {
      console.error(`[PaymentService] Webhook trigger failed for ${event}:`, error);
      // 不抛出错误，不影响主流程
    }
  }
}
```

### 6. Subscription Execution API

新建 API 端点供 Cron 作业调用。

```typescript
// app/api/subscriptions/execute/route.ts
export async function POST(request: NextRequest) {
  // 验证 Cron 作业密钥
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const subscriptionService = new SubscriptionService();
  const results = await subscriptionService.executeDueSubscriptions();
  
  return NextResponse.json({
    success: true,
    executed: results.executed,
    failed: results.failed,
    skipped: results.skipped,
  });
}
```

## Data Models

### push_subscriptions 表

```sql
-- scripts/018_create_push_subscriptions.sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_address, endpoint)
);

-- 索引
CREATE INDEX idx_push_subscriptions_user_address ON push_subscriptions(user_address);

-- RLS 策略
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (user_address = current_setting('app.current_user_address', true));

CREATE POLICY "Users can insert own push subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (user_address = current_setting('app.current_user_address', true));

CREATE POLICY "Users can delete own push subscriptions"
  ON push_subscriptions FOR DELETE
  USING (user_address = current_setting('app.current_user_address', true));
```

### payments 表 vendor_id 列

```sql
-- scripts/019_add_vendor_id_to_payments.sql
ALTER TABLE payments ADD COLUMN vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

-- 索引
CREATE INDEX idx_payments_vendor_id ON payments(vendor_id);

-- 更新现有支付记录的 vendor_id（可选）
UPDATE payments p
SET vendor_id = v.id
FROM vendors v
WHERE LOWER(p.to_address) = LOWER(v.wallet_address)
  AND p.vendor_id IS NULL;
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: API Keys Hook CRUD 操作正确性

*For any* API key 操作（创建、读取、删除），useApiKeys Hook 应该调用正确的 REST API 端点并正确处理响应和错误状态。

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6**

### Property 2: Subscriptions Hook REST API 迁移正确性

*For any* 订阅操作（加载、创建、更新、删除），useSubscriptions Hook 在非 demo 模式下应该调用 REST API 而不是直接 Supabase，并正确处理错误和重试。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6**

### Property 3: Webhooks Hook CRUD 操作正确性

*For any* webhook 操作（创建、读取、更新、删除、测试），useWebhooks Hook 应该调用正确的 REST API 端点。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 4: 支付-供应商自动关联

*For any* 支付创建，如果 to_address 匹配某个 vendor 的 wallet_address（不区分大小写），则 vendor_id 应该自动设置为该 vendor 的 ID。

**Validates: Requirements 5.2**

### Property 5: Webhook 触发与支付流程隔离

*For any* 支付操作，即使 webhook 触发失败，支付操作本身应该成功完成。

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

### Property 6: 订阅执行日期计算正确性

*For any* 订阅频率（daily、weekly、monthly、yearly）和任意当前日期，下次支付日期应该正确计算，包括月末边界情况。

**Validates: Requirements 8.3, 8.5, 8.6**

### Property 7: 订阅状态过滤

*For any* 暂停或取消的订阅，订阅执行引擎不应该为其创建支付交易。

**Validates: Requirements 8.7**

### Property 8: Dashboard 活动供应商名称显示

*For any* 关联到供应商的支付活动，Dashboard 应该显示供应商名称而不是原始地址。

**Validates: Requirements 7.3**

## Error Handling

### API 请求错误处理

```typescript
// 统一的 API 错误处理
async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(error.message || `HTTP ${response.status}`, response.status);
  }
  
  return response.json();
}

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}
```

### Webhook 触发错误隔离

```typescript
// Webhook 触发不应该影响主业务流程
private async triggerWebhookSafe(event: string, data: any): Promise<void> {
  try {
    await webhookTriggerService.trigger(event, data);
  } catch (error) {
    // 记录错误但不抛出
    console.error(`[WebhookTrigger] Failed to trigger ${event}:`, error);
    // 可选：发送到监控系统
  }
}
```

### 订阅执行错误处理

```typescript
// 单个订阅执行失败不应该影响其他订阅
async executeDueSubscriptions(): Promise<ExecutionResults> {
  const dueSubscriptions = await this.getDueSubscriptions();
  const results = { executed: 0, failed: 0, skipped: 0 };
  
  for (const subscription of dueSubscriptions) {
    try {
      await this.executeSubscription(subscription);
      results.executed++;
    } catch (error) {
      console.error(`[SubscriptionEngine] Failed to execute ${subscription.id}:`, error);
      await this.markSubscriptionFailed(subscription.id, error.message);
      results.failed++;
    }
  }
  
  return results;
}
```

## Testing Strategy

### 单元测试

1. **Hook 测试**: 使用 Jest 和 React Testing Library 测试 Hook 行为
2. **Service 测试**: 测试业务逻辑和数据处理
3. **API 路由测试**: 测试请求验证和响应格式

### 属性测试

使用 fast-check 进行属性测试，每个属性测试至少运行 100 次迭代。

```typescript
// 示例：订阅日期计算属性测试
import fc from 'fast-check';

describe('Subscription date calculation', () => {
  it('Property 6: next payment date is always in the future', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('daily', 'weekly', 'monthly', 'yearly'),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        (frequency, currentDate) => {
          const nextDate = calculateNextPaymentDate(currentDate, frequency);
          return nextDate > currentDate;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### 测试配置

- 属性测试最少 100 次迭代
- 每个属性测试标注对应的设计文档属性编号
- 标签格式: **Feature: frontend-api-integration, Property {number}: {property_text}**

