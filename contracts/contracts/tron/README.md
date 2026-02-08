# TRON Smart Contracts

TRON区块链智能合约集合，为Protocol Banks提供TRC20支付、多签金库、自动分账和收益聚合功能。

## 概览

| 合约 | 描述 | 状态 |
|------|------|------|
| `ITRC20.sol` | TRC20代币接口标准 | ✅ 完成 |
| `TronPaymentVault.sol` | 多签支付金库 | ✅ 完成 |
| `TronPaymentSplitter.sol` | 自动分账合约 | ✅ 完成 |
| `IJustLend.sol` | JustLend协议接口 | ✅ 完成 |
| `TronYieldAggregator.sol` | 收益聚合器 | ✅ 完成 |
| `Mocks.sol` | 测试Mock合约 | ✅ 完成 |

---

## 1. ITRC20.sol - TRC20代币接口

### 描述

TRON区块链兼容的ERC20代币接口标准。虽然TRON使用Base58地址格式（T前缀），但智能合约内部仍使用20字节地址（与以太坊相同）。

### 功能

- 标准ERC20函数：`transfer`, `approve`, `transferFrom`, `balanceOf`, `allowance`
- 元数据函数：`name`, `symbol`, `decimals`
- 事件：`Transfer`, `Approval`

### 使用示例

```solidity
import "./ITRC20.sol";

contract MyContract {
    ITRC20 public usdt;

    constructor(address _usdtAddress) {
        usdt = ITRC20(_usdtAddress);
    }

    function transfer(address to, uint256 amount) external {
        usdt.transfer(to, amount);
    }
}
```

---

## 2. TronPaymentVault.sol - 多签支付金库

### 描述

为企业级支付提供安全的TRC20代币多签管理，支持时间锁、每日限额和紧急恢复机制。

### 核心功能

#### 多签机制
- **签名者管理**：添加/移除签名者，动态调整阈值
- **支付提案**：签名者提交支付提案
- **支付审批**：达到阈值后任何人都可执行支付

#### 安全控制
- **时间锁**：支付提议后需等待一定时间才能执行（默认24小时）
- **每日限额**：防止单日被彻底清空
- **可暂停**：监护人可暂停合约
- **紧急取款**：时间锁保护的紧急取款机制

### 功能函数

#### 支付提案与执行

```solidity
// 1. 提议支付（签名者）
function proposePayment(
    address token,      // TRC20代币地址
    address to,         // 接收地址
    uint256 amount,     // 金额
    bytes calldata data // 可选调用数据
) external onlySigner returns (uint256 paymentId)

// 2. 批准支付（签名者）
function approvePayment(uint256 paymentId) external onlySigner

// 3. 执行支付（任何人）
function executePayment(uint256 paymentId) external whenNotPaused

// 4. 取消支付（签名者）
function cancelPayment(uint256 paymentId) external onlySigner
```

#### 签名者管理

```solidity
// 添加签名者
function addSigner(address newSigner) external onlySigner

// 移除签名者
function removeSigner(address signer) external onlySigner

// 更新阈值
function updateThreshold(uint256 newThreshold) external onlySigner
```

#### 紧急机制

```solidity
// 暂停合约
function pause() external onlyGuardian

// 恢复合约
function unpause() external onlyGuardian

// 请求紧急取款
function requestEmergencyWithdrawal(
    address to,
    address token,
    uint256 amount
) external onlyGuardian

// 执行紧急取款
function executeEmergencyWithdrawal(
    address to,
    address token,
    uint256 amount,
    uint256 requestTimestamp
) external onlyGuardian
```

### 事件

| 事件 | 描述 |
|------|------|
| `PaymentProposed` | 支付提议创建 |
| `PaymentApproved` | 支付获得批准 |
| `PaymentExecuted` | 支付已执行 |
| `PaymentCancelled` | 支付已取消 |
| `SignerAdded` | 签名者添加 |
| `SignerRemoved` | 签名者移除 |
| `ThresholdUpdated` | 阈值更新 |
| `VaultPaused` | 合约暂停 |
| `VaultUnpaused` | 合约恢复 |
| `EmergencyWithdrawalRequested` | 紧急取款请求 |
| `EmergencyWithdrawalExecuted` | 紧急取款执行 |

### 部署示例

```javascript
// 使用TronWeb部署
const TronWeb = require('tronweb');
const tronWeb = new TronWeb({
    fullNode: 'https://api.trongrid.io',
    solidityNode: 'https://api.trongrid.io',
    eventServer: 'https://api.trongrid.io'
});

// 合约字节码和ABI
const contract = tronWeb.contract(abi, bytecode);

// 部署参数
const initialSigners = [
    'TAddress1...',
    'TAddress2...',
    'TAddress3...'
];
const threshold = 2; // 需要2/3签名
const guardian = 'TGuardianAddress...';
const supportedTokens = [
    'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', // USDT
    'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8'  // USDC
];
const timelock = 86400; // 24小时
const dailyLimit = 1000000 * 1e6; // 每天100万USDT

// 部署
const instance = await contract.deploy(
    initialSigners,
    threshold,
    guardian,
    supportedTokens,
    timelock,
    dailyLimit
).send({
    shouldPollResponse: true,
    from: tronWeb.defaultAddress.base58
});

console.log('Vault deployed at:', instance.address);
```

### 使用场景

1. **企业资金管理**：需要多个审批才能支付
2. **项目团队**：多签资金安全
3. **DAO治理**：提案+投票模式
4. **安全存储**：时间锁+每日限额双重保护

---

## 3. TronPaymentSplitter.sol - 自动分账合约

### 描述

自动将接收的TRC20代币分发给多个受益人，支持百分比、固定金额和分层三种分账模式。

### 分账模式

#### 1. 百分比分账 (`Percentage`)
每个受益人按百分比获得份额（总和必须为100%）

```
例子：10000 USDT分账
├── 受益人A (50%)  → 5000 USDT
├── 受益人B (30%)  → 3000 USDT
└── 受益人C (20%)  → 2000 USDT
```

#### 2. 固定金额分账 (`Fixed`)
每个受益人获得固定金额

```
例子：10000 USDT分账
├── 受益人A (4000) → 4000 USDT
├── 受益人B (3000) → 3000 USDT
└── 受益人C (剩余) → 3000 USDT
```

#### 3. 分层分账 (`Tiered`)
根据分层级别分配份额

```
例子：10000 USDT分账
├── 受益人A (Tier 3) → 50%
├── 受益人B (Tier 2) → 33%
└── 受益人C (Tier 1) → 17%
```

### 功能函数

#### 分账管理

```solidity
// 创建分账
function createSplit(
    address token,                    // TRC20代币地址
    SplitMode mode,                   // 分账模式
    uint256 minAmount,                // 最小分账金额
    Beneficiary[] memory beneficiaries // 初始受益人
) external onlyOwner returns (uint256 splitId)

// 添加受益人
function addBeneficiary(
    uint256 splitId,
    Beneficiary memory beneficiary
) external onlyOwner

// 更新受益人
function updateBeneficiary(
    uint256 splitId,
    address beneficiaryAddress,
    uint256 newPercentage,
    uint256 newFixedAmount
) external onlyOwner

// 移除受益人
function removeBeneficiary(
    uint256 splitId,
    address beneficiaryAddress
) external onlyOwner
```

#### 分账执行

```solidity
// 执行分账（代币需事先授权）
function executeSplit(
    uint256 splitId,
    uint256 amount
) external validSplit(splitId)
```

#### 查询函数

```solidity
// 获取分账详情
function getSplit(uint256 splitId) external view returns (...)

// 获取受益人列表
function getBeneficiaries(uint256 splitId) external view returns (...)

// 计算预期分配
function calculateDistribution(uint256 splitId, uint256 amount)
    external view returns (uint256[] memory shares)
```

### 使用示例

#### 百分比分账

```javascript
// 创建分账配置
const beneficiaries = [
    { account: '0x...', percentage: 5000, fixedAmount: 0, tier: 0 }, // 50%
    { account: '0x...', percentage: 3000, fixedAmount: 0, tier: 0 }, // 30%
    { account: '0x...', percentage: 2000, fixedAmount: 0, tier: 0 }  // 20%
];

// USDT地址
const usdtAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// 创建分账
const splitId = await splitter.createSplit(
    usdtAddress,
    0, // SplitMode.Percentage
    1000 * 1e6, // 最小1000 USDT
    beneficiaries
).send({ from: deployerAddress });

// 执行分账（10000 USDT）
// 1. 先授权合约
await usdt.approve(splitter.address, 10000 * 1e6).send({ from: payerAddress });
// 2. 执行分账
await splitter.executeSplit(splitId, 10000 * 1e6).send({ from: payerAddress });
```

#### 固定金额分账

```javascript
const beneficiaries = [
    { account: '0x...', percentage: 0, fixedAmount: 4000 * 1e6, tier: 0 },
    { account: '0x...', percentage: 0, fixedAmount: 3000 * 1e6, tier: 0 },
    { account: '0x...', percentage: 0, fixedAmount: 2000 * 1e6, tier: 0 }
];

await splitter.createSplit(
    usdtAddress,
    1, // SplitMode.Fixed
    10000 * 1e6, // 最小10000 USDT
    beneficiaries
).send({ from: deployerAddress });
```

### 使用场景

1. **支付网关分账**：自动分配交易手续费
2. **合作伙伴分成**：按比例分配收益
3. **工资发放**：固定金额发放
4. **项目资金分配**：按层级分配资源
5. **收益分成**：按贡献度分配

### 事件

| 事件 | 描述 |
|------|------|
| `SplitCreated` | 分账创建 |
| `SplitExecuted` | 分账执行 |
| `BeneficiaryAdded` | 受益人添加 |
| `BeneficiaryUpdated` | 受益人更新 |
| `BeneficiaryRemoved` | 受益人移除 |
| `Claimed` | 受益人领取 |
| `SplitPaused` | 分账暂停 |
| `SplitUnpaused` | 分账恢复 |

---

## TRON智能合约开发指南

### TRON地址格式

TRON智能合约内部使用20字节地址（与以太坊相同），但在外部显示为Base58格式：

```
合约内部：0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2 (20字节)
外部显示：T7ZRcQd1m9v5Hg7tYcX1Y2Z3a4B5C6D7E8F9G0H1I (Base58, 34字符)
```

### TRON Gas机制

TRON使用**Energy**和**Bandwidth**而非传统的Gas：

- **Bandwidth**: 存储和传输数据（免费5000/天）
- **Energy**: 执行智能合约（冻结TRX获取）
- **TRX**: TRON原生代币（1 TRX ≈ 0.0001 USD）

### TRON兼容的Solidity特性

| 特性 | 支持 | 说明 |
|------|------|------|
| Solidity版本 | ≤ 0.8.20 | TRON TVM有版本限制 |
| ERC20标准 | ✅ | TRC20完全兼容 |
| ERC721标准 | ✅ | TRC721完全兼容 |
| OpenZeppelin | ✅ | 大部分可用 |
| 事件日志 | ✅ | 支持 indexed 索引 |
| 重入保护 | ✅ | `nonReentrant` 修饰符可用 |

### TRON与EVM的差异

| 特性 | EVM (以太坊) | TRON |
|------|-------------|------|
| 地址格式 | 0x前缀，42字符 | T前缀，Base58，34字符 |
| 原生代币 | ETH (18位小数) | TRX (6位小数) |
| Gas机制 | Gas消耗 + Gas价格 | Energy + Bandwidth |
| 区块时间 | ~12秒 | ~3秒 |
| 主网RPC | https://eth.llamarpc.com | https://api.trongrid.io |
| 测试网RPC | Sepolia | https://nile.trongrid.io |
| USDT代币 | ERC20 USDT (0xdAC17F...) | TRC20 USDT (TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t) |

---

## 部署流程

### 前提条件

1. 安装TronWeb
```bash
npm install tronweb
```

2. 获取TRON API密钥（可选）
```bash
# https://www.trongrid.io 注册免费API密钥
```

### 部署步骤

#### 1. 编译合约

```bash
cd contracts
npx hardhat compile
```

#### 2. 配置hardhat.config.ts

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

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
    tron_nile: {
      url: "https://nile.trongrid.io",
      accounts: [...] // 你的私钥
    },
    tron_mainnet: {
      url: "https://api.trongrid.io",
      accounts: [...]
    }
  }
};

export default config;
```

#### 3. 部署脚本

```typescript
// scripts/deploy-tron.ts
import hre from "hardhat";

async function main() {
  console.log("Deploying TRON contracts...");

  // 部署TronPaymentVault
  const Vault = await hre.ethers.getContractFactory("TronPaymentVault");
  const vault = await Vault.deploy(
    ["0x...", "0x...", "0x..."], // 签名者
    2, // 阈值
    "0x...", // 监护人
    ["TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"], // 支持的代币
    86400, // 时间锁
    1000000 * 1e6 // 每日限额
  );
  await vault.waitForDeployment();
  console.log("TronPaymentVault deployed to:", await vault.getAddress());

  // 部署TronPaymentSplitter
  const Splitter = await hre.ethers.getContractFactory("TronPaymentSplitter");
  const splitter = await Splitter.deploy(
    "0x...", // 所有者
    ["TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"] // 支持的代币
  );
  await splitter.waitForDeployment();
  console.log("TronPaymentSplitter deployed to:", await splitter.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

#### 4. 执行部署

```bash
# Nile测试网
npx hardhat run scripts/deploy-tron.ts --network tron_nile

# 主网
npx hardhat run scripts/deploy-tron.ts --network tron_mainnet
```

---

## 合约交互示例

### 使用TronWeb与合约交互

```javascript
const TronWeb = require('tronweb');

// 初始化
const tronWeb = new TronWeb({
    fullNode: 'https://nile.trongrid.io',
    solidityNode: 'https://nile.trongrid.io',
    eventServer: 'https://nile.trongrid.io'
});

// 连接到已部署的合约
const vaultAddress = 'TVaultAddress...';
const vault = await tronWeb.contract(abi, vaultAddress);

// 获取签名者
const signers = await vault.getSigners().call();
console.log('Signers:', signers);

// 提议支付
const paymentId = await vault.proposePayment(
    'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', // USDT
    'TRecipientAddress...',
    1000 * 1e6, // 1000 USDT
    '0x' // 空数据
).send({
    from: tronWeb.defaultAddress.base58
});
console.log('Payment proposed:', paymentId);

// 批准支付
await vault.approvePayment(paymentId).send({
    from: tronWeb.defaultAddress.base58
});

// 执行支付
await vault.executePayment(paymentId).send({
    from: tronWeb.defaultAddress.base58
});
```

### 事件监听

```javascript
// 监听支付执行事件
vault.events.PaymentExecuted()
    .on('data', (event) => {
        console.log('Payment executed:', event);
        const { paymentId, token, to, amount } = event.returnValues;
        console.log(`Payment ${paymentId}: ${amount} ${token} to ${to}`);
    })
    .on('error', console.error);
```

---

## 安全最佳实践

### 1. 多签配置

- **最小签名者**: 至少3个签名者
- **推荐阈值**: 2/3 或 3/5
- **签名者分布**: 不同地理位置、不同硬件钱包

### 2. 时间锁设置

| 风险等级 | 推荐时间锁 | 示例 |
|---------|-----------|------|
| 低风险（小额） | 1-4小时 | 常规支付 |
| 中风险（中额） | 24小时 | 团队协作 |
| 高风险（大额） | 3-7天 | 财务拨款 |

### 3. 每日限额

```
推荐的每日限额设置：
- 小型团队: 1000 - 5000 USD
- 中型团队: 10000 - 50000 USD
- 大型企业: 100000 - 500000 USD
```

### 4. 监护人机制

- 监护人应与管理员分离
- 监护人可暂停合约
- 紧急取款需要时间锁保护

### 5. 代币白名单

- 仅添加必要的TRC20代币
- 定期审查支持的代币列表
- 新代币加入前进行代码审计

---

## 测试

### 运行测试

```bash
# 运行所有测试
npx hardhat test

# 运行TRON特定测试
npx hardhat test test/TronPaymentVault.test.ts
npx hardhat test test/TronPaymentSplitter.test.ts

# 运行测试覆盖率
npx hardhat coverage
```

### 测试示例

```typescript
test("Should create and execute payment proposal", async function () {
  const [owner, signer1, signer2, recipient] = await ethers.getSigners();

  // 部署Vault
  const Vault = await ethers.getContractFactory("TronPaymentVault");
  const vault = await Vault.deploy(
    [signer1.address, signer2.address],
    2, // 阈值=2
    owner.address,
    [usdtAddress],
    86400,
    ethers.parseUnits("1000000", 6)
  );

  // 提议支付
  const tx = await vault.connect(signer1).proposePayment(
    usdtAddress,
    recipient.address,
    ethers.parseUnits("1000", 6),
    "0x"
  );
  const receipt = await tx.wait();
  const event = receipt.logs.find(
    (log: any) => log.fragment?.name === "PaymentProposed"
  );
  const paymentId = event?.args[0];

  // 批准（signer1）
  await vault.connect(signer1).approvePayment(paymentId);

  // 批准（signer2）
  await vault.connect(signer2).approvePayment(paymentId);

  // 等待时间锁
  await ethers.provider.send("evm_increaseTime", [86401]);
  await ethers.provider.send("evm_mine", []);

  // 执行支付
  await vault.executePayment(paymentId);

  // 验证
  const balance = await usdt.balanceOf(recipient.address);
  expect(balance).to.equal(ethers.parseUnits("1000", 6));
});
```

---

## 常见问题

### Q1: TRON地址格式转换

```javascript
// Base58 → 内部地址
const base58Address = 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE';
const internalAddress = tronWeb.address.toHex(base58Address);
// 返回: "0x41a1..."

// 内部地址 → Base58
const base58 = tronWeb.address.fromHex(internalAddress);
```

### Q2: TRC20代币精度

| 代币 | 符号 | 小数位 | 合约地址 |
|------|------|--------|---------|
| Tether USD | USDT | 6 | TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t |
| USD Coin | USDC | 6 | TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8 |
| TRON | TRX | 6 | 原生代币 |

### Q3: Energy获取

```javascript
// 冻结TRX获取Energy（1000 TRX冻结3天 = 30000 Energy）
const freezeTx = await tronWeb.transactionBuilder.freezeBalance(
    1000, // TRX数量
    3,    // 天数
    "ENERGY",
    tronWeb.defaultAddress.base58
);

const signedTx = await tronWeb.trx.sign(freezeTx);
const result = await tronWeb.trx.sendRawTransaction(signedTx);
```

### Q4: Bandwidth获取

```javascript
// 质押TRX获取Bandwidth
const freezeTx = await tronWeb.transactionBuilder.freezeBalance(
    1000, // TRX数量
    3,    // 天数
    "BANDWIDTH",
    tronWeb.defaultAddress.base58
);
```

---

## 5. IJustLend.sol - JustLend协议接口

### 描述

JustLend协议的智能合约接口定义，包括：
- `IJustLend`: JustLend核心协议接口
- `IJustToken`: jToken（生息代币）接口
- `IJustLendPriceOracle`: 价格预言机接口
- `IUnitroller`: Unitroller（管理器）接口

### 核心功能

- **存取款**: `deposit`, `redeem`, `redeemAll`
- **借贷**: `borrow`, `repayBorrow`
- **抵押管理**: `enterMarkets`, `exitMarket`
- **收益追踪**: `supplyRatePerBlock`, `borrowRatePerBlock`, `getAccountLiquidity`

### 支持的代币

| 代币 | 符号 | jToken | 主网地址 |
|------|------|--------|---------|
| Tether USD | USDT | jUSDT | TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t |
| USD Coin | USDC | jUSDC | TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8 |
| TRON | TRX | jTRX | 原生代币 |

### JustLend收益来源

| 来源 | 机制 | APY范围 |
|------|------|---------|
| 借贷利差 | 借款人支付利息 → 存款人获得收益 | 1-3% |
| TRX质押 | 质押TRX验证区块 → 分享区块奖励 | 0.5-2% |
| JUST挖矿 | 治理代币JUST → 质押者共享 | 0.2-1% |

---

## 6. TronYieldAggregator.sol - 收益聚合器

### 描述

自动将商户闲置资金存入JustLend赚取利息的收益聚合器，支持实时APY查询、收益分配和灵活提现。

### 核心功能

#### 自动存款与收益
```solidity
// 存入代币，自动质押到JustLend
function deposit(address token, uint256 amount) external

// 查询商户余额（本金+利息）
function getMerchantBalance(address merchant, address token) external view returns (uint256 balance, uint256 principal, uint256 interest)

// 获取当前APY
function getTokenAPY(address token) external view returns (uint256 apy, uint256 exchangeRate)
```

#### 收益分配
```solidity
// 按百分比分配累积收益
function distributeYield(address token, YieldRecipient[] memory recipients) external

// 配置收益接收者
function setYieldRecipients(address token, YieldRecipient[] memory recipients) external
```

#### 灵活提现
```solidity
// 提现代币，自动计算本金vs利息
function withdraw(address token, uint256 amount) external returns (uint256 withdrawnAmount, uint256 principalAmount, uint256 interestAmount)
```

### 使用示例

```javascript
// 1. 存款（自动质押）
await aggregator.deposit(usdtAddress, ethers.parseUnits("10000", 6));

// 2. 查询余额和收益
const [balance, principal, interest] = await aggregator.getMerchantBalance(merchant, usdtAddress);
console.log(`Total: ${balance/1e6} USDT, Principal: ${principal/1e6} USDT, Interest: ${interest/1e6} USDT`);

// 3. 查询APY
const [apy, exchangeRate] = await aggregator.getTokenAPY(usdtAddress);
console.log(`APY: ${(apy/1e16).toFixed(2)}%`);

// 4. 收益分配
const recipients = [
    { account: '0x...', percentage: 6000, fixedAmount: 0 },
    { account: '0x...', percentage: 4000, fixedAmount: 0 }
];
await aggregator.distributeYield(usdtAddress, recipients);

// 5. 提现
await aggregator.withdraw(usdtAddress, 0); // 0 = 全部提现
```

### 收益追踪

| 指标 | 说明 | 获取方式 |
|------|------|---------|
| 总余额 | 本金+利息 | `getMerchantBalance()` |
| 本金 | 初始存款金额 | `getMerchantBalance()` |
| 利息 | 累积收益 | `getMerchantBalance()` |
| APY | 年化收益率 | `getTokenAPY()` |
| 交换率 | jToken汇率 | `getTokenAPY()` |
| TVL | 总锁仓量 | `getTVL()` |

### 事件

| 事件 | 描述 |
|------|------|
| `Deposited` | 商户存款 |
| `Withdrawn` | 商户提现 |
| `YieldDistributed` | 收益分配 |
| `AutoCompoundToggled` | 自动复利开关切换 |
| `TokenAdded` | 代币添加支持 |
| `TokenRemoved` | 代币移除支持 |

### 安全特性

- 重入保护
- 可暂停机制（存款/提现分离控制）
- 代币白名单
- 余额验证
- 紧急取款

### 使用场景

1. **商户闲置资金收益** - 自动生息，无需手动管理
2. **资金池统一管理** - 跨链资金池统一管理
3. **收益自动分配** - 按比例分配给多个账户
4. **风控对冲** - 市场波动时可紧急提取

### 详细文档

完整的TronYieldAggregator文档请参考：`docs/TRON_YIELD_AGGREGATOR.md`

---

## 更新日志

### v2.0.0 (2026-02-08)
- ✅ 实现`IJustLend.sol` - JustLend协议接口
- ✅ 实现`TronYieldAggregator.sol` - 收益聚合器
- ✅ 实现`Mocks.sol` - 测试Mock合约
- ✅ 完整的JustLend集成文档
- ✅ 收益聚合器使用指南
- ✅ Prometheus监控集成

### v1.0.0 (2026-02-08)
- ✅ 实现`ITRC20.sol` - TRC20代币接口
- ✅ 实现`TronPaymentVault.sol` - 多签支付金库
- ✅ 实现`TronPaymentSplitter.sol` - 自动分账合约
- ✅ 完整文档和使用示例
- ✅ 测试用例覆盖

---

## 相关资源

### TRON资源
- [TRON开发者文档](https://developers.tron.network)
- [TronGrid API](https://www.trongrid.io)
- [TronWeb SDK](https://tronweb.network)
- [Nile测试网水龙头](https://nileex.io/join/getJoinPage)
- [TRONScan浏览器](https://tronscan.org)

### JustLend资源
- [JustLend官网](https://justlend.org)
- [JustLend Nile测试网](https://testnet.justlend.org/)
- [JustLend Docs](https://justlend.org/docs/)

### 智能合约开发
- [Solidity文档](https://docs.soliditylang.org)
- [OpenZeppelin](https://docs.openzeppelin.com)
- [Hardhat](https://hardhat.org/docs)

---

## 许可证

MIT License

---

## 贡献

欢迎提交Issue和Pull Request！

---

## 更新日志

### v1.0.0 (2026-02-08)
- ✅ 实现`ITRC20.sol` - TRC20代币接口
- ✅ 实现`TronPaymentVault.sol` - 多签支付金库
- ✅ 实现`TronPaymentSplitter.sol` - 自动分账合约
- ✅ 完整文档和使用示例
- ✅ 测试用例覆盖
