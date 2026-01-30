# 技术债务清单

## 概述

本文档记录 Protocol Banks 项目中已识别的技术债务，按优先级排序，定期评审并制定偿还计划。

---

## 现有技术债务

### TD-001: 批量支付串行执行（已解决 ✅）

**位置**: `lib/services/payment-service.ts`

**问题描述**: 原实现为串行执行，每笔间隔 1 秒

**解决方案**: 已实现并行执行

**修改内容**:
1. 新增 `lib/utils/concurrency.ts` - 通用并发控制工具
2. 修改 `processBatchPayments` 函数为并行执行
3. 新增 `BatchPaymentOptions` 配置项
4. 新增 `Recipient` 和 `PaymentResult` 类型

**配置参数**:
- `concurrency`: 最大并发数（默认 5）
- `batchDelay`: 批次间延迟（默认 200ms）
- `timeout`: 单笔超时（默认 60s）
- `retries`: 失败重试次数（默认 1）

**性能提升**:
- 100 人批量支付：100+ 秒 → ~25 秒（并发 5）
- 支持自定义并发数，最高可达 10-20 并发

**解决日期**: 2025-01-30

---

### TD-002: 缺少统一的错误处理机制（中优先级）

**位置**: 多处 API 路由和服务

**问题描述**:
- 错误信息不统一
- 缺少错误码
- 前端难以做针对性处理

**影响**:
- 用户体验差
- 调试困难
- 国际化困难

**解决方案**:
```typescript
// 建议的错误格式
interface ApiError {
  code: string        // "INVALID_ADDRESS"
  message: string     // 用户友好消息
  details?: any       // 调试信息
  field?: string      // 相关字段
}
```

**预计工作量**: 1-2 天

---

### TD-003: 订阅服务缺少执行器（高优先级）

**位置**: `lib/services/subscription-service.ts:446-448`

**问题描述**:
```typescript
// TODO: Schedule retry after 24 hours
// TODO: Send notification to user
```

**影响**:
- 订阅功能无法自动执行
- 支付失败无重试
- 用户无通知

**解决方案**:
- 本次 P0 功能「定时发薪」将解决此债务

**预计工作量**: 3-5 天（包含在定时发薪功能中）

---

### TD-004: Rain Card 授权检查未实现（低优先级）

**位置**: `services/webhook-handler/internal/handler/rain.go:237-243`

**问题描述**:
```go
func (h *RainHandler) checkAuthorization(...) (bool, string) {
  // TODO: 实现授权检查逻辑
  return true, "approved"
}
```

**影响**:
- Rain Card 功能不完整
- 安全风险（无限额检查）

**解决方案**:
- 暂不处理，Rain Card 非 MVP 优先级

**预计工作量**: 2-3 天

---

### TD-005: 前端状态管理分散（中优先级）

**位置**: 多个页面组件

**问题描述**:
- 使用 useState 管理复杂状态
- 无全局状态管理
- 数据获取逻辑分散

**影响**:
- 组件间状态同步困难
- 重复请求
- 代码难维护

**解决方案**:
1. 引入 Zustand 或 Jotai 做全局状态
2. 统一使用 SWR/React Query 做数据获取
3. 抽象 hooks

**预计工作量**: 3-5 天

---

### TD-006: 数据库表缺少索引优化（已解决 ✅）

**位置**: Supabase 数据库

**解决方案**: 已创建索引迁移脚本

**迁移脚本**: `scripts/migrations/2025-01-30_add_indexes.sql`

**添加的索引**:
- payments: created_by, created_at, status, 复合索引
- batch_payments: from_address, status, created_at
- subscriptions: created_by, next_payment (活跃), status
- transactions: from_address, to_address, tx_hash
- vendors: owner_address, status

**执行方式**: 在 Supabase SQL Editor 中运行脚本

**解决日期**: 2025-01-30

---

### TD-007: 缺少单元测试覆盖（中优先级）

**位置**: 整个项目

**问题描述**:
- 前端组件无测试
- 服务层测试不完整
- CI 无测试门禁

**影响**:
- 重构风险高
- 回归难发现

**解决方案**:
- 核心服务添加单元测试
- 关键流程添加集成测试
- CI 添加测试覆盖率检查

**预计工作量**: 持续进行

---

## 债务偿还计划

| 季度 | 计划偿还 | 原因 |
|------|---------|------|
| 本周期 | TD-001, TD-003 | 影响核心功能 |
| 下周期 | TD-002, TD-006 | 影响稳定性 |
| 后续 | TD-005, TD-007 | 技术改进 |
| 暂缓 | TD-004 | 非 MVP 功能 |

---

## 新增债务流程

1. 发现债务时立即记录到本文档
2. 评估优先级和工作量
3. 周会评审是否纳入当前迭代
4. 偿还后更新状态为「已解决」

---

**最后更新**: 2025-01-30
