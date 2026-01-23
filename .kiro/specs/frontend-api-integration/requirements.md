# Requirements Document

## Introduction

本文档定义了前端 API 统一集成的需求。目前部分前端页面直接使用 Supabase 客户端访问数据库，而不是通过 REST API。这导致了架构不一致、安全风险和维护困难。本规范涵盖将所有前端组件迁移到使用 REST API、数据库迁移、支付流程中的 Webhook 集成、Dashboard 活动组件更新以及订阅执行引擎的 Cron 作业设置。

## Glossary

- **Protocol_Banks**: 企业级加密支付基础设施平台
- **REST_API**: Next.js API 路由层，处理 HTTP 请求
- **Frontend_Hook**: React 自定义 Hook，用于前端数据获取和状态管理
- **Supabase_Client**: 直接数据库访问客户端（需要迁移）
- **API_Keys_Page**: API 密钥管理页面 (`app/settings/api-keys/page.tsx`)
- **Subscriptions_Page**: 订阅管理页面 (`app/subscriptions/page.tsx`)
- **Webhooks_Page**: Webhook 配置页面 (`app/settings/webhooks/page.tsx`)
- **Payment_Service**: 支付处理服务
- **Webhook_Trigger_Service**: Webhook 事件触发服务
- **Dashboard_Activity**: Dashboard 上的支付活动组件
- **Subscription_Engine**: 订阅执行引擎，处理定期支付
- **Push_Subscriptions_Table**: 推送通知订阅数据库表
- **Vendor_ID_Column**: payments 表中的 vendor_id 外键列

## Requirements

### Requirement 1: API Keys 页面 REST API 迁移

**User Story:** 作为开发者，我希望 API Keys 页面通过 REST API 获取和管理数据，以便保持架构一致性和安全性。

#### Acceptance Criteria

1. WHEN API_Keys_Page 加载时，THE Frontend_Hook SHALL 调用 `GET /api/settings/api-keys` 获取 API 密钥列表
2. WHEN 用户创建新 API 密钥时，THE Frontend_Hook SHALL 调用 `POST /api/settings/api-keys` 并返回新密钥
3. WHEN 用户删除 API 密钥时，THE Frontend_Hook SHALL 调用 `DELETE /api/settings/api-keys/[id]`
4. WHEN API 请求失败时，THE Frontend_Hook SHALL 返回错误信息并显示给用户
5. THE API_Keys_Page SHALL 不再直接导入或使用 `lib/api-keys.ts` 中的 `apiKeyService`
6. FOR ALL API 密钥操作，THE Frontend_Hook SHALL 处理加载状态和错误状态

### Requirement 2: Subscriptions Hook REST API 迁移

**User Story:** 作为用户，我希望订阅管理功能通过 REST API 操作，以便获得更好的安全性和一致的错误处理。

#### Acceptance Criteria

1. WHEN useSubscriptions Hook 加载订阅时，THE Hook SHALL 调用 `GET /api/subscriptions` 而不是直接查询 Supabase
2. WHEN 用户创建新订阅时，THE Hook SHALL 调用 `POST /api/subscriptions`
3. WHEN 用户更新订阅状态时，THE Hook SHALL 调用 `PUT /api/subscriptions/[id]`
4. WHEN 用户删除订阅时，THE Hook SHALL 调用 `DELETE /api/subscriptions/[id]`
5. THE useSubscriptions Hook SHALL 保持现有的 demo 模式功能不变
6. WHEN API 请求失败时，THE Hook SHALL 设置 error 状态并允许重试

### Requirement 3: Webhooks 页面 REST API 迁移

**User Story:** 作为开发者，我希望 Webhooks 配置页面通过 REST API 管理 webhook，以便保持与其他页面的一致性。

#### Acceptance Criteria

1. WHEN Webhooks_Page 加载时，THE Frontend_Hook SHALL 调用 `GET /api/webhooks` 获取 webhook 列表
2. WHEN 用户创建新 webhook 时，THE Frontend_Hook SHALL 调用 `POST /api/webhooks`
3. WHEN 用户更新 webhook 时，THE Frontend_Hook SHALL 调用 `PUT /api/webhooks/[id]`
4. WHEN 用户删除 webhook 时，THE Frontend_Hook SHALL 调用 `DELETE /api/webhooks/[id]`
5. WHEN 用户测试 webhook 时，THE Frontend_Hook SHALL 调用 `POST /api/webhooks/[id]/test`
6. THE Webhooks_Page SHALL 显示 webhook 投递历史记录

### Requirement 4: Push Subscriptions 数据库表

**User Story:** 作为平台运营者，我希望有一个专门的表来存储推送通知订阅，以便支持实时通知功能。

#### Acceptance Criteria

1. THE Database SHALL 包含 `push_subscriptions` 表，包含以下字段：id, user_address, endpoint, p256dh_key, auth_key, created_at, updated_at
2. WHEN 用户订阅推送通知时，THE Notification_Service SHALL 在 push_subscriptions 表中创建记录
3. WHEN 用户取消订阅时，THE Notification_Service SHALL 从 push_subscriptions 表中删除记录
4. THE push_subscriptions 表 SHALL 启用 RLS 策略，确保用户只能访问自己的订阅
5. THE push_subscriptions 表 SHALL 在 user_address 列上创建索引以优化查询性能

### Requirement 5: Payments 表 Vendor ID 列

**User Story:** 作为用户，我希望支付记录能够关联到供应商，以便查看每个供应商的支付历史和统计。

#### Acceptance Criteria

1. THE payments 表 SHALL 包含 `vendor_id` 列，类型为 UUID，可为空，外键引用 vendors 表
2. WHEN 创建支付时，IF to_address 匹配某个 vendor 的 wallet_address，THEN THE Payment_Service SHALL 自动设置 vendor_id
3. THE vendor_id 列 SHALL 创建索引以优化按供应商查询支付记录
4. WHEN 查询供应商详情时，THE Vendor_Service SHALL 返回该供应商的支付统计（总金额、交易数量）
5. WHEN vendor 被删除时，THE payments 表中的 vendor_id SHALL 设置为 NULL（ON DELETE SET NULL）

### Requirement 6: 支付流程 Webhook 触发器集成

**User Story:** 作为开发者，我希望支付完成时自动触发 webhook，以便我的系统能够实时响应支付事件。

#### Acceptance Criteria

1. WHEN 支付创建成功时，THE Payment_Service SHALL 调用 `webhookTriggerService.triggerPaymentCreated()`
2. WHEN 支付完成时，THE Payment_Service SHALL 调用 `webhookTriggerService.triggerPaymentCompleted()`
3. WHEN 支付失败时，THE Payment_Service SHALL 调用 `webhookTriggerService.triggerPaymentFailed()`
4. WHEN 批量支付创建时，THE Payment_Service SHALL 调用 `webhookTriggerService.triggerBatchPaymentCreated()`
5. WHEN 批量支付完成时，THE Payment_Service SHALL 调用 `webhookTriggerService.triggerBatchPaymentCompleted()`
6. IF webhook 触发失败，THEN THE Payment_Service SHALL 记录错误但不影响支付流程

### Requirement 7: Dashboard 活动组件更新

**User Story:** 作为用户，我希望 Dashboard 上显示最近的支付活动，以便快速了解我的支付流水。

#### Acceptance Criteria

1. WHEN Dashboard 加载时，THE Dashboard_Activity 组件 SHALL 调用 `GET /api/agents/activities` 或专用活动 API
2. THE Dashboard_Activity SHALL 显示最近 5 条支付记录，包含方向、金额、代币和时间戳
3. WHEN 支付关联到已知供应商时，THE Dashboard_Activity SHALL 显示供应商名称而不是原始地址
4. THE Dashboard_Activity SHALL 每 30 秒自动刷新数据
5. WHEN 没有支付记录时，THE Dashboard_Activity SHALL 显示空状态和引导操作
6. WHEN 用户点击活动项时，THE Dashboard_Activity SHALL 导航到详细交易视图

### Requirement 8: 订阅执行引擎 Cron 作业

**User Story:** 作为用户，我希望我的订阅能够按计划自动执行，以便我不需要手动处理定期支付。

#### Acceptance Criteria

1. THE Subscription_Engine SHALL 每小时检查到期的订阅
2. WHEN 订阅支付到期时，THE Subscription_Engine SHALL 创建支付交易
3. WHEN 订阅支付成功时，THE Subscription_Engine SHALL 更新 `last_payment_date` 并计算 `next_payment_date`
4. WHEN 订阅支付失败时，THE Subscription_Engine SHALL 更新状态为 "payment_failed" 并通知用户
5. THE Subscription_Engine SHALL 支持 daily、weekly、monthly 和 yearly 频率
6. WHEN 计算月度订阅的下次支付日期时，THE Subscription_Engine SHALL 处理月末边界情况（如 1月31日 → 2月28日）
7. THE Subscription_Engine SHALL 不执行已暂停或已取消订阅的支付
8. THE Subscription_Engine SHALL 提供 API 端点 `POST /api/subscriptions/execute` 供 Cron 作业调用

