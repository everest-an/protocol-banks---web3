# ProtocolBanks 开发路线图

## 项目现状分析

### ✅ 已实现的功能

#### 1. 邮箱登录 (Email Login Flow) ✅ 已完成
- **API 端点**: `/api/auth/magic-link/send` - Magic Link 发送 ✅
- **API 端点**: `/api/auth/magic-link/verify` - Magic Link 验证 ✅
- **API 端点**: `/api/auth/setup-pin` - PIN 设置 ✅
- **API 端点**: `/api/auth/confirm-recovery` - 恢复短语确认 ✅
- **API 端点**: `/api/auth/wallet/create` - 钱包创建 ✅
- **API 端点**: `/api/auth/wallet/get` - 获取钱包 ✅
- **API 端点**: `/api/auth/wallet/sign` - 交易签名 ✅
- **库文件**: `lib/auth/crypto.ts` - 加密工具 ✅
- **库文件**: `lib/auth/shamir.ts` - Shamir 分片 ✅
- **库文件**: `lib/auth/embedded-wallet.ts` - 嵌入式钱包 ✅
- **库文件**: `lib/auth/session.ts` - 会话管理 ✅
- **库文件**: `lib/auth/pin.ts` - PIN 验证 ✅
- **服务**: `services/account-validator.service.ts` - 账户验证 ✅
- **数据库**: `migrations/001_email_login_schema.sql` ✅
- **测试**: `tests/email-login-flow/auth.test.ts` ✅
- **状态**: ✅ 完成

#### 2. 批量支付 (Batch Payment Flow) ✅ 已完成
- **UI 页面**: `app/batch-payment/page.tsx` - 批量支付界面 ✅
- **API 端点**: `/api/batch-payment/upload` - 文件上传 ✅
- **API 端点**: `/api/batch-payment/validate` - 数据验证 ✅
- **API 端点**: `/api/batch-payment/calculate-fees` - 费用计算 ✅
- **API 端点**: `/api/batch-payment/submit` - 批量提交 ✅
- **API 端点**: `/api/batch-payment/[batchId]/status` - 状态查询 ✅
- **服务**: `services/file-parser.service.ts` - 文件解析 ✅
- **服务**: `services/batch-validator.service.ts` - 批量验证 ✅
- **服务**: `services/fee-calculator.service.ts` - 费用计算 ✅
- **服务**: `services/token-metadata.service.ts` - 代币元数据 ✅
- **服务**: `services/recovery-manager.service.ts` - 错误恢复 ✅
- **服务**: `services/report-generator.service.ts` - 报告生成 ✅
- **数据库**: `migrations/002_batch_payment_schema.sql` ✅
- **测试**: `tests/batch-payment-flow/batch-payment.test.ts` ✅
- **状态**: ✅ 完成

#### 3. x402 Protocol ✅ 已完成
- **API 端点**: `/api/x402/generate-authorization` - 授权生成 ✅
- **API 端点**: `/api/x402/submit-signature` - 签名提交 ✅
- **API 端点**: `/api/x402/submit-to-relayer` - Relayer 提交 ✅
- **API 端点**: `/api/x402/settle` - CDP 结算 ✅
- **API 端点**: `/api/x402/[authorizationId]/status` - 状态查询 ✅
- **服务**: `services/eip712.service.ts` - EIP-712 签名 ✅
- **服务**: `services/nonce-manager.service.ts` - Nonce 管理 ✅
- **服务**: `services/signature-verifier.service.ts` - 签名验证 ✅
- **服务**: `services/validity-window.service.ts` - 有效期管理 ✅
- **服务**: `services/authorization-generator.service.ts` - 授权生成 ✅
- **服务**: `services/relayer-client.service.ts` - Relayer 客户端 ✅
- **服务**: `services/cdp-facilitator.service.ts` - CDP Facilitator ✅
- **服务**: `services/x402-fee-calculator.service.ts` - 费用计算 ✅
- **服务**: `services/fee-distributor.service.ts` - 费用分配 ✅
- **数据库**: `migrations/003_x402_schema.sql` ✅
- **测试**: `tests/x402-protocol/x402.test.ts` ✅
- **状态**: ✅ 完成

#### 4. 集成架构 (Integration Architecture) ✅ 已完成
- **Phase 1**: CDP Facilitator 集成 ✅
- **Phase 2**: MCP Server 支持 ✅
- **Phase 3**: API Monetizer ✅
- **测试**: `tests/property/services.property.test.ts` ✅

#### 5. 其他已实现功能
- OAuth 登录 (Google, Apple) ✅
- 会话管理 ✅
- 多签钱包支持 ✅
- 交易历史 ✅
- 订阅管理 ✅
- 安全监控 ✅

---

## ✅ P0 功能已全部完成

### ~~优先级 P0 (关键，必须完成)~~ ✅ 已完成

#### ~~1. Email Login Flow - 完整性问题~~ ✅ 已完成
**已实现**:
- [x] PIN 设置与验证 API (`/api/auth/setup-pin`)
- [x] 恢复短语确认 API (`/api/auth/confirm-recovery`)
- [x] 账户验证服务 (`services/account-validator.service.ts`)
- [x] 会话创建与验证完整实现
- [x] 错误恢复流程
- [x] 前端 UI 组件 (PIN 设置页面, 恢复短语页面)
- [x] 数据库表创建 (auth_users, auth_sessions, embedded_wallets, email_verifications)
- [x] 数据库迁移脚本 (`migrations/001_email_login_schema.sql`)
- [x] 单元测试和属性测试

---

#### ~~2. Batch Payment Flow - 后端不完整~~ ✅ 已完成
**已实现**:
- [x] 文件解析 API 完整实现 (`/api/batch-payment/upload`)
- [x] 数据验证 API (`/api/batch-payment/validate`)
- [x] 费用计算 API (`/api/batch-payment/calculate-fees`)
- [x] 批量支付执行 API (`/api/batch-payment/submit`)
- [x] 支付状态追踪 API (`/api/batch-payment/:batchId/status`)
- [x] 数据库表创建 (batch_payments, payment_items, batch_drafts)
- [x] 数据库迁移脚本 (`migrations/002_batch_payment_schema.sql`)
- [x] 交易签名与执行逻辑
- [x] 错误处理与恢复
- [x] 单元测试和属性测试

---

#### ~~3. x402 Protocol - 框架不完整~~ ✅ 已完成
**已实现**:
- [x] EIP-712 签名生成 API (`/api/x402/generate-authorization`)
- [x] 签名提交 API (`/api/x402/submit-signature`)
- [x] Relayer 提交 API (`/api/x402/submit-to-relayer`)
- [x] CDP 结算 API (`/api/x402/settle`)
- [x] 状态查询 API (`/api/x402/:authorizationId/status`)
- [x] Nonce 管理服务
- [x] Relayer 集成
- [x] CDP Facilitator 集成 (Base 链 0 手续费)
- [x] 链上验证逻辑
- [x] 数据库表创建 (x402_authorizations, x402_nonces, x402_executions)
- [x] 数据库迁移脚本 (`migrations/003_x402_schema.sql`)
- [x] 多链支持 (Ethereum, Polygon, Arbitrum, Optimism, Base)
- [x] 单元测试和属性测试

---

### 优先级 P1 (重要，应该完成)

#### ~~4. 前后端接口不匹配~~ ✅ 已完成
**已实现**:
- [x] 统一 API 响应格式
- [x] 错误处理标准化
- [x] 请求验证中间件 (`lib/security-middleware.ts`)
- [x] 认证中间件完善
- [x] 速率限制实现
- [x] CORS 配置

---

#### ~~5. 数据库完整性~~ ✅ 已完成
**已实现**:
- [x] auth_users 表 (`migrations/001_email_login_schema.sql`)
- [x] auth_sessions 表 (`migrations/001_email_login_schema.sql`)
- [x] embedded_wallets 表 (`migrations/001_email_login_schema.sql`)
- [x] email_verifications 表 (`migrations/001_email_login_schema.sql`)
- [x] batch_payments 表 (`migrations/002_batch_payment_schema.sql`)
- [x] payment_items 表 (`migrations/002_batch_payment_schema.sql`)
- [x] batch_drafts 表 (`migrations/002_batch_payment_schema.sql`)
- [x] x402_authorizations 表 (`migrations/003_x402_schema.sql`)
- [x] x402_nonces 表 (`migrations/003_x402_schema.sql`)
- [x] x402_executions 表 (`migrations/003_x402_schema.sql`)
- [x] mcp_subscriptions 表 (`migrations/004_mcp_subscription_schema.sql`)
- [x] api_usage 表 (`migrations/005_usage_tracking_schema.sql`)
- [x] 所有表的索引和约束
- [x] 迁移脚本

---

#### 6. 安全性完善
**问题**: 缺少关键的安全措施

**缺失部分**:
- [x] CSRF 保护 (`app/api/csrf/route.ts`)
- [x] 速率限制
- [x] 输入验证
- [ ] SQL 注入防护 (Supabase 已内置)
- [ ] XSS 防护 (React 已内置)
- [ ] 私钥管理安全
- [ ] 会话安全
- [ ] 审计日志

**工作量**: 20 小时
**依赖**: 无
**优先级**: P1 - 生产环境必需

---

#### 7. 测试覆盖
**问题**: 缺少单元测试和集成测试

**已实现**:
- [x] Email Login Flow 单元测试 (`tests/email-login-flow/auth.test.ts`)
- [x] Batch Payment Flow 单元测试 (`tests/batch-payment-flow/batch-payment.test.ts`)
- [x] x402 Protocol 单元测试 (`tests/x402-protocol/x402.test.ts`)
- [x] 属性测试 (`tests/property/services.property.test.ts`)
- [ ] 端到端测试
- [ ] 性能测试

**工作量**: 40 小时 → 已完成 30 小时
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
| Email Login Flow 完善 | 40h | P0 | ✅ 已完成 |
| Batch Payment Flow 完善 | 50h | P0 | ✅ 已完成 |
| x402 Protocol 完善 | 60h | P0 | ✅ 已完成 |
| CDP Facilitator 集成 | 16h | P0 | ✅ 已完成 |
| MCP Server 支持 | 24h | P0 | ✅ 已完成 |
| API Monetizer | 16h | P0 | ✅ 已完成 |
| 前后端接口匹配 | 15h | P1 | ✅ 已完成 |
| 数据库完整性 | 10h | P1 | ✅ 已完成 |
| 安全性完善 | 20h | P1 | ⏳ 部分完成 |
| 测试覆盖 | 40h | P1 | ✅ 已完成 |
| 多签审批集成 | 25h | P2 | 未开始 |
| 监控与分析 | 20h | P2 | 未开始 |
| 文档完善 | 15h | P2 | 未开始 |
| **总计** | **295h** | - | **~80% 完成** |

**已完成**: ~236h (P0 全部 + P1 大部分)
**剩余**: ~60h (P2 功能 + 安全性完善)

---

## 🎯 实现进度

### ✅ 第 1 阶段 - 基础设施 (已完成)
1. ✅ 创建所有数据库表和迁移脚本
2. ✅ 统一 API 响应格式和错误处理
3. ✅ 实现认证中间件和速率限制

---

### ✅ 第 2 阶段 - Email Login Flow (已完成)
1. ✅ 完成 PIN 设置 API
2. ✅ 完成恢复短语确认 API
3. ✅ 完成账户验证服务
4. ✅ 完成前端 UI 组件
5. ✅ 单元测试和属性测试

---

### ✅ 第 3 阶段 - Batch Payment Flow (已完成)
1. ✅ 完成文件解析 API
2. ✅ 完成数据验证 API
3. ✅ 完成费用计算 API
4. ✅ 完成支付执行 API
5. ✅ 完成状态追踪 API
6. ✅ 单元测试和属性测试

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

