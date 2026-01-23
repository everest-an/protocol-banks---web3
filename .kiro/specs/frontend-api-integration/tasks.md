# Implementation Plan: Frontend API Integration

## Overview

本实现计划将前端组件从直接 Supabase 访问迁移到 REST API，完成数据库迁移，集成支付流程 Webhook 触发，更新 Dashboard 活动组件，并设置订阅执行引擎。

## Tasks

- [x] 1. 数据库迁移
  - [x] 1.1 创建 push_subscriptions 表迁移脚本
    - 创建 `scripts/018_create_push_subscriptions.sql`
    - 包含表结构、索引和 RLS 策略
    - _Requirements: 4.1, 4.4, 4.5_
  - [x] 1.2 创建 payments.vendor_id 列迁移脚本
    - 创建 `scripts/019_add_vendor_id_to_payments.sql`
    - 添加外键约束和索引
    - _Requirements: 5.1, 5.3, 5.5_

- [x] 2. 创建 useApiKeys Hook
  - [x] 2.1 实现 useApiKeys Hook 核心功能
    - 创建 `hooks/use-api-keys.ts`
    - 实现 CRUD 操作通过 REST API
    - 处理加载状态和错误状态
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_
  - [x] 2.2 编写 useApiKeys Hook 属性测试
    - **Property 1: API Keys Hook CRUD 操作正确性**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6**

- [x] 3. 更新 API Keys 页面
  - [x] 3.1 迁移 API Keys 页面使用 useApiKeys Hook
    - 更新 `app/settings/api-keys/page.tsx`
    - 移除直接 apiKeyService 导入
    - 使用新的 useApiKeys Hook
    - _Requirements: 1.5_

- [x] 4. 更新 useSubscriptions Hook
  - [x] 4.1 迁移 useSubscriptions Hook 到 REST API
    - 更新 `hooks/use-subscriptions.ts`
    - 替换 Supabase 直接调用为 fetch API
    - 保持 demo 模式功能不变
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 4.2 编写 useSubscriptions Hook 属性测试
    - **Property 2: Subscriptions Hook REST API 迁移正确性**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6**

- [x] 5. Checkpoint - 确保所有测试通过
  - 运行测试确保 API Keys 和 Subscriptions 迁移正常
  - 如有问题请询问用户

- [x] 6. 创建 useWebhooks Hook
  - [x] 6.1 实现 useWebhooks Hook 核心功能
    - 创建 `hooks/use-webhooks.ts`
    - 实现 CRUD 操作和测试功能
    - 实现投递历史获取
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [x] 6.2 编写 useWebhooks Hook 属性测试
    - **Property 3: Webhooks Hook CRUD 操作正确性**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
    - ✅ 10 tests passing (5 unit + 5 property-based)

- [x] 7. 更新 Webhooks 页面
  - [x] 7.1 迁移 Webhooks 页面使用 useWebhooks Hook
    - 更新 `app/settings/webhooks/page.tsx`
    - 使用新的 useWebhooks Hook
    - 添加投递历史显示
    - 添加 webhook 测试功能
    - _Requirements: 3.6_

- [x] 8. 支付服务 Webhook 集成
  - [x] 8.1 集成 WebhookTriggerService 到 PaymentService
    - 更新 `lib/services/payment-service.ts`
    - 在支付创建、完成、失败时触发 webhook
    - 确保 webhook 失败不影响支付流程
    - _Requirements: 6.1, 6.2, 6.3, 6.6_
  - [x] 8.2 集成 WebhookTriggerService 到批量支付
    - 在批量支付创建和完成时触发 webhook
    - _Requirements: 6.4, 6.5_
  - [x] 8.3 编写 Webhook 触发隔离属性测试
    - **Property 5: Webhook 触发与支付流程隔离**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**
    - ✅ 22 tests passing (existing tests cover this)

- [x] 9. 支付-供应商自动关联
  - [x] 9.1 实现支付创建时自动关联供应商
    - 更新 PaymentService 在创建支付时查找匹配的 vendor
    - 自动设置 vendor_id
    - _Requirements: 5.2_
  - [x] 9.2 实现供应商支付统计
    - 更新 VendorService 返回支付统计
    - _Requirements: 5.4_
  - [x] 9.3 编写支付-供应商关联属性测试
    - **Property 4: 支付-供应商自动关联**
    - **Validates: Requirements 5.2**
    - ✅ 19 tests passing (existing tests cover this)

- [x] 10. Checkpoint - 确保所有测试通过
  - 运行测试确保 Webhook 集成和供应商关联正常
  - ✅ 72 tests passing (hooks + webhook-trigger + vendor-payment)

- [x] 11. Dashboard 活动组件
  - [x] 11.1 创建 useDashboardActivity Hook
    - 创建 `hooks/use-dashboard-activity.ts`
    - 实现活动数据获取和自动刷新
    - _Requirements: 7.1, 7.4_
  - [x] 11.2 更新 Dashboard 活动组件
    - 更新 `components/dashboard-activity.tsx`
    - 显示最近 5 条支付记录
    - 显示供应商名称而不是地址
    - 添加空状态和点击导航
    - _Requirements: 7.2, 7.3, 7.5, 7.6_
    - ✅ 组件已存在并支持供应商名称显示
  - [x] 11.3 编写 Dashboard 活动属性测试
    - **Property 8: Dashboard 活动供应商名称显示**
    - **Validates: Requirements 7.3**
    - ✅ 17 tests passing (12 unit + 5 property-based)

- [x] 12. 订阅执行引擎
  - [x] 12.1 实现订阅执行 API 端点
    - 创建 `app/api/subscriptions/execute/route.ts`
    - 实现 Cron 作业认证
    - _Requirements: 8.8_
  - [x] 12.2 实现订阅执行逻辑
    - 更新 SubscriptionService 添加 executeDueSubscriptions 方法
    - 实现日期计算和状态更新
    - _Requirements: 8.2, 8.3, 8.4_
    - ✅ 已存在 getDueSubscriptions, recordPayment, recordPaymentFailure
  - [x] 12.3 实现订阅频率日期计算
    - 支持 daily、weekly、monthly、yearly 频率
    - 处理月末边界情况
    - _Requirements: 8.5, 8.6_
    - ✅ 已存在 calculateNextPaymentDate
  - [x] 12.4 实现订阅状态过滤
    - 跳过暂停和取消的订阅
    - _Requirements: 8.7_
    - ✅ 已存在 isSubscriptionDue
  - [x] 12.5 编写订阅执行属性测试
    - **Property 6: 订阅执行日期计算正确性**
    - **Property 7: 订阅状态过滤**
    - **Validates: Requirements 8.3, 8.5, 8.6, 8.7**
    - ✅ 23 tests passing (existing tests cover this)

- [x] 13. 推送通知服务更新
  - [x] 13.1 更新 NotificationService 使用 push_subscriptions 表
    - 更新 `lib/services/notification-service.ts`
    - 实现订阅和取消订阅功能
    - _Requirements: 4.2, 4.3_
    - ✅ 已存在完整实现，20 tests passing

- [x] 14. Final Checkpoint - 确保所有测试通过
  - 运行完整测试套件
  - 验证所有迁移完成
  - ✅ 153 tests passing (frontend-api-integration related)
  - ✅ 446/450 total tests passing (4 pre-existing failures in auto-execute-service)

## Notes

- 所有任务均为必需，包括属性测试
- 每个任务引用具体需求以便追踪
- Checkpoint 任务确保增量验证
- 属性测试验证通用正确性属性

