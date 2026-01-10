# Implementation Plan: WebAuthn/Passkey Support

## Overview

本实现计划将 WebAuthn/Passkey 功能分解为可执行的开发任务，集成现有认证系统，提供无密码登录和交易授权能力。

## Tasks

- [ ] 1. 项目基础设施搭建
  - [ ] 1.1 安装依赖包
    - 安装 @simplewebauthn/server, @simplewebauthn/browser
    - 配置 TypeScript 类型
    - _Requirements: 7.1-7.6_
  - [ ] 1.2 创建数据库表和 RLS 策略
    - 创建 webauthn_credentials, webauthn_challenges, webauthn_auth_attempts, webauthn_recovery_requests 表
    - 配置 Row Level Security 策略
    - _Requirements: 6.5, 6.7_
  - [ ] 1.3 创建核心类型定义
    - 定义 TypeScript 接口: RegistrationOptions, AuthenticationOptions, StoredCredential
    - 创建错误码枚举 WebAuthnErrorCode
    - _Requirements: 1.5, 2.6_
  - [ ] 1.4 编写错误处理属性测试
    - **Property 3: Registration Error Handling**
    - **Validates: Requirements 1.5**

- [ ] 2. Challenge 管理模块
  - [ ] 2.1 实现 Challenge 生成器
    - 生成 32 字节加密随机挑战
    - 支持不同类型 (registration, authentication, transaction)
    - _Requirements: 1.1, 2.1_
  - [ ] 2.2 编写 Challenge 唯一性属性测试
    - **Property 1: Challenge Uniqueness and Randomness**
    - **Validates: Requirements 1.1, 2.1**
  - [ ] 2.3 实现 Challenge 过期管理
    - 5 分钟过期时间
    - Redis 缓存存储
    - _Requirements: 2.3_
  - [ ] 2.4 编写过期属性测试
    - **Property 6: Token/Challenge Expiration**
    - **Validates: Requirements 2.3, 3.4**

- [ ] 3. Checkpoint - Challenge 模块测试
  - 确保所有 Challenge 相关测试通过，如有问题请询问用户

- [ ] 4. Passkey 注册流程
  - [ ] 4.1 实现注册选项生成
    - 配置 RP (Relying Party) 信息
    - 设置支持的算法 (ES256, RS256)
    - _Requirements: 1.3_
  - [ ] 4.2 实现注册验证
    - 验证 attestation 响应
    - 提取并存储公钥
    - _Requirements: 1.2, 6.3_
  - [ ] 4.3 编写凭证存储属性测试
    - **Property 2: Credential Storage Integrity**
    - **Validates: Requirements 1.2, 1.4**
  - [ ] 4.4 编写 Attestation 验证属性测试
    - **Property 21: Attestation Validation**
    - **Validates: Requirements 6.3**
  - [ ] 4.5 实现多 Passkey 支持
    - 允许用户注册多个凭证
    - 凭证列表管理
    - _Requirements: 1.6_
  - [ ] 4.6 编写多 Passkey 属性测试
    - **Property 4: Multiple Passkey Support**
    - **Validates: Requirements 1.6**
  - [ ] 4.7 编写无私钥存储属性测试
    - **Property 23: No Private Key Storage**
    - **Validates: Requirements 6.5**

- [ ] 5. Passkey 认证流程
  - [ ] 5.1 实现认证选项生成
    - 支持 Conditional UI
    - 跨设备认证 (QR Code)
    - _Requirements: 2.6, 2.7_
  - [ ] 5.2 实现签名验证
    - COSE 算法签名验证
    - 公钥匹配检查
    - _Requirements: 2.2_
  - [ ] 5.3 编写签名验证属性测试
    - **Property 5: Signature Verification**
    - **Validates: Requirements 2.2**
  - [ ] 5.4 实现计数器验证
    - 防重放攻击
    - 计数器递增检查
    - _Requirements: 6.4_
  - [ ] 5.5 编写计数器属性测试
    - **Property 22: Counter Replay Protection**
    - **Validates: Requirements 6.4**
  - [ ] 5.6 实现 Origin 验证
    - 域名匹配检查
    - 防钓鱼保护
    - _Requirements: 6.1_
  - [ ] 5.7 编写 Origin 验证属性测试
    - **Property 19: Origin Validation**
    - **Validates: Requirements 6.1**
  - [ ] 5.8 实现会话创建
    - 认证成功后创建会话
    - 与现有会话系统集成
    - _Requirements: 2.4_
  - [ ] 5.9 编写会话创建属性测试
    - **Property 7: Session Creation on Auth**
    - **Validates: Requirements 2.4**

- [ ] 6. Checkpoint - 认证流程测试
  - 确保注册和认证流程端到端可用，如有问题请询问用户

- [ ] 7. 安全控制模块
  - [ ] 7.1 实现速率限制
    - 每用户认证尝试限制
    - IP 级别限制
    - _Requirements: 6.6_
  - [ ] 7.2 实现账户锁定
    - 5 次失败后锁定 15 分钟
    - 锁定状态管理
    - _Requirements: 2.5_
  - [ ] 7.3 编写速率限制和锁定属性测试
    - **Property 8: Rate Limiting and Lockout**
    - **Validates: Requirements 2.5, 6.6**
  - [ ] 7.4 实现 UV 标志验证
    - 敏感操作要求用户验证
    - _Requirements: 6.2_
  - [ ] 7.5 编写 UV 标志属性测试
    - **Property 20: User Verification Flag**
    - **Validates: Requirements 6.2**
  - [ ] 7.6 实现审计日志
    - 记录所有认证事件
    - 记录恢复尝试
    - _Requirements: 5.6, 6.7_
  - [ ] 7.7 编写审计日志属性测试
    - **Property 24: Audit Logging**
    - **Validates: Requirements 5.6, 6.7**

- [ ] 8. 交易授权模块
  - [ ] 8.1 实现交易阈值检查
    - 可配置阈值 (默认 $1,000)
    - 超阈值触发 Passkey 验证
    - _Requirements: 3.1, 3.6_
  - [ ] 8.2 编写阈值属性测试
    - **Property 9: Transaction Threshold Enforcement**
    - **Validates: Requirements 3.1, 3.6**
  - [ ] 8.3 实现交易 Challenge 生成
    - 包含交易详情 (金额、收款人、代币)
    - _Requirements: 3.2_
  - [ ] 8.4 编写交易详情属性测试
    - **Property 10: Transaction Details in Challenge**
    - **Validates: Requirements 3.2**
  - [ ] 8.5 实现授权令牌生成
    - 60 秒有效期
    - 签名验证
    - _Requirements: 3.4_
  - [ ] 8.6 实现失败处理
    - 拒绝交易
    - 记录审计日志
    - _Requirements: 3.5_
  - [ ] 8.7 编写失败处理属性测试
    - **Property 11: Failed Verification Handling**
    - **Validates: Requirements 3.5**

- [ ] 9. Checkpoint - 交易授权测试
  - 确保交易授权流程可用，如有问题请询问用户

- [ ] 10. 凭证管理模块
  - [ ] 10.1 实现凭证列表
    - 显示设备名、注册日期、最后使用日期
    - 显示认证器类型
    - _Requirements: 4.1, 4.6_
  - [ ] 10.2 编写凭证列表属性测试
    - **Property 12: Credential Listing Completeness**
    - **Validates: Requirements 4.1, 4.6**
  - [ ] 10.3 实现凭证删除
    - 删除前验证
    - 最后凭证保护
    - _Requirements: 4.2, 4.3_
  - [ ] 10.4 编写删除验证属性测试
    - **Property 13: Credential Removal Verification**
    - **Validates: Requirements 4.2**
  - [ ] 10.5 编写最后凭证保护属性测试
    - **Property 14: Last Credential Protection**
    - **Validates: Requirements 4.3**
  - [ ] 10.6 实现会话失效
    - 删除凭证时失效相关会话
    - _Requirements: 4.4_
  - [ ] 10.7 编写会话失效属性测试
    - **Property 15: Session Invalidation on Removal**
    - **Validates: Requirements 4.4**
  - [ ] 10.8 实现凭证重命名
    - 允许用户自定义设备名
    - _Requirements: 4.5_

- [ ] 11. 恢复机制模块
  - [ ] 11.1 实现恢复流程
    - Email Magic Link 恢复
    - 身份验证要求
    - _Requirements: 5.1, 5.2_
  - [ ] 11.2 编写恢复验证属性测试
    - **Property 16: Recovery Verification Required**
    - **Validates: Requirements 5.2**
  - [ ] 11.3 实现冷却期
    - 24 小时冷却期
    - 新凭证使用限制
    - _Requirements: 5.4_
  - [ ] 11.4 编写冷却期属性测试
    - **Property 17: Recovery Cooling Period**
    - **Validates: Requirements 5.4**
  - [ ] 11.5 实现可疑活动检测
    - 多次尝试检测
    - 异常位置检测
    - _Requirements: 5.5_
  - [ ] 11.6 编写可疑活动属性测试
    - **Property 18: Suspicious Recovery Detection**
    - **Validates: Requirements 5.5**

- [ ] 12. 前端 UI 组件
  - [ ] 12.1 创建 Passkey 注册组件
    - 注册按钮和流程引导
    - 成功/失败反馈
    - _Requirements: 1.1-1.7_
  - [ ] 12.2 创建 Passkey 登录组件
    - Conditional UI 支持
    - 跨设备 QR Code
    - _Requirements: 2.1-2.7_
  - [ ] 12.3 创建凭证管理页面
    - 凭证列表
    - 添加/删除/重命名操作
    - _Requirements: 4.1-4.6_
  - [ ] 12.4 创建交易授权弹窗
    - 显示交易详情
    - Passkey 验证触发
    - _Requirements: 3.1-3.6_
  - [ ] 12.5 创建恢复流程页面
    - 恢复入口
    - 状态追踪
    - _Requirements: 5.1-5.6_

- [ ] 13. API 端点实现
  - [ ] 13.1 实现注册 API
    - POST /api/auth/webauthn/register/options
    - POST /api/auth/webauthn/register/verify
    - _Requirements: 1.1-1.7_
  - [ ] 13.2 实现认证 API
    - POST /api/auth/webauthn/authenticate/options
    - POST /api/auth/webauthn/authenticate/verify
    - _Requirements: 2.1-2.7_
  - [ ] 13.3 实现凭证管理 API
    - GET /api/auth/webauthn/credentials
    - DELETE /api/auth/webauthn/credentials/:id
    - PATCH /api/auth/webauthn/credentials/:id
    - _Requirements: 4.1-4.6_
  - [ ] 13.4 实现交易授权 API
    - POST /api/auth/webauthn/authorize/options
    - POST /api/auth/webauthn/authorize/verify
    - _Requirements: 3.1-3.6_

- [ ] 14. Final Checkpoint - 完整功能测试
  - 确保所有测试通过，如有问题请询问用户

## 待完善功能 (TODO)

### P0 - 必须完成 (上线前)

- [ ] 浏览器兼容性测试 (Chrome, Safari, Firefox, Edge)
- [ ] 移动端测试 (iOS Safari, Android Chrome)
- [ ] 安全审计

### P1 - 建议完成 (上线后 1 个月)

- [ ] YubiKey 专项支持和测试
- [ ] 企业级 Attestation 验证
- [ ] 批量凭证管理 (管理员功能)

### P2 - 未来规划

- [ ] Passkey 同步状态显示
- [ ] 凭证使用统计
- [ ] 高级安全策略配置

## Notes

- 所有任务均为必选，确保功能完整性
- 每个属性测试需引用设计文档中的属性编号
- Checkpoint 任务用于阶段性验证
- 建议按顺序执行，确保依赖关系正确
- 使用 @simplewebauthn 库简化 WebAuthn 实现
