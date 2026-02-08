# TRON 智能合约完整文档

> 最后更新: 2026-02-08
> 网络: TRON Nile Testnet

---

## 目录

1. [文件结构总结](#文件结构总结)
2. [合约部署总览](#合约部署总览)
3. [ITRC20.sol - TRC20代币接口](#itrc20sol---trc20代币接口)
4. [IJustLend.sol - JustLend协议接口](#ijustlendsol---justlend协议接口)
5. [TronPaymentVault.sol - 多签支付金库](#tronpaymentvaultsol---多签支付金库)
6. [TronPaymentSplitter.sol - 自动分账合约](#tronpaymentsplittersol---自动分账合约)
7. [TronYieldAggregator.sol - 收益聚合器](#tronyieldaggregatorsol---收益聚合器)
8. [使用指南](#使用指南)

---

## 文件结构总结

### 今天添加/修改的文件

| 文件路径 | 类型 | 说明 |
|---------|------|------|
| `contracts/contracts/tron/ITRC20.sol` | 接口 | TRC20代币标准接口 |
| `contracts/contracts/tron/IJustLend.sol` | 接口 | JustLend借贷协议接口 |
| `contracts/contracts/tron/TronPaymentVault.sol` | 合约 | 多签支付金库 |
| `contracts/contracts/tron/TronPaymentSplitter.sol` | 合约 | 自动分账合约 |
| `contracts/contracts/tron/TronYieldAggregator.sol` | 合约 | 收益聚合器 |
| `contracts/contracts/tron/Mocks.sol` | 合约 | 测试Mock合约 |
| `contracts/contracts/tron/README.md` | 文档 | 合约功能说明 |

### 编译和部署脚本

| 文件路径 | 说明 |
|---------|------|
| `scripts/compile-tron-v2.js` | 编译所有TRON合约 |
| `scripts/compile-splitter.js` | 编译分账合约 |
| `scripts/compile-yield-aggregator.js` | 编译收益聚合器 |
| `scripts/deploy-tron-simple.js` | 部署多签金库 |
| `scripts/deploy-splitter.js` | 部署分账合约 |
| `scripts/deploy-yield-aggregator.js` | 部署收益聚合器 |
| `scripts/test-vault-final.js` | 测试多签金库 |
| `scripts/test-splitter-simple.js` | 测试分账合约 |
| `scripts/test-yield-basic.js` | 测试收益聚合器 |

---

## 合约部署总览

| 合约名称 | 合约地址 | TRONScan | 状态 |
|---------|---------|----------|------|
| TronPaymentVault | `TSrRLNoyJmVNZMg6jA8hUzABxHA1ZBFGM` | [链接](https://nile.tronscan.org/#/contract/TSrRLNoyJmVNZMg6jA8hUzABxHA1ZBFGM) | ✅ 已部署 |
| TronPaymentSplitter | `TDJwns4C2Frp4wVnrqyz4Ud6SYoxc9nk7Z` | [链接](https://nile.tronscan.org/#/contract/TDJwns4C2Frp4wVnrqyz4Ud6SYoxc9nk7Z) | ✅ 已部署 |
| TronYieldAggregator | `TC6bpE1t1EderDzXZq1nuRDf8QRhQHgkgy` | [链接](https://nile.tronscan.org/#/contract/TC6bpE1t1EderDzXZq1nuRDf8QRhQHgkgy) | ✅ 已部署 |

---

## ITRC20.sol - TRC20代币接口

### 文件位置
`contracts/contracts/tron/ITRC20.sol`

### 合约描述
TRON区块链兼容的ERC20代币接口标准。

### 接口说明

#### totalSupply()
```solidity
function totalSupply() external view returns (uint256);
```
- **功能**: 查询代币总供应量
- **返回值**: 代币总数量
- **示例**:
```javascript
const totalSupply = await usdt.totalSupply().call();
console.log('Total Supply:', totalSupply.toString());
```

#### balanceOf(address account)
```solidity
function balanceOf(address account) external view returns (uint256);
```
- **功能**: 查询指定账户的余额
- **参数**: `account` - 账户地址(hex格式)
- **返回值**: 账户余额
- **测试代码**:
```javascript
const [owner, user1] = await ethers.getSigners();
const balance = await usdt.balanceOf(user1.address);
console.log('User1 USDT Balance:', formatUnits(balance, 6));
```

#### transfer(address recipient, uint256 amount)
```solidity
function transfer(address recipient, uint256 amount) external returns (bool);
```
- **功能**: 转账给指定地址
- **参数**:
  - `recipient` - 接收地址(hex格式)
  - `amount` - 转账数量
- **返回值**: 转账是否成功
- **测试代码**:
```javascript
const recipient = await ethers.Wallet.createRandom().address;
const amount = parseUnits('100', 6); // 100 USDT

const tx = await usdt.transfer(recipient, amount);
await tx.wait();

const recipientBalance = await usdt.balanceOf(recipient);
expect(recipientBalance).to.equal(amount);
```

#### approve(address spender, uint256 amount)
```solidity
function approve(address spender, uint256 amount) external returns (bool);
```
- **功能**: 授权第三方合约使用代币
- **参数**:
  - `spender` - 被授权地址(hex格式)
  - `amount` - 授权数量
- **返回值**: 授权是否成功
- **测试代码**:
```javascript
const vaultContract = await deployer.deploy(vaultABI);
const amount = parseUnits('10000', 6);

// 授权金库使用我们的USDT
const approveTx = await usdt.approve(vaultContract.target, amount);
await approveTx.wait();

// 验证授权额度
const allowance = await usdt.allowance(deployer.address, vaultContract.target);
expect(allowance).to.equal(amount);
```

#### allowance(address owner, address spender)
```solidity
function allowance(address owner, address spender) external view returns (uint256);
```
- **功能**: 查询授权额度
- **参数**:
  - `owner` - 代币所有者地址
  - `spender` - 被授权地址
- **返回值: 授权额度
- **测试代码**:
```javascript
const allowance = await usdt.allowance(user1.address, vaultAddress);
console.log('Vault allowance:', allowance.toString());
```

#### transferFrom(address sender, address recipient, uint256 amount)
```solidity
function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
```
- **功能**: 代理转账
- **参数**:
  - `sender` - 发送者地址
  - `recipient` - 接收者地址
  - `amount` - 转账数量
- **返回值**: 转账是否成功
- **测试代码**:
```javascript
// 用户1授权金库使用其USDT
await usdt.connect(user1).approve(vaultAddress, approveAmount);

// 金库转账给接收者
const vault = await ethers.getContractAt(vaultABI, vaultAddress);
const transferTx = await vault.connect(user1).transferFrom(
    user1.address,
    recipient.address,
    transferAmount
);
await transferTx.wait();
```

#### name()
```solidity
function name() external view returns (string memory);
```
- **返回值**: 代币名称
- **测试代码**:
```javascript
const tokenName = await usdt.name();
console.log('Token Name:', tokenName);
```

#### symbol()
```solidity
function symbol() external view returns (string memory);
```
- **返回值**: 代币符号
- **测试代码**:
```javascript
const symbol = await usdt.symbol();
console.log('Token Symbol:', symbol); // 应该是 "USDT"
```

#### decimals()
```solidity
function decimals() external view returns (uint8);
```
- **返回值**: 代币小数位数
- **测试代码**:
```javascript
const decimals = await usdt.decimals();
console.log('Token Decimals:', decimals); // USDT通常是6位
```

### 完整测试代码

```javascript
const { ethers } = require('ethers');

async function testITRC20() {
    const [owner, user1, user2] = await ethers.getSigners();

    // 创建或获取USDT实例
    const usdt = await ethers.getContractAt(TRC20_ABI, USDT_ADDRESS);

    console.log('=== ITRC20测试 ===\n');

    // 1. 测试totalSupply
    const totalSupply = await usdt.totalSupply();
    console.log('1. Total Supply:', ethers.formatUnits(totalSupply, 6));

    // 2. 测试balanceOf
    const user1Balance = await usdt.balanceOf(user1.address);
    console.log('2. User1 Balance:', ethers.formatUnits(user1Balance, 6));

    // 3. 测试transfer
    const transferAmount = ethers.parseUnits('100', 6); // 100 USDT
    const transferTx = await usdt.transfer(user2.address, transferAmount);
    await transferTx.wait();
    console.log('3. Transfer Tx:', transferTx.hash);

    // 验证转账
    const user2Balance = await usdt.balanceOf(user2.address);
    console.log('   User2 Balance after transfer:', ethers.formatUnits(user2Balance, 6));

    // 4. 测试approve
    const approveAmount = ethers.parseUnits('1000', 6);
    const approveTx = await usdt.approve(user1.address, approveAmount);
    await approveTx.wait();
    console.log('4. Approve Tx:', approveTx.hash);

    // 5. 测试allowance
    const allowance = await usdt.allowance(user2.address, user1.address);
    console.log('5. Allowance (user2 -> user1):', ethers.formatUnits(allowance, 6));

    // 6. 测试transferFrom
    const transferFromAmount = ethers.parseUnits('50', 6); // 50 USDT
    const transferFromTx = await usdt.connect(user1).transferFrom(
        user2.address,
        user1.address,
        transferFromAmount
    );
    await transferFromTx.wait();
    console.log('6. TransferFrom Tx:', transferFromTx.hash);

    // 验证代理转账
    const newAllowance = await usdt.allowance(user2.address, user1.address);
    console.log('   New Allowance:', ethers.formatUnits(newAllowance, 6));

    // 7. 测试元数据
    const name = await usdt.name();
    const symbol = await usdt.symbol();
    const decimals = await usdt.decimals();

    console.log('7. Token Info:');
    console.log('   Name:', name);
    console.log('   Symbol:', symbol);
    console.log('   Decimals:', decimals);

    console.log('\n✅ ITRC20接口测试完成!');
}
```

---

## IJustLend.sol - JustLend协议接口

### 文件位置
`contracts/contracts/tron/IJustLend.sol`

### 合约描述
TRON最大的去中心化借贷协议JustLend的接口定义。

### 接口说明

#### IJustLend - 借贷主协议

##### deposit(address jToken, uint256 underlyingAmount)
```solidity
function deposit(address jToken, uint256 underlyingAmount) external returns (uint256);
```
- **功能**: 将代币存入JustLend获得jToken
- **参数**:
  - `jToken` - jToken合约地址
  - `underlyingAmount` - 存入的底层代币数量
- **返回值**: 获得的jToken数量
- **测试代码**:
```javascript
const justLend = await ethers.getContractAt(JUSTLEND_ABI, JUSTLEND_ADDRESS);
const jUSDT = await ethers.getContractAt(JUSTTOKEN_ABI, JUSDT_ADDRESS);

// 授权jToken转移
const depositAmount = parseUnits('10000', 6); // 10000 USDT
await usdt.approve(JUSTLEND_ADDRESS, depositAmount);

// 存入获得jToken
const tx = await justLend.deposit(jUSDT_ADDRESS, depositAmount);
await tx.wait();

const jTokenReceived = tx.value;
console.log('jTokens received:', formatUnits(jTokenReceived, 18));
```

##### redeem(address jToken, uint256 jTokenAmount)
```solidity
function redeem(address jToken, uint256 jTokenAmount) external returns (uint256);
```
- **功能**: 赎回jToken换取底层代币
- **参数**:
  - `jToken` - jToken合约地址
  - `jTokenAmount` - 赎回的jToken数量
- **返回值**: 获得的底层代币数量
- **测试代码**:
```javascript
// 赎回部分jToken
const redeemTx = await justLend.redeem(jUSDT_ADDRESS, redeemAmount);
await redeemTx.wait();

const underlyingReceived = redeemTx.value;
console.log('USDT received:', formatUnits(underlyingReceived, 6));
```

##### redeemAll(address jToken)
```solidity
function redeemAll(address jToken) external returns (uint256);
```
- **功能**: 赎回全部jToken
- **参数** `jToken` - jToken合约地址
- **返回值**: 获得的全部底层代币数量
- **测试代码**:
```javascript
const jTokenBalance = await jUSDT.balanceOf(user.address);
const tx = await justLend.redeemAll(jUSDT_ADDRESS);
await tx.wait();

console.log('All USDT returned:', formatUnits(tx.value, 6));
```

##### borrow(address jToken, uint256 borrowAmount)
```solidity
function borrow(address jToken, uint256 borrowAmount) external;
```
- **功能**: 借出代币
- **参数**:
  - `jToken` - 借出的jToken类型
  - `borrowAmount` - 借款数量
- **测试代码**:
```javascript
// 必须先进入市场
const tx = await justLend.enterMarkets([jUSDT_ADDRESS]);
await tx.wait();

// 借款
const borrowAmount = parseUnits('5000', 6); // 5000 USDT
const borrowTx = await justLend.borrow(jUSDT_ADDRESS, borrowAmount);
await borrowTx.wait();

console.log('Borrowed USDT:', formatUnits(borrowAmount, 6));
```

##### repayBorrow(address jToken, uint256 repayAmount)
```solidity
function repayBorrow(address jToken, uint256 repayAmount) external;
```
- **功能**: 偿还借款
- **参数**:
  - `jToken` - 偿还的jToken类型
  - `repayAmount` - 偿还数量
- **测试代码**:
```javascript
const usdtBalance = await usdt.balanceOf(user.address);
const repayTx = await justLend.repayBorrow(jUSDT_ADDRESS, repayAmount);
await repayTx.wait();

console.log('Repaid USDT:', formatUnits(repayAmount, 6));
```

##### enterMarkets(address[] calldata jTokens)
```solidity
function enterMarkets(address[] memory jTokens) external;
```
- **功能**: 进入借贷市场
- **参数**: `jTokens` - jToken地址数组
- **测试代码**:
```javascript
const jTokens = [jUSDT_ADDRESS, jUSDC_ADDRESS];
const tx = await justLend.enterMarkets(jTokens);
await tx.wait();

console.log('Entered markets:', jTokens.length);
```

##### exitMarket(address jToken)
```solidity
function exitMarket(address jToken) external;
```
- **功能**: 退出借贷市场
- **参数**: `jToken` - 要退出的jToken
- **测试代码**:
```javascript
const tx = await justLend.exitMarket(jUSDT_ADDRESS);
await tx.wait();

console.log('Exited market');
```

##### getAccountLiquidity(address account)
```solidity
function getAccountLiquidity(address account) external view returns (uint256, uint256);
```
- **功能**: 获取账户流动性
- **参数**: `account` - 账户地址
- `返回值**:
  - `liquidity` - 总流动性
  `shortfall` - 流动性缺口
- **测试代码**:
```javascript
const [liquidity, shortfall] = await justLend.getAccountLiquidity(user.address);
console.log('Liquidity:', formatUnits(liquidity, 18));
console.log('Shortfall:', formatUnits(shortfall, 18));
```

---

#### IJustToken - 生息代币接口

##### exchangeRateCurrent()
```solidity
function exchangeRateCurrent() external view returns (uint256);
```
- **功能**: 获取当前汇率（1个jToken对应多少底层代币）
- **返回值**: 汇率 * 1e18
- **测试代码**:
```javascript
const jUSDT = await ethers.getContractAt(JUSTTOKEN_ABI, JUSDT_ADDRESS);
const exchangeRate = jUSDT.exchangeRateCurrent();
console.log('Exchange Rate:', formatUnits(exchangeRate, 18));
// 示例: 1.002e18 表示 1 jUSDT = 1.002 USDT
```

##### supplyRatePerBlock()
```solidity
function supplyRatePerBlock() external view returns (uint256);
```
- **功能**: 获取每区块存款利率
- **返回值**: 每区块利率
- **测试代码**:
```javascript
const supplyRate = jUSDT.supplyRatePerBlock();
const annualAPY = (Number(supplyRate) * 365 * 24 * 3600 / 1e18 * 100).toFixed(2);
console.log('Supply Rate:', supplyRate.toString());
console.log('Estimated APY:', annualAPY + '%');
```

##### borrowRatePerBlock()
```solidity
function borrowRatePerBlock() external view returns (uint256);
```
- **功能**: 获取每区块借款利率
- **返回值**: 每区块利率
- **测试代码**:
```javascript
const borrowRate = jUSDT.borrowRatePerBlock();
const annualBorrowAPY = (Number(borrowRate) * 365 * 24 * 3600 / 1e18 * 100).toFixed(2);
console.log('Borrow Rate:', borrowRate.toString());
console.log('Estimated Borrow APY:', annualBorrowAPY + '%');
```

##### getCash()
```solidity
function getCash() external view returns (uint256);
```
- **功能**: 获取合约中的底层代币余额
- **返回值**: 底层代币余额
- **测试代码**:
```javascript
const cash = jUSDT.getCash();
console.log('Cash in Protocol:', formatUnits(cash, 6), 'USDT');
```

##### balanceOf(address account)
```solidity
function balanceOf(address account) external view returns (uint256);
```
- **功能**: 获取账户持有的jToken余额
- **参数**: `account` - 账户地址
- **返回值**: jToken余额
- **测试代码**:
```javascript
const jTokenBalance = jUSDT.balanceOf(user.address);
console.log('jToken Balance:', formatUnits(jTokenBalance, 18));
```

---

#### IJustLendPriceOracle - 价格预言机

##### getUnderlyingPrice(address jToken)
```solidityfunction getUnderlyingPrice(address jToken) external view returns (uint256);
```
- **功能**: 获取jToken的底层代币价格
- **参数**: `jToken` - jToken地址
- **返回值**: 价格 * 1e18
- **测试代码**:
```javascript
const oracle = await ethers.getContractAt(ORACLE_ABI, ORACLE_ADDRESS);
const price = oracle.getUnderlyingPrice(jUSDT_ADDRESS);
console.log('USDT Price:', formatUnits(price, 18));
// 示例: 1000000000000000000 = 1.0000 USD
```

---

### 完整测试代码

```javascript
const { ethers } = require('ethers');

// 合约地址配置
const JUSDT_ADDRESS = '0x...'; // jUSDT地址
const JUSTLEND_ADDRESS = '0x...'; // JustLend地址
const USDT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

async function testJustLend() {
    const [owner, borrower] = await ethers.getSigners();

    const justLend = await ethers.getContractAt(JUSTLEND_ABI, JUSTLEND_ADDRESS);
    const jUSDT = await ethers.getContractAt(JUSTTOKEN_ABI, JUSDT_ADDRESS);
    const usdt = await ethers.getContractAt(TRC20_ABI, USDT_ADDRESS);

    console.log('=== JustLend测试 ===\n');

    // 1. 测试enterMarkets
    console.log('1. Entering market...');
    const enterTx = await justLend.enterMarkets([JUSDT_ADDRESS]);
    await enterTx.wait();
    console.log('   Tx:', enterTx.hash);

    // 2. 获取汇率
    console.log('\n2. Checking exchange rate...');
    const exchangeRate = await jUSDT.exchangeRateCurrent();
    console.log('   Exchange Rate:', ethers.formatUnits(exchangeRate, 18));

    // 3. 获取利率
    const supplyRate = await jUSDT.supplyRatePerBlock();
    const supplyAPY = (Number(supplyRate) * 365 * 24 * 3600 / 1e18 * 100).toFixed(2);
    console.log('   Supply Rate:', supplyRate.toString());
    console.log('   Estimated Supply APY:', supplyAPY + '%');

    // 4. 存款
    console.log('\n3. Depositing...');
    const depositAmount = ethers.parseUnits('10000', 6);

    // 授权
    const approveTx = await usdt.approve(JUSTLEND_ADDRESS, depositAmount);
    await approveTx.wait();

    // 存款
    const depositTx = await justLend.deposit(JUSDT_ADDRESS, depositAmount);
    await depositTx.wait();
    console.log('   Tx:', depositTx.hash);
    console.log('   Received jTokens:', formatUnits(depositTx.value, 18));

    // 5. 检查余额
    console.log('\n4. Checking balances...');
    const jTokenBalance = await jUSDT.balanceOf(borrower.address);
    const userBalance = await usdt.balanceOf(borrower.address);
    console.log('   jToken Balance:', formatUnits(jTokenBalance, 18));
    console.log('   USDT Balance:', formatUnits(userBalance, 6));

    // 6. 查询流动性
    console.log('\n5. Checking account liquidity...');
    const [liquidity, shortfall] = await justLend.getAccountLiquidity(borrower.address);
    console.log('   Liquidity:', formatUnits(liquidity, 18));
    console.log('   Shortfall:', formatUnits(shortfall, 18));

    console.log('\n✅ JustLend接口测试完成!');
    console.log('⚠️  注意: 借款功能需要足够的抵押品支持');
}
```

---

## TronPaymentVault.sol - 多签支付金库

### 文件位置
`contracts/contracts/tron/TronPaymentVault.sol`

### 合约地址
- **Nile Testnet**: `TSrRLNoyJmVNZMg6jA8hUzABxHA1ZBFGM`
- **TRONScan**: https://nile.tronscan.org/#/contract/TSrRLNoyJmVNZMg6jA8hUzABxHA1ZBFGM

### 合约功能
企业级多签名支付金库，支持时间锁、每日限额和紧急恢复机制。

### 接口说明

#### 构造函数
```solidity
constructor(
    address[] memory _initialSigners,
    uint256 _threshold,
    address _guardian,
    address[] memory _supportedTokens,
    uint256 _timelock,
    uint256 _dailyLimit
)
```
- **参数**:
  - `_initialSigners` - 初始签名者地址数组
  - `_threshold` - 所需签名数量（不能超过签名者总数）
  - `_guardian` - 监护人地址（可暂停、触发紧急恢复）
  - `_supportedTokens` - 支持的TRC20代币地址数组
  - `_timelock` - 时间锁（秒，最大7天）
  - `_dailyLimit` - 每日支付限额
- **限制**:
  - 签名者数量不能为0
  - 门槛值必须在1到签名者数量之间
  - 时间锁最大7天
  - 不能添加重复的签名者

##### 部署代码
```javascript
const TronWeb = require('tronweb');

const tronWeb = new TronWeb({
    fullNode: 'https://nile.trongrid.io',
    solidityNode: 'https://nile.trongrid.io',
    eventServer: 'https://nile.trongrid.io'
});

tronWeb.setPrivateKey(DEPLOYER_PRIVATE_KEY);

// 部署参数
const initialSigners = [
    deployerAddress,  // 签名者1
    'TSigner2...',     // 签名者2
    'TSigner3...'      // 签者3
];
const threshold = 2;  // 2/3签名
const guardian = deployerAddress;
const supportedTokens = ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t']; // USDT
const timelock = 86400;  // 24小时
const dailyLimit = '1000000000000'; // 100万USDT

// 部署
const vaultContract = await tronWeb.contract(VAULT_ABI, bytecode);
const tx = await vaultContract.deploy(
    initialSigners,
    threshold,
    guardian,
    supportedTokens,
    timelock,
    dailyLimit
).send({ from: deployerAddress });
```

---

#### 支付管理

##### proposePayment(address token, address to, uint256 amount, bytes calldata data)
```solidity
function proposePayment(
    address token,
    address to,
    uint256 amount,
    bytes calldata data
) external onlySigner whenNotPaused returns (uint256 paymentId)
```
- **功能**: 提议支付
- **参数**:
  - `token` - TRC20代币地址
  - `to` - 接收地址(hex格式)
  - `amount` - 支付金额
  - `data` - 可选的调用数据
- **返回值**: 支付ID
- **事件**: `PaymentProposed`
- **错误**:
  - `InvalidAddress` - 接收地址无效
  - `InvalidAmount` - 金额为0
  - `TokenNotSupported` - 代币不支持
  - `VaultIsPaused` - 金库已暂停
- **测试代码**:
```javascript
const vault = await tronWeb.contract(VAULT_ABI, vaultAddress);

const paymentId = await vault.proposePayment(
    'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',  // USDT
    'TRecipientAddress...',  // 接收者地址(hex)
    '1000000',             // 1 USDT (6位小数)
    '0x'                   // 空数据
).send({ from: signerAddress });

console.log('Payment ID:', paymentId);
```

##### approvePayment(uint256 paymentId)
```solidity
function approvePayment(uint256 paymentId) external onlySigner;
```
- **功能**: 批准支付
- **参数**: `paymentId` - 支付ID
- **事件**: `PaymentApproved`
- **错误**: `PaymentAlreadyApproved` - 已批准过
- **测试代码**:
```javascript
// 签名者2批准
await vault.approvePayment(paymentId)
    .send({ from: signer2Address });
```

##### executePayment(uint256 paymentId)
```solidity
function executePayment(uint256 paymentId) external whenNotPaused;
```
- **功能**: 执行支付
- **参数**: `paymentId` - 支付ID
- **事件**: `PaymentExecuted`
- **前置条件**:
  - 批准数量 >= 阈值
  - 时间锁已过期
  - 当日限额未超出
- **错误**:
  - `InvalidPaymentId` - 无效的支付ID
  - `PaymentAlreadyExecuted` - 已执行
  - `InsufficientApprovals` - 批准不足
  - `DailyLimitExceeded` - 每日限额超出
  - `NotTimelocked` - 时间锁未过期
- **测试代码**:
```javascript
// 等待时间锁过期
await new Promise(resolve => setTimeout(resolve, 86401)); // 24小时+

// 执行支付
await vault.executePayment(paymentId)
    .send({ from: signerAddress });
```

##### cancelPayment(uint256 paymentId)
```solidity
function cancelPayment(uint256 paymentId) external onlySigner;
```
- **功能**: 取消支付
- **参数**: `paymentId` - 支付ID
- **事件**: `PaymentCancelled`
- **错误**: `PaymentAlreadyCancelled` - 已取消
- **测试代码**:
```javascript
await vault.cancelPayment(paymentId)
    .send({ from: signerAddress });
```

---

#### 签名者管理

##### addSigner(address newSigner)
```solidity
function addSigner(address newSigner) external onlySigner;
```
- **功能**: 添加签名者
- **参数**: `newSigner` - 新签名者地址(hex格式)
- **事件**: `SignerAdded`
- **错误**: `SignerAlreadyExists` - 签名者已存在
- **测试代码**:
```javascript
await vault.addSigner('TNewSignerAddress...')
    .send({ from: signerAddress });
```

##### removeSigner(address signer)
```solidity
function removeSigner(address signer) external onlySigner;
```
- **功能**: 移除签名者
- **参数**: `signer` - 签名者地址
- **事件**: `SignerRemoved`
- **错误**: `SignerNotFound` - 签名者不存在
- **注意事项**: 移除签名者后需要更新阈值
- **测试代码**:
```javascript
await vault.removeSigner('TOldSignerAddress...')
    .send({ from: signerAddress });
```

##### updateThreshold(uint256 newThreshold)
```solidity
function updateThreshold(uint256 newThreshold) external onlySigner;
```
- **功能**: 更新签名阈值
- **参数**: `newThreshold` - 新阈值（需1<=newThreshold<=signers.length）
- **事件**: `ThresholdUpdated`
- **错误**:
  - `InvalidThreshold` - 阈值无效
- **测试代码**:
```javascript
const newThreshold = 3; // 从2改为3
await vault.updateThreshold(newThreshold)
    .send({ from: signerAddress });
```

---

#### 查询函数

##### getSigners() - 获取签名者列表
```solidity
function getSigners() external view returns (address[] memory)
```
- **返回**: 所有签名者地址数组

##### getPayment(uint256 paymentId) - 获取支付详情
```solidity
function getPayment(uint256 paymentId) external view returns (...);
```
- **返回**: 支付完整信息

##### hasApproved(address signer, uint256 paymentId) - 检查批准状态
```solidity
function hasApproved(
    address signer,
    uint256 paymentId
) external view returns (bool);
```
- **返回**: 是否已批准

---

#### 安全控制

##### pause() / unpause() - 暂停/恢复合约
```solidity
function pause() external onlyGuardian;
function unpause() external onlyGuardian;
```
- **功能**: 暂停所有支付执行
- **事件**: `VaultPaused`, `VaultUnpaused`

##### requestEmergencyWithdrawal(address to, address token, uint256 amount)
```solidity
function requestEmergencyWithdrawal(
    address to,
    address token,
    uint256 amount
) external onlyGuardian;
```
- **功能**: 请求紧急取款
- **时间锁保护**: 24小时后才能执行

##### executeEmergencyWithdrawal(...)
```solidity
function executeEmergencyWithdrawal(
    address to,
    address token,
    uint256 amount,
    uint256 requestTimestamp
) external onlyGuardian;
```

---

#### 配置管理

##### addSupportedToken(address token) - 添加支持代币
```solidity
function addSupportedToken(address token) external onlyOwner;
```

##### removeSupportedToken(address token) - 移除支持代币
```solidity
function removeSupportedToken(address token) external onlyOwner;
```

##### updateTimelock(uint256 newTimelock) - 更新时间锁
```solidity
function updateTimelock(uint256 newTimelock) external onlyOwner;
```
- **限制**: 最大7天 (604800秒)

##### updateDailyLimit(uint256 newLimit) - 更新每日限额
```solidity
function updateDailyLimit(uint256 newLimit) external onlyOwner;
```

---

### 完整测试代码

```javascript
const { TronWeb } = require('tronweb');
require('dotenv').config();

const VAULT_ADDRESS = 'TSrRLNoyJmVNZMg6jA8hUzABxHA1ZBFGM';
const USDT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

const vaultABI = JSON.parse(
    fs.readFileSync('artifacts/tron/TronPaymentVault.abi.json', 'utf8')
);

async function testVault() {
    const tronWeb = new TronWeb({
        fullNode: 'https://nile.trongrid.io',
        solidityNode: 'https://nile.trongrid.io',
        eventServer: 'https://nile.trongrid.io'
    });

    tronWeb.setPrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
    const signer1 = tronWeb.address.fromHex(tronWeb.defaultAddress.hex);
    console.log('Signer1:', signer1);

    const vault = await tronWeb.contract(vaultABI, VAULT_ADDRESS);

    console.log('=== TronPaymentVault 测试 ===\n');

    // 1. 查询基础信息
    console.log('1. 基础信息:');
    const threshold = await vault.threshold().call();
    console.log('   Threshold:', threshold.toString());

    const timelock = await vault.timelock().call();
    console.log('   Timelock:', timelock.toString(), 'seconds');

    const dailyLimit = await vault.dailyLimit().call();
    console.log('   Daily Limit:', (Number(BigInt(dailyLimit)) / 1e6).toLocaleString(), 'USDT');

    const signers = await vault.getSigners().call();
    console.log('   Signers:', signers);

    // 2. 提议支付
    console.log('\n2. 提议支付:');
    const recipient = 'TRecipientAddress...';
    const amount = '1000000'; // 1 USDT

    const proposeTx = await vault.proposePayment(
        USDT_ADDRESS,
        recipient,
        amount,
        '0x'
    ).send({ from: signer1, shouldPollResponse: true });

    console.log('   Tx:', proposeTx);
    const [paymentId, , , , ] = Object.values(proposeTx);
    console.log('   Payment ID:', paymentId);

    // 3. 获取支付详情
    console.log('\n3. 支付详情:');
    const payment = await vault.payment(paymentId);
    console.log('   Token:', payment.token);
    console.log('   To:', payment.to);
    console.log('   Amount:', (Number(BigInt(payment.amount)) / 1e6).toLocaleString(), 'USDT');
    console.log('   Approvals:', Number(BigInt(payment.approvalCount)), '/', threshold);
    console.log('   Executed:', payment.executed);

    // 4. 第二个签名者批准
    console.log('\n4. 批准支付 (签名者2):');
    await vault.approvePayment(paymentId)
        .send({ from: 'TSigner2...', shouldPollResponse: true });

    // 5. 等待时间锁（测试时使用时间跳过）
    console.log('\n5. 等待时间锁...');
    // 实际生产环境需要等待24小时

    // 6. 执行支付
    console.log('\n6. 执行支付:');
    try {
        const execTx = await vault.executePayment(paymentId)
            .send({ from: signer1, shouldPollResponse: true });
        console.log('   Tx:', execTx);
    } catch (e) {
        console.log('   Note: Cannot execute - timelock not expired yet');
    }

    // 7. 测试查询函数
    console.log('\n7. 查询函数:');
    const approved = await vault.hasApproved(signer1, paymentId);
    console.log('   Signer1 approved:', approved);

    const nextId = await vault.nextPaymentId().call();
    console.log('   Next Payment ID:', nextId.toString());

    console.log('\n✅ TronPaymentVault测试完成!');
}
```

---

## TronPaymentSplitter.sol - 自动分账合约

### 文件位置
`contracts/contracts/tron/TronPaymentSplitter.sol`

### 合约地址
- **Nile Testnet**: `TDJwns4C2Frp4wVnrqyz4Ud6SYoxc9nk7Z`
- **TRONScan**: https://nile.tronscan.org/#/contract/TDJwns4C2Frp4wVnrqyz4Ud6SYoxc9nk7Z

### 合约功能
自动将接收的TRC20代币分发给多个受益人，支持三种分账模式。

### 接口说明

#### 构造函数
```solidity
constructor(address _owner, address[] memory _supportedTokens)
```
- **参数**:
  - `_owner` - 所有者地址
  - `_supportedTokens` - 支持的代币地址数组
- **部署代码**:
```javascript
const splitter = await tronWeb.contract(SPLITTER_ABI, bytecode);
const tx = await splitter.deploy(
    deployerAddress,  // owner
    ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t']  // USDT
).send({ from: deployerAddress });
```

---

#### 分账管理

##### createSplit(address token, SplitMode mode, uint256 minAmount, Beneficiary[] memory beneficiaries)
```solidity
function createSplit(
    address token,
    SplitMode mode,
    uint256 minAmount,
    Beneficiary[] memory beneficiaries
) external onlyOwner returns (uint256 splitId)
```
- **功能**: 创建分账配置
- **参数**:
  - `token` - TRC20代币地址
  - `mode` - 分账模式 (0=百分比, 1=固定金额, 2=分层)
  - `minAmount` - 最小分账金额
  - `beneficiaries` - 受益人数组
- **返回值**: 分账ID
- **分账模式说明**:
  - `Percentage`: 按百分比分配，总和为10000
  - `Fixed`: 每个受益人固定金额
  - `Tiered`: 按层级分配比例
- **测试代码**:
```javascript
// 百分比分账示例
const beneficiaries = [
    ['TAddress1...', 6000, 0, 0],  // 60%
    ['TAddress2...', 4000, 0, 0]   // 40%
];

const splitId = await splitter.createSplit(
    'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    0,  // Percentage模式
    '1000000',  // 最小1 USDT
    beneficiaries
).send({ from: ownerAddress });

console.log('Split ID:', splitId);
```

##### executeSplit(uint256 splitId, uint256 amount)
```solidity
function executeSplit(
    uint256 splitId,
    uint256 amount
) external validSplit(splitId);
```
- **功能**: 执行分账
- **参数**:
  - `splitId` - 分账ID
  - `amount` - 分账金额
- **前置条件**:
  - 分账存在且未暂停
  - 金额 >= minAmount
- **错误**:
  - `InvalidSplitId` - 分账ID无效
  - `AmountBelowMinimum` - 金额低于最小值
  - `AlreadyPaused` - 分账已暂停

##### pauseSplit(uint256 splitId) / unpauseSplit(uint256 splitId)
```solidity
function pauseSplit(uint256 splitId) external onlyOwner;
function unpauseSplit(uint256 splitId) external onlyOwner;
```

---

#### 受益人管理

##### addBeneficiary(uint256 splitId, Beneficiary memory beneficiary)
```solidity
function addBeneficiary(
    uint256 splitId,
    Beneficiary memory beneficiary
) external onlyOwner;
```

##### updateBeneficiary(...)
- 修改单个受益人配置

##### removeBeneficiary(uint256 splitId, address beneficiaryAddress)
- 移除受益人

---

#### 查询函数

##### getSplit(uint256 splitId) - 获取分账详情
```solidity
function getSplit(uint256 splitId) external view returns (...);
```

##### getBeneficiaries(uint256 splitId) - 获取受益人列表
```solidity
function getBeneficiaries(uint256 splitId) external view returns (...);
```

##### calculateDistribution(uint256 splitId, uint256 amount) - 计算分配
```solidity
function calculateDistribution(uint256 splitId, uint256 amount)
    external view returns (uint256[] memory shares);
```

##### getAllSplits() - 获取所有分账

---

### 完整测试代码

```javascript
const { TronWeb } = require('tronweb');
require('dotenv').config();

const SPLITTER_ADDRESS = 'TDJwns4C2Frp4wVnrqyz4Ud6SYoxc9nk7Z';
const USDT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

const splitterABI = JSON.parse(
    fs.readFileSync('artifacts/tron/TronPaymentSplitter.abi.json', 'utf8')
);

async function testSplitter() {
    const tronWeb = new TronWeb({
        fullNode: 'https://nile.trongrid.io',
        solidityNode: 'https://nile.trongrid.io',
        eventServer: 'https://nile.trongrid.io'
    });

    tronWeb.setPrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
    const owner = tronWeb.address.fromHex(tronWeb.defaultAddress.hex);
    console.log('Owner:', owner);

    const splitter = await tronWeb.contract(splitterABI, SPLITTER_ADDRESS);

    console.log('=== TronPaymentSplitter 测试 ===\n');

    // 1. 创建百分比分账
    console.log('1. 创建百分比分账:');
    const beneficiaries = [
        [owner, 6000, 0, 0],       // 60%
        ['TAddress2...', 4000, 0, 0]     // 40%
    ];

    const splitId = await splitter.createSplit(
        USDT_ADDRESS,
        0,  // Percentage mode
        '1000000',  // Min 1 USDT
        beneficiaries
    ).send({ from: owner, shouldPollResponse: true });

    console.log('   Tx:', splitId);
    console.log('   Split ID:', Object.values(splitId)[0]);

    // 2. 获取分账详情
    console.log('\n2. 分账详情:');
    const split = await splitter.splits(1);
    console.log('   Token:', split.token);
    console.log('   Mode:', split.mode); // 0=Percentage
    console.log('   Min Amount:', (Number(BigInt(split.minAmount)) / 1e6).toLocaleString(), 'USDT');

    // 3. 获取受益人列表
    console.log('\n3. 受益人列表:');
    const beneficiariesList = await splitter.getBeneficiaries(1).call();
    beneficiariesList.forEach((b, i) => {
        console.log(`   ${i + 1}. Account: ${b[0]}`);
        console.log(`      Percentage: ${Number(BigInt(b[1])) / 100}%`);
        console.log(`      Active: ${b[3]}`);
    });

    // 4. 计算分配
    console.log('\n4. 计算分配:');
    const distribution = await splitter.calculateDistribution(1, '10000000').call();
    console.log('   Total: 10 USDT 分配如下:');
    distribution.forEach((share, i) => {
        console.log(`      Beneficiary ${i + 1}: ${(Number(BigInt(share)) / 1e6).toLocaleString()} USDT`);
    });

    // 5. 测试暂停/恢复
    console.log('\n5. 暂停/恢复分账:');
    await splitter.pauseSplit(1)
        .send({ from: owner, shouldPollResponse: true });

    const pausedState = (await splitter.splits(1)).paused;
    console.log('   Paused:', pausedState === true);

    await splitter.unpauseSplit(1)
        .send({ from: owner, shouldPollResponse: true });

    console.log('   Unpaused');

    // 6. 添加新受益人
    console.log('\n6. 添加受益人:');
    const newBeneficiary = [
        'TAddress3...',  // 新的受益人
        2000,            // 20%
        0,               // 0 USDT
        0                // Tier 0
    ];

    await splitter.addBeneficiary(1, newBeneficiary)
        .send({ from: owner, shouldPollResponse: true });

    console.log('   Added new beneficiary (20%)');

    console.log('\n✅ TronPaymentSplitter测试完成!');
}
```

---

## TronYieldAggregator.sol - 收益聚合器

### 文件位置
`contracts/contracts/tron/TronYieldAggregator.sol`

### 合约地址
- **Nile Testnet**: `TC6bpE1t1EderDzXZq1nuRDf8QRhQHgkgy`
- **TRONScan**: https://nile.tronscan.org/#/contract/TC6bpE1t1EderDzXZq1nuRDf8QRhQHgkgy

### 合约功能
自动将闲置资金存入JustLend赚取利息，支持实时APY查询、收益分配和灵活提现。

### 接口说明

#### 构造函数
```solidity
constructor(
    address _justLend,
    address _unitroller,
    address _oracle,
    address[] memory _initialTokens,
    address[] memory _initialJTokens
)
```
- **参数**:
  - `_justLend` - JustLend协议地址
  - `_unitroller` - Unitroller地址
  - `_oracle` - 价格预言机地址
  - `_initialTokens` - 初始支持的代币
  - `_initialJTokens` - 初始jToken地址

---

#### 存取款操作

##### deposit(address token, uint256 amount)
```solidity
function deposit(address token, uint256 amount)
    external
    nonReentrant
    whenDepositsNotPaused
    returns (uint256 principal)
```
- **功能**: 存入代币，自动质押到JustLend
- **参数**:
  - `token` - TRC20代币地址
  - `amount` - 存入数量
- **返回值**: 获得的jToken数量（即本金）
- **事件**: `Deposited`
- **错误**:
  - `InvalidAddress` - 地址无效
  - `InvalidAmount` - 金额为0
  - `TokenNotSupported` - 代币不支持

##### withdraw(address token, uint256 amount)
```solidity
function withdraw(address token, uint256 amount)
    external
    nonReentrant
    whenWithdrawalsNotPaused
    returns (
        uint256 withdrawnAmount,
        uint256 principalAmount,
        uint256 interestAmount
    )
```
- **功能**: 提现代币，自动计算本金vs利息
- **参数**:
  - `token` - TRC20代币地址
  - `amount` - 提取数量（0=全部）
- **返回值**:
  - `withdrawnAmount` - 实际提取数量
  - `principalAmount` - 本金数量
  - `interestAmount` - 利息数量
- **事件**: `Withdrawn`

---

#### 余额查询

##### getMerchantBalance(address merchant, address token)
```solidity
function getMerchantBalance(address merchant, address token)
    external
    view
    returns (
        uint256 balance,      // 总余额（本金+利息）
        uint256 principal,       // 本金
        uint256 interest        // 累积利息
    )
```
- **测试代码**:
```javascript
const vault = await tronWeb.contract(AGGREGATOR_ABI, AGGREGATOR_ADDRESS);
const [balance, principal, interest] = vault.getMerchantBalance(
    'TMerchantAddress...',
    USDT_ADDRESS
).call();

console.log('Total Balance:', (Number(balance) / 1e6).toLocaleString(), 'USDT');
console.log('Principal:', (Number(principal) / 1e6).toLocaleString(), 'USDT');
console.log('Interest:', (Number(interest) / 1e6).toLocaleString(), 'USDT');
```

##### getMerchantBalanceIncludingAccrued(address merchant, address token) -
包括应计利息

##### getTokenAPY(address token) - 获取代币APY
```solidity
function getTokenAPY(address token)
    external view
    returns (
        uint256 apy,            // APY (scaled by 1e16, 如 5,000,000,000 = 5.00%)
        uint256 exchangeRate // jToken汇率
    )
```

---

#### 收益分配

##### setYieldRecipients(...)
```solidity
function setYieldRecipients(
    address token,
    YieldRecipient[] memory recipients
) external onlyOwner
```
- **测试代码**:
```javascript
const recipients = [
    ['TAddress1', 6000, 0],
    ['TAddress2', 4000, 0]
]);

await vault.setYieldRecipients(USDT_ADDRESS, recipients)
    .send({ from: owner });
```

##### distributeYield(address token, YieldRecipient[] memory recipients)
```solidity
function distributeYield(
    address token,
    YieldRecipient[] memory recipients
) external onlyOwner;
```

---

#### 管理功能

##### addToken(...) / removeToken(...) - 代币管理
##### toggleAutoCompound(bool enabled) - 切换自动复利
##### pauseDeposits() / unpauseDeposits() - 暂停/恢复存款
##### pauseWithdrawals() / unpauseWithdrawals() - 暂停/恢复提现
##### updateAPY(address token, uint256 apy) - 更新APY

---

#### 查询函数

##### getSupportedTokens() - 获取支持的代币列表
```solidity
function getSupportedTokens() external view returns (address[] memory);
```

##### getTokenBalance(address token) - 获取合约代币余额

##### getTotalDeposits(address token) - 获取总存款

##### getTotalInterest(address token) - 获取总利息

##### getTVL() - 获取总锁仓量(TVL)

##### getStats() - 获取合约统计
```solidity
function getStats()
    external
    view
    returns (
        uint256 activeMerchants,
        uint256 supportedTokenCount,
        uint256 tvl,
        bool autoCompound,
        bool depositsPaused,
        bool withdrawalsPaused
    );
```

---

### 完整测试代码

```javascript
const { TronWeb } = require('tronweb');
require('dotenv').config();

const AGGREGATOR_ADDRESS = 'TC6bpE1t1EderDzXZq1nuRDf8QRhQHgkgy';

const aggregatorABI = JSON.parse(
    fs.readFileSync('artifacts/tron/TronYieldAggregator.abi.json', 'utf8')
);

async function testYieldAggregator() {
    const tronWeb = new TronWeb({
        fullNode: 'https://nile.trongrid.io',
        solidityNode: 'https://nile.trongrid.io',
        eventServer: 'https://nile.trongrid.io'
    });

    tronWeb.setPrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
    const merchant = tronWeb.address.fromHex(tronWeb.defaultAddress.hex);
    console.log('Merchant:', merchant);

    const aggregator = await tronWeb.contract(aggregatorABI, AGGREGATOR_ADDRESS);

    console.log('=== TronYieldAggregator 测试 ===\n');

    // 1. 基础配置
    console.log('1. 合约配置:');
    const owner = await aggregator.owner().call();
    console.log('   Owner:', owner);

    const autoCompound = await aggregator.autoCompoundEnabled().call();
    console.log('   Auto Compound:', autoCompound);

    // 2. 支持的代币
    console.log('\n2. 支持的代币:');
    const tokens = await aggregator.getSupportedTokens().call();
    tokens.forEach((token, i) => {
        console.log(`  ${i + 1}. ${token}`);
    });

    if (tokens.length > 0) {
        const usdtAddress = tokens[0];

        // 3. 商户余额
        console.log('\n3. 商户余额:');
        const [total, principal, interest] = await aggregator.getMerchantBalance(
            merchant,
            usdtAddress
        ).call();

        console.log(`   Total: ${(Number(total) / 1e6).toLocaleString()} USDT`);
        console.log(`   Principal: ${(Number(principal) / 1e6).toLocaleString()} USDT`);
        console.log(`   Interest: ${(Number(interest) / 1e6).toLocaleString()} USDT`);
        console.log(`   Active: ${(Number(total) > 0)}`);

        // 4. APY查询
        console.log('\n4. APY信息:');
        const [apy, exchangeRate] = await aggregator.getTokenAPY(usdtAddress).call();
        console.log(`   APY: ${(Number(apy) / 1e14).toFixed(2)}%`); // 1e16 = 10000 * 1e14 = 100%
        console.log(`   Exchange Rate: ${(Number(exchangeRate) / 1e18).toFixed(6)}`);

        // 5. 合约统计
        console.log('\n5. 合约统计:');
        const stats = await aggregator.getStats().call();
        console.log('   Active Merchants:', Number(BigInt(stats[0])));
        console.log('   Supported Tokens:', Number(BigInt(stats[1])));
        console.log('   TVL:', (Number(BigInt(stats[2])) / 1e18).toLocaleString(), 'USD');

        // 6. 测试自动复利开关
        console.log('\n6. 自动复利开关:');
        console.log('   Current:', autoCompound);
        await aggregator.toggleAutoCompound(false).send({
            from: merchant,
            shouldPollResponse: true,
            feeLimit: 100000000
        });
        const off = await aggregator.autoCompoundEnabled().call();
        console.log('   After toggle:', off);

        // 暂停/恢复
        console.log('\n7. 暂停/恢复:');
        await aggregator.pauseDeposits().send({ from: merchant });
        console.log('   Deposits Paused');

        const depositPaused = await aggregator.depositPaused().call();
        console.log('   Verification:', depositPaused === true);
    }

    console.log('\n✅ TronYieldAggregator测试完成!');
}
```

---

## 使用指南

### 快速开始

```bash
# 1. 编译所有TRON合约
npm run tron:compile

# 2. 部署到Nile测试网
node scripts/deploy-tron-simple.js        # 多签金库
node scripts/deploy-splitter.js         # 自动分账
node scripts/deploy-yield-aggregator.js   # 收益聚合器

# 3. 测试已部署的合约
node scripts/test-vault-final.js      # 测试多签金库
node scripts/test-splitter-simple.js    # 测试自动分账
node scripts/test-yield-basic.js       # 测试收益聚合器
```

### 常用命令

#### 查看合约状态
```javascript
const tronWeb = new TronWeb({
    fullNode: 'https://nile.trongrid.io'
});

// 连接合约
const vault = await tronWeb.contract(VAULT_ABI, VAULT_ADDRESS);

// 查询状态
const threshold = await vault.threshold().call();
const balance = await vault.nextPaymentId().call();
```

#### 监听事件
```javascript
vault.events.PaymentProposed()
    .on('data', (event) => {
        console.log('Payment Proposed:', event.returnValues);
    });
```

### 安全最佳实践

1. **多签配置**
   - 至少3个签名者
   - 阈值: 2/3 或 3/5
   - 签名者分散存储

2. **时间锁设置**
   - 小额: 1-4小时
   - 中额: 24小时
   - 额: 3-7天

3. **每日限额**
   - 小型团队: 1,000 - 5,000 USDT
   - 中型团队: 10,000 - 50,000 USDT
   - 大型企业: 100,000 - 500,000 USDT

4. **测试环境**
   - 使用Nile测试网进行测试
   - 小额测试，逐步增加金额
   - 验证所有功能后再部署到主网

### TRON资源管理

#### Energy获取
```javascript
// 冻结TRX获取Energy（1000 TRX冻结3天 = 30000 Energy）
const freezeTx = await tronWeb.transactionBuilder.freezeBalance(
    1000,     // 金额
    3,         // 天数
    "ENERGY",
    tronWeb.defaultAddress.base58
);

const signedTx = await tronWeb.trx.sign(freezeTx);
const result = await tronWeb.trx.sendRawTransaction(signedTx);
```

#### Bandwidth获取
```javascript
// 冻结TRX获取Bandwidth
const freezeTx = await tronWeb.transactionBuilder.freezeBalance(
    1000,
    3,
    "BANDWIDTH",
    tronWeb.defaultAddress.base58
);
```

---

## 附录

### A. 合约地址汇总

| 合约 | Nile测试网地址 | TRONScan链接 |
|------|-----------|--------------|
| TronPaymentVault | `TSrRLNoyJmVNZMg6jA8hUzABxHA1ZBFGM` | [链接](https://nile.tronscan.org/#/contract/TSrRLNoyJmVNZMg6jA8hUzABxHA1ZBFGM) |
| TronPaymentSplitter | `TDJwns4C2Frp4wVnrqyz4Ud6SYoxc9nk7Z` | [链接](https://nile.tronscan.org/#/contract/TDJwns4C2Frp4wVnrqyz4Ud6SYoxc9nk7Z) |
| TronYieldAggregator | `TC6bpE1t1EderDzXZq1nuRDf8QRhQHgkgy` | [链接](https://nile.tronscan.org/#/contract/TC6bpE1t1EderDzXZq1nuRDf8QRhQHgkgy) |

### B. 常用地址

| 网络 | RPC URL | 水龙头 |
|------|---------|--------|
| Nile Testnet | https://nile.trongrid.io | https://nileex.io/join/getJoinPage |
| Mainnet | https://api.trongrid.io | https://tronscan.org |

### C. 技术参考

- [TRON开发文档](https://developers.tron.network)
- [TronGrid API](https://www.trongrid.io/dashboard)
- [TronWeb SDK](https://tronweb.network)
- [Solidity文档](https://docs.soliditylang.org)
- [OpenZeppelin](https://docs.openzeppelin.com)

### D. 许可证

MIT License

---

**文档版本**: v1.0.0
**最后更新**: 2026-02-08
