# v0 快速任务清单

## 🚨 立即需要做的事情

### 任务 1: 接入 x402 CDP 结算 (最重要)

**文件**: `app/pay/page.tsx`

**需要做的**:
1. 调用 `/api/x402/settle` API 进行支付结算
2. 显示结算方式 (CDP = 0费用, Relayer = 有费用)
3. Base 链 (chainId: 8453) 显示 "0 手续费" 标识

**API 调用示例**:
```typescript
const response = await fetch('/api/x402/settle', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    authorizationId: 'xxx',
    chainId: 8453,
    paymentDetails: {
      amount: '100000000', // 100 USDC (6 decimals)
      token: 'USDC',
      recipient: '0x...'
    },
    signature: '0x...'
  })
});

const result = await response.json();
// result.settlementMethod: 'cdp' | 'relayer'
// result.fee: '0' (Base链) 或 '0.001' (其他链)
```

---

### 任务 2: 批量支付页面接入后端

**文件**: `app/batch-payment/page.tsx`

**需要连接的 API**:
```
POST /api/batch-payment/upload         - 上传文件
POST /api/batch-payment/validate       - 验证数据
POST /api/batch-payment/calculate-fees - 计算费用
POST /api/batch-payment/submit         - 提交支付
GET  /api/batch-payment/:id/status     - 查询状态
```

**使用现有 Hook**:
```typescript
import { useBatchPayment } from '@/hooks/use-batch-payment';

const { uploadFile, validateBatch, submitBatch, batchStatus } = useBatchPayment();
```

---

### 任务 3: 创建 MCP 订阅管理页面

**需要创建**: `app/subscriptions/mcp/page.tsx`

**API**:
```
GET  /api/mcp/plans          - 获取计划列表
GET  /api/mcp/subscriptions  - 获取当前订阅
POST /api/mcp/subscriptions  - 创建订阅
```

**使用现有 Hook**:
```typescript
import { useMCPSubscriptions } from '@/hooks/use-mcp-subscriptions';

const { plans, subscription, subscribe, cancel } = useMCPSubscriptions();
```

**UI 需求**:
- 显示 3 个订阅计划 (Free, Pro, Enterprise)
- 显示当前使用量
- 订阅/取消按钮

---

### 任务 4: 增强 API Monetizer 页面

**文件**: `app/vendors/monetize/page.tsx` (已存在)

**需要添加**:
1. 使用量图表 (用 recharts)
2. 定价策略编辑器
3. API 密钥管理

**API**:
```
GET  /api/monetize/usage   - 获取使用统计
POST /api/monetize/configs - 创建配置
```

---

## 📦 已有的 Hooks (直接使用)

```typescript
// hooks/index.ts 已导出
import { 
  useBatchPayment,    // 批量支付
  useX402,            // x402 协议
  useInvoice,         // 发票
  useOfframp,         // 法币出金
  useMCPSubscriptions,// MCP 订阅
  useMonetizeConfig,  // API 变现配置
  useAuditLog,        // 审计日志
  useSecurityCheck,   // 安全检查
} from '@/hooks';
```

---

## 🗄️ 数据库迁移 (需要在 Supabase 执行)

```sql
-- 执行这两个文件:
-- migrations/004_mcp_subscription_schema.sql
-- migrations/005_usage_tracking_schema.sql
```

---

## ✅ 完成检查

- [ ] `/api/x402/settle` 已接入支付页面
- [ ] 批量支付页面可以上传文件并提交
- [ ] MCP 订阅页面已创建
- [ ] API Monetizer 显示使用量图表
