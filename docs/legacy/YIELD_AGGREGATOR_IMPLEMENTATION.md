# Yield Aggregator Implementation Summary

## 概述

已完成基于 **Aave V3** 的收益聚合器开发（Week 2 核心功能），遵循您的要求 "收益合约不要自己写 而是调用aave"。

## ✅ 已完成功能

### 1. 智能合约层 (Solidity)

#### [contracts/yield/MerchantYieldManager.sol](contracts/yield/MerchantYieldManager.sol) (600+ lines)

**核心功能:**
- ✅ Aave V3 Pool 集成 (supply/withdraw)
- ✅ 多商户独立账户管理
- ✅ 本金和利息分离追踪
- ✅ 实时 APY 计算
- ✅ 平台手续费机制 (5% 默认，只从利息扣除)
- ✅ 紧急暂停和提现功能
- ✅ ReentrancyGuard 防重入攻击
- ✅ Ownable 权限管理

**关键方法:**
```solidity
// 商户存款 (自动存入 Aave V3)
function deposit(uint256 amount) external nonReentrant whenNotPaused

// 商户提现 (连本带息)
function withdraw(uint256 amount) external nonReentrant whenNotPaused

// 查询余额 (本金 + 利息)
function getMerchantBalance(address merchant) public view returns (uint256)

// 查询利息
function getMerchantInterest(address merchant) public view returns (uint256)

// 查询 APY
function getMerchantAPY(address merchant) public view returns (uint256)
```

**安全特性:**
- ✅ 最小存款限制 (1 USDT) 防止粉尘攻击
- ✅ 重入保护 (ReentrancyGuard)
- ✅ 暂停机制 (Pausable)
- ✅ 紧急提现 (仅 Owner)
- ✅ 手续费上限 (10%)

**利息计算逻辑:**
```solidity
// 商户余额 = (商户本金 / 总本金) * aUSDT 总余额
merchantBalance = (merchantPrincipal / totalPrincipal) * aTokenBalance

// 利息 = 商户余额 - 商户本金
interest = merchantBalance - merchantPrincipal

// APY = (利息 / 本金) * (365 天 / 经过时间) * 10000
apy = (interest * 365 days * 10000) / (principal * elapsedTime)
```

### 2. 部署配置

#### [contracts/yield/aave-addresses.json](contracts/yield/aave-addresses.json)

**支持网络:**
| 网络 | Chain ID | Aave Pool | USDT | aUSDT |
|------|----------|-----------|------|-------|
| Ethereum Mainnet | 1 | 0x87870Bca... | 0xdAC17F95... | 0x23878914... |
| Base | 8453 | 0xA238Dd80... | 0xfde4C96c... | 0x4e65fE4D... |
| Arbitrum One | 42161 | 0x794a6135... | 0xFd086bC7... | 0x6ab707Ac... |
| Base Sepolia (测试) | 84532 | 0x07eA79F6... | 0xF175520C... | 0x8Bb4C975... |

#### [contracts/yield/deploy.ts](contracts/yield/deploy.ts)

**部署脚本功能:**
- ✅ 自动检测网络和加载对应 Aave 地址
- ✅ 部署后自动验证合约 (Etherscan/Basescan)
- ✅ 保存部署信息到 JSON 文件
- ✅ 打印使用说明

**部署命令:**
```bash
# Base Sepolia 测试网
npx hardhat run contracts/yield/deploy.ts --network baseSepolia

# Base 主网
npx hardhat run contracts/yield/deploy.ts --network base

# Ethereum 主网
npx hardhat run contracts/yield/deploy.ts --network ethereum

# Arbitrum One
npx hardhat run contracts/yield/deploy.ts --network arbitrum
```

### 3. TypeScript 服务层

#### [lib/services/yield/yield-aggregator.service.ts](lib/services/yield/yield-aggregator.service.ts) (500+ lines)

**核心功能:**
- ✅ 多网络初始化 (Ethereum, Base, Arbitrum)
- ✅ 商户存款 (USDT approve + deposit)
- ✅ 商户提现 (withdraw)
- ✅ 余额查询 (getMerchantBalance)
- ✅ 统计信息查询 (getContractStats)
- ✅ 自动存款钩子 (autoDepositHook)
- ✅ 结构化日志集成

**接口定义:**
```typescript
interface MerchantYieldBalance {
  merchant: string
  network: YieldNetwork
  principal: string          // 本金 (USDT)
  interest: string           // 利息 (USDT)
  totalBalance: string       // 总余额 (USDT)
  apy: number                // 年化收益率 (%)
  lastOperationTime: Date    // 最后操作时间
}
```

**使用示例:**
```typescript
import { yieldAggregatorService } from '@/lib/services/yield/yield-aggregator.service'

// 1. 存款
const txHash = await yieldAggregatorService.deposit(
  'base',                    // 网络
  '0xmerchant...',          // 商户地址
  '1000.00',                // 金额 (USDT)
  signer                    // ethers Signer
)

// 2. 查询余额
const balance = await yieldAggregatorService.getMerchantBalance(
  'base',
  '0xmerchant...'
)
console.log('本金:', balance.principal)
console.log('利息:', balance.interest)
console.log('APY:', balance.apy, '%')

// 3. 提现 (全部)
const withdrawTxHash = await yieldAggregatorService.withdraw(
  'base',
  '0xmerchant...',
  '0',                      // 0 = 全部提现
  signer
)

// 4. 查询合约统计
const stats = await yieldAggregatorService.getContractStats('base')
console.log('总存款:', stats.totalDeposits)
console.log('总利息:', stats.totalInterest)
console.log('手续费率:', stats.platformFeeRate, '%')
```

**自动生息钩子:**
```typescript
// 订单确认后自动存入 Aave 赚取利息
await yieldAggregatorService.autoDepositHook(
  orderId,
  merchantId,
  amount,
  network
)
```

**环境变量配置:**
```bash
# 启用自动生息
ENABLE_AUTO_YIELD=true

# 最小金额阈值 (低于此金额不自动存入)
AUTO_YIELD_MIN_AMOUNT=100

# RPC URLs
ETHEREUM_RPC_URL=https://eth.llamarpc.com
BASE_RPC_URL=https://mainnet.base.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
```

### 4. ABI 文件

#### [lib/services/yield/abis/MerchantYieldManager.json](lib/services/yield/abis/MerchantYieldManager.json)

包含所有合约方法的 ABI 定义，用于 TypeScript 服务与合约交互。

## 架构设计

### 资金流转图

```
商户 USDT
    ↓
    | 1. approve(amount)
    ↓
MerchantYieldManager 合约
    ↓
    | 2. transferFrom(merchant, contract, amount)
    ↓
合约 USDT 余额
    ↓
    | 3. approve(aavePool, amount)
    ↓
    | 4. aavePool.supply(usdt, amount, contract, 0)
    ↓
Aave V3 Pool
    ↓
    | 5. mint aUSDT to contract
    ↓
合约 aUSDT 余额 (自动增长，包含利息)

提现流程 (反向):
Aave V3 Pool
    ↓
    | 1. aavePool.withdraw(usdt, amount, contract)
    ↓
合约 USDT 余额
    ↓
    | 2. 计算手续费 (platformFee = interest * 5%)
    ↓
    | 3. transfer(feeCollector, platformFee)
    ↓
    | 4. transfer(merchant, netAmount)
    ↓
商户收到 USDT (本金 + 利息 - 手续费)
```

### 利息计算原理

**Aave V3 利息机制:**
- aToken (如 aUSDT) 是利息代币，余额会随时间自动增长
- 增长率 = Aave Pool 的实时借贷利率
- 无需手动 claim，余额实时更新

**本合约的分配逻辑:**
1. 所有商户的 USDT 统一存入 Aave，获得 aUSDT
2. 合约记录每个商户的本金 (principal)
3. 查询时按比例计算：`商户份额 = (商户本金 / 总本金) * aUSDT总余额`
4. 利息 = 商户份额 - 商户本金

**优势:**
- ✅ 无需为每个商户单独存入 Aave (节省 gas)
- ✅ 利息自动复利 (Aave 机制)
- ✅ 实时查询，无延迟

### 安全考虑

**1. 重入攻击防护:**
```solidity
function deposit(uint256 amount) external nonReentrant {
  // 使用 OpenZeppelin ReentrancyGuard
}
```

**2. 暂停机制:**
```solidity
function deposit(uint256 amount) external whenNotPaused {
  // 紧急情况下可暂停所有操作
}
```

**3. 权限控制:**
```solidity
function setPlatformFeeRate(uint256 newRate) external onlyOwner {
  // 只有 Owner 可修改手续费率
}
```

**4. 最小金额限制:**
```solidity
uint256 public constant MIN_DEPOSIT = 1e6; // 1 USDT
require(amount >= MIN_DEPOSIT, "Amount too small");
```

**5. 手续费上限:**
```solidity
require(newRate <= 1000, "Fee rate too high"); // 最大 10%
```

### 与现有系统集成

#### 集成点 1: 订单确认后自动存入

**文件:** `lib/services/queue/payment-queue.service.ts`

```typescript
// Worker 处理支付成功后
await prisma.order.update({
  where: { id: orderId },
  data: { status: 'confirmed', confirmed_at: new Date() }
})

// 🆕 新增: 自动存入 Aave 赚取利息
await yieldAggregatorService.autoDepositHook(
  orderId,
  merchantId,
  amount,
  network
)
```

#### 集成点 2: Dashboard 余额展示

**文件:** `app/(products)/dashboard/page.tsx`

```typescript
// 查询商户在各网络的收益余额
const [ethBalance, baseBalance, arbBalance] = await Promise.all([
  yieldAggregatorService.getMerchantBalance('ethereum', merchantAddress),
  yieldAggregatorService.getMerchantBalance('base', merchantAddress),
  yieldAggregatorService.getMerchantBalance('arbitrum', merchantAddress)
])

// 显示在仪表板
<YieldBalanceCard
  network="base"
  principal={baseBalance.principal}
  interest={baseBalance.interest}
  apy={baseBalance.apy}
/>
```

#### 集成点 3: 商户结算时自动提现

**文件:** `app/api/settlements/route.ts`

```typescript
// 商户发起结算
const settlement = await createSettlement(merchantId, amount)

// 🆕 新增: 从 Aave 提取资金
const txHash = await yieldAggregatorService.withdraw(
  network,
  merchantAddress,
  amount,
  signer
)

// 继续结算流程...
```

## 部署流程

### 1. 安装依赖

```bash
# Hardhat 和 OpenZeppelin
pnpm add -D hardhat @nomicfoundation/hardhat-toolbox
pnpm add @openzeppelin/contracts

# ethers.js v6
pnpm add ethers@^6.0.0
```

### 2. 配置 Hardhat

**创建 `hardhat.config.ts`:**
```typescript
import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532
    },
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8453
    },
    ethereum: {
      url: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1
    },
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 42161
    }
  },
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY || "",
      baseSepolia: process.env.BASESCAN_API_KEY || "",
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      arbitrumOne: process.env.ARBISCAN_API_KEY || ""
    }
  }
}

export default config
```

### 3. 编译合约

```bash
npx hardhat compile
```

### 4. 部署到测试网 (Base Sepolia)

```bash
# 设置私钥
export PRIVATE_KEY="0x..."

# 部署
npx hardhat run contracts/yield/deploy.ts --network baseSepolia

# 输出示例:
# 🚀 Deploying MerchantYieldManager with account: 0x...
# 💰 Account balance: 0.5 ETH
# 🌐 Network: Base Sepolia (Chain ID: 84532)
# ✅ MerchantYieldManager deployed to: 0xABCDEF...
# 🔗 Explorer: https://sepolia.basescan.org/address/0xABCDEF...
```

### 5. 验证合约

```bash
npx hardhat verify --network baseSepolia \
  0xABCDEF... \
  0x07eA79F6... \  # aavePool
  0xF175520C... \  # usdt
  0x8Bb4C975... \  # aUsdt
  0xfeeCollector  # feeCollector
```

### 6. 部署到主网

```bash
# Base 主网
npx hardhat run contracts/yield/deploy.ts --network base

# Ethereum 主网
npx hardhat run contracts/yield/deploy.ts --network ethereum

# Arbitrum One
npx hardhat run contracts/yield/deploy.ts --network arbitrum
```

## 测试计划

### 单元测试 (Hardhat)

**创建 `test/MerchantYieldManager.test.ts`:**
```typescript
import { expect } from "chai"
import { ethers } from "hardhat"

describe("MerchantYieldManager", function () {
  it("Should deposit USDT and receive aUSDT", async function () {
    // ... test implementation
  })

  it("Should calculate interest correctly", async function () {
    // ... test implementation
  })

  it("Should withdraw with platform fee", async function () {
    // ... test implementation
  })
})
```

**运行测试:**
```bash
npx hardhat test
```

### 集成测试 (TypeScript)

**创建 `lib/services/yield/__tests__/yield-aggregator.test.ts`:**
```typescript
import { yieldAggregatorService } from '../yield-aggregator.service'

describe('YieldAggregatorService', () => {
  it('should fetch merchant balance', async () => {
    const balance = await yieldAggregatorService.getMerchantBalance(
      'base',
      '0xmerchant...'
    )
    expect(balance.principal).toBeDefined()
  })
})
```

## 费用估算

### Gas 费用 (Base 网络, 2024 年均价)

| 操作 | Gas Used | Gas Price | ETH Cost | USD Cost |
|------|----------|-----------|----------|----------|
| 部署合约 | ~2,000,000 | 0.01 Gwei | 0.00002 ETH | $0.05 |
| 首次存款 (approve + deposit) | ~150,000 | 0.01 Gwei | 0.0000015 ETH | $0.004 |
| 后续存款 (已授权) | ~100,000 | 0.01 Gwei | 0.000001 ETH | $0.003 |
| 提现 | ~120,000 | 0.01 Gwei | 0.0000012 ETH | $0.003 |
| 查询余额 (免费) | 0 | 0 | 0 | $0 |

**Base 优势:**
- 极低 gas 费 (比 Ethereum 便宜 ~100 倍)
- 快速确认 (2 秒出块)
- Coinbase 官方支持

### 平台手续费收入

假设商户平均存入 $10,000 USDT，年化收益率 5%:

| 商户数 | 总存款 | 年利息 (5%) | 平台手续费 (5%) | 年收入 |
|--------|--------|-------------|-----------------|--------|
| 10 | $100,000 | $5,000 | $250 | $250 |
| 100 | $1,000,000 | $50,000 | $2,500 | $2,500 |
| 1,000 | $10,000,000 | $500,000 | $25,000 | $25,000 |

## 监控和运维

### 监控指标

**Prometheus Metrics:**
```typescript
// 总存款量
yield_total_deposits_usd{network="base"} 1000000

// 总利息
yield_total_interest_usd{network="base"} 50000

// 活跃商户数
yield_active_merchants{network="base"} 100

// 平均 APY
yield_average_apy_percent{network="base"} 5.2
```

### 告警规则

```yaml
# Aave Pool 余额异常
- alert: AavePoolBalanceMismatch
  expr: abs(yield_aave_balance - yield_recorded_balance) > 1000
  for: 5m
  severity: high

# 商户提现失败率过高
- alert: HighWithdrawalFailureRate
  expr: rate(yield_withdrawal_failures[5m]) > 0.1
  for: 5m
  severity: critical
```

## 下一步开发 (Week 2 剩余任务)

### ⏳ 待完成

1. **JustLend Integration (TRON)** - 类似 Aave 的 TRON 生息协议
   - 创建 `contracts/yield/TronYieldManager.sol`
   - 使用 JustLend Pool API
   - 部署到 TRON 主网和 Nile 测试网

2. **Dashboard UI Components**
   - `components/yield/YieldBalanceCard.tsx` - 余额卡片
   - `components/yield/YieldDepositModal.tsx` - 存款弹窗
   - `components/yield/YieldWithdrawModal.tsx` - 提现弹窗
   - `components/yield/YieldHistoryTable.tsx` - 历史记录

3. **API Routes**
   - `app/api/yield/balance/route.ts` - 查询余额
   - `app/api/yield/deposit/route.ts` - 发起存款
   - `app/api/yield/withdraw/route.ts` - 发起提现
   - `app/api/yield/stats/route.ts` - 统计信息

4. **测试用例**
   - Hardhat 单元测试
   - Jest 集成测试
   - E2E 测试 (Cypress)

## 文件清单

### 已创建文件

```
contracts/yield/
├── MerchantYieldManager.sol         # Aave V3 集成合约 (600+ lines)
├── aave-addresses.json              # 多网络 Aave 地址配置
└── deploy.ts                        # Hardhat 部署脚本

lib/services/yield/
├── yield-aggregator.service.ts      # TypeScript 服务层 (500+ lines)
└── abis/
    └── MerchantYieldManager.json    # 合约 ABI

docs/
├── YIELD_AGGREGATOR_AAVE.md         # Aave 集成设计文档
└── YIELD_AGGREGATOR_IMPLEMENTATION.md  # 本文档
```

### 待创建文件

```
hardhat.config.ts                    # Hardhat 配置
test/MerchantYieldManager.test.ts    # 合约测试
components/yield/                    # UI 组件
app/api/yield/                       # API 路由
```

## Week 2 进度总结

| 任务 | 状态 | 进度 |
|------|------|------|
| Aave V3 智能合约 | ✅ | 100% |
| 部署脚本和配置 | ✅ | 100% |
| TypeScript 服务层 | ✅ | 100% |
| ABI 和类型定义 | ✅ | 100% |
| JustLend (TRON) 集成 | ⏳ | 0% |
| Dashboard UI | ⏳ | 0% |
| API Routes | ⏳ | 0% |
| 测试用例 | ⏳ | 0% |

**总体进度:** 50% (4/8 任务完成)

---

**创建时间:** 2026-02-07
**状态:** 🚧 进行中 (Week 2, Day 1-3)
**下一步:** 配置 Hardhat 并部署到 Base Sepolia 测试网
