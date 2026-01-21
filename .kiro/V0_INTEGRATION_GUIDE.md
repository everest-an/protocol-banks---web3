# v0 前端集成指南

本文档指导 v0 如何将后端 API 和服务集成到前端界面。

---

## 📋 概述

后端已实现以下核心功能，需要前端进行集成：

| 功能模块 | 后端状态 | 前端状态 | 优先级 |
|---------|---------|---------|-------|
| CDP Facilitator (x402 结算) | ✅ 完成 | ⚠️ 需要接入 | P0 |
| MCP Server 订阅管理 | ✅ 完成 | ⚠️ 需要创建 UI | P1 |
| API Monetizer | ✅ 完成 | ⚠️ 部分完成 | P1 |
| 批量支付 | ✅ 完成 | ⚠️ 需要接入 | P0 |
| x402 协议 | ✅ 完成 | ⚠️ 需要接入 | P0 |

---

## 🔧 1. CDP Facilitator 集成 (x402 结算)

### 后端 API

```
POST /api/x402/settle
```

### 功能说明
- Base 链 USDC 支付通过 Coinbase CDP 结算，**0 手续费**
- 非 Base 链自动回退到自建 Relayer

### 请求格式
```typescript
interface SettleRequest {
  authorizationId: string;
  chainId: number;
  paymentDetails: {
    amount: string;
    token: string;
    recipient: string;
  };
  signature: string;
}
```

### 响应格式
```typescript
interface SettleResponse {
  success: boolean;
  txHash?: string;
  settlementMethod: 'cdp' | 'relayer';
  fee: string; // Base 链为 "0"
  error?: string;
}
```

### 前端集成方式

**方式 A: 使用现有 `hooks/use-x402.ts`**
```typescript
import { useX402 } from '@/hooks/use-x402';

function PaymentComponent() {
  const { settle, isSettling } = useX402();
  
  const handlePayment = async () => {
    const result = await settle({
      authorizationId: 'xxx',
      chainId: 8453, // Base
      paymentDetails: { amount: '100', token: 'USDC', recipient: '0x...' },
      signature: '0x...'
    });
    
    if (result.success) {
      console.log('Settlement via:', result.settlementMethod);
      console.log('Fee:', result.fee); // "0" for Base
    }
  };
}
```

**方式 B: 直接调用 API**
```typescript
const response = await fetch('/api/x402/settle', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(settleRequest)
});
```

### 需要创建的 UI
- [ ] 在支付确认页面显示结算方式 (CDP vs Relayer)
- [ ] 显示手续费信息 (Base 链显示 "0 费用")
- [ ] 添加 Base 链推荐标识

---

## 🔧 2. MCP Server 订阅管理

### 后端 API

```
GET  /api/mcp/plans          # 获取订阅计划列表
GET  /api/mcp/subscriptions  # 获取用户订阅
POST /api/mcp/subscriptions  # 创建/更新订阅
```

### 数据模型
```typescript
interface MCPPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  limits: {
    requestsPerDay: number;
    tokensPerMonth: number;
  };
}

interface MCPSubscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'cancelled' | 'expired';
  currentPeriodEnd: string;
  usage: {
    requestsUsed: number;
    tokensUsed: number;
  };
}
```

### 前端集成方式

**使用现有 Hook**
```typescript
import { useMCPSubscriptions } from '@/hooks/use-mcp-subscriptions';

function SubscriptionPage() {
  const { plans, subscription, subscribe, cancel, isLoading } = useMCPSubscriptions();
  
  return (
    <div>
      {plans.map(plan => (
        <PlanCard 
          key={plan.id}
          plan={plan}
          isActive={subscription?.planId === plan.id}
          onSubscribe={() => subscribe(plan.id)}
        />
      ))}
    </div>
  );
}
```

### 需要创建的 UI
- [ ] `/subscriptions/mcp` - MCP 订阅管理页面
- [ ] 订阅计划选择卡片
- [ ] 使用量仪表盘
- [ ] 订阅历史记录
- [ ] 取消/升级订阅流程

---

## 🔧 3. API Monetizer 配置

### 后端 API

```
GET    /api/monetize/configs         # 获取配置列表
POST   /api/monetize/configs         # 创建配置
PUT    /api/monetize/configs/:id     # 更新配置
DELETE /api/monetize/configs/:id     # 删除配置
GET    /api/monetize/usage           # 获取使用统计
POST   /api/monetize/proxy/[...path] # 代理请求
```

### 数据模型
```typescript
interface MonetizeConfig {
  id: string;
  name: string;
  upstreamUrl: string;
  pricingStrategy: 'per_request' | 'per_token' | 'tiered' | 'dynamic';
  pricing: {
    basePrice: number;
    currency: string;
    tiers?: Array<{ threshold: number; price: number }>;
  };
  enabled: boolean;
}

interface UsageStats {
  totalRequests: number;
  totalRevenue: number;
  byEndpoint: Record<string, { requests: number; revenue: number }>;
  byDay: Array<{ date: string; requests: number; revenue: number }>;
}
```

### 现有前端页面
- `app/vendors/monetize/page.tsx` - 基础配置页面 (已存在)

### 需要增强的 UI
- [ ] 添加定价策略可视化编辑器
- [ ] 添加使用量图表 (使用 recharts)
- [ ] 添加 API 密钥管理
- [ ] 添加 Webhook 配置

---

## 🔧 4. 批量支付集成

### 后端 API

```
POST /api/batch-payment/upload        # 上传 CSV/Excel
POST /api/batch-payment/validate      # 验证数据
POST /api/batch-payment/calculate-fees # 计算费用
POST /api/batch-payment/submit        # 提交批量支付
GET  /api/batch-payment/:batchId/status # 查询状态
```

### 数据模型
```typescript
interface BatchPayment {
  id: string;
  status: 'draft' | 'validating' | 'pending' | 'processing' | 'completed' | 'failed';
  items: PaymentItem[];
  totalAmount: string;
  totalFee: string;
  createdAt: string;
}

interface PaymentItem {
  recipient: string;
  amount: string;
  token: string;
  chainId: number;
  status: 'pending' | 'success' | 'failed';
  txHash?: string;
  error?: string;
}
```

### 前端集成方式

**使用现有 Hook**
```typescript
import { useBatchPayment } from '@/hooks/use-batch-payment';

function BatchPaymentPage() {
  const { 
    uploadFile, 
    validateBatch, 
    calculateFees, 
    submitBatch,
    batchStatus,
    isProcessing 
  } = useBatchPayment();
  
  const handleFileUpload = async (file: File) => {
    const batch = await uploadFile(file);
    const validation = await validateBatch(batch.id);
    const fees = await calculateFees(batch.id);
    // 显示确认对话框
  };
}
```

### 现有前端页面
- `app/batch-payment/page.tsx` - 批量支付页面 (已存在)

### 需要接入的功能
- [ ] 连接文件上传到 `/api/batch-payment/upload`
- [ ] 显示验证结果和错误
- [ ] 显示费用明细
- [ ] 实时状态更新 (WebSocket 或轮询)
- [ ] 下载支付报告

---

## 🔧 5. x402 协议完整流程

### 后端 API

```
POST /api/x402/generate-authorization  # 生成授权
POST /api/x402/submit-signature        # 提交签名
POST /api/x402/submit-to-relayer       # 提交到 Relayer
POST /api/x402/settle                  # CDP 结算 (新)
GET  /api/x402/:authorizationId/status # 查询状态
```

### 完整支付流程
```
1. 用户发起支付请求
   ↓
2. 调用 /generate-authorization 获取 EIP-712 数据
   ↓
3. 用户钱包签名
   ↓
4. 调用 /submit-signature 提交签名
   ↓
5. 调用 /settle (自动选择 CDP 或 Relayer)
   ↓
6. 返回交易结果
```

### 前端集成方式

```typescript
import { useX402 } from '@/hooks/use-x402';

function X402PaymentFlow() {
  const { 
    generateAuthorization, 
    submitSignature, 
    settle,
    status 
  } = useX402();
  
  const handlePayment = async (amount: string, recipient: string) => {
    // 1. 生成授权
    const auth = await generateAuthorization({
      amount,
      recipient,
      token: 'USDC',
      chainId: 8453
    });
    
    // 2. 请求用户签名
    const signature = await requestWalletSignature(auth.typedData);
    
    // 3. 提交签名
    await submitSignature(auth.id, signature);
    
    // 4. 结算 (自动选择最优路径)
    const result = await settle({
      authorizationId: auth.id,
      chainId: 8453,
      paymentDetails: { amount, token: 'USDC', recipient },
      signature
    });
    
    return result;
  };
}
```

### 需要创建/更新的 UI
- [ ] 更新 `app/pay/page.tsx` 使用完整 x402 流程
- [ ] 添加签名请求 Modal
- [ ] 添加交易状态追踪
- [ ] 显示结算方式和费用

---

## 📁 数据库迁移

需要在 Supabase 执行以下迁移脚本：

```sql
-- 1. MCP 订阅表
-- 文件: migrations/004_mcp_subscription_schema.sql

-- 2. API 使用量追踪表
-- 文件: migrations/005_usage_tracking_schema.sql
```

---

## 🎨 UI 组件建议

### 推荐使用的现有组件
- `components/payment-button.tsx` - 支付按钮
- `components/ui/popover.tsx` - 弹出框
- `components/ui/avatar.tsx` - 头像

### 需要创建的新组件
- [ ] `components/settlement-method-badge.tsx` - 结算方式标识
- [ ] `components/fee-breakdown.tsx` - 费用明细
- [ ] `components/batch-status-tracker.tsx` - 批量支付状态追踪
- [ ] `components/subscription-card.tsx` - 订阅计划卡片
- [ ] `components/usage-chart.tsx` - 使用量图表

---

## 🔗 Hook 导出

所有 hooks 已在 `hooks/index.ts` 中导出：

```typescript
export { useBatchPayment } from './use-batch-payment';
export { useX402 } from './use-x402';
export { useInvoice } from './use-invoice';
export { useOfframp } from './use-offramp';
export { useMCPSubscriptions } from './use-mcp-subscriptions';
export { useMonetizeConfig } from './use-monetizer-config';
// ... 更多
```

---

## ✅ 集成检查清单

### P0 - 必须完成
- [ ] x402 支付流程接入 CDP Facilitator
- [ ] 批量支付页面连接后端 API
- [ ] 支付确认页面显示费用信息

### P1 - 重要
- [ ] MCP 订阅管理页面
- [ ] API Monetizer 配置增强
- [ ] 使用量统计仪表盘

### P2 - 可选
- [ ] 多签审批 UI
- [ ] 监控告警配置
- [ ] API 文档页面

---

## 📞 联系

如有问题，请参考：
- 后端 API 文档: `.kiro/specs/` 目录
- 服务实现: `services/` 目录
- 测试用例: `tests/` 目录
