# ProtocolBanks 开发路线图

## 项目现状分析

### ✅ 已实现的功能

#### 1. 邮箱登录 (Email Login Flow)
- **API 端点**: `/api/auth/magic-link/send` - Magic Link 发送
- **API 端点**: `/api/auth/magic-link/verify` - Magic Link 验证
- **API 端点**: `/api/auth/wallet/create` - 钱包创建
- **API 端点**: `/api/auth/wallet/get` - 获取钱包
- **API 端点**: `/api/auth/wallet/sign` - 交易签名
- **库文件**: `lib/auth/crypto.ts` - 加密工具
- **库文件**: `lib/auth/shamir.ts` - Shamir 分片
- **库文件**: `lib/auth/embedded-wallet.ts` - 嵌入式钱包
- **库文件**: `lib/auth/session.ts` - 会话管理
- **状态**: 部分实现，需要完善

#### 2. 批量支付 (Batch Payment Flow)
- **UI 页面**: `app/batch-payment/page.tsx` - 批量支付界面
- **API 端点**: `/api/payout/batch` - 批量支付处理
- **库文件**: `lib/excel-parser.ts` - CSV/Excel 解析
- **库文件**: `lib/payment-service.ts` - 支付服务
- **库文件**: `lib/services/payment-service.ts` - 支付业务逻辑
- **状态**: 部分实现，UI 完整但后端不完整

#### 3. x402 Protocol
- **库文件**: `lib/x402-client.ts` - x402 客户端
- **库文件**: `lib/web3.ts` - Web3 集成
- **状态**: 基础框架完成，需要完善

#### 4. 其他已实现功能
- OAuth 登录 (Google, Apple)
- 会话管理
- 多签钱包支持
- 交易历史
- 订阅管理
- 安全监控

---

## ❌ 未完善的功能清单

### 优先级 P0 (关键，必须完成)

#### 1. Email Login Flow - 完整性问题
**问题**: 邮箱登录流程不完整，用户无法完成从登录到钱包创建的全流程

**缺失部分**:
- [ ] PIN 设置与验证 API (`/api/auth/setup-pin`)
- [ ] 恢复短语确认 API (`/api/auth/confirm-recovery`)
- [ ] 账户验证 API (`/api/auth/validate-account`)
- [ ] 会话创建与验证完整实现
- [ ] 错误恢复流程
- [ ] 前端 UI 组件 (PIN 设置页面, 恢复短语页面)
- [ ] 数据库表创建 (auth_users, auth_sessions, embedded_wallets, email_verifications)
- [ ] 数据库迁移脚本

**工作量**: 40 小时
**依赖**: 无
**优先级**: P0 - 用户 onboarding 的关键路径

---

#### 2. Batch Payment Flow - 后端不完整
**问题**: 前端 UI 完整但后端 API 不完整，无法真正执行批量支付

**缺失部分**:
- [ ] 文件解析 API 完整实现 (`/api/batch-payment/upload`)
- [ ] 数据验证 API (`/api/batch-payment/validate`)
- [ ] 费用计算 API (`/api/batch-payment/calculate-fees`)
- [ ] 批量支付执行 API (`/api/batch-payment/submit`)
- [ ] 支付状态追踪 API (`/api/batch-payment/:batchId/status`)
- [ ] 数据库表创建 (batch_payments, payment_items, batch_drafts)
- [ ] 数据库迁移脚本
- [ ] 交易签名与执行逻辑
- [ ] 错误处理与恢复

**工作量**: 50 小时
**依赖**: Email Login Flow (用户认证)
**优先级**: P0 - 核心企业功能

---

#### 3. x402 Protocol - 框架不完整
**问题**: 只有客户端框架，缺少完整的后端实现和链上集成

**缺失部分**:
- [ ] EIP-712 签名生成 API (`/api/x402/generate-authorization`)
- [ ] 签名提交 API (`/api/x402/submit-signature`)
- [ ] Relayer 提交 API (`/api/x402/submit-to-relayer`)
- [ ] 状态查询 API (`/api/x402/:authorizationId/status`)
- [ ] Nonce 管理服务
- [ ] Relayer 集成
- [ ] 链上验证逻辑
- [ ] 数据库表创建 (x402_authorizations, x402_nonces, x402_executions)
- [ ] 数据库迁移脚本
- [ ] 多链支持 (Ethereum, Polygon, Arbitrum, Optimism, Base)

**工作量**: 60 小时
**依赖**: Email Login Flow (用户认证)
**优先级**: P0 - Gasless 支付的关键功能

---

### 优先级 P1 (重要，应该完成)

#### 4. 前后端接口不匹配
**问题**: 前端期望的 API 响应格式与后端实现不一致

**缺失部分**:
- [ ] 统一 API 响应格式
- [ ] 错误处理标准化
- [ ] 请求验证中间件
- [ ] 认证中间件完善
- [ ] 速率限制实现
- [ ] CORS 配置

**工作量**: 15 小时
**依赖**: 无
**优先级**: P1 - 影响所有 API 集成

---

#### 5. 数据库完整性
**问题**: 缺少必要的数据库表和迁移脚本

**缺失部分**:
- [ ] auth_users 表
- [ ] auth_sessions 表
- [ ] embedded_wallets 表
- [ ] email_verifications 表
- [ ] batch_payments 表
- [ ] payment_items 表
- [ ] batch_drafts 表
- [ ] x402_authorizations 表
- [ ] x402_nonces 表
- [ ] x402_executions 表
- [ ] 所有表的索引和约束
- [ ] 迁移脚本

**工作量**: 10 小时
**依赖**: 无
**优先级**: P1 - 所有功能的基础

---

#### 6. 安全性完善
**问题**: 缺少关键的安全措施

**缺失部分**:
- [ ] CSRF 保护
- [ ] 速率限制
- [ ] 输入验证
- [ ] SQL 注入防护
- [ ] XSS 防护
- [ ] 私钥管理安全
- [ ] 会话安全
- [ ] 审计日志

**工作量**: 20 小时
**依赖**: 无
**优先级**: P1 - 生产环境必需

---

#### 7. 测试覆盖
**问题**: 缺少单元测试和集成测试

**缺失部分**:
- [ ] Email Login Flow 单元测试
- [ ] Batch Payment Flow 单元测试
- [ ] x402 Protocol 单元测试
- [ ] API 集成测试
- [ ] 端到端测试
- [ ] 性能测试

**工作量**: 40 小时
**依赖**: 所有功能实现完成
**优先级**: P1 - 质量保证

---

### 优先级 P2 (可选，增强功能)

#### 8. 多签审批集成
**问题**: 多签钱包支持不完整

**缺失部分**:
- [ ] 多签提案创建
- [ ] 多签审批流程
- [ ] 多签执行
- [ ] 多签状态追踪

**工作量**: 25 小时
**依赖**: Batch Payment Flow
**优先级**: P2 - 企业级功能

---

#### 9. 监控与分析
**问题**: 缺少完整的监控和分析功能

**缺失部分**:
- [ ] 交易监控
- [ ] 错误追踪
- [ ] 性能监控
- [ ] 用户分析
- [ ] 审计日志查询

**工作量**: 20 小时
**依赖**: 所有功能实现完成
**优先级**: P2 - 运维支持

---

#### 10. 文档完善
**问题**: 缺少完整的 API 文档和用户文档

**缺失部分**:
- [ ] API 文档 (OpenAPI/Swagger)
- [ ] 用户指南
- [ ] 开发者指南
- [ ] 故障排除指南

**工作量**: 15 小时
**依赖**: 所有功能实现完成
**优先级**: P2 - 用户支持

---

## 📊 工作量统计

| 功能 | 工作量 | 优先级 | 状态 |
|------|--------|--------|------|
| Email Login Flow 完善 | 40h | P0 | 未开始 |
| Batch Payment Flow 完善 | 50h | P0 | 未开始 |
| x402 Protocol 完善 | 60h | P0 | 未开始 |
| 前后端接口匹配 | 15h | P1 | 未开始 |
| 数据库完整性 | 10h | P1 | 未开始 |
| 安全性完善 | 20h | P1 | 未开始 |
| 测试覆盖 | 40h | P1 | 未开始 |
| 多签审批集成 | 25h | P2 | 未开始 |
| 监控与分析 | 20h | P2 | 未开始 |
| 文档完善 | 15h | P2 | 未开始 |
| **总计** | **295h** | - | - |

**预计时间**: 6-8 周 (1 个开发者全职)

---

## 🎯 建议实现顺序

### 第 1 阶段 (第 1-2 周) - 基础设施
1. 创建所有数据库表和迁移脚本 (10h)
2. 统一 API 响应格式和错误处理 (15h)
3. 实现认证中间件和速率限制 (10h)

**产出**: 可用的数据库和 API 基础设施

---

### 第 2 阶段 (第 2-3 周) - Email Login Flow
1. 完成 PIN 设置 API (10h)
2. 完成恢复短语确认 API (8h)
3. 完成账户验证 API (8h)
4. 完成前端 UI 组件 (10h)
5. 集成测试 (4h)

**产出**: 完整的邮箱登录流程

---

### 第 3 阶段 (第 3-4 周) - Batch Payment Flow
1. 完成文件解析 API (12h)
2. 完成数据验证 API (8h)
3. 完成费用计算 API (8h)
4. 完成支付执行 API (15h)
5. 完成状态追踪 API (5h)
6. 集成测试 (2h)

**产出**: 完整的批量支付流程

---

### 第 4 阶段 (第 4-5 周) - x402 Protocol
1. 完成 EIP-712 签名 API (15h)
2. 完成 Nonce 管理 (10h)
3. 完成 Relayer 集成 (15h)
4. 完成链上验证 (12h)
5. 多链支持 (8h)

**产出**: 完整的 x402 gasless 支付

---

### 第 5 阶段 (第 5-6 周) - 安全性与测试
1. 安全性完善 (20h)
2. 单元测试 (20h)
3. 集成测试 (10h)
4. 端到端测试 (10h)

**产出**: 生产就绪的代码

---

### 第 6 阶段 (第 6-7 周) - 增强功能
1. 多签审批集成 (25h)
2. 监控与分析 (20h)

**产出**: 企业级功能

---

### 第 7 阶段 (第 7-8 周) - 文档与优化
1. API 文档 (8h)
2. 用户文档 (5h)
3. 性能优化 (2h)

**产出**: 完整的文档和优化

---

## 🔧 技术栈

### 已有
- Next.js 15.5.9
- React 19.2.0
- TypeScript 5
- Supabase (PostgreSQL)
- Ethers.js 6.15.0
- Wagmi 2.12.34
- Viem 2.21.58
- Resend (邮件服务)
- XLSX (Excel 解析)

### 需要添加
- `@noble/shamir` - Shamir 分片
- `tweetnacl.js` - AES-256-GCM 加密
- `bip39` - BIP39 助记词
- `argon2-browser` - PIN 哈希
- `jest` - 单元测试
- `supertest` - API 测试
- `swagger-ui-express` - API 文档

---

## 📝 待开发清单

### 数据库迁移
- [ ] 创建 auth_users 表
- [ ] 创建 auth_sessions 表
- [ ] 创建 embedded_wallets 表
- [ ] 创建 email_verifications 表
- [ ] 创建 batch_payments 表
- [ ] 创建 payment_items 表
- [ ] 创建 batch_drafts 表
- [ ] 创建 x402_authorizations 表
- [ ] 创建 x402_nonces 表
- [ ] 创建 x402_executions 表

### Email Login Flow
- [ ] 实现 PIN 设置 API
- [ ] 实现恢复短语确认 API
- [ ] 实现账户验证 API
- [ ] 创建 PIN 设置前端页面
- [ ] 创建恢复短语显示页面
- [ ] 创建恢复短语确认页面
- [ ] 集成 Shamir 分片库
- [ ] 集成 AES-256-GCM 加密
- [ ] 实现错误恢复流程

### Batch Payment Flow
- [ ] 完成文件解析 API
- [ ] 完成数据验证 API
- [ ] 完成费用计算 API
- [ ] 完成支付执行 API
- [ ] 完成状态追踪 API
- [ ] 实现交易签名逻辑
- [ ] 实现错误处理与恢复
- [ ] 前端与后端集成

### x402 Protocol
- [ ] 实现 EIP-712 签名 API
- [ ] 实现 Nonce 管理
- [ ] 实现 Relayer 集成
- [ ] 实现链上验证
- [ ] 实现多链支持
- [ ] 实现错误处理
- [ ] 前端与后端集成

### 安全性
- [ ] 实现 CSRF 保护
- [ ] 实现速率限制
- [ ] 实现输入验证
- [ ] 实现审计日志
- [ ] 实现会话安全

### 测试
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 编写端到端测试
- [ ] 编写性能测试

### 文档
- [ ] 编写 API 文档
- [ ] 编写用户指南
- [ ] 编写开发者指南
- [ ] 编写故障排除指南

---

## 🚀 下一步行动

1. **立即开始**: 创建数据库表和迁移脚本 (第 1 阶段)
2. **并行进行**: 统一 API 响应格式
3. **然后**: 按照建议顺序实现各功能

**预计完成时间**: 6-8 周

