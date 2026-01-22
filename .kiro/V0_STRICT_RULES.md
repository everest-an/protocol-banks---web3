# ⛔ v0 严格操作规则

## 🚫 绝对禁止删除或修改的文件

以下文件和目录是后端核心代码，**绝对不能删除、修改或覆盖**：

### 1. 后端 API 路由 (禁止删除)
```
app/api/x402/                    # x402 协议 API
app/api/mcp/                     # MCP 订阅 API
app/api/monetize/                # API 变现 API
app/api/batch-payment/           # 批量支付 API
app/api/auth/                    # 认证 API
app/api/csrf/                    # CSRF 保护
```

### 2. 服务层 (禁止删除)
```
services/                        # 所有服务文件
  - cdp-facilitator.service.ts
  - usage-tracker.service.ts
  - eip712.service.ts
  - nonce-manager.service.ts
  - signature-verifier.service.ts
  - relayer-client.service.ts
  - fee-calculator.service.ts
  - batch-validator.service.ts
  - file-parser.service.ts
  - 等等...
```

### 3. SDK 包 (禁止删除)
```
packages/sdk/                    # SDK 核心
packages/mcp-server/             # MCP Server 包
packages/python/                 # Python SDK
```

### 4. 数据库迁移 (禁止删除)
```
migrations/                      # 所有迁移脚本
  - 001_email_login_schema.sql
  - 002_batch_payment_schema.sql
  - 003_x402_schema.sql
  - 004_mcp_subscription_schema.sql
  - 005_usage_tracking_schema.sql
```

### 5. 测试文件 (禁止删除)
```
tests/                           # 所有测试
jest.config.js                   # Jest 配置
```

### 6. 配置和文档 (禁止删除)
```
.kiro/                           # Kiro 配置和文档
lib/                             # 库文件
middleware.ts                    # 中间件
```

---

## ✅ 允许 v0 操作的范围

### 1. 可以修改的前端页面
```
app/pay/page.tsx                 # 支付页面 - 接入 x402 API
app/batch-payment/page.tsx       # 批量支付页面 - 接入后端 API
app/subscriptions/mcp/page.tsx   # MCP 订阅页面 - 使用 useMCPSubscriptions
app/vendors/monetize/page.tsx    # API 变现页面 - 使用 useMonetizeConfig
```

### 2. 可以创建的新文件
```
components/                      # 新 UI 组件
  - settlement-method-badge.tsx  # 结算方式标识
  - fee-breakdown.tsx            # 费用明细
  - batch-status-tracker.tsx     # 批量支付状态
  - subscription-card.tsx        # 订阅卡片
  - usage-chart.tsx              # 使用量图表

hooks/                           # 新 Hooks (如果需要)
  - use-xxx.ts                   # 新的自定义 Hook
```

### 3. 可以修改的样式文件
```
app/globals.css                  # 全局样式
styles/                          # 样式目录
```

---

## 📋 v0 具体任务清单

### 任务 1: 支付页面接入 CDP 结算
**文件**: `app/pay/page.tsx`
**操作**: 修改
**要求**:
- 调用 `/api/x402/settle` API
- 显示结算方式 (CDP = 0费用)
- Base 链显示 "0 手续费" 标识

### 任务 2: 批量支付页面接入后端
**文件**: `app/batch-payment/page.tsx`
**操作**: 修改
**要求**:
- 使用 `useBatchPayment` hook
- 连接文件上传 API
- 显示验证结果和费用

### 任务 3: MCP 订阅页面
**文件**: `app/subscriptions/mcp/page.tsx`
**操作**: 创建或修改
**要求**:
- 使用 `useMCPSubscriptions` hook
- 显示订阅计划
- 订阅/取消功能

### 任务 4: API 变现页面增强
**文件**: `app/vendors/monetize/page.tsx`
**操作**: 修改
**要求**:
- 使用 `useMonetizeConfig` hook
- 添加使用量图表 (recharts)
- 添加定价策略编辑器

---

## ⚠️ 重要提醒

1. **不要运行 `git rm` 或删除任何后端文件**
2. **不要修改 `package.json` 中的依赖版本**（可以添加新依赖）
3. **不要修改 `tsconfig.json`**
4. **不要修改任何 `services/` 目录下的文件**
5. **不要修改任何 `packages/` 目录下的文件**
6. **不要修改任何 `migrations/` 目录下的文件**
7. **不要修改任何 `tests/` 目录下的文件**

---

## 🔧 已有的 Hooks (直接使用，不要重写)

```typescript
// 这些 hooks 已经存在，直接 import 使用
import { useBatchPayment } from '@/hooks/use-batch-payment';
import { useX402 } from '@/hooks/use-x402';
import { useMCPSubscriptions } from '@/hooks/use-mcp-subscriptions';
import { useMonetizeConfig } from '@/hooks/use-monetizer-config';
```

---

## 📝 提交规范

每次提交前检查：
1. ✅ 没有删除任何后端文件
2. ✅ 只修改了允许的前端文件
3. ✅ 新增的组件在 `components/` 目录
4. ✅ 使用了现有的 hooks，没有重写

提交信息格式：
```
feat(frontend): 描述你做了什么
```

---

## 🆘 如果不确定

如果不确定某个操作是否允许，**不要做**。先询问确认。

后端 API 已经完成，你只需要：
1. 调用 API
2. 显示数据
3. 创建 UI 组件

**不需要修改任何后端逻辑。**
