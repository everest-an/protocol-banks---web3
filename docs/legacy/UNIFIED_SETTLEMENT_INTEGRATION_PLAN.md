# 统一商户结算协议 - 集成实施方案

## 核心理念：一套系统，多链支持

**设计原则**：复用现有架构，扩展而非重建。所有功能对 EVM 和 TRON 透明，用户无需关心底层网络差异。

---

## 一、产品定位

### 统一的多链结算平台
- ✅ **一个控制台**：管理所有网络的交易（EVM + TRON）
- ✅ **一套 API**：统一的支付接口，自动路由到最优网络
- ✅ **一个对账系统**：跨链交易自动合并对账
- ✅ **一个用户体验**：无缝切换网络，用户无感知

### 支持的主流代币
| 代币 | Ethereum | Arbitrum | Base | BSC | TRON |
|------|----------|----------|------|-----|------|
| USDT | ✅ | ✅ | ✅ | ✅ | ✅ |
| USDC | ✅ | ✅ | ✅ | ✅ | ✅ |
| DAI  | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 二、现有功能的 TRON 集成方案

### 2.1 Dashboard（仪表盘）

#### 现状
- 文件：`app/(products)/dashboard/page.tsx`
- 功能：显示总余额、最近交易、快速操作

#### 集成方案
```tsx
// 现有：仅显示 EVM 余额
<BalanceCard network="EVM" balance={evmBalance} />

// 改进：统一显示所有网络余额
<BalanceCard
  networks={["ethereum", "arbitrum", "base", "tron"]}
  totalBalance={calculateTotalBalance()}
  breakdown={[
    { network: "Ethereum", balance: 1000, percentage: 30% },
    { network: "Arbitrum", balance: 1500, percentage: 45% },
    { network: "TRON", balance: 833, percentage: 25% },
  ]}
/>
```

**数据来源**：
- EVM：现有的 `useWeb3().usdtBalance`
- TRON：扩展 `refreshBalances()` 支持 TRON (已实现在 `web3-context.tsx:168-185`)

**UI 改动**：
- 添加网络筛选器（All / EVM / TRON）
- 余额卡片显示网络标签

---

### 2.2 Batch Payment（批量支付）

#### 现状
- 文件：`app/(products)/batch-payment/page.tsx`
- 功能：Excel 导入、批量转账、进度跟踪

#### 集成方案（零代码改动）
```typescript
// lib/services/batch-payment.service.ts
async function processBatchPayment(payments: Payment[]) {
  for (const payment of payments) {
    // 自动检测地址类型
    const networkType = detectAddressType(payment.address)

    if (networkType === "TRON") {
      await sendTronPayment(payment) // 调用现有的 TRON 转账函数
    } else {
      await sendEvmPayment(payment)  // 调用现有的 EVM 转账函数
    }
  }
}

function detectAddressType(address: string): "EVM" | "TRON" {
  if (address.startsWith("T") && address.length === 34) {
    return "TRON"
  }
  return "EVM"
}
```

**Excel 导入改进**：
```csv
Recipient Address,Amount,Token,Network (Optional)
0x1234...,100,USDT,auto  # 自动检测为 EVM
TXYZop...,100,USDT,auto  # 自动检测为 TRON
```

**进度跟踪**：
- 复用现有的 `ProgressBar` 组件
- 按网络分组显示（"3 pending on TRON, 5 confirmed on Arbitrum"）

---

### 2.3 Vendors（供应商/联系人管理）

#### 现状
- 文件：`app/(products)/vendors/page.tsx`
- 功能：保存常用收款地址、备注、标签

#### 集成方案
```typescript
// prisma/schema.prisma (扩展 Vendor 模型)
model Vendor {
  id          String   @id @default(cuid())
  userId      String
  name        String

  // 支持多个地址（EVM + TRON）
  addresses   VendorAddress[]

  // 其他字段保持不变
  email       String?
  tags        String[]
  createdAt   DateTime @default(now())
}

model VendorAddress {
  id          String   @id @default(cuid())
  vendorId    String
  vendor      Vendor   @relation(fields: [vendorId], references: [id])

  network     String   // "ethereum" | "tron" | "arbitrum"
  address     String
  isPrimary   Boolean  @default(false)

  @@unique([vendorId, network])
}
```

**UI 改进**：
```tsx
<VendorCard vendor={vendor}>
  <AddressList>
    <AddressRow network="ethereum" address="0x1234..." primary />
    <AddressRow network="tron" address="TXYZop..." />
    <Button onClick={() => addAddress("tron")}>+ Add TRON Address</Button>
  </AddressList>
</VendorCard>
```

**用户体验**：
- 支付时自动选择对应网络的地址
- 验证地址有效性（TRON 地址用 TronWeb，EVM 用 ethers）

---

### 2.4 Transaction History（交易历史）

#### 现状
- 文件：`app/(products)/history/page.tsx`
- 功能：查看所有交易记录、筛选、导出

#### 集成方案
```typescript
// prisma/schema.prisma (扩展 Transaction 模型)
model Transaction {
  id            String   @id @default(cuid())
  userId        String

  // 网络标识
  network       String   // "ethereum" | "tron" | "arbitrum" | "base"
  chainId       Int?     // EVM 专用，TRON 为 null

  // 交易详情
  txHash        String
  from          String
  to            String
  amount        Decimal
  token         String
  status        String   // "pending" | "confirmed" | "failed"

  // TRON 特有字段
  energyUsed    BigInt?
  bandwidthUsed BigInt?

  // EVM 特有字段
  gasUsed       BigInt?
  gasPrice      BigInt?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([userId, network])
  @@index([txHash])
}
```

**查询 API 改进**：
```typescript
// app/api/transactions/route.ts
export async function GET(req: Request) {
  const { userId, network, startDate, endDate } = getQueryParams(req)

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      network: network || undefined, // 如果未指定，返回所有网络
      createdAt: {
        gte: startDate,
        lte: endDate,
      }
    },
    orderBy: { createdAt: "desc" }
  })

  return Response.json(transactions)
}
```

**UI 筛选器**：
```tsx
<FilterBar>
  <NetworkSelect>
    <option value="all">All Networks</option>
    <option value="ethereum">Ethereum</option>
    <option value="arbitrum">Arbitrum</option>
    <option value="tron">TRON</option>
  </NetworkSelect>
  <TokenSelect>
    <option value="all">All Tokens</option>
    <option value="USDT">USDT</option>
    <option value="USDC">USDC</option>
  </TokenSelect>
</FilterBar>
```

---

### 2.5 Multi-Sig Wallets（多签钱包）

#### 现状
- 文件：`lib/multisig.ts`
- 功能：Gnosis Safe 集成（仅支持 EVM）

#### 集成方案
```typescript
// lib/multisig/index.ts (统一接口)
interface MultiSigProvider {
  createWallet(owners: string[], threshold: number): Promise<string>
  proposeTransaction(walletAddress: string, tx: Transaction): Promise<string>
  approveTransaction(proposalId: string): Promise<void>
  executeTransaction(proposalId: string): Promise<string>
}

class EvmMultiSigProvider implements MultiSigProvider {
  // 现有的 Gnosis Safe 实现
}

class TronMultiSigProvider implements MultiSigProvider {
  // TRON 多签合约实现（待开发）
  // 使用自定义合约或现有方案（如 TRON Gnosis Safe 移植版）
}

// 工厂函数
function getMultiSigProvider(network: string): MultiSigProvider {
  if (network === "tron" || network === "tron-nile") {
    return new TronMultiSigProvider()
  }
  return new EvmMultiSigProvider()
}
```

**用户界面统一**：
```tsx
<MultiSigWalletCard wallet={wallet}>
  <NetworkBadge>{wallet.network}</NetworkBadge>
  <Address>{wallet.address}</Address>
  <Threshold>{wallet.threshold} of {wallet.owners.length}</Threshold>
  <PendingTransactions count={wallet.pendingTxCount} />
</MultiSigWalletCard>
```

---

## 三、自动化对账系统（统一架构）

### 3.1 对账引擎设计

#### 核心原则
- **网络无关**：对账逻辑不区分 EVM 或 TRON
- **自动归集**：所有网络的交易统一进入对账池
- **差异检测**：跨链比对，发现遗漏或重复

#### 实现架构
```typescript
// lib/services/reconciliation.service.ts
interface ReconciliationEngine {
  // 拉取链上数据
  fetchOnChainTransactions(network: string, startTime: Date, endTime: Date): Promise<Transaction[]>

  // 拉取财务系统数据
  fetchSystemTransactions(startTime: Date, endTime: Date): Promise<Transaction[]>

  // 对账比对
  reconcile(onChain: Transaction[], system: Transaction[]): ReconciliationReport

  // 自动修复
  autoResolve(discrepancies: Discrepancy[]): Promise<void>
}

interface ReconciliationReport {
  period: { start: Date; end: Date }
  summary: {
    totalOnChain: number
    totalSystem: number
    matched: number
    missing: number      // 链上有但系统没有
    extra: number        // 系统有但链上没有
    amountMismatch: number
  }
  discrepancies: Discrepancy[]
  networks: NetworkSummary[] // 按网络分组
}

interface NetworkSummary {
  network: string
  totalTransactions: number
  totalVolume: Decimal
  matched: number
  issues: number
}
```

### 3.2 Event Indexer 扩展（Go 服务）

#### 现状
- 文件：`services/event-indexer/`
- 功能：监听 EVM 链事件

#### 集成方案
```go
// services/event-indexer/internal/indexer/interface.go
type BlockchainIndexer interface {
    Start(ctx context.Context) error
    Stop() error
    GetLatestBlock() (uint64, error)
    GetTransactions(from, to uint64) ([]*Transaction, error)
}

// EVM 实现（现有）
type EvmIndexer struct {
    // ...
}

// TRON 实现（新增）
type TronIndexer struct {
    client   *trongrid.Client
    network  string // "mainnet" | "nile"
    contracts map[string]string // token contracts
}

func (t *TronIndexer) Start(ctx context.Context) error {
    // 连接到 TronGrid API
    // 订阅 TRC20 Transfer 事件
    // 解析并存储到统一的 Transaction 表
}
```

#### 统一数据模型
```go
// services/event-indexer/internal/models/transaction.go
type Transaction struct {
    ID            string
    Network       string // "ethereum" | "tron" | "arbitrum"
    TxHash        string
    From          string
    To            string
    Amount        decimal.Decimal
    Token         string
    Status        string
    BlockNumber   uint64
    Timestamp     time.Time

    // 网络特定字段（JSON 存储）
    Metadata      map[string]interface{}
}
```

### 3.3 对账报告（统一格式）

#### 日报示例
```
Protocol Banks - 对账日报
日期：2026-02-07
===========================================

总览
---
总交易笔数：1,250
总交易金额：$1,234,567.89
对账状态：99.2% 匹配

网络分布
---
| 网络      | 笔数 | 金额        | 匹配率 |
|-----------|------|-------------|--------|
| Ethereum  | 350  | $450,000    | 99.5%  |
| Arbitrum  | 500  | $600,000    | 99.8%  |
| TRON      | 400  | $184,567    | 98.5%  |

异常交易
---
1. [TRON] TxHash: ABC123... - 金额不匹配 (链上: $100, 系统: $99.99)
2. [Arbitrum] TxHash: DEF456... - 状态不一致 (链上: confirmed, 系统: pending)

自动修复
---
✅ 2 笔状态同步已完成
⚠️  1 笔金额差异需人工审核（差额 < $0.01，可能为精度问题）
```

---

## 四、UI 组件复用策略

### 4.1 网络选择器（通用组件）

```tsx
// components/ui/network-selector.tsx
interface NetworkSelectorProps {
  value: string
  onChange: (network: string) => void
  filter?: "all" | "evm" | "tron" | "mainnet" | "testnet"
}

export function NetworkSelector({ value, onChange, filter }: NetworkSelectorProps) {
  const networks = useMemo(() => {
    let list = ALL_NETWORKS
    if (filter === "evm") list = EVM_NETWORKS
    if (filter === "tron") list = TRON_NETWORKS
    if (filter === "mainnet") list = getMainnetNetworks()
    if (filter === "testnet") list = getTestnetNetworks()
    return list
  }, [filter])

  return (
    <Select value={value} onValueChange={onChange}>
      {Object.entries(networks).map(([id, network]) => (
        <SelectItem key={id} value={id}>
          <NetworkIcon network={id} />
          {network.name}
        </SelectItem>
      ))}
    </Select>
  )
}
```

**使用场景**：
- Dashboard 网络筛选
- Batch Payment 网络选择
- Transaction History 筛选
- Settings 默认网络设置

### 4.2 交易卡片（统一格式）

```tsx
// components/ui/transaction-card.tsx
interface TransactionCardProps {
  tx: Transaction
  showNetwork?: boolean
  onViewDetails?: () => void
}

export function TransactionCard({ tx, showNetwork = true }: TransactionCardProps) {
  const explorerUrl = getExplorerUrl(tx.network, tx.txHash)

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between">
          <div>
            {showNetwork && <NetworkBadge network={tx.network} />}
            <StatusBadge status={tx.status} />
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{tx.amount} {tx.token}</p>
            <p className="text-sm text-gray-500">{formatDate(tx.createdAt)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <dl>
          <dt>From</dt>
          <dd><AddressDisplay address={tx.from} network={tx.network} /></dd>
          <dt>To</dt>
          <dd><AddressDisplay address={tx.to} network={tx.network} /></dd>
          <dt>TxHash</dt>
          <dd>
            <a href={explorerUrl} target="_blank" className="text-blue-500">
              {truncateHash(tx.txHash)}
            </a>
          </dd>
        </dl>
      </CardContent>
    </Card>
  )
}

function getExplorerUrl(network: string, txHash: string): string {
  const config = getNetworkById(network)
  if (!config) return "#"

  if (network.startsWith("tron")) {
    return `${config.blockExplorer}/#/transaction/${txHash}`
  }
  return `${config.blockExplorer}/tx/${txHash}`
}
```

---

## 五、API 路由统一化

### 5.1 支付 API（自动路由）

```typescript
// app/api/payments/send/route.ts
export async function POST(req: Request) {
  const { to, amount, token, network } = await req.json()

  // 自动检测网络（如果未指定）
  const targetNetwork = network || detectAddressNetwork(to)

  // 验证地址
  if (!validateAddress(to, targetNetwork)) {
    return Response.json({ error: "Invalid address" }, { status: 400 })
  }

  // 根据网络类型路由
  let txHash: string
  if (targetNetwork === "tron" || targetNetwork === "tron-nile") {
    txHash = await sendTronPayment({ to, amount, token })
  } else {
    txHash = await sendEvmPayment({ to, amount, token, network: targetNetwork })
  }

  // 统一记录到数据库
  const transaction = await prisma.transaction.create({
    data: {
      userId: req.userId,
      network: targetNetwork,
      txHash,
      from: req.userAddress,
      to,
      amount,
      token,
      status: "pending"
    }
  })

  return Response.json({ success: true, txHash, id: transaction.id })
}
```

### 5.2 余额查询 API（聚合）

```typescript
// app/api/balances/route.ts
export async function GET(req: Request) {
  const { address, networks } = getQueryParams(req)

  const networkList = networks?.split(",") || ["ethereum", "arbitrum", "tron"]

  const balances = await Promise.all(
    networkList.map(async (network) => {
      const tokens = getSupportedTokens(network)
      const balanceResults = await Promise.all(
        tokens.map(async (token) => {
          const balance = await getBalance(network, address, token.address)
          return { token: token.symbol, balance }
        })
      )

      return {
        network,
        tokens: balanceResults,
        total: balanceResults.reduce((sum, b) => sum + parseFloat(b.balance), 0)
      }
    })
  )

  return Response.json({
    address,
    networks: balances,
    totalUSD: calculateTotalUSD(balances)
  })
}

async function getBalance(network: string, address: string, tokenAddress: string): Promise<string> {
  if (network.startsWith("tron")) {
    return getTronBalance(address, tokenAddress)
  }
  return getEvmBalance(address, tokenAddress, network)
}
```

---

## 六、实施优先级与时间表

### Phase 1: 核心集成（2 周）
- ✅ **Week 1**：
  - 统一网络配置 (`lib/networks.ts`) ✅ 已完成
  - TRON 登录修复 ✅ 已完成
  - Dashboard 多网络余额显示
  - Transaction History 支持 TRON

- ✅ **Week 2**：
  - Batch Payment 自动网络检测
  - Vendor 多地址支持
  - API 路由统一化

### Phase 2: 对账系统（2 周）
- ✅ **Week 3**：
  - Event Indexer TRON 扩展（Go）
  - 统一 Transaction 数据模型
  - 链上数据采集接口

- ✅ **Week 4**：
  - 对账引擎实现
  - 差异检测算法
  - 自动修复逻辑
  - 对账报告生成

### Phase 3: 多签与高级功能（2 周）
- ✅ **Week 5**：
  - TRON 多签合约开发
  - 多签 UI 适配
  - 审批流程统一

- ✅ **Week 6**：
  - 分账规则引擎
  - 结算控制台
  - 测试与优化

---

## 七、数据迁移计划

### 7.1 现有数据兼容性

```typescript
// 数据库迁移脚本
// prisma/migrations/XXX_add_network_support.sql

-- 1. 给 Transaction 表添加 network 字段
ALTER TABLE "Transaction"
ADD COLUMN "network" TEXT DEFAULT 'ethereum';

-- 2. 根据 chainId 回填 network
UPDATE "Transaction"
SET network = CASE
  WHEN "chainId" = 1 THEN 'ethereum'
  WHEN "chainId" = 42161 THEN 'arbitrum'
  WHEN "chainId" = 8453 THEN 'base'
  WHEN "chainId" = 56 THEN 'bsc'
  ELSE 'ethereum'
END;

-- 3. 创建 VendorAddress 表
CREATE TABLE "VendorAddress" (
  "id" TEXT PRIMARY KEY,
  "vendorId" TEXT NOT NULL REFERENCES "Vendor"("id") ON DELETE CASCADE,
  "network" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "isPrimary" BOOLEAN DEFAULT false,
  UNIQUE("vendorId", "network")
);

-- 4. 迁移现有 Vendor 地址
INSERT INTO "VendorAddress" (id, "vendorId", network, address, "isPrimary")
SELECT
  gen_random_uuid()::text,
  id,
  'ethereum',
  address,
  true
FROM "Vendor"
WHERE address IS NOT NULL;
```

### 7.2 零停机迁移策略

1. **蓝绿部署**：
   - 保持旧版 API 继续服务
   - 新版 API 逐步上线
   - 流量逐步切换（10% → 50% → 100%）

2. **数据双写**：
   - 新交易同时写入旧字段和新字段
   - 保持 1 周兼容期
   - 验证数据一致性后删除旧字段

---

## 八、性能优化策略

### 8.1 缓存层设计

```typescript
// lib/cache/balance-cache.ts
import Redis from "ioredis"

const redis = new Redis(process.env.REDIS_URL)

export async function getCachedBalance(
  network: string,
  address: string,
  token: string
): Promise<string | null> {
  const key = `balance:${network}:${address}:${token}`
  return await redis.get(key)
}

export async function setCachedBalance(
  network: string,
  address: string,
  token: string,
  balance: string
): Promise<void> {
  const key = `balance:${network}:${address}:${token}`
  await redis.setex(key, 60, balance) // 60 秒过期
}
```

### 8.2 批量查询优化

```typescript
// 现有：串行查询（慢）
const balances = []
for (const network of networks) {
  for (const token of tokens) {
    const balance = await getBalance(network, address, token)
    balances.push(balance)
  }
}

// 优化：并行查询（快）
const queries = networks.flatMap(network =>
  tokens.map(token => getBalance(network, address, token))
)
const balances = await Promise.all(queries) // 并发执行
```

---

## 九、监控与告警

### 9.1 关键指标

| 指标 | 目标 | 告警阈值 |
|------|------|----------|
| 交易成功率 | > 99.5% | < 95% |
| 对账准确率 | > 99.9% | < 99% |
| API 响应时间 | < 500ms | > 2s |
| Event Indexer 延迟 | < 10s | > 60s |
| 余额查询错误率 | < 0.1% | > 1% |

### 9.2 Prometheus 指标

```go
// services/event-indexer/internal/metrics/metrics.go
var (
    BlocksIndexed = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "indexer_blocks_indexed_total",
            Help: "Total number of blocks indexed",
        },
        []string{"network"}, // "ethereum", "tron", etc.
    )

    TransactionsIndexed = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "indexer_transactions_indexed_total",
            Help: "Total number of transactions indexed",
        },
        []string{"network", "token"},
    )

    IndexerLag = promauto.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "indexer_lag_seconds",
            Help: "Lag between current time and last indexed block",
        },
        []string{"network"},
    )
)
```

---

## 十、成本与收益分析

### 10.1 开发成本
- **核心集成**：10 人/天
- **对账系统**：10 人/天
- **多签功能**：8 人/天
- **测试与优化**：7 人/天
- **文档与培训**：5 人/天

**总计**：约 40 人/天（6 周，单人开发）

### 10.2 运营成本（月）
- **TRON API**：$100（TronGrid Pro）
- **Redis 缓存**：$20（Upstash）
- **数据库**：$50（Supabase）
- **服务器**：$100（Vercel + Kubernetes）

**总计**：$270/月（比独立开发节省 50%）

### 10.3 收益分析
1. **用户体验提升**：
   - TRON 手续费更低（$0.01 vs $1-5）
   - 确认速度更快（3s vs 12-60s）
   - 吸引更多用户（预计 +30%）

2. **运营效率提升**：
   - 自动对账节省 80% 人力
   - 跨链统一管理，降低错误率
   - 报表自动生成，符合审计要求

3. **市场竞争力**：
   - 支持主流 EVM + TRON
   - 覆盖 90% 稳定币市场
   - 差异化竞争优势

---

## 十一、风险与应对

### 技术风险
| 风险 | 影响 | 应对措施 |
|------|------|----------|
| TRON API 限流 | 中 | 部署自有节点 + 多 API 源切换 |
| 跨链数据不一致 | 高 | 分布式锁 + 最终一致性检查 |
| 智能合约漏洞 | 高 | 多轮审计 + Bug Bounty + 时间锁 |

### 业务风险
| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 监管合规 | 高 | 法律顾问审查 + KYC/AML 集成 |
| 用户迁移阻力 | 中 | 渐进式发布 + 用户教育 |
| 市场接受度 | 低 | TRON 已是主流（Tether 50%+ 流通量） |

---

## 十二、成功标准

### 技术指标
- ✅ 支持 EVM + TRON 无缝切换
- ✅ 对账准确率 > 99.9%
- ✅ API 响应时间 < 500ms
- ✅ 交易成功率 > 99.5%

### 业务指标
- ✅ 用户增长 > 30%（3 个月内）
- ✅ 交易量增长 > 50%（TRON 低费用优势）
- ✅ 客户满意度 > 4.5/5

### 合规指标
- ✅ 通过安全审计（至少 2 家）
- ✅ 符合当地监管要求
- ✅ 审计报告 100% 可追溯

---

## 附录

### A. 参考文档
- [TRON 开发者文档](https://developers.tron.network/)
- [TronGrid API](https://www.trongrid.io/)
- [Prisma Multi-Provider](https://www.prisma.io/docs/concepts/database-connectors)

### B. 代码示例仓库
- [TronWeb SDK](https://github.com/tronprotocol/tronweb)
- [GoTron SDK](https://github.com/fbsobreira/gotron-sdk)

### C. 社区支持
- TRON Discord: https://discord.gg/tron
- Telegram: @TronNetworkEN
