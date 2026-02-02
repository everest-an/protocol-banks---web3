# Protocol Banks - 下一步行动计划

**更新时间**: 2026-02-03  
**GitHub 提交**: https://github.com/everest-an/protocol-banks---web3/commit/246a1c3

---

## 📋 已完成的工作

✅ 创建了三个完整的 Spec 规范：
1. **生产环境就绪** (`.kiro/specs/production-readiness/`)
2. **AI 计费 MVP** (`.kiro/specs/ai-billing-mvp/`)
3. **AI 计费完整版** (`.kiro/specs/ai-billing-expansion/`)

✅ 所有文档已推送到 GitHub main 分支

---

## 🎯 推荐执行顺序

### 阶段 1: 生产环境就绪（优先级 P0）
**时间**: 8-10 周  
**目标**: 确保现有系统稳定、安全、可维护

### 阶段 2: AI 计费 MVP（优先级 P1）
**时间**: 6 周  
**目标**: 快速验证市场需求，获取早期客户反馈

---

## 🚀 立即可以开始的任务

### 选项 A: 生产环境监控系统（推荐先做）

**为什么优先**：
- 立即提升系统可观测性
- 快速发现和解决问题
- 为后续开发提供保障

**具体任务**：

#### 1. Sentry 错误监控集成（2-3 天）
```bash
# 位置：根目录
# 需要创建的文件：
- sentry.client.config.ts
- sentry.server.config.ts
- sentry.edge.config.ts

# 需要修改的文件：
- next.config.mjs (添加 Sentry 配置)
- package.json (添加 @sentry/nextjs 依赖)
```

**交给 Claude Code 的指令**：
```
请帮我集成 Sentry 错误监控系统：

1. 安装依赖：
   pnpm add @sentry/nextjs

2. 创建配置文件：
   - sentry.client.config.ts (客户端配置)
   - sentry.server.config.ts (服务端配置)
   - sentry.edge.config.ts (Edge 配置)

3. 修改 next.config.mjs，添加 Sentry webpack 插件

4. 添加环境变量到 .env.example：
   NEXT_PUBLIC_SENTRY_DSN=
   SENTRY_ORG=
   SENTRY_PROJECT=

5. 测试错误捕获功能

参考设计文档：.kiro/specs/production-readiness/design.md (第 1.1 节)
```

#### 2. Prometheus 指标收集（2-3 天）
```bash
# 位置：lib/monitoring/
# 需要创建的文件：
- lib/monitoring/metrics.ts
- app/api/metrics/route.ts

# 需要修改的文件：
- package.json (添加 prom-client 依赖)
```

**交给 Claude Code 的指令**：
```
请帮我实现 Prometheus 指标收集系统：

1. 安装依赖：
   pnpm add prom-client

2. 创建指标定义文件：
   lib/monitoring/metrics.ts
   - HTTP 请求计数器
   - HTTP 请求延迟直方图
   - 支付成功率计数器
   - 批量支付吞吐量直方图

3. 创建指标导出端点：
   app/api/metrics/route.ts

4. 在关键位置添加指标记录（可选，后续优化）

参考设计文档：.kiro/specs/production-readiness/design.md (第 1.2 节)
```

#### 3. 健康检查端点增强（1 天）
```bash
# 位置：app/api/health/
# 需要修改的文件：
- app/api/health/route.ts (如果存在)
# 或创建：
- app/api/health/route.ts
```

**交给 Claude Code 的指令**：
```
请帮我创建/增强健康检查端点：

1. 创建 app/api/health/route.ts

2. 检查项目：
   - 数据库连接（Supabase）
   - Redis 连接（如果使用）
   - 外部服务状态

3. 返回格式：
   {
     "status": "healthy" | "degraded" | "unhealthy",
     "timestamp": "2026-02-03T12:00:00Z",
     "checks": {
       "database": { "status": "up", "latency": 10 },
       "redis": { "status": "up", "latency": 5 }
     }
   }

参考设计文档：.kiro/specs/production-readiness/design.md
```

---

### 选项 B: 测试覆盖率提升（如果想先提升代码质量）

#### 1. Jest 测试框架配置（1 天）
```bash
# 位置：根目录
# 需要创建/修改的文件：
- jest.config.js (已存在，需要优化)
- jest.setup.ts (已存在，需要增强)
- lib/test-utils/test-helpers.ts (新建)
```

**交给 Claude Code 的指令**：
```
请帮我优化 Jest 测试框架配置：

1. 检查并优化 jest.config.js：
   - 确保覆盖率阈值设置为 80%
   - 配置正确的测试路径
   - 排除不需要测试的文件

2. 增强 jest.setup.ts：
   - 添加全局测试工具
   - 配置测试环境变量

3. 创建测试工具函数库：
   lib/test-utils/test-helpers.ts
   - createMockRequest
   - mockSupabaseClient
   - mockEthersProvider

参考设计文档：.kiro/specs/production-readiness/design.md (第 2.1 节)
```

#### 2. 核心服务单元测试（3-4 天）
```bash
# 位置：lib/services/__tests__/
# 需要创建的文件：
- lib/services/__tests__/agent-service.test.ts
- lib/services/__tests__/payment-service.test.ts
- lib/services/__tests__/budget-service.test.ts
```

**交给 Claude Code 的指令**：
```
请帮我为核心服务编写单元测试：

1. 为 agent-service.ts 编写测试：
   - 测试创建 Agent
   - 测试更新 Agent
   - 测试删除 Agent
   - 测试错误处理

2. 为 payment-service.ts 编写测试：
   - 测试支付逻辑
   - 测试余额检查
   - 测试交易验证

3. 为 budget-service.ts 编写测试：
   - 测试预算管理
   - 测试使用量追踪
   - 测试预算告警

目标：每个服务测试覆盖率 > 80%

参考任务列表：.kiro/specs/production-readiness/tasks.md (任务 6)
```

---

### 选项 C: AI 计费 MVP - Session Key 智能合约（如果想直接开始新功能）

#### 1. 智能合约开发（2 天）
```bash
# 位置：contracts/
# 需要创建的文件：
- contracts/SessionKeyValidator.sol
- contracts/test/SessionKeyValidator.test.ts
```

**交给 Claude Code 的指令**：
```
请帮我开发 Session Key 智能合约：

1. 创建 contracts/SessionKeyValidator.sol：
   - 实现 createSessionKey 函数
   - 实现 validateAndRecord 函数
   - 实现 freezeSessionKey 函数
   - 实现 unfreezeSessionKey 函数
   - 实现 getSessionKey 查询函数

2. 创建测试文件：
   contracts/test/SessionKeyValidator.test.ts
   - 测试所有函数
   - 测试边界情况
   - 测试 Gas 消耗

3. 使用 Hardhat 框架

参考设计文档：.kiro/specs/ai-billing-mvp/design.md (第 2.1 节)
完整合约代码已在设计文档中提供
```

---

## 📁 关键文件位置

### 规范文档
```
.kiro/specs/
├── production-readiness/
│   ├── requirements.md    # 生产环境需求
│   ├── design.md          # 技术设计
│   └── tasks.md           # 任务列表
├── ai-billing-mvp/
│   ├── requirements.md    # MVP 需求
│   ├── design.md          # MVP 设计
│   └── tasks.md           # MVP 任务
└── ai-billing-expansion/
    ├── requirements.md    # 完整版需求
    ├── design.md          # 完整版设计
    └── tasks.md           # 完整版任务
```

### 需要创建的目录结构
```
lib/
├── monitoring/           # 监控系统（新建）
│   └── metrics.ts
├── test-utils/          # 测试工具（新建）
│   └── test-helpers.ts
└── services/
    └── __tests__/       # 服务测试（新建）

contracts/               # 智能合约（已存在）
├── SessionKeyValidator.sol  # 新建
└── test/
    └── SessionKeyValidator.test.ts  # 新建

app/api/
├── metrics/            # 指标端点（新建）
│   └── route.ts
├── health/             # 健康检查（可能需要新建）
│   └── route.ts
└── session-keys/       # Session Key API（新建）
    └── route.ts
```

---

## 💡 给 Claude Code 的通用指令模板

### 开始新任务时
```
我正在执行 Protocol Banks 的 [任务名称]。

任务详情：
- 规范文档：.kiro/specs/[spec-name]/[file].md
- 任务编号：[任务编号]
- 预计时间：[X] 天

请帮我：
1. [具体步骤 1]
2. [具体步骤 2]
3. [具体步骤 3]

参考设计文档中的代码示例和技术要求。
```

### 遇到问题时
```
我在执行 [任务名称] 时遇到问题：
[描述问题]

相关文件：
- [文件路径 1]
- [文件路径 2]

请帮我分析问题并提供解决方案。
```

---

## 🎯 推荐的第一周计划

### Day 1-2: Sentry 集成
- 安装和配置 Sentry
- 测试错误捕获
- 验证错误上报

### Day 3-4: Prometheus 指标
- 实现指标收集
- 创建指标端点
- 测试指标导出

### Day 5: 健康检查
- 增强健康检查端点
- 测试各项检查
- 文档化 API

---

## 📞 需要帮助时

如果 Claude Code 在执行过程中遇到问题，可以：

1. **查看设计文档**：所有技术细节和代码示例都在 `.kiro/specs/*/design.md`
2. **查看任务列表**：详细的任务分解在 `.kiro/specs/*/tasks.md`
3. **查看需求文档**：验收标准在 `.kiro/specs/*/requirements.md`

---

## 🔗 GitHub 链接

- **仓库**: https://github.com/everest-an/protocol-banks---web3
- **最新提交**: https://github.com/everest-an/protocol-banks---web3/commit/246a1c3
- **规范文档**: https://github.com/everest-an/protocol-banks---web3/tree/main/.kiro/specs

---

## ✅ 验收标准

每个任务完成后，确保：
- [ ] 代码符合设计文档要求
- [ ] 测试覆盖率达标
- [ ] 文档已更新
- [ ] 通过 CI/CD 检查
- [ ] 代码已提交到 Git

---

**祝开发顺利！有任何问题随时回来找我。** 🚀
