# TRON Yield Aggregator - JustLend Integration

自动收益聚合器，将商户闲置资金存入JustLend赚取利息，支持随时提现和收益分配。

## 概览

| 组件 | 描述 | 状态 |
|------|------|------|
| `IJustLend.sol` | JustLend协议接口定义 | ✅ 完成 |
| `TronYieldAggregator.sol` | 收益聚合器主合约 | ✅ 完成 |
| `Mocks.sol` | 测试用的Mock合约 | ✅ 完成 |

---

## 1. JustLend协议简介

JustLend是TRON区块链上最大的去中心化借贷协议，类似于以太坊上的Aave：

### 核心概念

#### jToken（生息代币）
JustLend使用**jToken**作为生息代币，类似于Aave的aToken：

```
存款流程:
用户存款 1000 USDT → 成为 998 jUSDT（exchangeRate = 1.002）

利息累积:
1年后，exchangeRate 从 1.002 涨到 1.01

提现流程:
赎回 998 jUSDT → 获得 1008 USDT
├── 本金: 1000 USDT
└── 利息: 8 USDT (0.8% APY)
```

#### 支持的代币

| 代币 | 符号 | jToken | 小数位 | 主网地址 |
|------|------|--------|--------|---------|
| Tether USD | USDT | jUSDT | 6 | TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t |
| USD Coin | USDC | jUSDC | 6 | TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8 |
| TRON | TRX | jTRX | 6 | 原生代币 |
| Wrapped BTC | WBTC | jWBTC | 18 | TJxKK8Ht9m... |
| Wrapped ETH | WETH | jWETH | 18 | TXp8H8pZ... |

#### JustLend收益来源

| 收益来源 | 说明 | APY示例 |
|---------|------|---------|
| 借贷利差 | 借款人支付的利息 | 2-5% |
| TRX奖励 | 质押挖矿奖励 | 1-3% |
| JUST奖励 | 治理代币奖励 | 0.5-2% |

---

## 2. TronYieldAggregator架构

### 工作流程

```
┌─────────────────────────────────────────────────────────────┐
│                    收益聚合流程                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 商户存款                                               │
│     用户 → 1000 USDT → TronYieldAggregator                  │
│                                                             │
│  2. 自动质押JustLend                                        │
│     TronYieldAggregator → JustLend.deposit(jUSDT)          │
│     获得利息 → exchangeRate 上涨                            │
│                                                             │
│  3. 收益计算                                               │
│     账户余额 = jUSDT数量 × exchangeRate                      │
│     利息 = 当前余额 - 本金                                  │
│                                                             │
│  4. 提现                                                   │
│     TronYieldAggregator → JustLend.redeem(jUSDT)           │
│     jUSDT → USDT → 用户                                    │
│                                                             │
│  5. 收益分配（可选）                                        │
│     TronYieldAggregator → 按比例分配给多个受益人             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 核心功能

#### 自动存款与质押
```solidity
function deposit(address token, uint256 amount)
    external
    nonReentrant
    whenNotPaused
    validToken(token)
```
- 用户存入TRC20代币
- 合约自动质押到JustLend
- 获得jToken生息资产

#### 灵活提现
```solidity
function withdraw(address token, uint256 amount)
    external
    nonReentrant
    whenNotPaused
    validToken(token)
    returns (uint256 withdrawnAmount, uint256 principalAmount, uint256 interestAmount)
```
- 支持部分提现或全额提现
- 自动计算本金vs利息部分
- 实时查询账户余额

#### 收益分配
```solidity
function distributeYield(
    address token,
    YieldRecipient[] memory recipients
) external
```
- 按百分比分配收益
- 支持固定金额分配
- 可配置多个受益人

#### 收益追踪
```solidity
function getMerchantBalance(address merchant, address token)
    external
    view
    returns (uint256 balance, uint256 principal, uint256 interest)
```
- 实时APY查询
- 本金vs利息追踪
- 历史累积收益统计

---

## 3. 合约接口详解

### 3.1 存款功能

#### deposit()
```solidity
/**
 * @notice 将代币存入收益聚合器（自动质押到JustLend）
 * @param token 代币地址（USDT、USDC等）
 * @param amount 存款金额（代币小数位，如USDT为6位）
 */
function deposit(address token, uint256 amount) external;
```

**使用示例：**
```javascript
// 存入1000 USDT
const usdtAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const amount = BigInt(1000 * 1e6); // 1000 USDT (6位小数)

await aggregator.deposit(usdtAddress, amount, {
    from: merchantAddress
});

// 事件监听
aggregator.events.Deposited()
    .on('data', (event) => {
        const {
            merchant,
            token,
            amount,
            principal,
            timestamp
        } = event.returnValues;
        console.log(`Merchant ${merchant} deposited ${amount} ${token}, principal: ${principal}`);
    });
```

### 3.2 提现功能

#### withdraw()
```solidity
/**
 * @notice 从收益聚合器提现代币（从JustLend赎回）
 * @param token 代币地址
 * @param amount 提现金额，0 = 提现全部
 * @return withdrawnAmount 实际提现金额
 * @return principalAmount 本金部分
 * @return interestAmount 利息部分
 */
function withdraw(address token, uint256 amount)
    external
    returns (uint256 withdrawnAmount, uint256 principalAmount, uint256 interestAmount);
```

**使用示例：**
```javascript
// 提现全部USDT
const { withdrawnAmount, principalAmount, interestAmount } = await aggregator.withdraw(
    usdtAddress,
    0, // 0 = 全部提现
    { from: merchantAddress }
);

console.log(`Withdrawn: ${Number(withdrawnAmount)/1e6} USDT`);
console.log(`Principal: ${Number(principalAmount)/1e6} USDT`);
console.log(`Interest: ${Number(interestAmount)/1e6} USDT`);
```

### 3.3 收益查询

#### getMerchantBalance()
```solidity
/**
 * @notice 获取商户余额（本金+利息）
 * @param merchant 商户地址
 * @param token 代币地址
 * @return balance 总余额
 * @return principal 本金
 * @return interest 累积利息
 */
function getMerchantBalance(address merchant, address token)
    external
    view
    returns (uint256 balance, uint256 principal, uint256 interest);
```

**使用示例：**
```javascript
const [balance, principal, interest] = await aggregator.getMerchantBalance(
    merchantAddress,
    usdtAddress
);

console.log(`Total Balance: ${Number(balance)/1e6} USDT`);
console.log(`Principal: ${Number(principal)/1e6} USDT`);
console.log(`Earned Interest: ${Number(interest)/1e6} USDT`);

// 计算收益率
const yieldPercentage = (Number(interest) / Number(principal)) * 100;
console.log(`Yield: ${yieldPercentage.toFixed(2)}%`);
```

#### getTokenAPY()
```solidity
/**
 * @notice 获取代币当前的APY
 * @param token 代币地址
 * @return apy 当前APY（×1e18，如1e17 = 10%）
 * @return exchangeRate 当前jToken汇率
 */
function getTokenAPY(address token)
    external
    view
    returns (uint256 apy, uint256 exchangeRate);
```

**使用示例：**
```javascript
const [apy, exchangeRate] = await aggregator.getTokenAPY(usdtAddress);

const apyPercentage = (Number(apy) / 1e16) / 100; // 转换为百分比
console.log(`Current APY: ${apyPercentage.toFixed(2)}%`);
console.log(`Exchange Rate: ${Number(exchangeRate)/1e18}`);
```

### 3.4 收益分配

#### distributeYield()
```solidity
/**
 * @notice 将累积收益分配给多个受益人
 * @param token 代币地址
 * @param recipients 受益人数组（可按百分比或固定金额）
 */
function distributeYield(address token, YieldRecipient[] memory recipients) external;
```

**使用示例：**
```javascript
// 按百分比分配收益（总100%）
const recipients = [
    {
        account: '0xBeneficiary1...',
        percentage: 6000,  // 60%
        fixedAmount: 0
    },
    {
        account: '0xBeneficiary2...',
        percentage: 4000,  // 40%
        fixedAmount: 0
    }
];

await aggregator.distributeYield(usdtAddress, recipients, {
    from: merchantAddress
});

// 按固定金额分配收益
const fixedRecipients = [
    {
        account: '0xBeneficiary1...',
        percentage: 0,
        fixedAmount: BigInt(100 * 1e6) // 100 USDT
    },
    {
        account: '0xBeneficiary2...',
        percentage: 0,
        fixedAmount: BigInt(50 * 1e6)  // 50 USDT
    }
];

await aggregator.distributeYield(usdtAddress, fixedRecipients, {
    from: merchantAddress
});
```

---

## 4. 部署流程

### 前置要求

```
1. TRON账户余额充足（用于部署和测试）
   - 主网：至少100 TRX
   - Nile测试网：至少1000 TRX

2. JustLend协议地址
   - 主网JustLend: TDyvndW...
   - 主网Unitroller: THjzj3qy...
   - 主网Oracle: T9yDxG...

3. TRC20代币
   - USDT: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
   - USDC: TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8
```

### 部署脚本

```typescript
// scripts/deploy-yield-aggregator.ts
import hre from "hardhat";
import { ethers } from "hardhat";

async function main() {
  console.log("Deploying TRON Yield Aggregator to Nile Testnet...");

  const [deployer] = await hre.ethers.getSigners();

  // JustLend addresses (Nile Testnet)
  const justLendAddress = "0x..."; // MockJustLend for testing
  const unitrollerAddress = "0x...";
  const oracleAddress = "0x...";

  // Mock TRC20 tokens
  const [usdtMock, _] = await hre.ethers.getContractFactory("MockTRC20");
  const usdt = await usdtMock.deploy("Tether USD", "USDT", 6, ethers.parseUnits("1000000", 6));
  await usdt.waitForDeployment();
  console.log("Mock USDT deployed to:", await usdt.getAddress());

  // Mock JustLend
  const [justLendMock, _] = await hre.ethers.getContractFactory("MockJustLend");
  const justLend = await justLendMock.deploy();
  await justLend.waitForDeployment();
  console.log("MockJustLend deployed to:", await justLend.getAddress());

  // Mock Unitroller
  const [unitrollerMock, _] = await hre.ethers.getContractFactory("MockUnitroller");
  const unitroller = await unitrollerMock.deploy();
  await unitroller.waitForDeployment();
  console.log("MockUnitroller deployed to:", await unitroller.getAddress());

  // Mock Price Oracle
  const [oracleMock, _] = await hre.ethers.getContractFactory("MockPriceOracle");
  const oracle = await oracleMock.deploy();
  await oracle.waitForDeployment();
  console.log("MockOracle deployed to:", await oracle.getAddress());

  // Mock JustToken (USDT)
  const [justTokenMock, _] = await hre.ethers.getContractFactory("MockJustToken");
  const justToken = await justTokenMock.deploy(
    "Just USDT",
    "jUSDT",
    await usdt.getAddress(),
    1e18 // Initial exchange rate = 1.0
  );
  await justToken.waitForDeployment();
  console.log("MockJustToken deployed to:", await justToken.getAddress());

  // Configure Mocks
  await justLend.addSupportedToken(await usdt.getAddress(), await justToken.getAddress());
  await oracle.setupDefaultPrices(
    await justToken.getAddress(),
    ethers.ZeroAddress,
    ethers.ZeroAddress
  );

  // Deploy YieldAggregator
  const YieldAggregator = await hre.ethers.getContractFactory("TronYieldAggregator");
  const aggregator = await YieldAggregator.deploy(
    await justLend.getAddress(),
    await unitroller.getAddress(),
    await oracle.getAddress(),
    [await usdt.getAddress()],
    [await justToken.getAddress()]
  );
  await aggregator.waitForDeployment();
  console.log("TronYieldAggregator deployed to:", await aggregator.getAddress());

  // Setup: Transfer USDT to aggregator for initial liquidity
  await usdt.transfer(
    await aggregator.getAddress(),
    ethers.parseUnits("100000", 6) // 100,000 USDT
  );
  console.log("Transferred 100,000 USDT to aggregator");

  console.log("\nDeployment Summary:");
  console.log("-" .repeat(50));
  console.log(`USDT:           ${await usdt.getAddress()}`);
  console.log(`JustLend:       ${await justLend.getAddress()}`);
  console.log(`Unitroller:     ${await unitroller.getAddress()}`);
  console.log(`Oracle:         ${await oracle.getAddress()}`);
  console.log(`JustToken:      ${await justToken.getAddress()}`);
  console.log(`YieldAggregator:${await aggregator.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

### 运行部署

```bash
# 编译合约
npx hardhat compile

# 部署到Nile测试网
npx hardhat run scripts/deploy-yield-aggregator.ts --network tron_nile

# 部署到主网
npx hardhat run scripts/deploy-yield-aggregator.ts --network tron_mainnet
```

---

## 5. 使用场景

### 5.1 商户闲置资金收益

```javascript
// 商户A有100,000 USDT闲置
const aggregator = new ethers.Contract(aggregatorAddress, aggregatorABI, wallet);

// 1. 存款到收益聚合器
await aggregator.deposit(
    usdtAddress,
    ethers.parseUnits("100000", 6),  // 100,000 USDT
    { gasLimit: 500000 }
);

// 2. 1年后查询收益
const [balance, principal, interest] = await aggregator.getMerchantBalance(
    merchantAddress,
    usdtAddress
);

// 预期结果：
// balance ≈ 100800 USDT
// principal = 100000 USDT
// interest ≈ 800 USDT (0.8% APY)
```

### 5.2 跨链资金池统一管理

```javascript
// 在不同链上存款（TRON、Ethereum、Base）
const tronAggregator = new ethers.Contract(tronAggregatorAddress, tronABI, tronWallet);
const ethAggregator = new ethers.Contract(ethAggregatorAddress, ethABI, ethWallet);

// TRON: 存入USDT
await tronAggregator.deposit(usdtAddress, ethers.parseUnits("50000", 6));

// Ethereum: 存入USDC
await ethAggregator.deposit(usdcAddress, ethers.parseUnits("50000", 6));

// Base: 存入USDC
await baseAggregator.deposit(usdcAddress, ethers.parseUnits("50000", 6));

// 统一查询余额
const tronBalance = await tronAggregator.getMerchantBalance(merchantAddress, usdtAddress);
const ethBalance = await ethAggregator.getMerchantBalance(merchantAddress, usdcAddress);
const baseBalance = await baseAggregator.getMerchantBalance(merchantAddress, usdcAddress);

console.log(`TRON Balance:  ${tronBalance.balance/1e6} USDT`);
console.log(`ETH Balance:   ${ethBalance.balance/1e18} USDC`);
console.log(`Base Balance:  ${baseBalance.balance/1e6} USDC`);
```

### 5.3 自动化收益分配

```javascript
// 商户B将40%收益分配给子账户，60%保留
const recipients = [
    {
        account: subAccount1,
        percentage: 2000, // 20%
        fixedAmount: 0
    },
    {
        account: subAccount2,
        percentage: 2000, // 20%
        fixedAmount: 0
    },
    {
        account: mainAccount,
        percentage: 6000, // 60%
        fixedAmount: 0
    }
];

// 定期执行收益分配（例如每月1号）
await aggregator.distributeYield(usdtAddress, recipients);

// 验证分配结果
for (const recipient of recipients) {
    const [balance] = await aggregatorWithSigner.getMerchantBalance(
        recipient.account,
        usdtAddress
    );
    console.log(`${recipient.account}: ${balance/1e6} USDT`);
}
```

### 5.4 紧急资金提取

```javascript
// 在市场波动时紧急提取所有资金
const [withdrawnAmount, principalAmount, interestAmount] = await aggregator.withdraw(
    usdtAddress,
    0, // 0 = 全部提取
    { gasLimit: 800000 }
);

console.log(`Withdrawn: ${withdrawnAmount/1e6} USDT`);
console.log(`Principal: ${principalAmount/1e6} USDT`);
console.log(`Interest: ${interestAmount/1e6} USDT`);
```

---

## 6. 收益机制详解

### 6.1 JustLend收益来源

| 来源 | 机制 | APY范围 |
|------|------|---------|
| **借贷利差** | 借款人支付利息 → 存款人获得收益 | 1-3% |
| **TRX质押** | 质押TRX验证区块 → 分享区块奖励 | 0.5-2% |
| **JUST挖矿** | 治理代币JUST -> 质押者共享 | 0.2-1% |
| **Compliance奖励** | 符合合规要求 → 额外奖励 | 0.1-0.5% |

### 6.2 收益计算示例

#### 单利计算（简化）
```
本金 = 10,000 USDT
每日收益率 = 0.003%（年化 1.1%）

30天后：
总收益 = 10,000 * 0.003% * 30 = 9 USDT
总余额 = 10,000 + 9 = 10,009 USDT
```

#### 复利计算（实际）
```
本金 = 10,000 USDT
APY = 1.1%

1年后（复利）：
总余额 = 10,000 * (1 + 0.011)^1 ≈ 10,110 USDT
综合收益 ≈ 1.1%
```

### 6.3 APY查询与监控

```javascript
// 定期监控APY变化
setInterval(async () => {
    const [apy] = await aggregator.getTokenAPY(usdtAddress);
    const apyPercentage = (Number(apy) / 1e16) / 100;

    console.log(`[${new Date().toISOString()}] USDT APY: ${apyPercentage.toFixed(4)}%`);

    // 如果APY显著下降，发送通知
    if (apyPercentage < 0.5) {
        console.warn("USDT APY below 0.5% - consider alternative strategies");
        // 发送Webhook/通知
    }
}, 3600000); // 每小时
```

---

## 7. 安全机制

### 7.1 合约安全特性

| 特性 | 实现 | 目的 |
|------|------|------|
| 重入保护 | `nonReentrant` 修饰符 | 防止重入攻击 |
| 暂停机制 | `depositPaused` `withdrawalPaused` | 紧急情况下可暂停操作 |
| 仅所有者配置 | `onlyOwner` 修饰符 | 防止未授权修改 |
| 代币白名单 | `tokenConfigs` 映射 | 仅支持经过验证的代币 |
| 余额验证 | 多处余额检查 | 防止超额提现 |

### 7.2 最佳实践

#### 密钥管理
```javascript
// 使用多重签名控制YieldAggregator
// 2/3签名模式：
// - 管理员A：日常维护
// - 管理员B：应急响应
// - 管理员C：监督审计

// 配置多签钱包
const multisigAddress = 'TMultisig...';
const aggregator = new ethers.Contract(
    aggregatorAddress,
    aggregatorABI,
    multisigWallet // 使用多签钱包签名
);
```

#### 风险管理
```javascript
// 1. 分散存款代币
const tokens = [usdtAddress, usdcAddress, wbtcAddress];
const amountPerToken = ethers.parseUnits("100000", 6); // 100,000 USDT

for (const token of tokens) {
    await aggregator.deposit(token, amountPerToken);
}

// 2. 设置收益分发阈值
// 累积利息 > 10,000 USDT才分发
if (interestAmount > ethers.parseUnits("10000", 6)) {
    await aggregator.distributeYield(usdtAddress, recipients);
}

// 3. 定期审计余额
setInterval(async () => {
    const stats = await aggregator.getStats();
    console.log(`Active Merchants: ${stats[0]}`);
    console.log(`TVL: $${Number(stats[3]) / 1e18} USD`);

    // 如果TVL异常，发送警报
    if (Number(stats[3]) < expectedMinTVL) {
        console.error("TVL dropped below expected minimum!");
        // 发送紧急通知
    }
}, 86400000); // 每天检查
```

---

## 8. 事件监听与监控

### 8.1 Web3事件监听

```javascript
// 监听存款事件
aggregator.events.Deposited({
    filter: { merchant: merchantAddress }
})
.on('data', (event) => {
    const { token, amount, principal, timestamp } = event.returnValues;
    console.log(`[Deposit] ${amount/1e6} ${token}, Principal: ${principal/1e6}`);

    // 更新数据库/仪表板
    updateDashboard({
        action: 'deposit',
        amount: amount,
        token,
        timestamp
    });
})
.on('error', console.error);

// 监听提现事件
aggregator.events.Withdrawn({
    filter: { merchant: merchantAddress }
})
.on('data', (event) => {
    const { amount, principal, interest, newPrincipal } = event.returnValues;
    console.log(`[Withdraw] ${amount/1e6} USDT`);
    console.log(`  Principal: ${principal/1e6} USDT`);
    console.log(`  Interest:  ${interest/1e6} USDT`);
    console.log(`  New Principal: ${newPrincipal/1e6} USDT`);
});

// 监听收益分配事件
aggregator.events.YieldDistributed({
    filter: { merchant: merchantAddress }
})
.on('data', (event) => {
    const { totalInterest, recipientCount, timestamp } = event.returnValues;
    console.log(`[Yield] Distributed ${totalInterest/1e6} USDT to ${recipientCount} recipients`);
});
```

### 8.2 实时收益追踪

```javascript
class YieldTracker {
    constructor(aggregator, merchant, token) {
        this.aggregator = aggregator;
        this.merchant = merchant;
        this.token = token;
        this.lastSnapshot = null;
    }

    async getSnapshot() {
        const [balance, principal, interest] = await this.aggregator.getMerchantBalance(
            this.merchant,
            this.token
        );
        const apy = await this.aggregator.getTokenAPY(this.token);

        return {
            timestamp: Date.now(),
            balance: balance,
            principal: principal,
            interest: interest,
            apy: apy[0],
            exchangeRate: apy[1],
            yieldRate: principal > 0 ? (Number(interest) / Number(principal)) * 100 : 0
        };
    }

    async trackGrowth(intervalMs = 3600000) {
        this.lastSnapshot = await this.getSnapshot();

        setInterval(async () => {
            const current = await this.getSnapshot();
            this.lastSnapshot = await this.growthAnalysis(this.lastSnapshot, current);
        }, intervalMs);
    }

    async growthAnalysis(previous, current) {
        const timeDiff = (current.timestamp - previous.timestamp) / 1000 / 3600; // hours
        const balanceDiff = Number(current.balance) - Number(previous.balance);
        const interestDiff = Number(current.interest) - Number(previous.interest);

        const hourlyYield = (interestDiff / Number(principal)) * 100;
        const apy = hourlyYield * 24 * 365;

        console.log(`\n=== Growth Analysis (${timeDiff.toFixed(1)}h) ===`);
        console.log(`Balance Change:  ${balanceDiff/1e6} USDT`);
        console.log(`Interest Earned: ${interestDiff/1e6} USDT`);
        console.log(`Hourly Yield:    ${hourlyYield.toFixed(4)}%`);
        console.log(`APY Estimate:   ${apy.toFixed(2)}%`);

        return current;
    }
}

// 使用
const tracker = new YieldTracker(aggregator, merchantAddress, usdtAddress);
await tracker.trackGrowth(3600000); // 每小时追踪
```

---

## 9. 测试指南

### 9.1 单元测试

```typescript
// test/TronYieldAggregator.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";

describe("TronYieldAggregator", function () {
  let aggregator, usdt, justLend, oracle, unitroller, justToken;
  let owner, merchant1, merchant2;

  beforeEach(async function () {
    [owner, merchant1, merchant2] = await ethers.getSigners();

    // Deploy mock contracts
    const MockUSDT = await ethers.getContractFactory("MockTRC20");
    usdt = await MockUSDT.deploy("Tether USD", "USDT", 6, ethers.parseUnits("1000000", 6));

    const MockJustLend = await ethers.getContractFactory("MockJustLend");
    justLend = await MockJustLend.deploy();

    const MockUnitroller = await ethers.getContractFactory("MockUnitroller");
    unitroller = await MockUnitroller.deploy();

    const MockOracle = await ethers.getContractFactory("MockPriceOracle");
    oracle = await MockOracle.deploy();

    const MockJustToken = await ethers.getContractFactory("MockJustToken");
    justToken = await MockJustToken.deploy("Just USDT", "jUSDT", await usdt.getAddress(), 1e18);

    // Configure mocks
    await justLend.addSupportedToken(await usdt.getAddress(), await justToken.getAddress());
    await oracle.setupDefaultPrices(
      await justToken.getAddress(),
      ethers.ZeroAddress,
      ethers.ZeroAddress
    );

    // Deploy YieldAggregator
    const YieldAggregator = await ethers.getContractFactory("TronYieldAggregator");
    aggregator = await YieldAggregator.deploy(
      await justLend.getAddress(),
      await unitroller.getAddress(),
      await oracle.getAddress(),
      [await usdt.getAddress()],
      [await justToken.getAddress()]
    );
  });

  it("Should deposit USDT and stake in JustLend", async function () {
    const depositAmount = ethers.parseUnits("1000", 6);

    // Approve and deposit
    await usdt.connect(merchant1).approve(await aggregator.getAddress(), depositAmount);
    await aggregator.connect(merchant1).deposit(await usdt.getAddress(), depositAmount);

    // Verify deposit
    const [balance, principal] = await aggregator.getMerchantBalance(
      merchant1.address,
      await usdt.getAddress()
    );

    expect(balance).to.equal(depositAmount);
    expect(principal).to.equal(depositAmount);
  });

  it("Should earn interest over time", async function () {
    const depositAmount = ethers.parseUnits("10000", 6);

    await usdt.connect(merchant1).approve(await aggregator.getAddress(), depositAmount);
    await aggregator.connect(merchant1).deposit(await usdt.getAddress(), depositAmount);

    // Simulate interest accrual
    await justToken.setExchangeRate(1010000000000000000); // Exchange rate increases by 1%

    // Check balance with interest
    const [balance, principal] = await aggregator.getMerchantBalance(
      merchant1.address,
      await usdt.getAddress()
    );

    expect(balance).to.be.gt(principal); // Balance > Principal (interest earned)
    console.log(`Interest: ${balance - principal}`);
  });

  it("Should withdraw principal and interest", async function () {
    const depositAmount = ethers.parseUnits("5000", 6);

    await usdt.connect(merchant1).approve(await aggregator.getAddress(), depositAmount);
    await aggregator.connect(merchant1).deposit(await usdt.getAddress(), depositAmount);

    // Simulate interest
    await justToken.setExchangeRate(1005000000000000000); // 0.5% increase

    // Withdraw all
    const [withdrawn, principal, interest] = await aggregator
      .connect(merchant1)
      .withdraw(await usdt.getAddress(), 0);

    expect(withdrawn).to.be.gte(principal); // Withdrawn >= Principal
    expect(interest).to.be.gt(0); // Interest > 0
  });

  it("Should distribute yield to multiple recipients", async function () {
    const depositAmount = ethers.parseUnits("10000", 6);

    await usdt.connect(merchant1).approve(await aggregator.getAddress(), depositAmount);
    await aggregator.connect(merchant1).deposit(await usdt.getAddress(), depositAmount);

    // Simulate interest
    await justToken.setExchangeRate(1020000000000000000); // 2% increase

    // Set recipients
    const recipients = [
      {
        account: merchant2.address,
        percentage: 6000,
        fixedAmount: 0
      },
      {
        account: owner.address,
        percentage: 4000,
        fixedAmount: 0
      }
    ];

    // Distribute yield
    await aggregator
      .connect(merchant1)
      .distributeYield(await usdt.getAddress(), recipients);

    // Verify recipients received tokens
    const merchant2Balance = await usdt.balanceOf(merchant2.address);
    const ownerBalance = await usdt.balanceOf(owner.address);

    expect(merchant2Balance).to.be.gt(0);
    expect(ownerBalance).to.be.gt(0);

    console.log(`Merchant2 received: ${merchant2Balance/1e6} USDT`);
    console.log(`Owner received: ${ownerBalance/1e6} USDT`);
  });
});
```

### 9.2 运行测试

```bash
# 运行所有测试
npx hardhat test test/TronYieldAggregator.test.ts

# 运行测试覆盖率
npx hardhat coverage --testfiles "test/TronYieldAggregator.test.ts"

# 详细输出
npx hardhat test test/TronYieldAggregator.test.ts --verbose
```

---

## 10. 性能优化

### 10.1 Gas优化

| 操作 | Gas消耗 | 优化建议 |
|------|---------|---------|
| deposit() | ~250,000 | 批量存款可节省 |
| withdraw() | ~300,000 | 部分提现比全额提现更省gas |
| distributeYield() | ~500,000 | 减少受益人数量 |
| getMerchantBalance() | ~10,000（view） | 使用事件缓存查询 |

### 10.2 批量操作

```javascript
// 批量存款（多个代币）
const tokens = [usdtAddress, usdcAddress, wbtcAddress];
const amounts = [
    ethers.parseUnits("50000", 6),   // 50,000 USDT
    ethers.parseUnits("50000", 6),   // 50,000 USDC
    ethers.parseUnits("1", 18)        // 1 WBTC
];

// 并行授权
const approvePromises = tokens.map((token, i) =>
    ITRC20(token).approve(aggregatorAddress, amounts[i])
);
await Promise.all(approvePromises);

// 顺序存款（避免nonce冲突）
for (let i = 0; i < tokens.length; i++) {
    await aggregator.deposit(tokens[i], amounts[i]);
}
```

---

## 11. 监控与告警

### 11.1 Prometheus指标

```javascript
// 集成Prometheus监控
const promClient = require('prom-client');

// 定义指标
const depositCounter = new promClient.Counter({
    name: 'tron_yield_deposit_total',
    help: 'Total deposits in Tron Yield Aggregator',
    labelNames: ['token', 'merchant']
});

const withdrawalCounter = new promClient.Counter({
    name: 'tron_yield_withdrawal_total',
    help: 'Total withdrawals from Tron Yield Aggregator',
    labelNames: ['token', 'merchant']
});

const interestGauge = new promClient.Gauge({
    name: 'tron_yield_interest_accrued',
    help: 'Total interest accrued by merchants',
    labelNames: ['merchant', 'token']
});

const tvlGauge = new promClient.Gauge({
    name: 'tron_yield_tvl',
    help: 'Total Value Locked in Tron Yield Aggregator',
    labelNames: ['token']
});

// 更新指标
async function updateMetrics() {
    const stats = await aggregator.getStats();
    const tvl = stats[3];

    // TVL
    tvlGauge.set({ token: 'USDT' }, Number(tvl) / 1e18);

    // 每个商户的利息
    const merchants = ['0x...', '0x...'];
    for (const merchant of merchants) {
        const [balance, principal, interest] = await aggregator.getMerchantBalance(
            merchant,
            usdtAddress
        );
        interestGauge.set({ merchant, token: 'USDT' }, Number(interest) / 1e6);
    }
}

// 暴露metrics端点
// Express.js示例
app.get('/metrics', async (req, res) => {
    await updateMetrics();
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
});
```

### 11.2 告警规则

```yaml
# prometheus-alerts.yml
groups:
  - name: tron_yield_aggregator
    rules:
      - alert: LowAPY
        expr: tron_yield_apy < 0.5
        for: 24h
        annotations:
          summary: "USDT APY below 0.5% for 24 hours"
          description: "Current APY is {{ $value }}%, consider alternative strategies"

      - alert: HighWithdrawalRate
        expr: rate(tron_yield_withdrawal_total[1h]) > 10
        annotations:
          summary: "High withdrawal rate detected (10+ per hour)"
          description: "User confidence may be dropping"

      - alert: UnexpectedTVDrop
        expr: (prev(tron_yield_tvl[1h]) - tron_yield_tvl) / prev(tron_yield_tvl[1h]) > 0.5
        annotations:
          summary: "TVL dropped by > 50% in 1 hour"
          description: "May indicate security issue or protocol problem"
```

---

## 12. 常见问题（FAQ）

### Q1: JustLend APY如何计算？
JustLend APY = supplyRatePerBlock × blocksPerYear × 100

TRON区块时间 = 3秒/块
每年区块数 = 365 × 24 × 3600 / 3 = 10,512,000块

示例：
- supplyRatePerBlock = 0.0000000001 (1e-10)
- APY = 1e-10 × 10,512,000 × 100 = 0.1051% ≈ 0.11%

### Q2: 利息多久复利一次？
JustLend的jToken汇率持续增长（每个区块更新），实质上是**每3秒复利一次**。

### Q3: 提现需要多长时间？
- 普通提现：~5-10秒（1-2个区块）
- 大额提现：可能需要更多时间（Gas限制）

### Q4: 如果JustLend协议出现问题怎么办？
收益聚合器有暂停机制，管理员可暂停提现：
```javascript
// 暂停提现
await aggregator.pauseWithdrawals();

// 紧急取款（仅所有者）
await aggregator.emergencyWithdraw(usdtAddress, safeWallet, amount);
```

### Q5: 支持哪些链？
Yield Aggregator当前仅支持TRON主网和Nile测试网。跨链版本开发中。

### Q6: 收益是否可以再质押？
支持！启用autoCompound功能后，收益会自动再质押到JustLend，实现复利增长。

---

## 13. 相关资源

- [JustLend官方文档](https://justlend.org)
- [TRON开发者文档](https://developers.tron.network)
- [JustLend主网](https://justlend.org/)
- [JustLend Nile测试网](https://testnet.justlend.org/)
- [TRONScan浏览器](https://tronscan.org)
- [Nile测试网浏览器](https://nile.tronscan.org)

---

## 14. 更新日志

### v1.0.0 (2026-02-08)
- ✅ 实现`IJustLend.sol` - JustLend协议接口
- ✅ 实现`TronYieldAggregator.sol` - 收益聚合器主合约
- ✅ 实现`Mocks.sol` - 测试Mock合约
- ✅ 完整文档和使用示例
- ✅ 支持USDT、USDC、TRX等代币
- ✅ 收益分配功能
- ✅ 收益追踪和APY查询

---

## 15. 许可证

MIT License
