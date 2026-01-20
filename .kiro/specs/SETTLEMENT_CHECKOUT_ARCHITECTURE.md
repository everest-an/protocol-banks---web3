# Settlement Checkout (Self-Hosted) - 完整技术架构解读

## 📋 概述

基于最新代码更新分析，ProtocolBanks 的 Settlement Checkout 功能是一个**自托管的加密支付收单系统**，允许商户接收加密货币支付并自动转换为法币。这是一个完整的支付收单解决方案，包括：

1. **支付接收** - 接收加密货币支付
2. **批量处理** - 批量支付给多个收款人
3. **链上执行** - 通过 Go 微服务高效执行
4. **法币转换** - 通过 Off-Ramp 转换为法币
5. **多签审批** - 企业级审批流程

---

## 🏗️ 完整技术架构

### 1. 系统分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                    前端层 (Next.js)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 支付接收页面  │  │ 批量支付页面  │  │ 法币转换页面  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  API 层 (Next.js Routes)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ /batch-pay   │  │ /x402        │  │ /offramp     │      │
│  │ /auth        │  │ /verify      │  │ /quote       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              业务逻辑层 (Services)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 支付处理      │  │ 签名验证      │  │ 费用计算      │      │
│  │ 批量验证      │  │ Nonce 管理    │  │ 法币转换      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Go 微服务层 (高性能处理)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Payout Engine│  │ Event Index  │  │ Webhook      │      │
│  │ 500+ TPS     │  │ 多链监控      │  │ Handler      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              数据层 (Supabase PostgreSQL)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 支付记录      │  │ 用户数据      │  │ 审计日志      │      │
│  │ 交易状态      │  │ 多签钱包      │  │ 事件日志      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              区块链层 (多链支持)                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Ethereum     │  │ Polygon      │  │ Arbitrum     │      │
│  │ Base         │  │ Optimism     │  │ BSC          │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 支付收单完整流程

### 流程 1: 批量支付收单

```
用户上传 CSV/Excel 文件
    ↓
文件解析 (File Parser Service)
    ├─ 自动检测列名
    ├─ 验证地址格式
    ├─ 检查重复收款人
    └─ 返回解析结果
    ↓
数据验证 (Batch Validator Service)
    ├─ 地址校验和验证
    ├─ ENS 名称解析
    ├─ 金额范围检查
    └─ 余额检查
    ↓
费用计算 (Fee Calculator Service)
    ├─ 估算 Gas 费用
    ├─ 计算服务费 (0.5%)
    ├─ 显示费用明细
    └─ 用户确认
    ↓
多签审批 (可选)
    ├─ 创建多签提案
    ├─ 发送通知给签署者
    ├─ 收集签名
    └─ 达到阈值后执行
    ↓
交易签名 (Signature Verifier Service)
    ├─ 重建私钥 (Shamir 分片)
    ├─ 使用 PIN 解密
    ├─ 签署所有交易
    └─ 销毁私钥
    ↓
批量执行 (Go Payout Engine)
    ├─ 按代币分组
    ├─ 并发处理 (500+ TPS)
    ├─ Nonce 管理
    ├─ 自动重试
    └─ 实时进度追踪
    ↓
状态追踪 (Event Indexer)
    ├─ 监听链上事件
    ├─ 更新交易状态
    ├─ 生成报告
    └─ 发送 Webhook
    ↓
法币转换 (Off-Ramp Service)
    ├─ 获取汇率报价
    ├─ 用户确认
    ├─ 提交转换请求
    └─ 资金到账银行账户
```

### 流程 2: x402 Gasless 支付

```
用户发起支付
    ↓
生成 EIP-712 授权 (Authorization Generator Service)
    ├─ 创建域分隔符
    ├─ 构建消息结构
    ├─ 设置有效期 (1 小时)
    └─ 分配 Nonce
    ↓
用户签署 (Signature Verifier Service)
    ├─ 验证签名格式
    ├─ 恢复签署者地址
    ├─ 检查 Nonce 未使用
    └─ 存储授权
    ↓
提交到 Relayer (Relayer Client Service)
    ├─ 验证签名有效性
    ├─ 估算 Gas 成本
    ├─ 检查盈利性
    └─ 提交到区块链
    ↓
链上执行 (Smart Contract)
    ├─ 验证签名
    ├─ 检查 Nonce
    ├─ 验证有效期
    ├─ 检查余额
    ├─ 执行转账
    └─ 标记 Nonce 已使用
    ↓
费用分配 (Fee Distributor Service)
    ├─ 计算 Relayer 费用
    ├─ 转账费用给 Relayer
    ├─ 记录分配日志
    └─ 通知用户实际收到金额
```

---

## 📊 核心服务详解

### 1. 文件解析服务 (File Parser Service)

**位置**: `services/file-parser.service.ts`

**功能**:
```typescript
// 支持的文件格式
- CSV (.csv)
- Excel (.xlsx, .xls)

// 自动列名检测
address: ["address", "wallet", "wallet_address", "recipient", "to", "destination"]
amount: ["amount", "value", "sum", "total", "payment"]
token: ["token", "currency", "coin", "asset", "symbol"]
vendorName: ["vendor_name", "vendor", "name", "payee", "company"]
vendorId: ["vendor_id", "id", "reference", "invoice"]
memo: ["memo", "note", "notes", "description"]
chainId: ["chain_id", "chain", "network"]

// 返回结果
{
  success: boolean
  recipients: ParsedRecipient[]
  errors: string[]
  warnings: string[]
}
```

**API 端点**: `POST /api/batch-payment/upload`

---

### 2. 批量验证服务 (Batch Validator Service)

**位置**: `services/batch-validator.service.ts`

**验证项**:
```typescript
✓ 地址校验和验证 (EIP-55)
✓ ENS 名称解析
✓ 重复收款人检测
✓ 金额范围检查
✓ 代币支持检查
✓ 余额充足检查
✓ 部分批处理支持 (跳过无效行)

// 返回结果
{
  validItems: number
  invalidItems: number
  summary: {
    totalAmount: string
    tokenBreakdown: Record<string, string>
  }
}
```

**API 端点**: `POST /api/batch-payment/validate`

---

### 3. 费用计算服务 (Fee Calculator Service)

**位置**: `services/fee-calculator.service.ts`

**计算逻辑**:
```typescript
// Gas 估算
gasPerToken = 65,000 gas
totalGas = gasPerToken * tokenCount
gasPrice = 当前网络 gas 价格
gasMultiplier = 1.2 (安全边际)
totalGasCost = totalGas * gasPrice * gasMultiplier

// 服务费
serviceFee = max(1, min(500, totalAmount * 0.005))

// 总费用
totalFee = gasEstimate + serviceFee

// 费用明细
{
  gasEstimate: string
  serviceFee: string
  totalFee: string
  breakdown: {
    [token]: {
      gasEstimate: string
      serviceFee: string
    }
  }
}
```

**API 端点**: `POST /api/batch-payment/calculate-fees`

---

### 4. EIP-712 签名服务 (EIP712 Service)

**位置**: `services/eip712.service.ts`

**功能**:
```typescript
// 域分隔符
domain = {
  name: "ProtocolBanks",
  version: "1",
  chainId: number,
  verifyingContract: tokenAddress
}

// 消息结构
TransferWithAuthorization {
  from: address
  to: address
  value: uint256
  validAfter: uint256
  validBefore: uint256
  nonce: bytes32
  data: bytes
}

// 签名验证
recoverAddress(signature) === authorizer
```

**API 端点**: `POST /api/x402/generate-authorization`

---

### 5. Nonce 管理服务 (Nonce Manager Service)

**位置**: `services/nonce-manager.service.ts`

**功能**:
```typescript
// 维护每个用户+代币+链的 Nonce 计数器
nonce_key = `${userId}:${tokenAddress}:${chainId}`

// 获取当前 Nonce
currentNonce = await getNonce(userId, tokenAddress, chainId)

// 分配新 Nonce
nextNonce = currentNonce + 1

// 标记已使用
await markNonceAsUsed(userId, tokenAddress, chainId, nonce)

// 防重放检查
if (nonce in usedNonces) {
  throw new Error("Nonce already used")
}
```

**数据库表**: `x402_nonces`, `x402_used_nonces`

---

### 6. Relayer 客户端服务 (Relayer Client Service)

**位置**: `services/relayer-client.service.ts`

**功能**:
```typescript
// 提交授权到 Relayer
await relayer.submitAuthorization({
  domain,
  types,
  message,
  signature
})

// 获取 Relayer 状态
status = await relayer.getStatus(txHash)

// 重试逻辑
if (failed) {
  retry(gasPrice * 1.2) // 提高 20% gas 价格
}
```

**Relayer 职责**:
- 验证签名
- 估算 Gas 成本
- 检查盈利性
- 提交到区块链
- 监控交易状态
- 失败重试 (最多 3 次)

---

### 7. Go Payout Engine (高性能支付引擎)

**位置**: `services/payout-engine/`

**性能指标**:
```
吞吐量: 500+ TPS (每秒交易数)
延迟: <3 秒平均
并发: 支持 1000+ 并发交易
```

**功能**:
```go
// 并发处理
for each payment {
  go executePayment(payment)
}

// Nonce 管理
distributedNonceLock(address, token)

// 自动重试
if failed {
  retry(exponentialBackoff)
}

// 事件发送
emit("payment.completed", {
  txHash,
  amount,
  recipient,
  status
})
```

**通信**: gRPC + Redis 队列

---

### 8. Off-Ramp 服务 (法币转换)

**位置**: `lib/offramp.ts`, `app/api/offramp/`

**支持的提供商**:
```typescript
- Coinbase
- Bridge.xyz
- Transak
- MoonPay
```

**流程**:
```typescript
// 1. 获取报价
quote = await getOffRampQuote({
  amount: "1000",
  token: "USDC",
  targetCurrency: "USD",
  provider: "coinbase"
})

// 2. 用户确认
// 3. 发起转换
transaction = await initiateOffRamp({
  walletAddress,
  amount,
  token,
  chainId,
  targetCurrency,
  bankAccount: {
    type: "ach",
    accountNumber: "...",
    routingNumber: "..."
  },
  provider
})

// 4. 重定向到提供商
window.location.href = transaction.redirectUrl

// 5. 监听完成
status = await getOffRampStatus(transactionId)
```

**API 端点**:
- `POST /api/offramp/quote` - 获取报价
- `POST /api/offramp/initiate` - 发起转换

---

## 🗄️ 数据库架构

### 表结构

```sql
-- 批量支付
batch_payments {
  id: UUID
  user_id: UUID
  batch_name: VARCHAR
  status: VARCHAR (draft, pending, processing, completed, failed)
  total_amount: DECIMAL
  total_fee: DECIMAL
  payment_method: VARCHAR (standard, x402)
  item_count: INT
  successful_count: INT
  failed_count: INT
  created_at: TIMESTAMP
  submitted_at: TIMESTAMP
  completed_at: TIMESTAMP
}

payment_items {
  id: UUID
  batch_id: UUID
  recipient_address: VARCHAR
  amount: DECIMAL
  token_symbol: VARCHAR
  token_address: VARCHAR
  chain_id: INT
  status: VARCHAR (pending, processing, completed, failed)
  transaction_hash: VARCHAR
  error_reason: TEXT
  created_at: TIMESTAMP
  completed_at: TIMESTAMP
}

-- x402 授权
x402_authorizations {
  id: UUID
  user_id: UUID
  token_address: VARCHAR
  chain_id: INT
  from_address: VARCHAR
  to_address: VARCHAR
  amount: DECIMAL
  nonce: INT
  valid_after: TIMESTAMP
  valid_before: TIMESTAMP
  signature: VARCHAR
  status: VARCHAR (pending, submitted, executed, failed, expired)
  transaction_hash: VARCHAR
  relayer_address: VARCHAR
  relayer_fee: DECIMAL
  created_at: TIMESTAMP
  executed_at: TIMESTAMP
}

x402_nonces {
  id: UUID
  user_id: UUID
  token_address: VARCHAR
  chain_id: INT
  current_nonce: INT
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}

x402_used_nonces {
  id: UUID
  user_id: UUID
  token_address: VARCHAR
  chain_id: INT
  nonce: INT
  used_at: TIMESTAMP
}

-- Off-Ramp
offramp_transactions {
  id: VARCHAR
  wallet_address: VARCHAR
  provider: VARCHAR (coinbase, bridge, transak, moonpay)
  input_amount: DECIMAL
  input_token: VARCHAR
  output_amount: DECIMAL
  output_currency: VARCHAR
  chain_id: INT
  status: VARCHAR (pending, processing, completed, failed)
  tx_hash: VARCHAR
  bank_reference: VARCHAR
  created_at: TIMESTAMP
  completed_at: TIMESTAMP
}
```

---

## 🔐 安全性架构

### 1. 私钥管理

```
用户 PIN
    ↓
PBKDF2 (100,000 iterations)
    ↓
PIN 派生密钥
    ↓
AES-256-GCM 加密
    ↓
Share A (设备) + Share B (服务器) + Share C (恢复码)
    ↓
Shamir 2-of-3 分片
    ↓
任何 2 个分片可重建私钥
```

### 2. 交易签名

```
用户确认支付
    ↓
输入 PIN
    ↓
重建私钥 (Share A + Share B)
    ↓
签署交易
    ↓
销毁私钥 (内存清零)
    ↓
提交到区块链
```

### 3. 防重放保护

```
每个授权有唯一 Nonce
    ↓
Nonce 递增
    ↓
已使用 Nonce 存储在数据库
    ↓
重复 Nonce 被拒绝
    ↓
链上验证 Nonce 未使用
```

### 4. 有效期管理

```
授权创建时设置 validAfter 和 validBefore
    ↓
默认有效期: 1 小时
    ↓
超过 validBefore 的授权被拒绝
    ↓
链上验证当前时间在有效期内
```

---

## 📈 性能优化

### 1. 批量处理优化

```
文件上传 (1000 行)
    ↓
并行验证 (10 个 worker)
    ↓
批量数据库插入
    ↓
Go 服务并发执行 (500+ TPS)
    ↓
实时进度更新 (WebSocket)
```

### 2. Gas 优化

```
交易分组 (按代币)
    ↓
批量 Approve (一次性)
    ↓
批量转账 (一个交易多个接收者)
    ↓
Nonce 预分配
    ↓
Gas 价格动态调整
```

### 3. 缓存策略

```
代币元数据缓存 (1 小时)
    ↓
汇率缓存 (5 分钟)
    ↓
地址验证缓存 (24 小时)
    ↓
ENS 解析缓存 (7 天)
```

---

## 🔗 多链支持

### 支持的区块链

```
Layer 1:
- Ethereum (chainId: 1)
- BSC (chainId: 56)

Layer 2:
- Polygon (chainId: 137)
- Arbitrum (chainId: 42161)
- Optimism (chainId: 10)
- Base (chainId: 8453)
```

### 跨链操作

```
用户选择源链和目标链
    ↓
获取最佳路由 (Rango Exchange)
    ↓
执行 Swap 或 Bridge
    ↓
监听目标链事件
    ↓
确认完成
```

---

## 📊 监控与分析

### 1. 实时监控

```
Prometheus 指标:
- 支付成功率
- 平均处理时间
- Gas 成本
- 错误率
- Relayer 性能

Grafana 仪表板:
- 交易吞吐量
- 费用分析
- 用户活跃度
- 系统健康状态
```

### 2. 审计日志

```
所有操作记录:
- 支付创建
- 签名验证
- 交易提交
- 状态更新
- 错误发生

行级安全 (RLS):
- 用户只能看到自己的数据
- 多签成员只能看到相关交易
```

---

## 🚀 部署架构

### 前端部署 (Vercel)

```
Next.js 应用
    ↓
自动部署 (main 分支)
    ↓
CDN 分发
    ↓
全球加速
```

### 后端部署 (Kubernetes)

```
Go 微服务
    ↓
Docker 容器化
    ↓
Kubernetes 编排
    ↓
自动扩展 (HPA)
    ↓
负载均衡
```

### 数据库 (Supabase)

```
PostgreSQL
    ↓
自动备份
    ↓
行级安全 (RLS)
    ↓
实时订阅
```

---

## 📋 API 端点总结

### 批量支付 API

```
POST /api/batch-payment/upload          - 上传文件
POST /api/batch-payment/validate        - 验证数据
POST /api/batch-payment/calculate-fees  - 计算费用
POST /api/batch-payment/submit          - 提交支付
GET  /api/batch-payment/:batchId/status - 查询状态
GET  /api/batch-payment/:batchId/report - 生成报告
POST /api/batch-payment/:batchId/retry  - 重试失败项
GET  /api/batch-payment/history         - 历史记录
```

### x402 API

```
POST /api/x402/generate-authorization   - 生成授权
POST /api/x402/submit-signature         - 提交签名
POST /api/x402/submit-to-relayer        - 提交到 Relayer
GET  /api/x402/:authorizationId/status  - 查询状态
POST /api/x402/:authorizationId/cancel  - 取消授权
```

### Off-Ramp API

```
POST /api/offramp/quote                 - 获取报价
POST /api/offramp/initiate              - 发起转换
```

---

## 🎯 关键特性

✅ **自托管** - 完全控制支付流程  
✅ **高性能** - 500+ TPS 吞吐量  
✅ **多链** - 支持 6+ 区块链  
✅ **安全** - Shamir 分片 + 多签  
✅ **自动化** - 批量处理 + 自动重试  
✅ **透明** - 完整的审计日志  
✅ **灵活** - 支持多种支付方式  
✅ **可扩展** - 微服务架构  

---

## 📚 相关文件

- 前端: `app/batch-payment/page.tsx`
- API: `app/api/batch-payment/`, `app/api/x402/`, `app/api/offramp/`
- 服务: `services/`
- 数据库: `migrations/`
- 配置: `lib/auth/`, `lib/offramp.ts`

