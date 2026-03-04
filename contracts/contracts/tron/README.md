# TRON Smart Contracts

TRON鍖哄潡閾炬櫤鑳藉悎绾﹂泦鍚堬紝涓篜rotocol Banks鎻愪緵TRC20鏀粯銆佸绛鹃噾搴撱€佽嚜鍔ㄥ垎璐﹀拰鏀剁泭鑱氬悎鍔熻兘銆?

## 姒傝

| 鍚堢害 | 鎻忚堪 | 鐘舵€?|
|------|------|------|
| `ITRC20.sol` | TRC20浠ｅ竵鎺ュ彛鏍囧噯 | 鉁?瀹屾垚 |
| `TronPaymentVault.sol` | 澶氱鏀粯閲戝簱 | 鉁?瀹屾垚 |
| `TronPaymentSplitter.sol` | 鑷姩鍒嗚处鍚堢害 | 鉁?瀹屾垚 |
| `IJustLend.sol` | JustLend鍗忚鎺ュ彛 | 鉁?瀹屾垚 |
| `TronYieldAggregator.sol` | 鏀剁泭鑱氬悎鍣?| 鉁?瀹屾垚 |
| `Mocks.sol` | 娴嬭瘯Mock鍚堢害 | 鉁?瀹屾垚 |

---

## 1. ITRC20.sol - TRC20浠ｅ竵鎺ュ彛

### 鎻忚堪

TRON鍖哄潡閾惧吋瀹圭殑ERC20浠ｅ竵鎺ュ彛鏍囧噯銆傝櫧鐒禩RON浣跨敤Base58鍦板潃鏍煎紡锛圱鍓嶇紑锛夛紝浣嗘櫤鑳藉悎绾﹀唴閮ㄤ粛浣跨敤20瀛楄妭鍦板潃锛堜笌浠ュお鍧婄浉鍚岋級銆?

### 鍔熻兘

- 鏍囧噯ERC20鍑芥暟锛歚transfer`, `approve`, `transferFrom`, `balanceOf`, `allowance`
- 鍏冩暟鎹嚱鏁帮細`name`, `symbol`, `decimals`
- 浜嬩欢锛歚Transfer`, `Approval`

### 浣跨敤绀轰緥

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

## 2. TronPaymentVault.sol - 澶氱鏀粯閲戝簱

### 鎻忚堪

涓轰紒涓氱骇鏀粯鎻愪緵瀹夊叏鐨凾RC20浠ｅ竵澶氱绠＄悊锛屾敮鎸佹椂闂撮攣銆佹瘡鏃ラ檺棰濆拰绱ф€ユ仮澶嶆満鍒躲€?

### 鏍稿績鍔熻兘

#### 澶氱鏈哄埗
- **绛惧悕鑰呯鐞?*锛氭坊鍔?绉婚櫎绛惧悕鑰咃紝鍔ㄦ€佽皟鏁撮槇鍊?
- **鏀粯鎻愭**锛氱鍚嶈€呮彁浜ゆ敮浠樻彁妗?
- **鏀粯瀹℃壒**锛氳揪鍒伴槇鍊煎悗浠讳綍浜洪兘鍙墽琛屾敮浠?

#### 瀹夊叏鎺у埗
- **鏃堕棿閿?*锛氭敮浠樻彁璁悗闇€绛夊緟涓€瀹氭椂闂存墠鑳芥墽琛岋紙榛樿24灏忔椂锛?
- **姣忔棩闄愰**锛氶槻姝㈠崟鏃ヨ褰诲簳娓呯┖
- **鍙殏鍋?*锛氱洃鎶や汉鍙殏鍋滃悎绾?
- **绱ф€ュ彇娆?*锛氭椂闂撮攣淇濇姢鐨勭揣鎬ュ彇娆炬満鍒?

### 鍔熻兘鍑芥暟

#### 鏀粯鎻愭涓庢墽琛?

```solidity
// 1. 鎻愯鏀粯锛堢鍚嶈€咃級
function proposePayment(
    address token,      // TRC20浠ｅ竵鍦板潃
    address to,         // 鎺ユ敹鍦板潃
    uint256 amount,     // 閲戦
    bytes calldata data // 鍙€夎皟鐢ㄦ暟鎹?
) external onlySigner returns (uint256 paymentId)

// 2. 鎵瑰噯鏀粯锛堢鍚嶈€咃級
function approvePayment(uint256 paymentId) external onlySigner

// 3. 鎵ц鏀粯锛堜换浣曚汉锛?
function executePayment(uint256 paymentId) external whenNotPaused

// 4. 鍙栨秷鏀粯锛堢鍚嶈€咃級
function cancelPayment(uint256 paymentId) external onlySigner
```

#### 绛惧悕鑰呯鐞?

```solidity
// 娣诲姞绛惧悕鑰?
function addSigner(address newSigner) external onlySigner

// 绉婚櫎绛惧悕鑰?
function removeSigner(address signer) external onlySigner

// 鏇存柊闃堝€?
function updateThreshold(uint256 newThreshold) external onlySigner
```

#### 绱ф€ユ満鍒?

```solidity
// 鏆傚仠鍚堢害
function pause() external onlyGuardian

// 鎭㈠鍚堢害
function unpause() external onlyGuardian

// 璇锋眰绱ф€ュ彇娆?
function requestEmergencyWithdrawal(
    address to,
    address token,
    uint256 amount
) external onlyGuardian

// 鎵ц绱ф€ュ彇娆?
function executeEmergencyWithdrawal(
    address to,
    address token,
    uint256 amount,
    uint256 requestTimestamp
) external onlyGuardian
```

### 浜嬩欢

| 浜嬩欢 | 鎻忚堪 |
|------|------|
| `PaymentProposed` | 鏀粯鎻愯鍒涘缓 |
| `PaymentApproved` | 鏀粯鑾峰緱鎵瑰噯 |
| `PaymentExecuted` | 鏀粯宸叉墽琛?|
| `PaymentCancelled` | 鏀粯宸插彇娑?|
| `SignerAdded` | 绛惧悕鑰呮坊鍔?|
| `SignerRemoved` | 绛惧悕鑰呯Щ闄?|
| `ThresholdUpdated` | 闃堝€兼洿鏂?|
| `VaultPaused` | 鍚堢害鏆傚仠 |
| `VaultUnpaused` | 鍚堢害鎭㈠ |
| `EmergencyWithdrawalRequested` | 绱ф€ュ彇娆捐姹?|
| `EmergencyWithdrawalExecuted` | 绱ф€ュ彇娆炬墽琛?|

### 閮ㄧ讲绀轰緥

```javascript
// 浣跨敤TronWeb閮ㄧ讲
const TronWeb = require('tronweb');
const tronWeb = new TronWeb({
    fullNode: 'https://api.trongrid.io',
    solidityNode: 'https://api.trongrid.io',
    eventServer: 'https://api.trongrid.io'
});

// 鍚堢害瀛楄妭鐮佸拰ABI
const contract = tronWeb.contract(abi, bytecode);

// 閮ㄧ讲鍙傛暟
const initialSigners = [
    'TAddress1...',
    'TAddress2...',
    'TAddress3...'
];
const threshold = 2; // 闇€瑕?/3绛惧悕
const guardian = 'TGuardianAddress...';
const supportedTokens = [
    'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', // USDT
    'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8'  // USDC
];
const timelock = 86400; // 24灏忔椂
const dailyLimit = 1000000 * 1e6; // 姣忓ぉ100涓嘦SDT

// 閮ㄧ讲
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

### 浣跨敤鍦烘櫙

1. **浼佷笟璧勯噾绠＄悊**锛氶渶瑕佸涓鎵规墠鑳芥敮浠?
2. **椤圭洰鍥㈤槦**锛氬绛捐祫閲戝畨鍏?
3. **DAO娌荤悊**锛氭彁妗?鎶曠エ妯″紡
4. **瀹夊叏瀛樺偍**锛氭椂闂撮攣+姣忔棩闄愰鍙岄噸淇濇姢

---

## 3. TronPaymentSplitter.sol - 鑷姩鍒嗚处鍚堢害

### 鎻忚堪

鑷姩灏嗘帴鏀剁殑TRC20浠ｅ竵鍒嗗彂缁欏涓彈鐩婁汉锛屾敮鎸佺櫨鍒嗘瘮銆佸浐瀹氶噾棰濆拰鍒嗗眰涓夌鍒嗚处妯″紡銆?

### 鍒嗚处妯″紡

#### 1. 鐧惧垎姣斿垎璐?(`Percentage`)
姣忎釜鍙楃泭浜烘寜鐧惧垎姣旇幏寰椾唤棰濓紙鎬诲拰蹇呴』涓?00%锛?

```
渚嬪瓙锛?0000 USDT鍒嗚处
鈹溾攢鈹€ 鍙楃泭浜篈 (50%)  鈫?5000 USDT
鈹溾攢鈹€ 鍙楃泭浜築 (30%)  鈫?3000 USDT
鈹斺攢鈹€ 鍙楃泭浜篊 (20%)  鈫?2000 USDT
```

#### 2. 鍥哄畾閲戦鍒嗚处 (`Fixed`)
姣忎釜鍙楃泭浜鸿幏寰楀浐瀹氶噾棰?

```
渚嬪瓙锛?0000 USDT鍒嗚处
鈹溾攢鈹€ 鍙楃泭浜篈 (4000) 鈫?4000 USDT
鈹溾攢鈹€ 鍙楃泭浜築 (3000) 鈫?3000 USDT
鈹斺攢鈹€ 鍙楃泭浜篊 (鍓╀綑) 鈫?3000 USDT
```

#### 3. 鍒嗗眰鍒嗚处 (`Tiered`)
鏍规嵁鍒嗗眰绾у埆鍒嗛厤浠介

```
渚嬪瓙锛?0000 USDT鍒嗚处
鈹溾攢鈹€ 鍙楃泭浜篈 (Tier 3) 鈫?50%
鈹溾攢鈹€ 鍙楃泭浜築 (Tier 2) 鈫?33%
鈹斺攢鈹€ 鍙楃泭浜篊 (Tier 1) 鈫?17%
```

### 鍔熻兘鍑芥暟

#### 鍒嗚处绠＄悊

```solidity
// 鍒涘缓鍒嗚处
function createSplit(
    address token,                    // TRC20浠ｅ竵鍦板潃
    SplitMode mode,                   // 鍒嗚处妯″紡
    uint256 minAmount,                // 鏈€灏忓垎璐﹂噾棰?
    Beneficiary[] memory beneficiaries // 鍒濆鍙楃泭浜?
) external onlyOwner returns (uint256 splitId)

// 娣诲姞鍙楃泭浜?
function addBeneficiary(
    uint256 splitId,
    Beneficiary memory beneficiary
) external onlyOwner

// 鏇存柊鍙楃泭浜?
function updateBeneficiary(
    uint256 splitId,
    address beneficiaryAddress,
    uint256 newPercentage,
    uint256 newFixedAmount
) external onlyOwner

// 绉婚櫎鍙楃泭浜?
function removeBeneficiary(
    uint256 splitId,
    address beneficiaryAddress
) external onlyOwner
```

#### 鍒嗚处鎵ц

```solidity
// 鎵ц鍒嗚处锛堜唬甯侀渶浜嬪厛鎺堟潈锛?
function executeSplit(
    uint256 splitId,
    uint256 amount
) external validSplit(splitId)
```

#### 鏌ヨ鍑芥暟

```solidity
// 鑾峰彇鍒嗚处璇︽儏
function getSplit(uint256 splitId) external view returns (...)

// 鑾峰彇鍙楃泭浜哄垪琛?
function getBeneficiaries(uint256 splitId) external view returns (...)

// 璁＄畻棰勬湡鍒嗛厤
function calculateDistribution(uint256 splitId, uint256 amount)
    external view returns (uint256[] memory shares)
```

### 浣跨敤绀轰緥

#### 鐧惧垎姣斿垎璐?

```javascript
// 鍒涘缓鍒嗚处閰嶇疆
const beneficiaries = [
    { account: '0x...', percentage: 5000, fixedAmount: 0, tier: 0 }, // 50%
    { account: '0x...', percentage: 3000, fixedAmount: 0, tier: 0 }, // 30%
    { account: '0x...', percentage: 2000, fixedAmount: 0, tier: 0 }  // 20%
];

// USDT鍦板潃
const usdtAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// 鍒涘缓鍒嗚处
const splitId = await splitter.createSplit(
    usdtAddress,
    0, // SplitMode.Percentage
    1000 * 1e6, // 鏈€灏?000 USDT
    beneficiaries
).send({ from: deployerAddress });

// 鎵ц鍒嗚处锛?0000 USDT锛?
// 1. 鍏堟巿鏉冨悎绾?
await usdt.approve(splitter.address, 10000 * 1e6).send({ from: payerAddress });
// 2. 鎵ц鍒嗚处
await splitter.executeSplit(splitId, 10000 * 1e6).send({ from: payerAddress });
```

#### 鍥哄畾閲戦鍒嗚处

```javascript
const beneficiaries = [
    { account: '0x...', percentage: 0, fixedAmount: 4000 * 1e6, tier: 0 },
    { account: '0x...', percentage: 0, fixedAmount: 3000 * 1e6, tier: 0 },
    { account: '0x...', percentage: 0, fixedAmount: 2000 * 1e6, tier: 0 }
];

await splitter.createSplit(
    usdtAddress,
    1, // SplitMode.Fixed
    10000 * 1e6, // 鏈€灏?0000 USDT
    beneficiaries
).send({ from: deployerAddress });
```

### 浣跨敤鍦烘櫙

1. **鏀粯缃戝叧鍒嗚处**锛氳嚜鍔ㄥ垎閰嶄氦鏄撴墜缁垂
2. **鍚堜綔浼欎即鍒嗘垚**锛氭寜姣斾緥鍒嗛厤鏀剁泭
3. **宸ヨ祫鍙戞斁**锛氬浐瀹氶噾棰濆彂鏀?
4. **椤圭洰璧勯噾鍒嗛厤**锛氭寜灞傜骇鍒嗛厤璧勬簮
5. **鏀剁泭鍒嗘垚**锛氭寜璐＄尞搴﹀垎閰?

### 浜嬩欢

| 浜嬩欢 | 鎻忚堪 |
|------|------|
| `SplitCreated` | 鍒嗚处鍒涘缓 |
| `SplitExecuted` | 鍒嗚处鎵ц |
| `BeneficiaryAdded` | 鍙楃泭浜烘坊鍔?|
| `BeneficiaryUpdated` | 鍙楃泭浜烘洿鏂?|
| `BeneficiaryRemoved` | 鍙楃泭浜虹Щ闄?|
| `Claimed` | 鍙楃泭浜洪鍙?|
| `SplitPaused` | 鍒嗚处鏆傚仠 |
| `SplitUnpaused` | 鍒嗚处鎭㈠ |

---

## TRON鏅鸿兘鍚堢害寮€鍙戞寚鍗?

### TRON鍦板潃鏍煎紡

TRON鏅鸿兘鍚堢害鍐呴儴浣跨敤20瀛楄妭鍦板潃锛堜笌浠ュお鍧婄浉鍚岋級锛屼絾鍦ㄥ閮ㄦ樉绀轰负Base58鏍煎紡锛?

```
鍚堢害鍐呴儴锛?x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2 (20瀛楄妭)
澶栭儴鏄剧ず锛歍7ZRcQd1m9v5Hg7tYcX1Y2Z3a4B5C6D7E8F9G0H1I (Base58, 34瀛楃)
```

### TRON Gas鏈哄埗

TRON浣跨敤**Energy**鍜?*Bandwidth**鑰岄潪浼犵粺鐨凣as锛?

- **Bandwidth**: 瀛樺偍鍜屼紶杈撴暟鎹紙鍏嶈垂5000/澶╋級
- **Energy**: 鎵ц鏅鸿兘鍚堢害锛堝喕缁揟RX鑾峰彇锛?
- **TRX**: TRON鍘熺敓浠ｅ竵锛? TRX 鈮?0.0001 USD锛?

### TRON鍏煎鐨凷olidity鐗规€?

| 鐗规€?| 鏀寔 | 璇存槑 |
|------|------|------|
| Solidity鐗堟湰 | 鈮?0.8.20 | TRON TVM鏈夌増鏈檺鍒?|
| ERC20鏍囧噯 | 鉁?| TRC20瀹屽叏鍏煎 |
| ERC721鏍囧噯 | 鉁?| TRC721瀹屽叏鍏煎 |
| OpenZeppelin | 鉁?| 澶ч儴鍒嗗彲鐢?|
| 浜嬩欢鏃ュ織 | 鉁?| 鏀寔 indexed 绱㈠紩 |
| 閲嶅叆淇濇姢 | 鉁?| `nonReentrant` 淇グ绗﹀彲鐢?|

### TRON涓嶦VM鐨勫樊寮?

| 鐗规€?| EVM (浠ュお鍧? | TRON |
|------|-------------|------|
| 鍦板潃鏍煎紡 | 0x鍓嶇紑锛?2瀛楃 | T鍓嶇紑锛孊ase58锛?4瀛楃 |
| 鍘熺敓浠ｅ竵 | ETH (18浣嶅皬鏁? | TRX (6浣嶅皬鏁? |
| Gas鏈哄埗 | Gas娑堣€?+ Gas浠锋牸 | Energy + Bandwidth |
| 鍖哄潡鏃堕棿 | ~12绉?| ~3绉?|
| 涓荤綉RPC | https://eth.llamarpc.com | https://api.trongrid.io |
| 娴嬭瘯缃慠PC | Sepolia | https://nile.trongrid.io |
| USDT浠ｅ竵 | ERC20 USDT (0xdAC17F...) | TRC20 USDT (TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t) |

---

## 閮ㄧ讲娴佺▼

### 鍓嶆彁鏉′欢

1. 瀹夎TronWeb
```bash
npm install tronweb
```

2. 鑾峰彇TRON API瀵嗛挜锛堝彲閫夛級
```bash
# https://www.trongrid.io 娉ㄥ唽鍏嶈垂API瀵嗛挜
```

### 閮ㄧ讲姝ラ

#### 1. 缂栬瘧鍚堢害

```bash
cd contracts
npx hardhat compile
```

#### 2. 閰嶇疆hardhat.config.ts

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
      accounts: [...] // 浣犵殑绉侀挜
    },
    tron_mainnet: {
      url: "https://api.trongrid.io",
      accounts: [...]
    }
  }
};

export default config;
```

#### 3. 閮ㄧ讲鑴氭湰

```typescript
// scripts/deploy-tron.ts
import hre from "hardhat";

async function main() {
  console.log("Deploying TRON contracts...");

  // 閮ㄧ讲TronPaymentVault
  const Vault = await hre.ethers.getContractFactory("TronPaymentVault");
  const vault = await Vault.deploy(
    ["0x...", "0x...", "0x..."], // 绛惧悕鑰?
    2, // 闃堝€?
    "0x...", // 鐩戞姢浜?
    ["TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"], // 鏀寔鐨勪唬甯?
    86400, // 鏃堕棿閿?
    1000000 * 1e6 // 姣忔棩闄愰
  );
  await vault.waitForDeployment();
  console.log("TronPaymentVault deployed to:", await vault.getAddress());

  // 閮ㄧ讲TronPaymentSplitter
  const Splitter = await hre.ethers.getContractFactory("TronPaymentSplitter");
  const splitter = await Splitter.deploy(
    "0x...", // 鎵€鏈夎€?
    ["TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"] // 鏀寔鐨勪唬甯?
  );
  await splitter.waitForDeployment();
  console.log("TronPaymentSplitter deployed to:", await splitter.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

#### 4. 鎵ц閮ㄧ讲

```bash
# Nile娴嬭瘯缃?
npx hardhat run scripts/deploy-tron.ts --network tron_nile

# 涓荤綉
npx hardhat run scripts/deploy-tron.ts --network tron_mainnet
```

---

## 鍚堢害浜や簰绀轰緥

### 浣跨敤TronWeb涓庡悎绾︿氦浜?

```javascript
const TronWeb = require('tronweb');

// 鍒濆鍖?
const tronWeb = new TronWeb({
    fullNode: 'https://nile.trongrid.io',
    solidityNode: 'https://nile.trongrid.io',
    eventServer: 'https://nile.trongrid.io'
});

// 杩炴帴鍒板凡閮ㄧ讲鐨勫悎绾?
const vaultAddress = 'TVaultAddress...';
const vault = await tronWeb.contract(abi, vaultAddress);

// 鑾峰彇绛惧悕鑰?
const signers = await vault.getSigners().call();
console.log('Signers:', signers);

// 鎻愯鏀粯
const paymentId = await vault.proposePayment(
    'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', // USDT
    'TRecipientAddress...',
    1000 * 1e6, // 1000 USDT
    '0x' // 绌烘暟鎹?
).send({
    from: tronWeb.defaultAddress.base58
});
console.log('Payment proposed:', paymentId);

// 鎵瑰噯鏀粯
await vault.approvePayment(paymentId).send({
    from: tronWeb.defaultAddress.base58
});

// 鎵ц鏀粯
await vault.executePayment(paymentId).send({
    from: tronWeb.defaultAddress.base58
});
```

### 浜嬩欢鐩戝惉

```javascript
// 鐩戝惉鏀粯鎵ц浜嬩欢
vault.events.PaymentExecuted()
    .on('data', (event) => {
        console.log('Payment executed:', event);
        const { paymentId, token, to, amount } = event.returnValues;
        console.log(`Payment ${paymentId}: ${amount} ${token} to ${to}`);
    })
    .on('error', console.error);
```

---

## 瀹夊叏鏈€浣冲疄璺?

### 1. 澶氱閰嶇疆

- **鏈€灏忕鍚嶈€?*: 鑷冲皯3涓鍚嶈€?
- **鎺ㄨ崘闃堝€?*: 2/3 鎴?3/5
- **绛惧悕鑰呭垎甯?*: 涓嶅悓鍦扮悊浣嶇疆銆佷笉鍚岀‖浠堕挶鍖?

### 2. 鏃堕棿閿佽缃?

| 椋庨櫓绛夌骇 | 鎺ㄨ崘鏃堕棿閿?| 绀轰緥 |
|---------|-----------|------|
| 浣庨闄╋紙灏忛锛?| 1-4灏忔椂 | 甯歌鏀粯 |
| 涓闄╋紙涓锛?| 24灏忔椂 | 鍥㈤槦鍗忎綔 |
| 楂橀闄╋紙澶ч锛?| 3-7澶?| 璐㈠姟鎷ㄦ |

### 3. 姣忔棩闄愰

```
鎺ㄨ崘鐨勬瘡鏃ラ檺棰濊缃細
- 灏忓瀷鍥㈤槦: 1000 - 5000 USD
- 涓瀷鍥㈤槦: 10000 - 50000 USD
- 澶у瀷浼佷笟: 100000 - 500000 USD
```

### 4. 鐩戞姢浜烘満鍒?

- 鐩戞姢浜哄簲涓庣鐞嗗憳鍒嗙
- 鐩戞姢浜哄彲鏆傚仠鍚堢害
- 绱ф€ュ彇娆鹃渶瑕佹椂闂撮攣淇濇姢

### 5. 浠ｅ竵鐧藉悕鍗?

- 浠呮坊鍔犲繀瑕佺殑TRC20浠ｅ竵
- 瀹氭湡瀹℃煡鏀寔鐨勪唬甯佸垪琛?
- 鏂颁唬甯佸姞鍏ュ墠杩涜浠ｇ爜瀹¤

---

## 娴嬭瘯

### 杩愯娴嬭瘯

```bash
# 杩愯鎵€鏈夋祴璇?
npx hardhat test

# 杩愯TRON鐗瑰畾娴嬭瘯
npx hardhat test test/TronPaymentVault.test.ts
npx hardhat test test/TronPaymentSplitter.test.ts

# 杩愯娴嬭瘯瑕嗙洊鐜?
npx hardhat coverage
```

### 娴嬭瘯绀轰緥

```typescript
test("Should create and execute payment proposal", async function () {
  const [owner, signer1, signer2, recipient] = await ethers.getSigners();

  // 閮ㄧ讲Vault
  const Vault = await ethers.getContractFactory("TronPaymentVault");
  const vault = await Vault.deploy(
    [signer1.address, signer2.address],
    2, // 闃堝€?2
    owner.address,
    [usdtAddress],
    86400,
    ethers.parseUnits("1000000", 6)
  );

  // 鎻愯鏀粯
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

  // 鎵瑰噯锛坰igner1锛?
  await vault.connect(signer1).approvePayment(paymentId);

  // 鎵瑰噯锛坰igner2锛?
  await vault.connect(signer2).approvePayment(paymentId);

  // 绛夊緟鏃堕棿閿?
  await ethers.provider.send("evm_increaseTime", [86401]);
  await ethers.provider.send("evm_mine", []);

  // 鎵ц鏀粯
  await vault.executePayment(paymentId);

  // 楠岃瘉
  const balance = await usdt.balanceOf(recipient.address);
  expect(balance).to.equal(ethers.parseUnits("1000", 6));
});
```

---

## 甯歌闂

### Q1: TRON鍦板潃鏍煎紡杞崲

```javascript
// Base58 鈫?鍐呴儴鍦板潃
const base58Address = 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE';
const internalAddress = tronWeb.address.toHex(base58Address);
// 杩斿洖: "0x41a1..."

// 鍐呴儴鍦板潃 鈫?Base58
const base58 = tronWeb.address.fromHex(internalAddress);
```

### Q2: TRC20浠ｅ竵绮惧害

| 浠ｅ竵 | 绗﹀彿 | 灏忔暟浣?| 鍚堢害鍦板潃 |
|------|------|--------|---------|
| Tether USD | USDT | 6 | TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t |
| USD Coin | USDC | 6 | TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8 |
| TRON | TRX | 6 | 鍘熺敓浠ｅ竵 |

### Q3: Energy鑾峰彇

```javascript
// 鍐荤粨TRX鑾峰彇Energy锛?000 TRX鍐荤粨3澶?= 30000 Energy锛?
const freezeTx = await tronWeb.transactionBuilder.freezeBalance(
    1000, // TRX鏁伴噺
    3,    // 澶╂暟
    "ENERGY",
    tronWeb.defaultAddress.base58
);

const signedTx = await tronWeb.trx.sign(freezeTx);
const result = await tronWeb.trx.sendRawTransaction(signedTx);
```

### Q4: Bandwidth鑾峰彇

```javascript
// 璐ㄦ娂TRX鑾峰彇Bandwidth
const freezeTx = await tronWeb.transactionBuilder.freezeBalance(
    1000, // TRX鏁伴噺
    3,    // 澶╂暟
    "BANDWIDTH",
    tronWeb.defaultAddress.base58
);
```

---

## 5. IJustLend.sol - JustLend鍗忚鎺ュ彛

### 鎻忚堪

JustLend鍗忚鐨勬櫤鑳藉悎绾︽帴鍙ｅ畾涔夛紝鍖呮嫭锛?
- `IJustLend`: JustLend鏍稿績鍗忚鎺ュ彛
- `IJustToken`: jToken锛堢敓鎭唬甯侊級鎺ュ彛
- `IJustLendPriceOracle`: 浠锋牸棰勮█鏈烘帴鍙?
- `IUnitroller`: Unitroller锛堢鐞嗗櫒锛夋帴鍙?

### 鏍稿績鍔熻兘

- **瀛樺彇娆?*: `deposit`, `redeem`, `redeemAll`
- **鍊熻捶**: `borrow`, `repayBorrow`
- **鎶垫娂绠＄悊**: `enterMarkets`, `exitMarket`
- **鏀剁泭杩借釜**: `supplyRatePerBlock`, `borrowRatePerBlock`, `getAccountLiquidity`

### 鏀寔鐨勪唬甯?

| 浠ｅ竵 | 绗﹀彿 | jToken | 涓荤綉鍦板潃 |
|------|------|--------|---------|
| Tether USD | USDT | jUSDT | TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t |
| USD Coin | USDC | jUSDC | TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8 |
| TRON | TRX | jTRX | 鍘熺敓浠ｅ竵 |

### JustLend鏀剁泭鏉ユ簮

| 鏉ユ簮 | 鏈哄埗 | APY鑼冨洿 |
|------|------|---------|
| 鍊熻捶鍒╁樊 | 鍊熸浜烘敮浠樺埄鎭?鈫?瀛樻浜鸿幏寰楁敹鐩?| 1-3% |
| TRX璐ㄦ娂 | 璐ㄦ娂TRX楠岃瘉鍖哄潡 鈫?鍒嗕韩鍖哄潡濂栧姳 | 0.5-2% |
| JUST鎸栫熆 | 娌荤悊浠ｅ竵JUST 鈫?璐ㄦ娂鑰呭叡浜?| 0.2-1% |

---

## 6. TronYieldAggregator.sol - 鏀剁泭鑱氬悎鍣?

### 鎻忚堪

鑷姩灏嗗晢鎴烽棽缃祫閲戝瓨鍏ustLend璧氬彇鍒╂伅鐨勬敹鐩婅仛鍚堝櫒锛屾敮鎸佸疄鏃禔PY鏌ヨ銆佹敹鐩婂垎閰嶅拰鐏垫椿鎻愮幇銆?

### 鏍稿績鍔熻兘

#### 鑷姩瀛樻涓庢敹鐩?
```solidity
// 瀛樺叆浠ｅ竵锛岃嚜鍔ㄨ川鎶煎埌JustLend
function deposit(address token, uint256 amount) external

// 鏌ヨ鍟嗘埛浣欓锛堟湰閲?鍒╂伅锛?
function getMerchantBalance(address merchant, address token) external view returns (uint256 balance, uint256 principal, uint256 interest)

// 鑾峰彇褰撳墠APY
function getTokenAPY(address token) external view returns (uint256 apy, uint256 exchangeRate)
```

#### 鏀剁泭鍒嗛厤
```solidity
// 鎸夌櫨鍒嗘瘮鍒嗛厤绱Н鏀剁泭
function distributeYield(address token, YieldRecipient[] memory recipients) external

// 閰嶇疆鏀剁泭鎺ユ敹鑰?
function setYieldRecipients(address token, YieldRecipient[] memory recipients) external
```

#### 鐏垫椿鎻愮幇
```solidity
// 鎻愮幇浠ｅ竵锛岃嚜鍔ㄨ绠楁湰閲憊s鍒╂伅
function withdraw(address token, uint256 amount) external returns (uint256 withdrawnAmount, uint256 principalAmount, uint256 interestAmount)
```

### 浣跨敤绀轰緥

```javascript
// 1. 瀛樻锛堣嚜鍔ㄨ川鎶硷級
await aggregator.deposit(usdtAddress, ethers.parseUnits("10000", 6));

// 2. 鏌ヨ浣欓鍜屾敹鐩?
const [balance, principal, interest] = await aggregator.getMerchantBalance(merchant, usdtAddress);
console.log(`Total: ${balance/1e6} USDT, Principal: ${principal/1e6} USDT, Interest: ${interest/1e6} USDT`);

// 3. 鏌ヨAPY
const [apy, exchangeRate] = await aggregator.getTokenAPY(usdtAddress);
console.log(`APY: ${(apy/1e16).toFixed(2)}%`);

// 4. 鏀剁泭鍒嗛厤
const recipients = [
    { account: '0x...', percentage: 6000, fixedAmount: 0 },
    { account: '0x...', percentage: 4000, fixedAmount: 0 }
];
await aggregator.distributeYield(usdtAddress, recipients);

// 5. 鎻愮幇
await aggregator.withdraw(usdtAddress, 0); // 0 = 鍏ㄩ儴鎻愮幇
```

### 鏀剁泭杩借釜

| 鎸囨爣 | 璇存槑 | 鑾峰彇鏂瑰紡 |
|------|------|---------|
| 鎬讳綑棰?| 鏈噾+鍒╂伅 | `getMerchantBalance()` |
| 鏈噾 | 鍒濆瀛樻閲戦 | `getMerchantBalance()` |
| 鍒╂伅 | 绱Н鏀剁泭 | `getMerchantBalance()` |
| APY | 骞村寲鏀剁泭鐜?| `getTokenAPY()` |
| 浜ゆ崲鐜?| jToken姹囩巼 | `getTokenAPY()` |
| TVL | 鎬婚攣浠撻噺 | `getTVL()` |

### 浜嬩欢

| 浜嬩欢 | 鎻忚堪 |
|------|------|
| `Deposited` | 鍟嗘埛瀛樻 |
| `Withdrawn` | 鍟嗘埛鎻愮幇 |
| `YieldDistributed` | 鏀剁泭鍒嗛厤 |
| `AutoCompoundToggled` | 鑷姩澶嶅埄寮€鍏冲垏鎹?|
| `TokenAdded` | 浠ｅ竵娣诲姞鏀寔 |
| `TokenRemoved` | 浠ｅ竵绉婚櫎鏀寔 |

### 瀹夊叏鐗规€?

- 閲嶅叆淇濇姢
- 鍙殏鍋滄満鍒讹紙瀛樻/鎻愮幇鍒嗙鎺у埗锛?
- 浠ｅ竵鐧藉悕鍗?
- 浣欓楠岃瘉
- 绱ф€ュ彇娆?

### 浣跨敤鍦烘櫙

1. **鍟嗘埛闂茬疆璧勯噾鏀剁泭** - 鑷姩鐢熸伅锛屾棤闇€鎵嬪姩绠＄悊
2. **璧勯噾姹犵粺涓€绠＄悊** - 璺ㄩ摼璧勯噾姹犵粺涓€绠＄悊
3. **鏀剁泭鑷姩鍒嗛厤** - 鎸夋瘮渚嬪垎閰嶇粰澶氫釜璐︽埛
4. **椋庢帶瀵瑰啿** - 甯傚満娉㈠姩鏃跺彲绱ф€ユ彁鍙?

### 璇︾粏鏂囨。

瀹屾暣鐨凾ronYieldAggregator鏂囨。璇峰弬鑰冿細`docs/TRON_YIELD_AGGREGATOR.md`

---

## 鏇存柊鏃ュ織

### v2.0.0 (2026-02-08)
- 鉁?瀹炵幇`IJustLend.sol` - JustLend鍗忚鎺ュ彛
- 鉁?瀹炵幇`TronYieldAggregator.sol` - 鏀剁泭鑱氬悎鍣?
- 鉁?瀹炵幇`Mocks.sol` - 娴嬭瘯Mock鍚堢害
- 鉁?瀹屾暣鐨凧ustLend闆嗘垚鏂囨。
- 鉁?鏀剁泭鑱氬悎鍣ㄤ娇鐢ㄦ寚鍗?
- 鉁?Prometheus鐩戞帶闆嗘垚

### v1.0.0 (2026-02-08)
- 鉁?瀹炵幇`ITRC20.sol` - TRC20浠ｅ竵鎺ュ彛
- 鉁?瀹炵幇`TronPaymentVault.sol` - 澶氱鏀粯閲戝簱
- 鉁?瀹炵幇`TronPaymentSplitter.sol` - 鑷姩鍒嗚处鍚堢害
- 鉁?瀹屾暣鏂囨。鍜屼娇鐢ㄧず渚?
- 鉁?娴嬭瘯鐢ㄤ緥瑕嗙洊

---

## 鐩稿叧璧勬簮

### TRON璧勬簮
- [TRON寮€鍙戣€呮枃妗(https://developers.tron.network)
- [TronGrid API](https://www.trongrid.io)
- [TronWeb SDK](https://tronweb.network)
- [Nile娴嬭瘯缃戞按榫欏ご](https://nileex.io/join/getJoinPage)
- [TRONScan娴忚鍣╙(https://tronscan.org)

### JustLend璧勬簮
- [JustLend瀹樼綉](https://justlend.org)
- [JustLend Nile娴嬭瘯缃慮(https://testnet.justlend.org/)
- [JustLend Docs](https://justlend.org/docs/)

### 鏅鸿兘鍚堢害寮€鍙?
- [Solidity鏂囨。](https://docs.soliditylang.org)
- [OpenZeppelin](https://docs.openzeppelin.com)
- [Hardhat](https://hardhat.org/docs)

---

## 璁稿彲璇?

GPL-3.0-only License

---

## 璐＄尞

娆㈣繋鎻愪氦Issue鍜孭ull Request锛?

---

## 鏇存柊鏃ュ織

### v1.0.0 (2026-02-08)
- 鉁?瀹炵幇`ITRC20.sol` - TRC20浠ｅ竵鎺ュ彛
- 鉁?瀹炵幇`TronPaymentVault.sol` - 澶氱鏀粯閲戝簱
- 鉁?瀹炵幇`TronPaymentSplitter.sol` - 鑷姩鍒嗚处鍚堢害
- 鉁?瀹屾暣鏂囨。鍜屼娇鐢ㄧず渚?
- 鉁?娴嬭瘯鐢ㄤ緥瑕嗙洊
