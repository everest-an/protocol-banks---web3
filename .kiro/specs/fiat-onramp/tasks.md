# Implementation Plan: Fiat On/Off Ramp

## Overview

本实现计划将法币出入金功能分解为可执行的开发任务，采用渐进式开发策略，优先实现核心功能，再逐步完善高级特性。

## Tasks

- [ ] 1. 项目基础设施搭建
  - [ ] 1.1 创建数据库表和 RLS 策略
    - 创建 kyc_users, kyc_documents, fiat_transactions, bank_accounts, fiat_audit_logs 表
    - 配置 Row Level Security 策略
    - _Requirements: 1.7, 7.4_
  - [ ] 1.2 创建核心类型定义
    - 定义 TypeScript 接口: Quote, Transaction, KYCStatus, RiskAssessment
    - 创建错误码枚举 FiatErrorCode
    - _Requirements: 2.6, 8.7_
  - [ ] 1.3 编写类型定义的属性测试
    - **Property 24: API Error Format**
    - **Validates: Requirements 8.7**

- [ ] 2. KYC 服务实现
  - [ ] 2.1 实现 KYC 状态管理
    - 创建 getKYCStatus, updateKYCStatus 函数
    - 实现 KYC 等级与限额映射
    - _Requirements: 1.1, 1.3, 1.4_
  - [ ] 2.2 编写 KYC 限额属性测试
    - **Property 2: Transaction Limits by KYC Tier**
    - **Validates: Requirements 1.3, 1.4, 2.8**
  - [ ] 2.3 实现文档加密存储
    - 使用 AES-256-GCM 加密 KYC 文档
    - 实现加密/解密工具函数
    - _Requirements: 1.7_
  - [ ] 2.4 编写加密往返属性测试
    - **Property 1: KYC Data Encryption Round Trip**
    - **Validates: Requirements 1.7**
  - [ ] 2.5 实现 KYC 拒绝原因系统
    - 定义拒绝原因码
    - 实现拒绝通知逻辑
    - _Requirements: 1.5_
  - [ ] 2.6 编写拒绝原因属性测试
    - **Property 3: KYC Rejection Provides Reason**
    - **Validates: Requirements 1.5**

- [ ] 3. Checkpoint - KYC 服务测试
  - 确保所有 KYC 相关测试通过，如有问题请询问用户

- [ ] 4. Fiat Gateway 核心服务
  - [ ] 4.1 实现报价聚合器
    - 集成 MoonPay/Transak API 获取报价
    - 实现最优报价选择逻辑
    - _Requirements: 2.4, 5.1_
  - [ ] 4.2 编写汇率价差属性测试
    - **Property 5: Exchange Rate Spread Limit**
    - **Validates: Requirements 2.4**
  - [ ] 4.3 实现费用透明度
    - 分离显示 exchange_rate, network_fee, service_fee
    - 生成详细交易收据
    - _Requirements: 5.1, 5.4_
  - [ ] 4.4 编写费用透明度属性测试
    - **Property 14: Fee Transparency**
    - **Validates: Requirements 5.1, 5.4**
  - [ ] 4.5 实现报价过期检测
    - 监控市场价格变化
    - 超过 1% 变化时标记报价过期
    - _Requirements: 5.2_
  - [ ] 4.6 编写报价过期属性测试
    - **Property 15: Quote Staleness Detection**
    - **Validates: Requirements 5.2**

- [ ] 5. 支付处理器实现
  - [ ] 5.1 集成 Stripe 卡支付
    - 实现卡片 tokenization
    - 集成 3D Secure 验证
    - _Requirements: 2.2, 2.7_
  - [ ] 5.2 编写卡片 tokenization 属性测试
    - **Property 4: Card Tokenization Security**
    - **Validates: Requirements 2.2**
  - [ ] 5.3 实现支付错误处理
    - 映射 Stripe 错误码到 FiatErrorCode
    - 提供替代支付建议
    - _Requirements: 2.6_
  - [ ] 5.4 编写支付错误处理属性测试
    - **Property 6: Payment Error Handling**
    - **Validates: Requirements 2.6**
  - [ ] 5.5 实现交易限额检查
    - 根据 KYC 等级检查限额
    - 实现每日/每月累计限额
    - _Requirements: 2.8_

- [ ] 6. Checkpoint - 入金流程测试
  - 确保卡支付入金流程端到端可用，如有问题请询问用户

- [ ] 7. 银行转账模块
  - [ ] 7.1 实现银行转账指令生成
    - 生成唯一参考码
    - 支持 SEPA/ACH/SWIFT 格式
    - _Requirements: 3.1, 3.2_
  - [ ] 7.2 编写参考码唯一性属性测试
    - **Property 7: Unique Reference Code Generation**
    - **Validates: Requirements 3.1**
  - [ ] 7.3 实现入账匹配算法
    - 按参考码精确匹配
    - 无参考码时按金额+发送方模糊匹配
    - _Requirements: 3.6_
  - [ ] 7.4 编写入账匹配属性测试
    - **Property 8: Deposit Matching Algorithm**
    - **Validates: Requirements 3.6**
  - [ ] 7.5 实现银行转账费用计算
    - 0.5% 费率，最低 $1，最高 $50
    - _Requirements: 3.7_
  - [ ] 7.6 编写费用计算属性测试
    - **Property 9: Bank Transfer Fee Calculation**
    - **Validates: Requirements 3.7**

- [ ] 8. 出金模块实现
  - [ ] 8.1 实现汇率锁定机制
    - 确认订单后锁定汇率 60 秒
    - 超时后自动过期
    - _Requirements: 4.2_
  - [ ] 8.2 编写汇率锁定属性测试
    - **Property 10: Rate Lock Validity**
    - **Validates: Requirements 4.2**
  - [ ] 8.3 实现银行账户验证
    - 微存款验证流程
    - 只允许已验证账户出金
    - _Requirements: 4.4, 4.5_
  - [ ] 8.4 编写账户验证属性测试
    - **Property 11: Verified Account Withdrawal Only**
    - **Validates: Requirements 4.4**
  - [ ] 8.5 实现大额出金验证
    - 超过 $10,000 需额外验证
    - _Requirements: 4.6_
  - [ ] 8.6 编写大额出金属性测试
    - **Property 12: Large Withdrawal Verification**
    - **Validates: Requirements 4.6**
  - [ ] 8.7 实现小额出金批处理
    - 批量处理 <$100 的出金
    - 达到 10 笔或 24 小时触发
    - _Requirements: 4.8_
  - [ ] 8.8 编写批处理属性测试
    - **Property 13: Withdrawal Batching**
    - **Validates: Requirements 4.8**

- [ ] 9. Checkpoint - 出金流程测试
  - 确保出金流程端到端可用，如有问题请询问用户

- [ ] 10. 风控与合规模块
  - [ ] 10.1 实现制裁名单筛查
    - 集成 Chainalysis API
    - 检查 OFAC/EU/UN 制裁名单
    - _Requirements: 7.3, 7.6_
  - [ ] 10.2 编写制裁合规属性测试
    - **Property 18: Sanctions Compliance**
    - **Validates: Requirements 7.3, 7.6**
  - [ ] 10.3 实现风险评分系统
    - 定义风险规则和权重
    - 计算交易风险分数
    - _Requirements: 7.1, 7.2, 7.7_
  - [ ] 10.4 编写风险检测属性测试
    - **Property 19: Risk Detection and Flagging**
    - **Validates: Requirements 7.1, 7.2, 7.7**
  - [ ] 10.5 实现审计日志系统
    - 记录所有法币交易
    - 确保日志不可篡改
    - _Requirements: 7.4_
  - [ ] 10.6 编写审计完整性属性测试
    - **Property 20: Audit Trail Completeness**
    - **Validates: Requirements 7.4**
  - [ ] 10.7 实现合规报告生成
    - CTR 报告 (>$10,000)
    - SAR 报告 (可疑活动)
    - _Requirements: 7.5_
  - [ ] 10.8 编写报告生成属性测试
    - **Property 21: Regulatory Report Generation**
    - **Validates: Requirements 7.5**

- [ ] 11. API 与集成模块
  - [ ] 11.1 实现 REST API 端点
    - /api/fiat/quote - 获取报价
    - /api/fiat/onramp - 执行入金
    - /api/fiat/offramp - 执行出金
    - /api/fiat/status - 查询状态
    - _Requirements: 8.1_
  - [ ] 11.2 实现 API 访问控制
    - IP 白名单验证
    - 速率限制 (100/分钟)
    - _Requirements: 8.3, 8.5_
  - [ ] 11.3 编写 API 访问控制属性测试
    - **Property 23: API Access Control**
    - **Validates: Requirements 8.3, 8.5**
  - [ ] 11.4 实现 Webhook 通知
    - 交易状态变更通知
    - 签名验证
    - _Requirements: 8.2_
  - [ ] 11.5 编写 Webhook 属性测试
    - **Property 22: Webhook Delivery**
    - **Validates: Requirements 8.2**

- [ ] 12. 前端 UI 组件
  - [ ] 12.1 创建入金页面组件
    - 支付方式选择
    - 金额输入和报价显示
    - 确认和状态追踪
    - _Requirements: 2.1, 5.1_
  - [ ] 12.2 创建出金页面组件
    - 银行账户选择
    - 金额输入和费用预览
    - 确认和状态追踪
    - _Requirements: 4.1, 4.7_
  - [ ] 12.3 创建 KYC 流程组件
    - 文档上传界面
    - 状态显示和进度追踪
    - _Requirements: 1.1, 1.2_
  - [ ] 12.4 创建价格提醒组件
    - 目标价格设置
    - 提醒通知
    - _Requirements: 5.6_
  - [ ] 12.5 编写价格提醒属性测试
    - **Property 16: Price Alert Triggering**
    - **Validates: Requirements 5.6**

- [ ] 13. 高级功能
  - [ ] 13.1 实现货币回退机制
    - 首选货币不可用时回退到 USD
    - 显示转换汇率
    - _Requirements: 6.5_
  - [ ] 13.2 编写货币回退属性测试
    - **Property 17: Currency Fallback**
    - **Validates: Requirements 6.5**
  - [ ] 13.3 创建 SDK 包
    - JavaScript/TypeScript SDK
    - Python SDK
    - Go SDK
    - _Requirements: 8.4_
  - [ ] 13.4 创建沙盒环境
    - 测试 API 端点
    - 模拟支付流程
    - _Requirements: 8.6_

- [ ] 14. Final Checkpoint - 完整功能测试
  - 确保所有测试通过，如有问题请询问用户

## 待完善功能 (TODO)

### P0 - 必须完成 (上线前)

- [ ] HSM 集成 - 使用硬件安全模块保护加密密钥
- [ ] 第三方 KYC 服务集成 (Jumio/Onfido)
- [ ] 生产环境支付服务商配置 (Stripe/MoonPay)
- [ ] 合规法律审查 - 各地区监管要求确认

### P1 - 建议完成 (上线后 1 个月)

- [ ] 更多法币支持 (CNY, HKD, TWD)
- [ ] 更多加密货币支持 (AVAX, ARB, OP)
- [ ] 定期购买功能 (DCA)
- [ ] 企业批量入金 API
- [ ] 移动端优化

### P2 - 未来规划

- [ ] 银行直连 (Open Banking API)
- [ ] 虚拟卡发行
- [ ] 跨境汇款优化
- [ ] AI 风控模型

## Notes

- 所有任务均为必选，确保功能完整性
- 每个属性测试需引用设计文档中的属性编号
- Checkpoint 任务用于阶段性验证
- 建议按顺序执行，确保依赖关系正确
