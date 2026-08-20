# TRON 鏅鸿兘鍚堢害瀹屾暣鏂囨。

> 鏈€鍚庢洿鏂? 2026-02-08
> 缃戠粶: TRON Nile Testnet

---

## 鐩綍

1. [鏂囦欢缁撴瀯鎬荤粨](#鏂囦欢缁撴瀯鎬荤粨)
2. [鍚堢害閮ㄧ讲鎬昏](#鍚堢害閮ㄧ讲鎬昏)
3. [ITRC20.sol - TRC20浠ｅ竵鎺ュ彛](#itrc20sol---trc20浠ｅ竵鎺ュ彛)
4. [IJustLend.sol - JustLend鍗忚鎺ュ彛](#ijustlendsol---justlend鍗忚鎺ュ彛)
5. [TronPaymentVault.sol - 澶氱鏀粯閲戝簱](#tronpaymentvaultsol---澶氱鏀粯閲戝簱)
6. [TronPaymentSplitter.sol - 鑷姩鍒嗚处鍚堢害](#tronpaymentsplittersol---鑷姩鍒嗚处鍚堢害)
7. [TronYieldAggregator.sol - 鏀剁泭鑱氬悎鍣╙(#tronyieldaggregatorsol---鏀剁泭鑱氬悎鍣?
8. [浣跨敤鎸囧崡](#浣跨敤鎸囧崡)

---

## 鏂囦欢缁撴瀯鎬荤粨

### 浠婂ぉ娣诲姞/淇敼鐨勬枃浠?

| 鏂囦欢璺緞 | 绫诲瀷 | 璇存槑 |
|---------|------|------|
| `contracts/contracts/tron/ITRC20.sol` | 鎺ュ彛 | TRC20浠ｅ竵鏍囧噯鎺ュ彛 |
| `contracts/contracts/tron/IJustLend.sol` | 鎺ュ彛 | JustLend鍊熻捶鍗忚鎺ュ彛 |
| `contracts/contracts/tron/TronPaymentVault.sol` | 鍚堢害 | 澶氱鏀粯閲戝簱 |
| `contracts/contracts/tron/TronPaymentSplitter.sol` | 鍚堢害 | 鑷姩鍒嗚处鍚堢害 |
| `contracts/contracts/tron/TronYieldAggregator.sol` | 鍚堢害 | 鏀剁泭鑱氬悎鍣?|
| `contracts/contracts/tron/Mocks.sol` | 鍚堢害 | 娴嬭瘯Mock鍚堢害 |
| `contracts/contracts/tron/README.md` | 鏂囨。 | 鍚堢害鍔熻兘璇存槑 |

### 缂栬瘧鍜岄儴缃茶剼鏈?

| 鏂囦欢璺緞 | 璇存槑 |
|---------|------|
| `scripts/compile-tron-v2.js` | 缂栬瘧鎵€鏈塗RON鍚堢害 |
| `scripts/compile-splitter.js` | 缂栬瘧鍒嗚处鍚堢害 |
| `scripts/compile-yield-aggregator.js` | 缂栬瘧鏀剁泭鑱氬悎鍣?|
| `scripts/deploy-tron-simple.js` | 閮ㄧ讲澶氱閲戝簱 |
| `scripts/deploy-splitter.js` | 閮ㄧ讲鍒嗚处鍚堢害 |
| `scripts/deploy-yield-aggregator.js` | 閮ㄧ讲鏀剁泭鑱氬悎鍣?|
| `scripts/test-vault-final.js` | 娴嬭瘯澶氱閲戝簱 |
| `scripts/test-splitter-simple.js` | 娴嬭瘯鍒嗚处鍚堢害 |
| `scripts/test-yield-basic.js` | 娴嬭瘯鏀剁泭鑱氬悎鍣?|

---

## 鍚堢害閮ㄧ讲鎬昏

| 鍚堢害鍚嶇О | 鍚堢害鍦板潃 | TRONScan | 鐘舵€?|
|---------|---------|----------|------|
| TronPaymentVault | `TSrRLNoyJmVNZMg6jA8hUzABxHA1ZBFGM` | [閾炬帴](https://nile.tronscan.org/#/contract/TSrRLNoyJmVNZMg6jA8hUzABxHA1ZBFGM) | 鉁?宸查儴缃?|
| TronPaymentSplitter | `TDJwns4C2Frp4wVnrqyz4Ud6SYoxc9nk7Z` | [閾炬帴](https://nile.tronscan.org/#/contract/TDJwns4C2Frp4wVnrqyz4Ud6SYoxc9nk7Z) | 鉁?宸查儴缃?|
| TronYieldAggregator | `TC6bpE1t1EderDzXZq1nuRDf8QRhQHgkgy` | [閾炬帴](https://nile.tronscan.org/#/contract/TC6bpE1t1EderDzXZq1nuRDf8QRhQHgkgy) | 鉁?宸查儴缃?|

---

## ITRC20.sol - TRC20浠ｅ竵鎺ュ彛

### 鏂囦欢浣嶇疆
`contracts/contracts/tron/ITRC20.sol`

### 鍚堢害鎻忚堪
TRON鍖哄潡閾惧吋瀹圭殑ERC20浠ｅ竵鎺ュ彛鏍囧噯銆?

### 鎺ュ彛璇存槑

#### totalSupply()
```solidity
function totalSupply() external view returns (uint256);
```
- **鍔熻兘**: 鏌ヨ浠ｅ竵鎬讳緵搴旈噺
- **杩斿洖鍊?*: 浠ｅ竵鎬绘暟閲?
- **绀轰緥**:
```javascript
const totalSupply = await usdt.totalSupply().call();
console.log('Total Supply:', totalSupply.toString());
```

#### balanceOf(address account)
```solidity
function balanceOf(address account) external view returns (uint256);
```
- **鍔熻兘**: 鏌ヨ鎸囧畾璐︽埛鐨勪綑棰?
- **鍙傛暟**: `account` - 璐︽埛鍦板潃(hex鏍煎紡)
- **杩斿洖鍊?*: 璐︽埛浣欓
- **娴嬭瘯浠ｇ爜**:
```javascript
const [owner, user1] = await ethers.getSigners();
const balance = await usdt.balanceOf(user1.address);
console.log('User1 USDT Balance:', formatUnits(balance, 6));
```

#### transfer(address recipient, uint256 amount)
```solidity
function transfer(address recipient, uint256 amount) external returns (bool);
```
- **鍔熻兘**: 杞处缁欐寚瀹氬湴鍧€
- **鍙傛暟**:
  - `recipient` - 鎺ユ敹鍦板潃(hex鏍煎紡)
  - `amount` - 杞处鏁伴噺
- **杩斿洖鍊?*: 杞处鏄惁鎴愬姛
- **娴嬭瘯浠ｇ爜**:
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
- **鍔熻兘**: 鎺堟潈绗笁鏂瑰悎绾︿娇鐢ㄤ唬甯?
- **鍙傛暟**:
  - `spender` - 琚巿鏉冨湴鍧€(hex鏍煎紡)
  - `amount` - 鎺堟潈鏁伴噺
- **杩斿洖鍊?*: 鎺堟潈鏄惁鎴愬姛
- **娴嬭瘯浠ｇ爜**:
```javascript
const vaultContract = await deployer.deploy(vaultABI);
const amount = parseUnits('10000', 6);

// 鎺堟潈閲戝簱浣跨敤鎴戜滑鐨刄SDT
const approveTx = await usdt.approve(vaultContract.target, amount);
await approveTx.wait();

// 楠岃瘉鎺堟潈棰濆害
const allowance = await usdt.allowance(deployer.address, vaultContract.target);
expect(allowance).to.equal(amount);
```

#### allowance(address owner, address spender)
```solidity
function allowance(address owner, address spender) external view returns (uint256);
```
- **鍔熻兘**: 鏌ヨ鎺堟潈棰濆害
- **鍙傛暟**:
  - `owner` - 浠ｅ竵鎵€鏈夎€呭湴鍧€
  - `spender` - 琚巿鏉冨湴鍧€
- **杩斿洖鍊? 鎺堟潈棰濆害
- **娴嬭瘯浠ｇ爜**:
```javascript
const allowance = await usdt.allowance(user1.address, vaultAddress);
console.log('Vault allowance:', allowance.toString());
```

#### transferFrom(address sender, address recipient, uint256 amount)
```solidity
function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
```
- **鍔熻兘**: 浠ｇ悊杞处
- **鍙傛暟**:
  - `sender` - 鍙戦€佽€呭湴鍧€
  - `recipient` - 鎺ユ敹鑰呭湴鍧€
  - `amount` - 杞处鏁伴噺
- **杩斿洖鍊?*: 杞处鏄惁鎴愬姛
- **娴嬭瘯浠ｇ爜**:
```javascript
// 鐢ㄦ埛1鎺堟潈閲戝簱浣跨敤鍏禪SDT
await usdt.connect(user1).approve(vaultAddress, approveAmount);

// 閲戝簱杞处缁欐帴鏀惰€?
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
- **杩斿洖鍊?*: 浠ｅ竵鍚嶇О
- **娴嬭瘯浠ｇ爜**:
```javascript
const tokenName = await usdt.name();
console.log('Token Name:', tokenName);
```

#### symbol()
```solidity
function symbol() external view returns (string memory);
```
- **杩斿洖鍊?*: 浠ｅ竵绗﹀彿
- **娴嬭瘯浠ｇ爜**:
```javascript
const symbol = await usdt.symbol();
console.log('Token Symbol:', symbol); // 搴旇鏄?"USDT"
```

#### decimals()
```solidity
function decimals() external view returns (uint8);
```
- **杩斿洖鍊?*: 浠ｅ竵灏忔暟浣嶆暟
- **娴嬭瘯浠ｇ爜**:
```javascript
const decimals = await usdt.decimals();
console.log('Token Decimals:', decimals); // USDT閫氬父鏄?浣?
```

### 瀹屾暣娴嬭瘯浠ｇ爜

```javascript
const { ethers } = require('ethers');

async function testITRC20() {
    const [owner, user1, user2] = await ethers.getSigners();

    // 鍒涘缓鎴栬幏鍙朥SDT瀹炰緥
    const usdt = await ethers.getContractAt(TRC20_ABI, USDT_ADDRESS);

    console.log('=== ITRC20娴嬭瘯 ===\n');

    // 1. 娴嬭瘯totalSupply
    const totalSupply = await usdt.totalSupply();
    console.log('1. Total Supply:', ethers.formatUnits(totalSupply, 6));

    // 2. 娴嬭瘯balanceOf
    const user1Balance = await usdt.balanceOf(user1.address);
    console.log('2. User1 Balance:', ethers.formatUnits(user1Balance, 6));

    // 3. 娴嬭瘯transfer
    const transferAmount = ethers.parseUnits('100', 6); // 100 USDT
    const transferTx = await usdt.transfer(user2.address, transferAmount);
    await transferTx.wait();
    console.log('3. Transfer Tx:', transferTx.hash);

    // 楠岃瘉杞处
    const user2Balance = await usdt.balanceOf(user2.address);
    console.log('   User2 Balance after transfer:', ethers.formatUnits(user2Balance, 6));

    // 4. 娴嬭瘯approve
    const approveAmount = ethers.parseUnits('1000', 6);
    const approveTx = await usdt.approve(user1.address, approveAmount);
    await approveTx.wait();
    console.log('4. Approve Tx:', approveTx.hash);

    // 5. 娴嬭瘯allowance
    const allowance = await usdt.allowance(user2.address, user1.address);
    console.log('5. Allowance (user2 -> user1):', ethers.formatUnits(allowance, 6));

    // 6. 娴嬭瘯transferFrom
    const transferFromAmount = ethers.parseUnits('50', 6); // 50 USDT
    const transferFromTx = await usdt.connect(user1).transferFrom(
        user2.address,
        user1.address,
        transferFromAmount
    );
    await transferFromTx.wait();
    console.log('6. TransferFrom Tx:', transferFromTx.hash);

    // 楠岃瘉浠ｇ悊杞处
    const newAllowance = await usdt.allowance(user2.address, user1.address);
    console.log('   New Allowance:', ethers.formatUnits(newAllowance, 6));

    // 7. 娴嬭瘯鍏冩暟鎹?
    const name = await usdt.name();
    const symbol = await usdt.symbol();
    const decimals = await usdt.decimals();

    console.log('7. Token Info:');
    console.log('   Name:', name);
    console.log('   Symbol:', symbol);
    console.log('   Decimals:', decimals);

    console.log('\n鉁?ITRC20鎺ュ彛娴嬭瘯瀹屾垚!');
}
```

---

## IJustLend.sol - JustLend鍗忚鎺ュ彛

### 鏂囦欢浣嶇疆
`contracts/contracts/tron/IJustLend.sol`

### 鍚堢害鎻忚堪
TRON鏈€澶х殑鍘讳腑蹇冨寲鍊熻捶鍗忚JustLend鐨勬帴鍙ｅ畾涔夈€?

### 鎺ュ彛璇存槑

#### IJustLend - 鍊熻捶涓诲崗璁?

##### deposit(address jToken, uint256 underlyingAmount)
```solidity
function deposit(address jToken, uint256 underlyingAmount) external returns (uint256);
```
- **鍔熻兘**: 灏嗕唬甯佸瓨鍏ustLend鑾峰緱jToken
- **鍙傛暟**:
  - `jToken` - jToken鍚堢害鍦板潃
  - `underlyingAmount` - 瀛樺叆鐨勫簳灞備唬甯佹暟閲?
- **杩斿洖鍊?*: 鑾峰緱鐨刯Token鏁伴噺
- **娴嬭瘯浠ｇ爜**:
```javascript
const justLend = await ethers.getContractAt(JUSTLEND_ABI, JUSTLEND_ADDRESS);
const jUSDT = await ethers.getContractAt(JUSTTOKEN_ABI, JUSDT_ADDRESS);

// 鎺堟潈jToken杞Щ
const depositAmount = parseUnits('10000', 6); // 10000 USDT
await usdt.approve(JUSTLEND_ADDRESS, depositAmount);

// 瀛樺叆鑾峰緱jToken
const tx = await justLend.deposit(jUSDT_ADDRESS, depositAmount);
await tx.wait();

const jTokenReceived = tx.value;
console.log('jTokens received:', formatUnits(jTokenReceived, 18));
```

##### redeem(address jToken, uint256 jTokenAmount)
```solidity
function redeem(address jToken, uint256 jTokenAmount) external returns (uint256);
```
- **鍔熻兘**: 璧庡洖jToken鎹㈠彇搴曞眰浠ｅ竵
- **鍙傛暟**:
  - `jToken` - jToken鍚堢害鍦板潃
  - `jTokenAmount` - 璧庡洖鐨刯Token鏁伴噺
- **杩斿洖鍊?*: 鑾峰緱鐨勫簳灞備唬甯佹暟閲?
- **娴嬭瘯浠ｇ爜**:
```javascript
// 璧庡洖閮ㄥ垎jToken
const redeemTx = await justLend.redeem(jUSDT_ADDRESS, redeemAmount);
await redeemTx.wait();

const underlyingReceived = redeemTx.value;
console.log('USDT received:', formatUnits(underlyingReceived, 6));
```

##### redeemAll(address jToken)
```solidity
function redeemAll(address jToken) external returns (uint256);
```
- **鍔熻兘**: 璧庡洖鍏ㄩ儴jToken
- **鍙傛暟** `jToken` - jToken鍚堢害鍦板潃
- **杩斿洖鍊?*: 鑾峰緱鐨勫叏閮ㄥ簳灞備唬甯佹暟閲?
- **娴嬭瘯浠ｇ爜**:
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
- **鍔熻兘**: 鍊熷嚭浠ｅ竵
- **鍙傛暟**:
  - `jToken` - 鍊熷嚭鐨刯Token绫诲瀷
  - `borrowAmount` - 鍊熸鏁伴噺
- **娴嬭瘯浠ｇ爜**:
```javascript
// 蹇呴』鍏堣繘鍏ュ競鍦?
const tx = await justLend.enterMarkets([jUSDT_ADDRESS]);
await tx.wait();

// 鍊熸
const borrowAmount = parseUnits('5000', 6); // 5000 USDT
const borrowTx = await justLend.borrow(jUSDT_ADDRESS, borrowAmount);
await borrowTx.wait();

console.log('Borrowed USDT:', formatUnits(borrowAmount, 6));
```

##### repayBorrow(address jToken, uint256 repayAmount)
```solidity
function repayBorrow(address jToken, uint256 repayAmount) external;
```
- **鍔熻兘**: 鍋胯繕鍊熸
- **鍙傛暟**:
  - `jToken` - 鍋胯繕鐨刯Token绫诲瀷
  - `repayAmount` - 鍋胯繕鏁伴噺
- **娴嬭瘯浠ｇ爜**:
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
- **鍔熻兘**: 杩涘叆鍊熻捶甯傚満
- **鍙傛暟**: `jTokens` - jToken鍦板潃鏁扮粍
- **娴嬭瘯浠ｇ爜**:
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
- **鍔熻兘**: 閫€鍑哄€熻捶甯傚満
- **鍙傛暟**: `jToken` - 瑕侀€€鍑虹殑jToken
- **娴嬭瘯浠ｇ爜**:
```javascript
const tx = await justLend.exitMarket(jUSDT_ADDRESS);
await tx.wait();

console.log('Exited market');
```

##### getAccountLiquidity(address account)
```solidity
function getAccountLiquidity(address account) external view returns (uint256, uint256);
```
- **鍔熻兘**: 鑾峰彇璐︽埛娴佸姩鎬?
- **鍙傛暟**: `account` - 璐︽埛鍦板潃
- `杩斿洖鍊?*:
  - `liquidity` - 鎬绘祦鍔ㄦ€?
  `shortfall` - 娴佸姩鎬х己鍙?
- **娴嬭瘯浠ｇ爜**:
```javascript
const [liquidity, shortfall] = await justLend.getAccountLiquidity(user.address);
console.log('Liquidity:', formatUnits(liquidity, 18));
console.log('Shortfall:', formatUnits(shortfall, 18));
```

---

#### IJustToken - 鐢熸伅浠ｅ竵鎺ュ彛

##### exchangeRateCurrent()
```solidity
function exchangeRateCurrent() external view returns (uint256);
```
- **鍔熻兘**: 鑾峰彇褰撳墠姹囩巼锛?涓猨Token瀵瑰簲澶氬皯搴曞眰浠ｅ竵锛?
- **杩斿洖鍊?*: 姹囩巼 * 1e18
- **娴嬭瘯浠ｇ爜**:
```javascript
const jUSDT = await ethers.getContractAt(JUSTTOKEN_ABI, JUSDT_ADDRESS);
const exchangeRate = jUSDT.exchangeRateCurrent();
console.log('Exchange Rate:', formatUnits(exchangeRate, 18));
// 绀轰緥: 1.002e18 琛ㄧず 1 jUSDT = 1.002 USDT
```

##### supplyRatePerBlock()
```solidity
function supplyRatePerBlock() external view returns (uint256);
```
- **鍔熻兘**: 鑾峰彇姣忓尯鍧楀瓨娆惧埄鐜?
- **杩斿洖鍊?*: 姣忓尯鍧楀埄鐜?
- **娴嬭瘯浠ｇ爜**:
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
- **鍔熻兘**: 鑾峰彇姣忓尯鍧楀€熸鍒╃巼
- **杩斿洖鍊?*: 姣忓尯鍧楀埄鐜?
- **娴嬭瘯浠ｇ爜**:
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
- **鍔熻兘**: 鑾峰彇鍚堢害涓殑搴曞眰浠ｅ竵浣欓
- **杩斿洖鍊?*: 搴曞眰浠ｅ竵浣欓
- **娴嬭瘯浠ｇ爜**:
```javascript
const cash = jUSDT.getCash();
console.log('Cash in Protocol:', formatUnits(cash, 6), 'USDT');
```

##### balanceOf(address account)
```solidity
function balanceOf(address account) external view returns (uint256);
```
- **鍔熻兘**: 鑾峰彇璐︽埛鎸佹湁鐨刯Token浣欓
- **鍙傛暟**: `account` - 璐︽埛鍦板潃
- **杩斿洖鍊?*: jToken浣欓
- **娴嬭瘯浠ｇ爜**:
```javascript
const jTokenBalance = jUSDT.balanceOf(user.address);
console.log('jToken Balance:', formatUnits(jTokenBalance, 18));
```

---

#### IJustLendPriceOracle - 浠锋牸棰勮█鏈?

##### getUnderlyingPrice(address jToken)
```solidityfunction getUnderlyingPrice(address jToken) external view returns (uint256);
```
- **鍔熻兘**: 鑾峰彇jToken鐨勫簳灞備唬甯佷环鏍?
- **鍙傛暟**: `jToken` - jToken鍦板潃
- **杩斿洖鍊?*: 浠锋牸 * 1e18
- **娴嬭瘯浠ｇ爜**:
```javascript
const oracle = await ethers.getContractAt(ORACLE_ABI, ORACLE_ADDRESS);
const price = oracle.getUnderlyingPrice(jUSDT_ADDRESS);
console.log('USDT Price:', formatUnits(price, 18));
// 绀轰緥: 1000000000000000000 = 1.0000 USD
```

---

### 瀹屾暣娴嬭瘯浠ｇ爜

```javascript
const { ethers } = require('ethers');

// 鍚堢害鍦板潃閰嶇疆
const JUSDT_ADDRESS = '0x...'; // jUSDT鍦板潃
const JUSTLEND_ADDRESS = '0x...'; // JustLend鍦板潃
const USDT_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

async function testJustLend() {
    const [owner, borrower] = await ethers.getSigners();

    const justLend = await ethers.getContractAt(JUSTLEND_ABI, JUSTLEND_ADDRESS);
    const jUSDT = await ethers.getContractAt(JUSTTOKEN_ABI, JUSDT_ADDRESS);
    const usdt = await ethers.getContractAt(TRC20_ABI, USDT_ADDRESS);

    console.log('=== JustLend娴嬭瘯 ===\n');

    // 1. 娴嬭瘯enterMarkets
    console.log('1. Entering market...');
    const enterTx = await justLend.enterMarkets([JUSDT_ADDRESS]);
    await enterTx.wait();
    console.log('   Tx:', enterTx.hash);

    // 2. 鑾峰彇姹囩巼
    console.log('\n2. Checking exchange rate...');
    const exchangeRate = await jUSDT.exchangeRateCurrent();
    console.log('   Exchange Rate:', ethers.formatUnits(exchangeRate, 18));

    // 3. 鑾峰彇鍒╃巼
    const supplyRate = await jUSDT.supplyRatePerBlock();
    const supplyAPY = (Number(supplyRate) * 365 * 24 * 3600 / 1e18 * 100).toFixed(2);
    console.log('   Supply Rate:', supplyRate.toString());
    console.log('   Estimated Supply APY:', supplyAPY + '%');

    // 4. 瀛樻
    console.log('\n3. Depositing...');
    const depositAmount = ethers.parseUnits('10000', 6);

    // 鎺堟潈
    const approveTx = await usdt.approve(JUSTLEND_ADDRESS, depositAmount);
    await approveTx.wait();

    // 瀛樻
    const depositTx = await justLend.deposit(JUSDT_ADDRESS, depositAmount);
    await depositTx.wait();
    console.log('   Tx:', depositTx.hash);
    console.log('   Received jTokens:', formatUnits(depositTx.value, 18));

    // 5. 妫€鏌ヤ綑棰?
    console.log('\n4. Checking balances...');
    const jTokenBalance = await jUSDT.balanceOf(borrower.address);
    const userBalance = await usdt.balanceOf(borrower.address);
    console.log('   jToken Balance:', formatUnits(jTokenBalance, 18));
    console.log('   USDT Balance:', formatUnits(userBalance, 6));

    // 6. 鏌ヨ娴佸姩鎬?
    console.log('\n5. Checking account liquidity...');
    const [liquidity, shortfall] = await justLend.getAccountLiquidity(borrower.address);
    console.log('   Liquidity:', formatUnits(liquidity, 18));
    console.log('   Shortfall:', formatUnits(shortfall, 18));

    console.log('\n鉁?JustLend鎺ュ彛娴嬭瘯瀹屾垚!');
    console.log('鈿狅笍  娉ㄦ剰: 鍊熸鍔熻兘闇€瑕佽冻澶熺殑鎶垫娂鍝佹敮鎸?);
}
```

---

## TronPaymentVault.sol - 澶氱鏀粯閲戝簱

### 鏂囦欢浣嶇疆
`contracts/contracts/tron/TronPaymentVault.sol`

### 鍚堢害鍦板潃
- **Nile Testnet**: `TSrRLNoyJmVNZMg6jA8hUzABxHA1ZBFGM`
- **TRONScan**: https://nile.tronscan.org/#/contract/TSrRLNoyJmVNZMg6jA8hUzABxHA1ZBFGM

### 鍚堢害鍔熻兘
浼佷笟绾у绛惧悕鏀粯閲戝簱锛屾敮鎸佹椂闂撮攣銆佹瘡鏃ラ檺棰濆拰绱ф€ユ仮澶嶆満鍒躲€?

### 鎺ュ彛璇存槑

#### 鏋勯€犲嚱鏁?
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
- **鍙傛暟**:
  - `_initialSigners` - 鍒濆绛惧悕鑰呭湴鍧€鏁扮粍
  - `_threshold` - 鎵€闇€绛惧悕鏁伴噺锛堜笉鑳借秴杩囩鍚嶈€呮€绘暟锛?
  - `_guardian` - 鐩戞姢浜哄湴鍧€锛堝彲鏆傚仠銆佽Е鍙戠揣鎬ユ仮澶嶏級
  - `_supportedTokens` - 鏀寔鐨凾RC20浠ｅ竵鍦板潃鏁扮粍
  - `_timelock` - 鏃堕棿閿侊紙绉掞紝鏈€澶?澶╋級
  - `_dailyLimit` - 姣忔棩鏀粯闄愰
- **闄愬埗**:
  - 绛惧悕鑰呮暟閲忎笉鑳戒负0
  - 闂ㄦ鍊煎繀椤诲湪1鍒扮鍚嶈€呮暟閲忎箣闂?
  - 鏃堕棿閿佹渶澶?澶?
  - 涓嶈兘娣诲姞閲嶅鐨勭鍚嶈€?

##### 閮ㄧ讲浠ｇ爜
```javascript
const TronWeb = require('tronweb');

const tronWeb = new TronWeb({
    fullNode: 'https://nile.trongrid.io',
    solidityNode: 'https://nile.trongrid.io',
    eventServer: 'https://nile.trongrid.io'
});

tronWeb.setPrivateKey(DEPLOYER_PRIVATE_KEY);

// 閮ㄧ讲鍙傛暟
const initialSigners = [
    deployerAddress,  // 绛惧悕鑰?
    'TSigner2...',     // 绛惧悕鑰?
    'TSigner3...'      // 绛捐€?
];
const threshold = 2;  // 2/3绛惧悕
const guardian = deployerAddress;
const supportedTokens = ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t']; // USDT
const timelock = 86400;  // 24灏忔椂
const dailyLimit = '1000000000000'; // 100涓嘦SDT

// 閮ㄧ讲
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

#### 鏀粯绠＄悊

##### proposePayment(address token, address to, uint256 amount, bytes calldata data)
```solidity
function proposePayment(
    address token,
    address to,
    uint256 amount,
    bytes calldata data
) external onlySigner whenNotPaused returns (uint256 paymentId)
```
- **鍔熻兘**: 鎻愯鏀粯
- **鍙傛暟**:
  - `token` - TRC20浠ｅ竵鍦板潃
  - `to` - 鎺ユ敹鍦板潃(hex鏍煎紡)
  - `amount` - 鏀粯閲戦
  - `data` - 鍙€夌殑璋冪敤鏁版嵁
- **杩斿洖鍊?*: 鏀粯ID
- **浜嬩欢**: `PaymentProposed`
- **閿欒**:
  - `InvalidAddress` - 鎺ユ敹鍦板潃鏃犳晥
  - `InvalidAmount` - 閲戦涓?
  - `TokenNotSupported` - 浠ｅ竵涓嶆敮鎸?
  - `VaultIsPaused` - 閲戝簱宸叉殏鍋?
- **娴嬭瘯浠ｇ爜**:
```javascript
const vault = await tronWeb.contract(VAULT_ABI, vaultAddress);

const paymentId = await vault.proposePayment(
    'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',  // USDT
    'TRecipientAddress...',  // 鎺ユ敹鑰呭湴鍧€(hex)
    '1000000',             // 1 USDT (6浣嶅皬鏁?
    '0x'                   // 绌烘暟鎹?
).send({ from: signerAddress });

console.log('Payment ID:', paymentId);
```

##### approvePayment(uint256 paymentId)
```solidity
function approvePayment(uint256 paymentId) external onlySigner;
```
- **鍔熻兘**: 鎵瑰噯鏀粯
- **鍙傛暟**: `paymentId` - 鏀粯ID
- **浜嬩欢**: `PaymentApproved`
- **閿欒**: `PaymentAlreadyApproved` - 宸叉壒鍑嗚繃
- **娴嬭瘯浠ｇ爜**:
```javascript
// 绛惧悕鑰?鎵瑰噯
await vault.approvePayment(paymentId)
    .send({ from: signer2Address });
```

##### executePayment(uint256 paymentId)
```solidity
function executePayment(uint256 paymentId) external whenNotPaused;
```
- **鍔熻兘**: 鎵ц鏀粯
- **鍙傛暟**: `paymentId` - 鏀粯ID
- **浜嬩欢**: `PaymentExecuted`
- **鍓嶇疆鏉′欢**:
  - 鎵瑰噯鏁伴噺 >= 闃堝€?
  - 鏃堕棿閿佸凡杩囨湡
  - 褰撴棩闄愰鏈秴鍑?
- **閿欒**:
  - `InvalidPaymentId` - 鏃犳晥鐨勬敮浠業D
  - `PaymentAlreadyExecuted` - 宸叉墽琛?
  - `InsufficientApprovals` - 鎵瑰噯涓嶈冻
  - `DailyLimitExceeded` - 姣忔棩闄愰瓒呭嚭
  - `NotTimelocked` - 鏃堕棿閿佹湭杩囨湡
- **娴嬭瘯浠ｇ爜**:
```javascript
// 绛夊緟鏃堕棿閿佽繃鏈?
await new Promise(resolve => setTimeout(resolve, 86401)); // 24灏忔椂+

// 鎵ц鏀粯
await vault.executePayment(paymentId)
    .send({ from: signerAddress });
```

##### cancelPayment(uint256 paymentId)
```solidity
function cancelPayment(uint256 paymentId) external onlySigner;
```
- **鍔熻兘**: 鍙栨秷鏀粯
- **鍙傛暟**: `paymentId` - 鏀粯ID
- **浜嬩欢**: `PaymentCancelled`
- **閿欒**: `PaymentAlreadyCancelled` - 宸插彇娑?
- **娴嬭瘯浠ｇ爜**:
```javascript
await vault.cancelPayment(paymentId)
    .send({ from: signerAddress });
```

---

#### 绛惧悕鑰呯鐞?

##### addSigner(address newSigner)
```solidity
function addSigner(address newSigner) external onlySigner;
```
- **鍔熻兘**: 娣诲姞绛惧悕鑰?
- **鍙傛暟**: `newSigner` - 鏂扮鍚嶈€呭湴鍧€(hex鏍煎紡)
- **浜嬩欢**: `SignerAdded`
- **閿欒**: `SignerAlreadyExists` - 绛惧悕鑰呭凡瀛樺湪
- **娴嬭瘯浠ｇ爜**:
```javascript
await vault.addSigner('TNewSignerAddress...')
    .send({ from: signerAddress });
```

##### removeSigner(address signer)
```solidity
function removeSigner(address signer) external onlySigner;
```
- **鍔熻兘**: 绉婚櫎绛惧悕鑰?
- **鍙傛暟**: `signer` - 绛惧悕鑰呭湴鍧€
- **浜嬩欢**: `SignerRemoved`
- **閿欒**: `SignerNotFound` - 绛惧悕鑰呬笉瀛樺湪
- **娉ㄦ剰浜嬮」**: 绉婚櫎绛惧悕鑰呭悗闇€瑕佹洿鏂伴槇鍊?
- **娴嬭瘯浠ｇ爜**:
```javascript
await vault.removeSigner('TOldSignerAddress...')
    .send({ from: signerAddress });
```

##### updateThreshold(uint256 newThreshold)
```solidity
function updateThreshold(uint256 newThreshold) external onlySigner;
```
- **鍔熻兘**: 鏇存柊绛惧悕闃堝€?
- **鍙傛暟**: `newThreshold` - 鏂伴槇鍊硷紙闇€1<=newThreshold<=signers.length锛?
- **浜嬩欢**: `ThresholdUpdated`
- **閿欒**:
  - `InvalidThreshold` - 闃堝€兼棤鏁?
- **娴嬭瘯浠ｇ爜**:
```javascript
const newThreshold = 3; // 浠?鏀逛负3
await vault.updateThreshold(newThreshold)
    .send({ from: signerAddress });
```

---

#### 鏌ヨ鍑芥暟

##### getSigners() - 鑾峰彇绛惧悕鑰呭垪琛?
```solidity
function getSigners() external view returns (address[] memory)
```
- **杩斿洖**: 鎵€鏈夌鍚嶈€呭湴鍧€鏁扮粍

##### getPayment(uint256 paymentId) - 鑾峰彇鏀粯璇︽儏
```solidity
function getPayment(uint256 paymentId) external view returns (...);
```
- **杩斿洖**: 鏀粯瀹屾暣淇℃伅

##### hasApproved(address signer, uint256 paymentId) - 妫€鏌ユ壒鍑嗙姸鎬?
```solidity
function hasApproved(
    address signer,
    uint256 paymentId
) external view returns (bool);
```
- **杩斿洖**: 鏄惁宸叉壒鍑?

---

#### 瀹夊叏鎺у埗

##### pause() / unpause() - 鏆傚仠/鎭㈠鍚堢害
```solidity
function pause() external onlyGuardian;
function unpause() external onlyGuardian;
```
- **鍔熻兘**: 鏆傚仠鎵€鏈夋敮浠樻墽琛?
- **浜嬩欢**: `VaultPaused`, `VaultUnpaused`

##### requestEmergencyWithdrawal(address to, address token, uint256 amount)
```solidity
function requestEmergencyWithdrawal(
    address to,
    address token,
    uint256 amount
) external onlyGuardian;
```
- **鍔熻兘**: 璇锋眰绱ф€ュ彇娆?
- **鏃堕棿閿佷繚鎶?*: 24灏忔椂鍚庢墠鑳芥墽琛?

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

#### 閰嶇疆绠＄悊

##### addSupportedToken(address token) - 娣诲姞鏀寔浠ｅ竵
```solidity
function addSupportedToken(address token) external onlyOwner;
```

##### removeSupportedToken(address token) - 绉婚櫎鏀寔浠ｅ竵
```solidity
function removeSupportedToken(address token) external onlyOwner;
```

##### updateTimelock(uint256 newTimelock) - 鏇存柊鏃堕棿閿?
```solidity
function updateTimelock(uint256 newTimelock) external onlyOwner;
```
- **闄愬埗**: 鏈€澶?澶?(604800绉?

##### updateDailyLimit(uint256 newLimit) - 鏇存柊姣忔棩闄愰
```solidity
function updateDailyLimit(uint256 newLimit) external onlyOwner;
```

---

### 瀹屾暣娴嬭瘯浠ｇ爜

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

    console.log('=== TronPaymentVault 娴嬭瘯 ===\n');

    // 1. 鏌ヨ鍩虹淇℃伅
    console.log('1. 鍩虹淇℃伅:');
    const threshold = await vault.threshold().call();
    console.log('   Threshold:', threshold.toString());

    const timelock = await vault.timelock().call();
    console.log('   Timelock:', timelock.toString(), 'seconds');

    const dailyLimit = await vault.dailyLimit().call();
    console.log('   Daily Limit:', (Number(BigInt(dailyLimit)) / 1e6).toLocaleString(), 'USDT');

    const signers = await vault.getSigners().call();
    console.log('   Signers:', signers);

    // 2. 鎻愯鏀粯
    console.log('\n2. 鎻愯鏀粯:');
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

    // 3. 鑾峰彇鏀粯璇︽儏
    console.log('\n3. 鏀粯璇︽儏:');
    const payment = await vault.payment(paymentId);
    console.log('   Token:', payment.token);
    console.log('   To:', payment.to);
    console.log('   Amount:', (Number(BigInt(payment.amount)) / 1e6).toLocaleString(), 'USDT');
    console.log('   Approvals:', Number(BigInt(payment.approvalCount)), '/', threshold);
    console.log('   Executed:', payment.executed);

    // 4. 绗簩涓鍚嶈€呮壒鍑?
    console.log('\n4. 鎵瑰噯鏀粯 (绛惧悕鑰?):');
    await vault.approvePayment(paymentId)
        .send({ from: 'TSigner2...', shouldPollResponse: true });

    // 5. 绛夊緟鏃堕棿閿侊紙娴嬭瘯鏃朵娇鐢ㄦ椂闂磋烦杩囷級
    console.log('\n5. 绛夊緟鏃堕棿閿?..');
    // 瀹為檯鐢熶骇鐜闇€瑕佺瓑寰?4灏忔椂

    // 6. 鎵ц鏀粯
    console.log('\n6. 鎵ц鏀粯:');
    try {
        const execTx = await vault.executePayment(paymentId)
            .send({ from: signer1, shouldPollResponse: true });
        console.log('   Tx:', execTx);
    } catch (e) {
        console.log('   Note: Cannot execute - timelock not expired yet');
    }

    // 7. 娴嬭瘯鏌ヨ鍑芥暟
    console.log('\n7. 鏌ヨ鍑芥暟:');
    const approved = await vault.hasApproved(signer1, paymentId);
    console.log('   Signer1 approved:', approved);

    const nextId = await vault.nextPaymentId().call();
    console.log('   Next Payment ID:', nextId.toString());

    console.log('\n鉁?TronPaymentVault娴嬭瘯瀹屾垚!');
}
```

---

## TronPaymentSplitter.sol - 鑷姩鍒嗚处鍚堢害

### 鏂囦欢浣嶇疆
`contracts/contracts/tron/TronPaymentSplitter.sol`

### 鍚堢害鍦板潃
- **Nile Testnet**: `TDJwns4C2Frp4wVnrqyz4Ud6SYoxc9nk7Z`
- **TRONScan**: https://nile.tronscan.org/#/contract/TDJwns4C2Frp4wVnrqyz4Ud6SYoxc9nk7Z

### 鍚堢害鍔熻兘
鑷姩灏嗘帴鏀剁殑TRC20浠ｅ竵鍒嗗彂缁欏涓彈鐩婁汉锛屾敮鎸佷笁绉嶅垎璐︽ā寮忋€?

### 鎺ュ彛璇存槑

#### 鏋勯€犲嚱鏁?
```solidity
constructor(address _owner, address[] memory _supportedTokens)
```
- **鍙傛暟**:
  - `_owner` - 鎵€鏈夎€呭湴鍧€
  - `_supportedTokens` - 鏀寔鐨勪唬甯佸湴鍧€鏁扮粍
- **閮ㄧ讲浠ｇ爜**:
```javascript
const splitter = await tronWeb.contract(SPLITTER_ABI, bytecode);
const tx = await splitter.deploy(
    deployerAddress,  // owner
    ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t']  // USDT
).send({ from: deployerAddress });
```

---

#### 鍒嗚处绠＄悊

##### createSplit(address token, SplitMode mode, uint256 minAmount, Beneficiary[] memory beneficiaries)
```solidity
function createSplit(
    address token,
    SplitMode mode,
    uint256 minAmount,
    Beneficiary[] memory beneficiaries
) external onlyOwner returns (uint256 splitId)
```
- **鍔熻兘**: 鍒涘缓鍒嗚处閰嶇疆
- **鍙傛暟**:
  - `token` - TRC20浠ｅ竵鍦板潃
  - `mode` - 鍒嗚处妯″紡 (0=鐧惧垎姣? 1=鍥哄畾閲戦, 2=鍒嗗眰)
  - `minAmount` - 鏈€灏忓垎璐﹂噾棰?
  - `beneficiaries` - 鍙楃泭浜烘暟缁?
- **杩斿洖鍊?*: 鍒嗚处ID
- **鍒嗚处妯″紡璇存槑**:
  - `Percentage`: 鎸夌櫨鍒嗘瘮鍒嗛厤锛屾€诲拰涓?0000
  - `Fixed`: 姣忎釜鍙楃泭浜哄浐瀹氶噾棰?
  - `Tiered`: 鎸夊眰绾у垎閰嶆瘮渚?
- **娴嬭瘯浠ｇ爜**:
```javascript
// 鐧惧垎姣斿垎璐︾ず渚?
const beneficiaries = [
    ['TAddress1...', 6000, 0, 0],  // 60%
    ['TAddress2...', 4000, 0, 0]   // 40%
];

const splitId = await splitter.createSplit(
    'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    0,  // Percentage妯″紡
    '1000000',  // 鏈€灏? USDT
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
- **鍔熻兘**: 鎵ц鍒嗚处
- **鍙傛暟**:
  - `splitId` - 鍒嗚处ID
  - `amount` - 鍒嗚处閲戦
- **鍓嶇疆鏉′欢**:
  - 鍒嗚处瀛樺湪涓旀湭鏆傚仠
  - 閲戦 >= minAmount
- **閿欒**:
  - `InvalidSplitId` - 鍒嗚处ID鏃犳晥
  - `AmountBelowMinimum` - 閲戦浣庝簬鏈€灏忓€?
  - `AlreadyPaused` - 鍒嗚处宸叉殏鍋?

##### pauseSplit(uint256 splitId) / unpauseSplit(uint256 splitId)
```solidity
function pauseSplit(uint256 splitId) external onlyOwner;
function unpauseSplit(uint256 splitId) external onlyOwner;
```

---

#### 鍙楃泭浜虹鐞?

##### addBeneficiary(uint256 splitId, Beneficiary memory beneficiary)
```solidity
function addBeneficiary(
    uint256 splitId,
    Beneficiary memory beneficiary
) external onlyOwner;
```

##### updateBeneficiary(...)
- 淇敼鍗曚釜鍙楃泭浜洪厤缃?

##### removeBeneficiary(uint256 splitId, address beneficiaryAddress)
- 绉婚櫎鍙楃泭浜?

---

#### 鏌ヨ鍑芥暟

##### getSplit(uint256 splitId) - 鑾峰彇鍒嗚处璇︽儏
```solidity
function getSplit(uint256 splitId) external view returns (...);
```

##### getBeneficiaries(uint256 splitId) - 鑾峰彇鍙楃泭浜哄垪琛?
```solidity
function getBeneficiaries(uint256 splitId) external view returns (...);
```

##### calculateDistribution(uint256 splitId, uint256 amount) - 璁＄畻鍒嗛厤
```solidity
function calculateDistribution(uint256 splitId, uint256 amount)
    external view returns (uint256[] memory shares);
```

##### getAllSplits() - 鑾峰彇鎵€鏈夊垎璐?

---

### 瀹屾暣娴嬭瘯浠ｇ爜

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

    console.log('=== TronPaymentSplitter 娴嬭瘯 ===\n');

    // 1. 鍒涘缓鐧惧垎姣斿垎璐?
    console.log('1. 鍒涘缓鐧惧垎姣斿垎璐?');
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

    // 2. 鑾峰彇鍒嗚处璇︽儏
    console.log('\n2. 鍒嗚处璇︽儏:');
    const split = await splitter.splits(1);
    console.log('   Token:', split.token);
    console.log('   Mode:', split.mode); // 0=Percentage
    console.log('   Min Amount:', (Number(BigInt(split.minAmount)) / 1e6).toLocaleString(), 'USDT');

    // 3. 鑾峰彇鍙楃泭浜哄垪琛?
    console.log('\n3. 鍙楃泭浜哄垪琛?');
    const beneficiariesList = await splitter.getBeneficiaries(1).call();
    beneficiariesList.forEach((b, i) => {
        console.log(`   ${i + 1}. Account: ${b[0]}`);
        console.log(`      Percentage: ${Number(BigInt(b[1])) / 100}%`);
        console.log(`      Active: ${b[3]}`);
    });

    // 4. 璁＄畻鍒嗛厤
    console.log('\n4. 璁＄畻鍒嗛厤:');
    const distribution = await splitter.calculateDistribution(1, '10000000').call();
    console.log('   Total: 10 USDT 鍒嗛厤濡備笅:');
    distribution.forEach((share, i) => {
        console.log(`      Beneficiary ${i + 1}: ${(Number(BigInt(share)) / 1e6).toLocaleString()} USDT`);
    });

    // 5. 娴嬭瘯鏆傚仠/鎭㈠
    console.log('\n5. 鏆傚仠/鎭㈠鍒嗚处:');
    await splitter.pauseSplit(1)
        .send({ from: owner, shouldPollResponse: true });

    const pausedState = (await splitter.splits(1)).paused;
    console.log('   Paused:', pausedState === true);

    await splitter.unpauseSplit(1)
        .send({ from: owner, shouldPollResponse: true });

    console.log('   Unpaused');

    // 6. 娣诲姞鏂板彈鐩婁汉
    console.log('\n6. 娣诲姞鍙楃泭浜?');
    const newBeneficiary = [
        'TAddress3...',  // 鏂扮殑鍙楃泭浜?
        2000,            // 20%
        0,               // 0 USDT
        0                // Tier 0
    ];

    await splitter.addBeneficiary(1, newBeneficiary)
        .send({ from: owner, shouldPollResponse: true });

    console.log('   Added new beneficiary (20%)');

    console.log('\n鉁?TronPaymentSplitter娴嬭瘯瀹屾垚!');
}
```

---

## TronYieldAggregator.sol - 鏀剁泭鑱氬悎鍣?

### 鏂囦欢浣嶇疆
`contracts/contracts/tron/TronYieldAggregator.sol`

### 鍚堢害鍦板潃
- **Nile Testnet**: `TC6bpE1t1EderDzXZq1nuRDf8QRhQHgkgy`
- **TRONScan**: https://nile.tronscan.org/#/contract/TC6bpE1t1EderDzXZq1nuRDf8QRhQHgkgy

### 鍚堢害鍔熻兘
鑷姩灏嗛棽缃祫閲戝瓨鍏ustLend璧氬彇鍒╂伅锛屾敮鎸佸疄鏃禔PY鏌ヨ銆佹敹鐩婂垎閰嶅拰鐏垫椿鎻愮幇銆?

### 鎺ュ彛璇存槑

#### 鏋勯€犲嚱鏁?
```solidity
constructor(
    address _justLend,
    address _unitroller,
    address _oracle,
    address[] memory _initialTokens,
    address[] memory _initialJTokens
)
```
- **鍙傛暟**:
  - `_justLend` - JustLend鍗忚鍦板潃
  - `_unitroller` - Unitroller鍦板潃
  - `_oracle` - 浠锋牸棰勮█鏈哄湴鍧€
  - `_initialTokens` - 鍒濆鏀寔鐨勪唬甯?
  - `_initialJTokens` - 鍒濆jToken鍦板潃

---

#### 瀛樺彇娆炬搷浣?

##### deposit(address token, uint256 amount)
```solidity
function deposit(address token, uint256 amount)
    external
    nonReentrant
    whenDepositsNotPaused
    returns (uint256 principal)
```
- **鍔熻兘**: 瀛樺叆浠ｅ竵锛岃嚜鍔ㄨ川鎶煎埌JustLend
- **鍙傛暟**:
  - `token` - TRC20浠ｅ竵鍦板潃
  - `amount` - 瀛樺叆鏁伴噺
- **杩斿洖鍊?*: 鑾峰緱鐨刯Token鏁伴噺锛堝嵆鏈噾锛?
- **浜嬩欢**: `Deposited`
- **閿欒**:
  - `InvalidAddress` - 鍦板潃鏃犳晥
  - `InvalidAmount` - 閲戦涓?
  - `TokenNotSupported` - 浠ｅ竵涓嶆敮鎸?

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
- **鍔熻兘**: 鎻愮幇浠ｅ竵锛岃嚜鍔ㄨ绠楁湰閲憊s鍒╂伅
- **鍙傛暟**:
  - `token` - TRC20浠ｅ竵鍦板潃
  - `amount` - 鎻愬彇鏁伴噺锛?=鍏ㄩ儴锛?
- **杩斿洖鍊?*:
  - `withdrawnAmount` - 瀹為檯鎻愬彇鏁伴噺
  - `principalAmount` - 鏈噾鏁伴噺
  - `interestAmount` - 鍒╂伅鏁伴噺
- **浜嬩欢**: `Withdrawn`

---

#### 浣欓鏌ヨ

##### getMerchantBalance(address merchant, address token)
```solidity
function getMerchantBalance(address merchant, address token)
    external
    view
    returns (
        uint256 balance,      // 鎬讳綑棰濓紙鏈噾+鍒╂伅锛?
        uint256 principal,       // 鏈噾
        uint256 interest        // 绱Н鍒╂伅
    )
```
- **娴嬭瘯浠ｇ爜**:
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
鍖呮嫭搴旇鍒╂伅

##### getTokenAPY(address token) - 鑾峰彇浠ｅ竵APY
```solidity
function getTokenAPY(address token)
    external view
    returns (
        uint256 apy,            // APY (scaled by 1e16, 濡?5,000,000,000 = 5.00%)
        uint256 exchangeRate // jToken姹囩巼
    )
```

---

#### 鏀剁泭鍒嗛厤

##### setYieldRecipients(...)
```solidity
function setYieldRecipients(
    address token,
    YieldRecipient[] memory recipients
) external onlyOwner
```
- **娴嬭瘯浠ｇ爜**:
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

#### 绠＄悊鍔熻兘

##### addToken(...) / removeToken(...) - 浠ｅ竵绠＄悊
##### toggleAutoCompound(bool enabled) - 鍒囨崲鑷姩澶嶅埄
##### pauseDeposits() / unpauseDeposits() - 鏆傚仠/鎭㈠瀛樻
##### pauseWithdrawals() / unpauseWithdrawals() - 鏆傚仠/鎭㈠鎻愮幇
##### updateAPY(address token, uint256 apy) - 鏇存柊APY

---

#### 鏌ヨ鍑芥暟

##### getSupportedTokens() - 鑾峰彇鏀寔鐨勪唬甯佸垪琛?
```solidity
function getSupportedTokens() external view returns (address[] memory);
```

##### getTokenBalance(address token) - 鑾峰彇鍚堢害浠ｅ竵浣欓

##### getTotalDeposits(address token) - 鑾峰彇鎬诲瓨娆?

##### getTotalInterest(address token) - 鑾峰彇鎬诲埄鎭?

##### getTVL() - 鑾峰彇鎬婚攣浠撻噺(TVL)

##### getStats() - 鑾峰彇鍚堢害缁熻
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

### 瀹屾暣娴嬭瘯浠ｇ爜

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

    console.log('=== TronYieldAggregator 娴嬭瘯 ===\n');

    // 1. 鍩虹閰嶇疆
    console.log('1. 鍚堢害閰嶇疆:');
    const owner = await aggregator.owner().call();
    console.log('   Owner:', owner);

    const autoCompound = await aggregator.autoCompoundEnabled().call();
    console.log('   Auto Compound:', autoCompound);

    // 2. 鏀寔鐨勪唬甯?
    console.log('\n2. 鏀寔鐨勪唬甯?');
    const tokens = await aggregator.getSupportedTokens().call();
    tokens.forEach((token, i) => {
        console.log(`  ${i + 1}. ${token}`);
    });

    if (tokens.length > 0) {
        const usdtAddress = tokens[0];

        // 3. 鍟嗘埛浣欓
        console.log('\n3. 鍟嗘埛浣欓:');
        const [total, principal, interest] = await aggregator.getMerchantBalance(
            merchant,
            usdtAddress
        ).call();

        console.log(`   Total: ${(Number(total) / 1e6).toLocaleString()} USDT`);
        console.log(`   Principal: ${(Number(principal) / 1e6).toLocaleString()} USDT`);
        console.log(`   Interest: ${(Number(interest) / 1e6).toLocaleString()} USDT`);
        console.log(`   Active: ${(Number(total) > 0)}`);

        // 4. APY鏌ヨ
        console.log('\n4. APY淇℃伅:');
        const [apy, exchangeRate] = await aggregator.getTokenAPY(usdtAddress).call();
        console.log(`   APY: ${(Number(apy) / 1e14).toFixed(2)}%`); // 1e16 = 10000 * 1e14 = 100%
        console.log(`   Exchange Rate: ${(Number(exchangeRate) / 1e18).toFixed(6)}`);

        // 5. 鍚堢害缁熻
        console.log('\n5. 鍚堢害缁熻:');
        const stats = await aggregator.getStats().call();
        console.log('   Active Merchants:', Number(BigInt(stats[0])));
        console.log('   Supported Tokens:', Number(BigInt(stats[1])));
        console.log('   TVL:', (Number(BigInt(stats[2])) / 1e18).toLocaleString(), 'USD');

        // 6. 娴嬭瘯鑷姩澶嶅埄寮€鍏?
        console.log('\n6. 鑷姩澶嶅埄寮€鍏?');
        console.log('   Current:', autoCompound);
        await aggregator.toggleAutoCompound(false).send({
            from: merchant,
            shouldPollResponse: true,
            feeLimit: 100000000
        });
        const off = await aggregator.autoCompoundEnabled().call();
        console.log('   After toggle:', off);

        // 鏆傚仠/鎭㈠
        console.log('\n7. 鏆傚仠/鎭㈠:');
        await aggregator.pauseDeposits().send({ from: merchant });
        console.log('   Deposits Paused');

        const depositPaused = await aggregator.depositPaused().call();
        console.log('   Verification:', depositPaused === true);
    }

    console.log('\n鉁?TronYieldAggregator娴嬭瘯瀹屾垚!');
}
```

---

## 浣跨敤鎸囧崡

### 蹇€熷紑濮?

```bash
# 1. 缂栬瘧鎵€鏈塗RON鍚堢害
npm run tron:compile

# 2. 閮ㄧ讲鍒癗ile娴嬭瘯缃?
node scripts/deploy-tron-simple.js        # 澶氱閲戝簱
node scripts/deploy-splitter.js         # 鑷姩鍒嗚处
node scripts/deploy-yield-aggregator.js   # 鏀剁泭鑱氬悎鍣?

# 3. 娴嬭瘯宸查儴缃茬殑鍚堢害
node scripts/test-vault-final.js      # 娴嬭瘯澶氱閲戝簱
node scripts/test-splitter-simple.js    # 娴嬭瘯鑷姩鍒嗚处
node scripts/test-yield-basic.js       # 娴嬭瘯鏀剁泭鑱氬悎鍣?
```

### 甯哥敤鍛戒护

#### 鏌ョ湅鍚堢害鐘舵€?
```javascript
const tronWeb = new TronWeb({
    fullNode: 'https://nile.trongrid.io'
});

// 杩炴帴鍚堢害
const vault = await tronWeb.contract(VAULT_ABI, VAULT_ADDRESS);

// 鏌ヨ鐘舵€?
const threshold = await vault.threshold().call();
const balance = await vault.nextPaymentId().call();
```

#### 鐩戝惉浜嬩欢
```javascript
vault.events.PaymentProposed()
    .on('data', (event) => {
        console.log('Payment Proposed:', event.returnValues);
    });
```

### 瀹夊叏鏈€浣冲疄璺?

1. **澶氱閰嶇疆**
   - 鑷冲皯3涓鍚嶈€?
   - 闃堝€? 2/3 鎴?3/5
   - 绛惧悕鑰呭垎鏁ｅ瓨鍌?

2. **鏃堕棿閿佽缃?*
   - 灏忛: 1-4灏忔椂
   - 涓: 24灏忔椂
   - 棰? 3-7澶?

3. **姣忔棩闄愰**
   - 灏忓瀷鍥㈤槦: 1,000 - 5,000 USDT
   - 涓瀷鍥㈤槦: 10,000 - 50,000 USDT
   - 澶у瀷浼佷笟: 100,000 - 500,000 USDT

4. **娴嬭瘯鐜**
   - 浣跨敤Nile娴嬭瘯缃戣繘琛屾祴璇?
   - 灏忛娴嬭瘯锛岄€愭澧炲姞閲戦
   - 楠岃瘉鎵€鏈夊姛鑳藉悗鍐嶉儴缃插埌涓荤綉

### TRON璧勬簮绠＄悊

#### Energy鑾峰彇
```javascript
// 鍐荤粨TRX鑾峰彇Energy锛?000 TRX鍐荤粨3澶?= 30000 Energy锛?
const freezeTx = await tronWeb.transactionBuilder.freezeBalance(
    1000,     // 閲戦
    3,         // 澶╂暟
    "ENERGY",
    tronWeb.defaultAddress.base58
);

const signedTx = await tronWeb.trx.sign(freezeTx);
const result = await tronWeb.trx.sendRawTransaction(signedTx);
```

#### Bandwidth鑾峰彇
```javascript
// 鍐荤粨TRX鑾峰彇Bandwidth
const freezeTx = await tronWeb.transactionBuilder.freezeBalance(
    1000,
    3,
    "BANDWIDTH",
    tronWeb.defaultAddress.base58
);
```

---

## 闄勫綍

### A. 鍚堢害鍦板潃姹囨€?

| 鍚堢害 | Nile娴嬭瘯缃戝湴鍧€ | TRONScan閾炬帴 |
|------|-----------|--------------|
| TronPaymentVault | `TSrRLNoyJmVNZMg6jA8hUzABxHA1ZBFGM` | [閾炬帴](https://nile.tronscan.org/#/contract/TSrRLNoyJmVNZMg6jA8hUzABxHA1ZBFGM) |
| TronPaymentSplitter | `TDJwns4C2Frp4wVnrqyz4Ud6SYoxc9nk7Z` | [閾炬帴](https://nile.tronscan.org/#/contract/TDJwns4C2Frp4wVnrqyz4Ud6SYoxc9nk7Z) |
| TronYieldAggregator | `TC6bpE1t1EderDzXZq1nuRDf8QRhQHgkgy` | [閾炬帴](https://nile.tronscan.org/#/contract/TC6bpE1t1EderDzXZq1nuRDf8QRhQHgkgy) |

### B. 甯哥敤鍦板潃

| 缃戠粶 | RPC URL | 姘撮緳澶?|
|------|---------|--------|
| Nile Testnet | https://nile.trongrid.io | https://nileex.io/join/getJoinPage |
| Mainnet | https://api.trongrid.io | https://tronscan.org |

### C. 鎶€鏈弬鑰?

- [TRON寮€鍙戞枃妗(https://developers.tron.network)
- [TronGrid API](https://www.trongrid.io/dashboard)
- [TronWeb SDK](https://tronweb.network)
- [Solidity鏂囨。](https://docs.soliditylang.org)
- [OpenZeppelin](https://docs.openzeppelin.com)

### D. 璁稿彲璇?

GPL-3.0-only License

---

**鏂囨。鐗堟湰**: v1.0.0
**鏈€鍚庢洿鏂?*: 2026-02-08
