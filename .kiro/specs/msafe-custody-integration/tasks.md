# 实现计划: MSafe 托管集成

## 概述

本实现计划将 MSafe 多签托管功能集成到 Protocol Banks 平台，作为与现有 EVM 支付系统并行的可选托管收单服务。实现采用 TypeScript，使用 Next.js API Routes 和现有的服务架构模式。

## 任务

- [ ] 1. 项目基础设施搭建
  - [ ] 1.1 创建数据库表结构
    - 创建 custody_wallets、escrow_transactions、withdrawal_proposals、proposal_approvals、custody_audit_logs、wallet_configs 表
    - 添加必要的索引和约束
    - _Requirements: 10.1, 10.2, 10.6_

  - [ ] 1.2 安装和配置 MSafe SDK 依赖
    - 安装 @msafe/aptos-wallet 和 @aptos-labs/ts-sdk
    - 配置 Aptos RPC 端点（主备）
    - _Requirements: 1.1, 9.1_

  - [ ] 1.3 创建核心类型定义
    - 在 types/ 目录创建 custody.ts 类型文件
    - 定义 CustodyWallet、EscrowTransaction、WithdrawalProposal 等接口
    - _Requirements: 10.1, 10.2_

- [ ] 2. MSafe SDK 适配器实现
  - [ ] 2.1 实现 MSafe 适配器核心类
    - 创建 lib/services/msafe-adapter.ts
    - 实现钱包创建、余额查询、交易提交方法
    - 实现签名验证方法
    - _Requirements: 1.1, 5.1_

  - [ ] 2.2 编写 MSafe 适配器属性测试
    - **Property 17: 数据序列化往返**
    - **Validates: Requirements 10.3**

  - [ ] 2.3 实现 RPC 故障转移管理器
    - 创建 lib/services/rpc-manager.ts
    - 实现主备 RPC 切换逻辑
    - 实现健康检查
    - _Requirements: 2.6, 9.1_

  - [ ] 2.4 编写 RPC 故障转移属性测试
    - **Property 7: RPC 故障转移**
    - **Validates: Requirements 2.6, 9.1**

- [ ] 3. 托管钱包管理服务
  - [ ] 3.1 实现钱包管理服务
    - 创建 lib/services/custody-wallet-service.ts
    - 实现创建、查询、更新钱包方法
    - 实现签名者和阈值验证
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [ ] 3.2 编写钱包创建属性测试
    - **Property 1: 钱包创建参数验证**
    - **Property 2: 唯一标识符生成**
    - **Validates: Requirements 1.2, 1.5, 4.6**

  - [ ] 3.3 实现钱包配置管理
    - 实现提款延迟、限额、白名单配置
    - _Requirements: 8.1, 8.2, 8.6_

  - [ ] 3.4 创建钱包管理 API 路由
    - 创建 app/api/custody/wallets/route.ts (POST, GET)
    - 创建 app/api/custody/wallets/[id]/route.ts (GET, PATCH)
    - _Requirements: 1.1, 1.5_

- [ ] 4. Checkpoint - 钱包管理功能验证
  - 确保所有测试通过，如有问题请询问用户

- [ ] 5. 支付路由服务
  - [ ] 5.1 实现支付路由器
    - 创建 lib/services/custody-payment-router.ts
    - 实现幂等性检查
    - 实现托管钱包路由逻辑
    - _Requirements: 2.1, 2.2_

  - [ ] 5.2 编写支付路由属性测试
    - **Property 3: 幂等性保证**
    - **Property 4: 支付路由正确性**
    - **Validates: Requirements 2.1, 2.2, 5.6**

  - [ ] 5.3 实现托管交易记录服务
    - 记录托管交易到数据库
    - 触发 Webhook 通知
    - _Requirements: 2.3, 2.5_

  - [ ] 5.4 编写托管交易属性测试
    - **Property 5: 托管交易数据完整性**
    - **Validates: Requirements 2.3**

  - [ ] 5.5 实现重试队列
    - 创建 lib/services/custody-retry-queue.ts
    - 实现指数退避重试逻辑
    - _Requirements: 2.4_

  - [ ] 5.6 编写重试机制属性测试
    - **Property 6: 指数退避重试**
    - **Validates: Requirements 2.4, 6.5**

- [ ] 6. 余额查询服务
  - [ ] 6.1 实现余额服务
    - 创建 lib/services/custody-balance-service.ts
    - 实现缓存逻辑（30秒过期）
    - 实现降级处理（返回过期数据）
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 6.2 编写余额缓存属性测试
    - **Property 8: 缓存行为正确性**
    - **Validates: Requirements 3.1, 3.4, 3.5**

  - [ ] 6.3 创建余额查询 API 路由
    - 创建 app/api/custody/wallets/[id]/balance/route.ts
    - _Requirements: 3.1, 3.2_

- [ ] 7. Checkpoint - 支付路由和余额功能验证
  - 确保所有测试通过，如有问题请询问用户

- [ ] 8. 提款提案服务
  - [ ] 8.1 实现提案管理服务
    - 创建 lib/services/custody-proposal-service.ts
    - 实现创建、查询、状态更新方法
    - 实现签名者授权验证
    - 实现余额验证
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ] 8.2 编写提案创建属性测试
    - **Property 9: 签名者授权验证**
    - **Property 10: 余额验证**
    - **Validates: Requirements 4.1, 4.3, 5.1**

  - [ ] 8.3 实现审批服务
    - 实现批准和拒绝逻辑
    - 实现阈值检测和状态转换
    - 防止重复操作
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ] 8.4 编写审批流程属性测试
    - **Property 11: 提案状态转换**
    - **Validates: Requirements 5.3, 5.5**

  - [ ] 8.5 创建提案管理 API 路由
    - 创建 app/api/custody/proposals/route.ts (POST, GET)
    - 创建 app/api/custody/proposals/[id]/route.ts (GET)
    - 创建 app/api/custody/proposals/[id]/approve/route.ts (POST)
    - 创建 app/api/custody/proposals/[id]/reject/route.ts (POST)
    - _Requirements: 4.1, 5.1_

- [ ] 9. 提款执行服务
  - [ ] 9.1 实现执行引擎
    - 创建 lib/services/custody-execution-service.ts
    - 实现延迟检查
    - 实现签名组装
    - 实现交易提交和状态监控
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 9.2 编写执行延迟属性测试
    - **Property 12: 提款延迟执行**
    - **Validates: Requirements 6.1**

  - [ ] 9.3 实现限额验证
    - 验证单笔、每日、每周限额
    - 超限时要求额外审批
    - _Requirements: 8.2, 8.3_

  - [ ] 9.4 编写限额验证属性测试
    - **Property 15: 提款限额验证**
    - **Validates: Requirements 8.2, 8.3**

  - [ ] 9.5 创建执行 API 路由
    - 创建 app/api/custody/proposals/[id]/execute/route.ts (POST)
    - _Requirements: 6.1_

- [ ] 10. Checkpoint - 提款流程功能验证
  - 确保所有测试通过，如有问题请询问用户

- [ ] 11. 审计日志服务
  - [ ] 11.1 实现审计日志服务
    - 创建 lib/services/custody-audit-service.ts
    - 实现日志记录方法
    - 确保日志不可变（禁止更新删除）
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 11.2 编写审计日志属性测试
    - **Property 13: 审计日志完整性**
    - **Property 14: 审计日志不可变性**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

  - [ ] 11.3 创建审计日志查询 API
    - 创建 app/api/custody/audit-logs/route.ts (GET)
    - _Requirements: 7.1_

- [ ] 12. 高可用基础设施
  - [ ] 12.1 实现熔断器
    - 扩展现有 lib/services/circuit-breaker.ts
    - 为 MSafe 服务添加熔断配置
    - _Requirements: 9.4_

  - [ ] 12.2 编写熔断器属性测试
    - **Property 16: 熔断器状态转换**
    - **Validates: Requirements 9.4**

  - [ ] 12.3 实现持久化队列
    - 创建 lib/services/custody-queue-service.ts
    - 实现故障恢复后的顺序处理
    - _Requirements: 9.5, 9.6_

  - [ ] 12.4 实现告警服务
    - 扩展现有通知服务
    - 添加多渠道告警（邮件、短信、钉钉）
    - _Requirements: 9.3_

- [ ] 13. 数据验证和序列化
  - [ ] 13.1 实现 JSON Schema 验证
    - 创建 lib/validators/custody-schemas.ts
    - 为所有数据类型定义 Schema
    - _Requirements: 10.4, 10.5_

  - [ ] 13.2 编写 Schema 验证属性测试
    - **Property 18: Schema 验证**
    - **Validates: Requirements 10.4, 10.5**

- [ ] 14. Webhook 集成
  - [ ] 14.1 扩展 Webhook 触发服务
    - 添加托管相关事件类型
    - custody.payment.received
    - custody.proposal.created
    - custody.proposal.approved
    - custody.proposal.executed
    - _Requirements: 2.5, 6.6_

- [ ] 15. 最终集成和测试
  - [ ] 15.1 集成到现有支付网关
    - 在支付路由中添加托管模式选项
    - 更新商户配置界面
    - _Requirements: 2.2_

  - [ ] 15.2 端到端测试
    - 测试完整的托管收单流程
    - 测试完整的提款审批流程
    - _Requirements: All_

- [ ] 16. Final Checkpoint - 完整功能验证
  - 确保所有测试通过，如有问题请询问用户

## 注意事项

- 所有属性测试任务均为必需
- 每个属性测试引用设计文档中的正确性属性
- Checkpoint 任务用于阶段性验证
- 所有服务应遵循现有代码库的架构模式
