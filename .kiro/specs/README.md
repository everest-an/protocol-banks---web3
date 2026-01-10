# ProtocolBanks 产品开发规范总览

## 项目概述

ProtocolBanks 是企业级全链银行基础设施，本目录包含所有功能的开发规范文档。

## 已创建规范

### 1. 法币出入金 (fiat-onramp)
- **状态**: 📋 规范完成，待开发
- **优先级**: P0 (Q1 2026 路线图)
- **文档**:
  - [requirements.md](./fiat-onramp/requirements.md) - 8 个需求，35+ 验收标准
  - [design.md](./fiat-onramp/design.md) - 系统架构，24 个正确性属性
  - [tasks.md](./fiat-onramp/tasks.md) - 14 个主任务，50+ 子任务

### 2. WebAuthn/Passkey 支持 (webauthn-passkey)
- **状态**: 📋 规范完成，待开发
- **优先级**: P1 (认证系统增强)
- **文档**:
  - [requirements.md](./webauthn-passkey/requirements.md) - 7 个需求，40+ 验收标准
  - [design.md](./webauthn-passkey/design.md) - 系统架构，24 个正确性属性
  - [tasks.md](./webauthn-passkey/tasks.md) - 14 个主任务，45+ 子任务

## 待创建规范

### P0 - 必须完成

| 功能 | 描述 | 状态 |
|------|------|------|
| HSM 集成 | 硬件安全模块保护密钥 | ⏳ 待规划 |
| Go 微服务完善 | 完成 Payout Engine 等服务 | ⏳ 待规划 |
| 集成测试框架 | testcontainers 集成测试 | ⏳ 待规划 |

### P1 - 建议完成

| 功能 | 描述 | 状态 |
|------|------|------|
| Agent Link API | AI Agent 预算请求 API | ⏳ 待规划 |
| 社交恢复 | 可信联系人恢复钱包 | ⏳ 待规划 |
| 多设备同步 | 跨设备钱包同步 | ⏳ 待规划 |
| API 文档生成 | OpenAPI/Swagger 文档 | ⏳ 待规划 |

### P2 - 未来规划

| 功能 | 描述 | 状态 |
|------|------|------|
| 虚拟卡发行 | 加密货币虚拟卡 | ⏳ 待规划 |
| AI 风控模型 | 机器学习欺诈检测 | ⏳ 待规划 |
| 跨境汇款优化 | 国际转账路由优化 | ⏳ 待规划 |

## 现有功能文档

以下功能已实现，文档位于 `/docs` 目录：

| 功能 | 文档 | 完成度 |
|------|------|--------|
| 认证系统 | [AUTH_SYSTEM.md](/docs/AUTH_SYSTEM.md) | 90% |
| 批量支付 | [BATCH_PAYMENT.md](/docs/BATCH_PAYMENT.md) | 80% |
| Go 服务架构 | [GO_SERVICES_ARCHITECTURE.md](/docs/GO_SERVICES_ARCHITECTURE.md) | 60% |
| 安全架构 | [SECURITY.md](/docs/SECURITY.md) | 85% |

## 开发流程

1. **查看规范**: 阅读 requirements.md 了解需求
2. **理解设计**: 阅读 design.md 了解技术方案
3. **执行任务**: 打开 tasks.md，点击 "Start task" 开始开发
4. **测试验证**: 完成属性测试，确保正确性

## 路线图

```
2025 Q3: x402 Relayer 网络主网上线
2025 Q4: Agent Link API 发布
2026 Q1: 法币出入金集成 ← 当前规划
```

## 联系方式

- Email: everest9812@gmail.com
- Twitter: [@0xPrococolBank](https://x.com/0xPrococolBank)
