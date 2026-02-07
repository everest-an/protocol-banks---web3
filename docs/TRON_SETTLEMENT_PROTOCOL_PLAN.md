# TRON 商户结算协议完善计划

## 一、当前状态分析

### ✅ 已实现功能
1. **基础 TRON 集成**
   - TronLink 钱包连接 (`lib/web3.ts:532-553`)
   - TRON 钱包状态管理 (`contexts/web3-context.tsx`)
   - USDT (TRC20) 余额查询和转账
   - TRON 与 EVM 的多链切换

2. **非托管认证系统**
   - Shamir Secret Sharing (2-of-3 threshold)
   - PIN 加密 (PBKDF2 + AES-256-GCM)
   - Magic link / OAuth 登录

3. **核心基础设施**
   - Batch Payment 功能
   - Vendor 管理系统
   - Audit Log 系统
   - Event Indexer (Go 服务，仅支持 EVM)
   - Payout Engine (Go 服务，仅支持 EVM)

### ❌ 缺失功能（需要开发）

#### 1. TRON 智能合约层
- ❌ 多签分账智能合约（类似 Gnosis Safe 的 TRON 版本）
- ❌ 批量支付合约优化（降低 Gas 费用）
- ❌ 分账规则引擎（按比例、固定金额、阶梯式分账）

#### 2. 链上索引引擎
- ❌ TRON 事件监听（TRC20 Transfer、多签交易）
- ❌ TRON 区块确认监控
- ❌ TRON 与 EVM 的统一索引 API

#### 3. 自动化对账系统
- ❌ 链上数据与财务系统的自动对账
- ❌ 差异检测和报警
- ❌ 对账报告生成

#### 4. 商户控制台增强
- ❌ TRON 专属的结算规则配置
- ❌ TRON 交易详情展示
- ❌ TRON 多签审批流程

---

## 二、TRON 登录问题诊断

### 问题原因
1. **TronLink 检测延迟**：`window.tronWeb` 注入需要时间（已在代码中添加重试逻辑）
2. **权限请求**：TronLink 新版本需要显式请求账户权限
3. **网络配置**：未在 Reown AppKit 中配置 TRON（Reown 主要支持 EVM）

### 解决方案
```typescript
// 优化 connectTron 函数 (lib/web3.ts:532-553)
export async function connectTron(): Promise<string> {
    if (typeof window === "undefined") return ""

    // 1. 等待 TronLink 注入（最多 10 次，每次 200ms）
    let tries = 0;
    while (!window.tronWeb && tries < 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        tries++;
    }

    // 2. 检查 TronLink 是否安装
    if (!window.tronWeb) {
         window.open("https://www.tronlink.org/", "_blank")
         throw new Error("请安装 TronLink 钱包")
    }

    // 3. 请求账户权限（新版 TronLink）
    if (window.tronWeb.request) {
        try {
            await window.tronWeb.request({ method: 'tron_requestAccounts' });
        } catch (error) {
            throw new Error("用户拒绝授权")
        }
    }

    // 4. 验证连接状态
    if (!window.tronWeb.defaultAddress.base58) {
        throw new Error("TronLink 未登录，请在钱包中解锁账户")
    }

    return window.tronWeb.defaultAddress.base58;
}
```

---

## 三、完善路线图

### Phase 1: TRON 多签分账智能合约（2-3 周）

#### 1.1 智能合约开发
```solidity
// contracts/tron/MultiSigSplitter.sol
// 功能：
// - 多签门槛配置（2-of-3, 3-of-5 等）
// - 自动分账逻辑（按比例分配）
// - 交易提案和投票机制
// - 紧急暂停功能
```

**技术选型**：
- 开发工具：TronBox / TronIDE
- 测试网：Nile Testnet
- 审计：需要第三方安全审计

**开发任务**：
1. ✅ 设计合约架构（1天）
2. ✅ 实现多签逻辑（3天）
3. ✅ 实现分账规则引擎（3天）
4. ✅ 单元测试（2天）
5. ✅ 集成测试（2天）
6. ✅ 安全审计（5天）

#### 1.2 前端集成
- 多签钱包创建 UI
- 分账规则配置界面
- 交易提案和审批流程

---

### Phase 2: TRON 链上索引引擎（2 周）

#### 2.1 扩展 Event Indexer（Go 服务）
```go
// services/event-indexer/internal/indexer/tron.go
// 功能：
// - 监听 TRON 区块（TronGrid API / Full Node）
// - 解析 TRC20 Transfer 事件
// - 解析多签合约事件
// - 存储到 PostgreSQL
```

**技术栈**：
- TRON API：TronGrid / Full Node RPC
- Go 库：`github.com/fbsobreira/gotron-sdk`
- 数据库：PostgreSQL (Prisma)

**开发任务**：
1. ✅ TRON 区块监听服务（3天）
2. ✅ 事件解析和存储（2天）
3. ✅ 多签交易状态追踪（2天）
4. ✅ 统一 EVM + TRON 的 API（2天）
5. ✅ 性能优化（批量处理、缓存）（2天）

#### 2.2 数据库扩展
```prisma
// prisma/schema.prisma
model Transaction {
  id            String   @id @default(cuid())
  network       String   // "EVM" | "TRON"
  chainId       Int?     // TRON 使用特殊 ID
  txHash        String
  from          String
  to            String
  amount        Decimal
  token         String
  status        String   // "pending" | "confirmed" | "failed"
  confirmations Int      @default(0)
  blockNumber   BigInt?
  timestamp     DateTime

  // TRON 特有字段
  energyUsed    BigInt?
  bandwidthUsed BigInt?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

---

### Phase 3: 自动化对账系统（2 周）

#### 3.1 对账引擎
```typescript
// lib/services/reconciliation.service.ts
// 功能：
// - 定时拉取链上交易（每小时）
// - 与财务系统记录比对
// - 检测差异（金额、时间戳、状态）
// - 生成对账报告
```

**核心逻辑**：
1. **数据源对比**：
   - 链上数据（Event Indexer）
   - 财务系统数据（Transaction 表）
   - Vendor 支付记录

2. **差异检测规则**：
   - 金额不匹配（容差 ±0.01 USDT）
   - 状态不一致（链上已确认但系统显示 pending）
   - 遗漏交易（链上有但系统没有）
   - 重复交易（同一笔交易多次记录）

3. **自动修复**：
   - 状态同步（自动更新 pending → confirmed）
   - 差额调整（记录到 AuditLog）
   - 人工审核流程（超过阈值时）

#### 3.2 对账报告
- **日报**：每日交易总额、笔数、手续费
- **周报**：趋势分析、异常交易统计
- **月报**：财务对账表（符合会计准则）

**导出格式**：
- Excel（财务人员）
- PDF（审计报告）
- API（企业 ERP 集成）

---

### Phase 4: 商户控制台增强（1 周）

#### 4.1 TRON 专属功能
1. **结算规则配置**
   ```typescript
   interface SettlementRule {
     id: string
     name: string
     network: "TRON" | "EVM"
     type: "percentage" | "fixed" | "tiered"
     recipients: {
       address: string
       percentage?: number  // 0-100
       fixedAmount?: string // 固定金额
     }[]
     conditions: {
       minAmount?: string
       maxAmount?: string
       tokenWhitelist?: string[]
     }
   }
   ```

2. **TRON 交易详情页**
   - TronScan 链接
   - Energy / Bandwidth 消耗
   - 多签审批状态
   - 分账明细

3. **多签审批流程**
   - 提案列表（待审批、已通过、已拒绝）
   - 一键审批（移动端推送）
   - 历史记录（审计追溯）

#### 4.2 UI 组件开发
```tsx
// components/tron/settlement-rule-editor.tsx
// components/tron/transaction-detail-card.tsx
// components/tron/multisig-approval-panel.tsx
```

---

## 四、技术架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    商户控制台（Next.js）                     │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ 结算规则配置 │  │ 对账报告     │  │ 多签审批     │       │
│  └─────────────┘  └──────────────┘  └──────────────┘       │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  Prisma API      │    │  gRPC Service    │
│  (TypeScript)    │    │  (Go)            │
└────────┬─────────┘    └─────────┬────────┘
         │                        │
         ▼                        ▼
┌────────────────────────────────────────────┐
│            PostgreSQL (Supabase)           │
│  - Transaction (EVM + TRON)                │
│  - Vendor (Merchant Info)                  │
│  - SettlementRule                          │
│  - ReconciliationReport                    │
└────────────────────────────────────────────┘
         ▲
         │
         ├────────────┬─────────────┐
         │            │             │
┌────────┴──────┐ ┌──┴────────┐ ┌──┴──────────┐
│ Event Indexer │ │ Payout    │ │ Webhook     │
│ (Go Service)  │ │ Engine    │ │ Handler     │
│               │ │ (Go)      │ │ (Go)        │
│ - EVM Events  │ │           │ │             │
│ - TRON Events │ │           │ │             │
└───────┬───────┘ └───────────┘ └─────────────┘
        │
        ▼
┌──────────────────────────────────┐
│      Blockchain Networks         │
│  ┌──────────┐    ┌───────────┐  │
│  │   EVM    │    │   TRON    │  │
│  │ Ethereum │    │  Mainnet  │  │
│  │ Arbitrum │    │  Nile     │  │
│  │ Base     │    │           │  │
│  └──────────┘    └───────────┘  │
└──────────────────────────────────┘
```

---

## 五、关键指标（KPI）

### 性能指标
- **吞吐量**：500+ TPS（TRON 优于 EVM）
- **确认时间**：3 秒（TRON）vs 12-60 秒（EVM）
- **索引延迟**：< 10 秒

### 对账准确性
- **自动对账率**：> 99%
- **差异检测时间**：< 1 小时
- **人工干预率**：< 1%

### 用户体验
- **交易成功率**：> 99.5%
- **审批响应时间**：< 5 分钟（移动端推送）
- **报告生成时间**：< 30 秒

---

## 六、开发优先级

### P0（必须完成）
1. ✅ 修复 TRON 登录问题
2. ✅ TRON 事件索引引擎
3. ✅ 自动化对账系统（基础版）

### P1（高优先级）
4. ✅ TRON 多签分账合约
5. ✅ 商户控制台 TRON 功能
6. ✅ 对账报告导出

### P2（中优先级）
7. ⏸ 批量支付优化（Gas 优化）
8. ⏸ 移动端审批推送
9. ⏸ ERP 系统集成 API

---

## 七、安全考量

### 智能合约安全
- ✅ 多签门槛不可低于 2-of-3
- ✅ 时间锁（重要操作延迟 24 小时）
- ✅ 紧急暂停开关
- ✅ 第三方安全审计（建议：CertiK、SlowMist）

### 数据安全
- ✅ RLS（Row-Level Security）隔离商户数据
- ✅ API 密钥轮换（每 90 天）
- ✅ 敏感数据加密（AES-256-GCM）

### 对账安全
- ✅ 双因素验证（2FA）
- ✅ 审计日志（所有操作可追溯）
- ✅ 异常交易报警（邮件 + 短信）

---

## 八、成本估算

### 开发成本
- **智能合约**：15 人/天
- **链上索引**：10 人/天
- **对账系统**：10 人/天
- **UI 开发**：5 人/天
- **测试 + 审计**：10 人/天

**总计**：约 50 人/天（7-8 周，单人开发）

### 运营成本
- **TRON 节点**：$200/月（TronGrid 免费额度可能不够）
- **数据库**：$50/月（Supabase Pro）
- **服务器**：$100/月（Vercel Pro + Kubernetes）

---

## 九、交付物

### 代码交付
- ✅ TRON 多签合约（Solidity）
- ✅ Event Indexer TRON 扩展（Go）
- ✅ 对账服务（TypeScript）
- ✅ 商户控制台 UI（React）

### 文档交付
- ✅ 智能合约审计报告
- ✅ API 文档（OpenAPI 3.0）
- ✅ 商户操作手册
- ✅ 开发者集成指南

### 测试交付
- ✅ 单元测试覆盖率 > 80%
- ✅ 集成测试（Nile Testnet）
- ✅ 压力测试报告（500 TPS）

---

## 十、里程碑时间表

```
Week 1-2:  智能合约开发 + 测试
Week 3-4:  Event Indexer 扩展
Week 5-6:  对账系统实现
Week 7:    商户控制台 UI
Week 8:    集成测试 + 安全审计
Week 9:    Nile Testnet 部署
Week 10:   主网部署 + 监控
```

---

## 十一、风险与应对

### 技术风险
- **TRON API 稳定性**：部署自有 Full Node 作为备份
- **智能合约漏洞**：多轮审计 + Bug Bounty
- **数据一致性**：使用分布式锁 + 事务

### 业务风险
- **监管合规**：咨询法律顾问，确保符合当地法规
- **用户迁移**：提供 EVM → TRON 的迁移工具

---

## 附录：参考资源

- TRON 官方文档：https://developers.tron.network/
- TronGrid API：https://www.trongrid.io/
- TronBox：https://developers.tron.network/docs/tronbox
- Gnosis Safe TRON：https://github.com/CryptoKeepto/tron-gnosis-safe
