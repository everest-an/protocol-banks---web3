# Implementation Plan: MCP Server Support

## Overview

基于 INTEGRATION_ARCHITECTURE_PLAN.md Phase 2 设计，实现 MCP Server 支持，使 AI Agent 能够自动处理订阅付款。

## Current Status

- ✅ `packages/mcp-server/` 目录已创建，包含完整的 MCP Server 实现
- ✅ `app/api/mcp/` API 路由已创建 (plans, subscriptions)
- ✅ 数据库迁移脚本已创建 (migrations/004_mcp_subscription_schema.sql)
- ✅ CDP Facilitator 服务已实现 (services/cdp-facilitator.service.ts)
- ✅ Claude Desktop 配置模板和 README 文档已完成
- 🔄 订阅页面更新待完成 (可选，现有页面仍可使用)

## Tasks

- [x] 1. 创建 MCP Server 包结构
  - [x] 1.1 初始化 `packages/mcp-server/` 目录和 package.json
    - 配置 name: `@protocolbanks/mcp-server`
    - 添加依赖: `@modelcontextprotocol/sdk`, `@protocolbanks/sdk`
    - _Requirements: 1.1, 1.3, 1.4_
  - [x] 1.2 配置 TypeScript 和 Rollup 构建
    - 创建 tsconfig.json 和 rollup.config.js
    - 配置 CommonJS 和 ESM 双输出
    - _Requirements: 1.1, 1.5_
  - [x] 1.3 创建类型定义文件 `src/types/index.ts`
    - 定义 SubscriptionPlan, UserSubscription, PaymentRequirement 等接口
    - _Requirements: 4.1, 4.2_

- [x] 2. 实现核心 MCP Server
  - [x] 2.1 实现 `src/server.ts` - PaidServer 类
    - 实现 `paidTool()` 方法用于定义付费工具
    - 实现 `tool()` 方法用于定义免费工具
    - 实现价格解析逻辑（支持 "$0.001", "0.001 USDC" 格式）
    - _Requirements: 5.1, 5.2_
  - [x]* 2.2 编写 PaidServer 单元测试
    - 测试工具注册
    - 测试价格解析
    - _Requirements: 5.2_
  - [x] 2.3 实现 `src/handler.ts` - 402 响应处理器
    - 生成 X-Payment-Request header
    - 包含 version, network, paymentAddress, amount, token, memo 字段
    - _Requirements: 3.1, 3.2_
  - [x]* 2.4 编写属性测试: 402 Response Structure
    - **Property 1: 402 Response Structure**
    - **Validates: Requirements 3.1, 3.2**
  - [x] 2.5 实现 `src/index.ts` - 导出 createPaidHandler
    - 导出主入口函数
    - 导出类型定义
    - _Requirements: 1.2_

- [x] 3. Checkpoint - 核心 MCP Server 完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 4. 实现订阅服务
  - [x] 4.1 创建 `src/services/subscription.service.ts`
    - 实现 listPlans(), getPlan(), createSubscription()
    - 实现 getSubscription(), cancelSubscription()
    - 集成 Supabase 数据库
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.6_
  - [ ]* 4.2 编写属性测试: Subscription Status Transitions
    - **Property 2: Subscription Status Transitions**
    - **Validates: Requirements 4.3, 4.4, 4.5**
  - [x] 4.3 创建 `src/tools/subscriptions.ts` - 订阅工具
    - 注册 list_subscriptions (免费)
    - 注册 get_subscription_info (免费)
    - 注册 subscribe (付费)
    - 注册 check_subscription (免费)
    - 注册 cancel_subscription (免费)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]* 4.4 编写订阅工具单元测试
    - 测试各工具的输入输出
    - _Requirements: 2.1-2.6_

- [x] 5. 实现支付处理
  - [x] 5.1 创建 `src/services/payment.service.ts`
    - 实现支付验证逻辑
    - 集成 CDP Facilitator (Base 链) - 复用 services/cdp-facilitator.service.ts
    - 实现 Relayer 回退逻辑
    - _Requirements: 3.3, 3.6, 3.7_
  - [ ]* 5.2 编写属性测试: Payment Amount Verification
    - **Property 3: Payment Amount Verification**
    - **Validates: Requirements 5.4**
  - [ ]* 5.3 编写属性测试: Price Conversion Accuracy
    - **Property 4: Price Conversion Accuracy**
    - **Validates: Requirements 5.2, 5.3**
  - [x] 5.4 实现动态定价支持
    - 支持基于请求参数的动态定价
    - _Requirements: 5.5_

- [x] 6. Checkpoint - 支付处理完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 7. 实现输入验证和安全
  - [x] 7.1 创建 `src/utils/validation.ts`
    - 实现钱包地址验证
    - 实现参数验证
    - 实现金额限制验证
    - _Requirements: 9.1, 9.2, 9.6_
  - [ ]* 7.2 编写属性测试: Input Validation
    - **Property 5: Input Validation**
    - **Validates: Requirements 9.1, 9.2**
  - [x] 7.3 实现日志服务 `src/utils/logger.ts`
    - 支持 debug, info, warn, error 级别
    - 过滤敏感数据（签名、私钥）
    - _Requirements: 8.2, 8.3, 8.5, 9.5_
  - [ ]* 7.4 编写属性测试: Sensitive Data Protection
    - **Property 6: Sensitive Data Protection**
    - **Validates: Requirements 9.5**
  - [x] 7.5 实现错误处理
    - 定义错误码枚举
    - 实现结构化错误响应
    - _Requirements: 8.1, 8.4_

- [x] 8. Claude Desktop 集成
  - [x] 8.1 创建 `config/claude_desktop_config.json` 模板
    - 配置 stdio transport
    - 配置环境变量
    - _Requirements: 6.1, 6.2_
  - [x] 8.2 实现 stdio transport 入口
    - 创建 `src/cli.ts` 作为 CLI 入口
    - 支持环境变量配置钱包
    - _Requirements: 6.2, 6.5_
  - [x] 8.3 编写 README.md 文档
    - Claude Desktop 安装指南
    - 配置说明
    - 使用示例
    - _Requirements: 6.4_

- [x] 9. Checkpoint - MCP Server 包完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 10. 数据库迁移
  - [x] 10.1 创建数据库迁移脚本 `migrations/004_mcp_subscription_schema.sql`
    - 创建 subscription_plans 表 (订阅计划定义)
    - 创建 user_subscriptions 表 (用户订阅记录)
    - 创建 subscription_payments 表 (支付记录)
    - 配置 RLS 策略
    - 注: 现有 subscriptions 表 (scripts/015_create_subscriptions.sql) 用于用户自定义订阅，保持不变
    - _Requirements: 4.1, 4.2, 4.6_

- [x] 11. 订阅页面更新
  - [x] 11.1 更新 `hooks/use-subscriptions.ts`
    - 添加 MCP 订阅数据加载支持
    - 保留现有 demo 模式支持
    - 区分用户自定义订阅和 MCP 订阅
    - _Requirements: 7.1, 7.5_
  - [x] 11.2 更新 `app/subscriptions/page.tsx`
    - 显示 MCP 订阅数据
    - 显示支付历史
    - 支持暂停/恢复/取消操作
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ]* 11.3 编写订阅页面集成测试
    - 测试数据加载
    - 测试操作功能
    - _Requirements: 7.1-7.5_

- [x] 12. API 路由和最终集成
  - [x] 12.1 创建 API 路由 `app/api/mcp/subscriptions/route.ts`
    - 提供订阅 API 供 MCP Server 调用
    - 实现 GET (列表/详情), POST (创建), PATCH (更新), DELETE (取消)
    - _Requirements: 2.1-2.5_
  - [x] 12.2 创建 API 路由 `app/api/mcp/plans/route.ts`
    - 提供订阅计划 API
    - 实现 GET (列表/详情)
    - _Requirements: 2.1, 2.2_
  - [ ]* 12.3 端到端测试
    - 测试完整订阅流程
    - 测试 Claude Desktop 集成
    - _Requirements: 6.3_
  - [x] 12.4 更新 INTEGRATION_ARCHITECTURE_PLAN.md
    - 标记 Phase 2 任务完成
    - 记录实现细节

- [x] 13. Final Checkpoint
  - 确保所有测试通过，如有问题请询问用户

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- 使用 `fast-check` 作为属性测试框架
- 使用 Jest 作为测试运行器
- CDP Facilitator 服务已实现，可直接复用
- 现有 subscriptions 表用于用户自定义订阅，需新建 subscription_plans 表用于 MCP 订阅计划
