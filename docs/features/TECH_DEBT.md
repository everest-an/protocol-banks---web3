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

### TD-002: 缺少统一的错误处理机制（已解决 ✅）

**位置**: 多处 API 路由和服务

**问题描述**:
- 错误信息不统一
- 缺少错误码
- 前端难以做针对性处理

**解决方案**: 已实现统一错误处理系统

**修改内容**:
1. 新增 `lib/errors/index.ts` - 错误码、消息、HTTP 状态映射
2. 新增 `lib/errors/api-handler.ts` - API 包装器和验证助手
3. 重构订阅 API 路由使用新系统

**特性**:
- 30+ 错误类型（Auth、Validation、Payment、Blockchain 等）
- 双语支持（英文/中文）
- 自动 HTTP 状态码映射
- `withErrorHandling` API 包装器
- 验证助手（validateAddress、validateRequired 等）

**解决日期**: 2025-01-30

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

### TD-004: Rain Card 授权检查未实现（已解决 ✅）

**位置**: `services/webhook-handler/internal/handler/rain.go`

**问题描述**: 授权检查直接返回硬编码 "approved"，存在安全风险

**解决方案**: 已实现完整授权检查

**修改内容**:
1. 修改 `checkAuthorization` 实现完整授权逻辑
2. 新增 `store.GetCardUserInfo` 获取卡用户信息
3. 新增 `store.IsMerchantBlacklisted` 商户黑名单检查
4. 新增 `store.RecordAuthorization` 授权记录
5. 新增数据库迁移 `2025-01-30_rain_card_tables.sql`

**授权检查项**:
- 卡激活状态验证
- 余额充足性检查
- 单笔交易限额检查
- 日消费限额检查
- 月消费限额检查
- 商户黑名单验证

**安全设计**: 查询失败时拒绝交易（Fail-safe）

**解决日期**: 2025-01-30

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

### TD-008: Payout Engine 私钥管理不安全（已解决 ✅）

**位置**: `services/payout-engine/internal/service/payout.go`

**问题描述**: `signTransaction` 使用硬编码空字符串，无法执行交易签名

**解决方案**: 已实现 KMS（密钥管理服务）集成

**修改内容**:

1. 新增 `services/payout-engine/internal/kms/` 包
2. 实现 `Signer` 接口支持多种 KMS 提供商
3. 更新 `PayoutService` 使用 KMS 签名器
4. 更新配置支持 KMS 环境变量

**支持的 KMS 提供商**:

- `local`: 本地私钥（仅开发环境）
- `aws`: AWS Key Management Service
- `gcp`: Google Cloud KMS
- `vault`: HashiCorp Vault Transit

**环境变量**:

- `KMS_PROVIDER`: 选择提供商
- `PAYOUT_PRIVATE_KEY`: 本地私钥（开发）
- `AWS_REGION`, `AWS_KMS_KEY_ID`: AWS 配置
- `VAULT_ADDR`, `VAULT_TOKEN`, `VAULT_KEY_NAME`: Vault 配置

**解决日期**: 2025-01-30

---

## 债务偿还计划

| 状态 | 项目 | 说明 |
|------|------|------|
| ✅ 已完成 | TD-001, TD-003, TD-006 | 批量支付、订阅执行、数据库索引 |
| ✅ 已完成 | TD-002, TD-004, TD-008 | 错误处理、Rain Card、KMS 集成 |
| 待处理 | TD-005 | 前端状态管理（中优先级） |
| 待处理 | TD-007 | 单元测试覆盖（持续进行） |

---

## 新增债务流程

1. 发现债务时立即记录到本文档
2. 评估优先级和工作量
3. 周会评审是否纳入当前迭代
4. 偿还后更新状态为「已解决」

---

**最后更新**: 2025-01-30
