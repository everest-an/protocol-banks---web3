# TRON Yield Aggregator - JustLend Integration

鑷姩鏀剁泭鑱氬悎鍣紝灏嗗晢鎴烽棽缃祫閲戝瓨鍏ustLend璧氬彇鍒╂伅锛屾敮鎸侀殢鏃舵彁鐜板拰鏀剁泭鍒嗛厤銆?

## 姒傝

| 缁勪欢 | 鎻忚堪 | 鐘舵€?|
|------|------|------|
| `IJustLend.sol` | JustLend鍗忚鎺ュ彛瀹氫箟 | 鉁?瀹屾垚 |
| `TronYieldAggregator.sol` | 鏀剁泭鑱氬悎鍣ㄤ富鍚堢害 | 鉁?瀹屾垚 |
| `Mocks.sol` | 娴嬭瘯鐢ㄧ殑Mock鍚堢害 | 鉁?瀹屾垚 |

---

## 1. JustLend鍗忚绠€浠?

JustLend鏄疶RON鍖哄潡閾句笂鏈€澶х殑鍘讳腑蹇冨寲鍊熻捶鍗忚锛岀被浼间簬浠ュお鍧婁笂鐨凙ave锛?

### 鏍稿績姒傚康

#### jToken锛堢敓鎭唬甯侊級
JustLend浣跨敤**jToken**浣滀负鐢熸伅浠ｅ竵锛岀被浼间簬Aave鐨刟Token锛?

```
瀛樻娴佺▼:
鐢ㄦ埛瀛樻 1000 USDT 鈫?鎴愪负 998 jUSDT锛坋xchangeRate = 1.002锛?

鍒╂伅绱Н:
1骞村悗锛宔xchangeRate 浠?1.002 娑ㄥ埌 1.01

鎻愮幇娴佺▼:
璧庡洖 998 jUSDT 鈫?鑾峰緱 1008 USDT
鈹溾攢鈹€ 鏈噾: 1000 USDT
鈹斺攢鈹€ 鍒╂伅: 8 USDT (0.8% APY)
```

#### 鏀寔鐨勪唬甯?

| 浠ｅ竵 | 绗﹀彿 | jToken | 灏忔暟浣?| 涓荤綉鍦板潃 |
|------|------|--------|--------|---------|
| Tether USD | USDT | jUSDT | 6 | TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t |
| USD Coin | USDC | jUSDC | 6 | TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8 |
| TRON | TRX | jTRX | 6 | 鍘熺敓浠ｅ竵 |
| Wrapped BTC | WBTC | jWBTC | 18 | TJxKK8Ht9m... |
| Wrapped ETH | WETH | jWETH | 18 | TXp8H8pZ... |

#### JustLend鏀剁泭鏉ユ簮

| 鏀剁泭鏉ユ簮 | 璇存槑 | APY绀轰緥 |
|---------|------|---------|
| 鍊熻捶鍒╁樊 | 鍊熸浜烘敮浠樼殑鍒╂伅 | 2-5% |
| TRX濂栧姳 | 璐ㄦ娂鎸栫熆濂栧姳 | 1-3% |
| JUST濂栧姳 | 娌荤悊浠ｅ竵濂栧姳 | 0.5-2% |

---

## 2. TronYieldAggregator鏋舵瀯

### 宸ヤ綔娴佺▼

```
鈹屸攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?
鈹?                   鏀剁泭鑱氬悎娴佺▼                              鈹?
鈹溾攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?
鈹?                                                            鈹?
鈹? 1. 鍟嗘埛瀛樻                                               鈹?
鈹?    鐢ㄦ埛 鈫?1000 USDT 鈫?TronYieldAggregator                  鈹?
鈹?                                                            鈹?
鈹? 2. 鑷姩璐ㄦ娂JustLend                                        鈹?
鈹?    TronYieldAggregator 鈫?JustLend.deposit(jUSDT)          鈹?
鈹?    鑾峰緱鍒╂伅 鈫?exchangeRate 涓婃定                            鈹?
鈹?                                                            鈹?
鈹? 3. 鏀剁泭璁＄畻                                               鈹?
鈹?    璐︽埛浣欓 = jUSDT鏁伴噺 脳 exchangeRate                      鈹?
鈹?    鍒╂伅 = 褰撳墠浣欓 - 鏈噾                                  鈹?
鈹?                                                            鈹?
鈹? 4. 鎻愮幇                                                   鈹?
鈹?    TronYieldAggregator 鈫?JustLend.redeem(jUSDT)           鈹?
鈹?    jUSDT 鈫?USDT 鈫?鐢ㄦ埛                                    鈹?
鈹?                                                            鈹?
鈹? 5. 鏀剁泭鍒嗛厤锛堝彲閫夛級                                        鈹?
鈹?    TronYieldAggregator 鈫?鎸夋瘮渚嬪垎閰嶇粰澶氫釜鍙楃泭浜?            鈹?
鈹?                                                            鈹?
鈹斺攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹?
```

### 鏍稿績鍔熻兘

#### 鑷姩瀛樻涓庤川鎶?
```solidity
function deposit(address token, uint256 amount)
    external
    nonReentrant
    whenNotPaused
    validToken(token)
```
- 鐢ㄦ埛瀛樺叆TRC20浠ｅ竵
- 鍚堢害鑷姩璐ㄦ娂鍒癑ustLend
- 鑾峰緱jToken鐢熸伅璧勪骇

#### 鐏垫椿鎻愮幇
```solidity
function withdraw(address token, uint256 amount)
    external
    nonReentrant
    whenNotPaused
    validToken(token)
    returns (uint256 withdrawnAmount, uint256 principalAmount, uint256 interestAmount)
```
- 鏀寔閮ㄥ垎鎻愮幇鎴栧叏棰濇彁鐜?
- 鑷姩璁＄畻鏈噾vs鍒╂伅閮ㄥ垎
- 瀹炴椂鏌ヨ璐︽埛浣欓

#### 鏀剁泭鍒嗛厤
```solidity
function distributeYield(
    address token,
    YieldRecipient[] memory recipients
) external
```
- 鎸夌櫨鍒嗘瘮鍒嗛厤鏀剁泭
- 鏀寔鍥哄畾閲戦鍒嗛厤
- 鍙厤缃涓彈鐩婁汉

#### 鏀剁泭杩借釜
```solidity
function getMerchantBalance(address merchant, address token)
    external
    view
    returns (uint256 balance, uint256 principal, uint256 interest)
```
- 瀹炴椂APY鏌ヨ
- 鏈噾vs鍒╂伅杩借釜
- 鍘嗗彶绱Н鏀剁泭缁熻

---

## 3. 鍚堢害鎺ュ彛璇﹁В

### 3.1 瀛樻鍔熻兘

#### deposit()
```solidity
/**
 * @notice 灏嗕唬甯佸瓨鍏ユ敹鐩婅仛鍚堝櫒锛堣嚜鍔ㄨ川鎶煎埌JustLend锛?
 * @param token 浠ｅ竵鍦板潃锛圲SDT銆乁SDC绛夛級
 * @param amount 瀛樻閲戦锛堜唬甯佸皬鏁颁綅锛屽USDT涓?浣嶏級
 */
function deposit(address token, uint256 amount) external;
```

**浣跨敤绀轰緥锛?*
```javascript
// 瀛樺叆1000 USDT
const usdtAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const amount = BigInt(1000 * 1e6); // 1000 USDT (6浣嶅皬鏁?

await aggregator.deposit(usdtAddress, amount, {
    from: merchantAddress
});

// 浜嬩欢鐩戝惉
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

### 3.2 鎻愮幇鍔熻兘

#### withdraw()
```solidity
/**
 * @notice 浠庢敹鐩婅仛鍚堝櫒鎻愮幇浠ｅ竵锛堜粠JustLend璧庡洖锛?
 * @param token 浠ｅ竵鍦板潃
 * @param amount 鎻愮幇閲戦锛? = 鎻愮幇鍏ㄩ儴
 * @return withdrawnAmount 瀹為檯鎻愮幇閲戦
 * @return principalAmount 鏈噾閮ㄥ垎
 * @return interestAmount 鍒╂伅閮ㄥ垎
 */
function withdraw(address token, uint256 amount)
    external
    returns (uint256 withdrawnAmount, uint256 principalAmount, uint256 interestAmount);
```

**浣跨敤绀轰緥锛?*
```javascript
// 鎻愮幇鍏ㄩ儴USDT
const { withdrawnAmount, principalAmount, interestAmount } = await aggregator.withdraw(
    usdtAddress,
    0, // 0 = 鍏ㄩ儴鎻愮幇
    { from: merchantAddress }
);

console.log(`Withdrawn: ${Number(withdrawnAmount)/1e6} USDT`);
console.log(`Principal: ${Number(principalAmount)/1e6} USDT`);
console.log(`Interest: ${Number(interestAmount)/1e6} USDT`);
```

### 3.3 鏀剁泭鏌ヨ

#### getMerchantBalance()
```solidity
/**
 * @notice 鑾峰彇鍟嗘埛浣欓锛堟湰閲?鍒╂伅锛?
 * @param merchant 鍟嗘埛鍦板潃
 * @param token 浠ｅ竵鍦板潃
 * @return balance 鎬讳綑棰?
 * @return principal 鏈噾
 * @return interest 绱Н鍒╂伅
 */
function getMerchantBalance(address merchant, address token)
    external
    view
    returns (uint256 balance, uint256 principal, uint256 interest);
```

**浣跨敤绀轰緥锛?*
```javascript
const [balance, principal, interest] = await aggregator.getMerchantBalance(
    merchantAddress,
    usdtAddress
);

console.log(`Total Balance: ${Number(balance)/1e6} USDT`);
console.log(`Principal: ${Number(principal)/1e6} USDT`);
console.log(`Earned Interest: ${Number(interest)/1e6} USDT`);

// 璁＄畻鏀剁泭鐜?
const yieldPercentage = (Number(interest) / Number(principal)) * 100;
console.log(`Yield: ${yieldPercentage.toFixed(2)}%`);
```

#### getTokenAPY()
```solidity
/**
 * @notice 鑾峰彇浠ｅ竵褰撳墠鐨凙PY
 * @param token 浠ｅ竵鍦板潃
 * @return apy 褰撳墠APY锛埫?e18锛屽1e17 = 10%锛?
 * @return exchangeRate 褰撳墠jToken姹囩巼
 */
function getTokenAPY(address token)
    external
    view
    returns (uint256 apy, uint256 exchangeRate);
```

**浣跨敤绀轰緥锛?*
```javascript
const [apy, exchangeRate] = await aggregator.getTokenAPY(usdtAddress);

const apyPercentage = (Number(apy) / 1e16) / 100; // 杞崲涓虹櫨鍒嗘瘮
console.log(`Current APY: ${apyPercentage.toFixed(2)}%`);
console.log(`Exchange Rate: ${Number(exchangeRate)/1e18}`);
```

### 3.4 鏀剁泭鍒嗛厤

#### distributeYield()
```solidity
/**
 * @notice 灏嗙疮绉敹鐩婂垎閰嶇粰澶氫釜鍙楃泭浜?
 * @param token 浠ｅ竵鍦板潃
 * @param recipients 鍙楃泭浜烘暟缁勶紙鍙寜鐧惧垎姣旀垨鍥哄畾閲戦锛?
 */
function distributeYield(address token, YieldRecipient[] memory recipients) external;
```

**浣跨敤绀轰緥锛?*
```javascript
// 鎸夌櫨鍒嗘瘮鍒嗛厤鏀剁泭锛堟€?00%锛?
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

// 鎸夊浐瀹氶噾棰濆垎閰嶆敹鐩?
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

## 4. 閮ㄧ讲娴佺▼

### 鍓嶇疆瑕佹眰

```
1. TRON璐︽埛浣欓鍏呰冻锛堢敤浜庨儴缃插拰娴嬭瘯锛?
   - 涓荤綉锛氳嚦灏?00 TRX
   - Nile娴嬭瘯缃戯細鑷冲皯1000 TRX

2. JustLend鍗忚鍦板潃
   - 涓荤綉JustLend: TDyvndW...
   - 涓荤綉Unitroller: THjzj3qy...
   - 涓荤綉Oracle: T9yDxG...

3. TRC20浠ｅ竵
   - USDT: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
   - USDC: TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8
```

### 閮ㄧ讲鑴氭湰

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

### 杩愯閮ㄧ讲

```bash
# 缂栬瘧鍚堢害
npx hardhat compile

# 閮ㄧ讲鍒癗ile娴嬭瘯缃?
npx hardhat run scripts/deploy-yield-aggregator.ts --network tron_nile

# 閮ㄧ讲鍒颁富缃?
npx hardhat run scripts/deploy-yield-aggregator.ts --network tron_mainnet
```

---

## 5. 浣跨敤鍦烘櫙

### 5.1 鍟嗘埛闂茬疆璧勯噾鏀剁泭

```javascript
// 鍟嗘埛A鏈?00,000 USDT闂茬疆
const aggregator = new ethers.Contract(aggregatorAddress, aggregatorABI, wallet);

// 1. 瀛樻鍒版敹鐩婅仛鍚堝櫒
await aggregator.deposit(
    usdtAddress,
    ethers.parseUnits("100000", 6),  // 100,000 USDT
    { gasLimit: 500000 }
);

// 2. 1骞村悗鏌ヨ鏀剁泭
const [balance, principal, interest] = await aggregator.getMerchantBalance(
    merchantAddress,
    usdtAddress
);

// 棰勬湡缁撴灉锛?
// balance 鈮?100800 USDT
// principal = 100000 USDT
// interest 鈮?800 USDT (0.8% APY)
```

### 5.2 璺ㄩ摼璧勯噾姹犵粺涓€绠＄悊

```javascript
// 鍦ㄤ笉鍚岄摼涓婂瓨娆撅紙TRON銆丒thereum銆丅ase锛?
const tronAggregator = new ethers.Contract(tronAggregatorAddress, tronABI, tronWallet);
const ethAggregator = new ethers.Contract(ethAggregatorAddress, ethABI, ethWallet);

// TRON: 瀛樺叆USDT
await tronAggregator.deposit(usdtAddress, ethers.parseUnits("50000", 6));

// Ethereum: 瀛樺叆USDC
await ethAggregator.deposit(usdcAddress, ethers.parseUnits("50000", 6));

// Base: 瀛樺叆USDC
await baseAggregator.deposit(usdcAddress, ethers.parseUnits("50000", 6));

// 缁熶竴鏌ヨ浣欓
const tronBalance = await tronAggregator.getMerchantBalance(merchantAddress, usdtAddress);
const ethBalance = await ethAggregator.getMerchantBalance(merchantAddress, usdcAddress);
const baseBalance = await baseAggregator.getMerchantBalance(merchantAddress, usdcAddress);

console.log(`TRON Balance:  ${tronBalance.balance/1e6} USDT`);
console.log(`ETH Balance:   ${ethBalance.balance/1e18} USDC`);
console.log(`Base Balance:  ${baseBalance.balance/1e6} USDC`);
```

### 5.3 鑷姩鍖栨敹鐩婂垎閰?

```javascript
// 鍟嗘埛B灏?0%鏀剁泭鍒嗛厤缁欏瓙璐︽埛锛?0%淇濈暀
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

// 瀹氭湡鎵ц鏀剁泭鍒嗛厤锛堜緥濡傛瘡鏈?鍙凤級
await aggregator.distributeYield(usdtAddress, recipients);

// 楠岃瘉鍒嗛厤缁撴灉
for (const recipient of recipients) {
    const [balance] = await aggregatorWithSigner.getMerchantBalance(
        recipient.account,
        usdtAddress
    );
    console.log(`${recipient.account}: ${balance/1e6} USDT`);
}
```

### 5.4 绱ф€ヨ祫閲戞彁鍙?

```javascript
// 鍦ㄥ競鍦烘尝鍔ㄦ椂绱ф€ユ彁鍙栨墍鏈夎祫閲?
const [withdrawnAmount, principalAmount, interestAmount] = await aggregator.withdraw(
    usdtAddress,
    0, // 0 = 鍏ㄩ儴鎻愬彇
    { gasLimit: 800000 }
);

console.log(`Withdrawn: ${withdrawnAmount/1e6} USDT`);
console.log(`Principal: ${principalAmount/1e6} USDT`);
console.log(`Interest: ${interestAmount/1e6} USDT`);
```

---

## 6. 鏀剁泭鏈哄埗璇﹁В

### 6.1 JustLend鏀剁泭鏉ユ簮

| 鏉ユ簮 | 鏈哄埗 | APY鑼冨洿 |
|------|------|---------|
| **鍊熻捶鍒╁樊** | 鍊熸浜烘敮浠樺埄鎭?鈫?瀛樻浜鸿幏寰楁敹鐩?| 1-3% |
| **TRX璐ㄦ娂** | 璐ㄦ娂TRX楠岃瘉鍖哄潡 鈫?鍒嗕韩鍖哄潡濂栧姳 | 0.5-2% |
| **JUST鎸栫熆** | 娌荤悊浠ｅ竵JUST -> 璐ㄦ娂鑰呭叡浜?| 0.2-1% |
| **Compliance濂栧姳** | 绗﹀悎鍚堣瑕佹眰 鈫?棰濆濂栧姳 | 0.1-0.5% |

### 6.2 鏀剁泭璁＄畻绀轰緥

#### 鍗曞埄璁＄畻锛堢畝鍖栵級
```
鏈噾 = 10,000 USDT
姣忔棩鏀剁泭鐜?= 0.003%锛堝勾鍖?1.1%锛?

30澶╁悗锛?
鎬绘敹鐩?= 10,000 * 0.003% * 30 = 9 USDT
鎬讳綑棰?= 10,000 + 9 = 10,009 USDT
```

#### 澶嶅埄璁＄畻锛堝疄闄咃級
```
鏈噾 = 10,000 USDT
APY = 1.1%

1骞村悗锛堝鍒╋級锛?
鎬讳綑棰?= 10,000 * (1 + 0.011)^1 鈮?10,110 USDT
缁煎悎鏀剁泭 鈮?1.1%
```

### 6.3 APY鏌ヨ涓庣洃鎺?

```javascript
// 瀹氭湡鐩戞帶APY鍙樺寲
setInterval(async () => {
    const [apy] = await aggregator.getTokenAPY(usdtAddress);
    const apyPercentage = (Number(apy) / 1e16) / 100;

    console.log(`[${new Date().toISOString()}] USDT APY: ${apyPercentage.toFixed(4)}%`);

    // 濡傛灉APY鏄捐憲涓嬮檷锛屽彂閫侀€氱煡
    if (apyPercentage < 0.5) {
        console.warn("USDT APY below 0.5% - consider alternative strategies");
        // 鍙戦€乄ebhook/閫氱煡
    }
}, 3600000); // 姣忓皬鏃?
```

---

## 7. 瀹夊叏鏈哄埗

### 7.1 鍚堢害瀹夊叏鐗规€?

| 鐗规€?| 瀹炵幇 | 鐩殑 |
|------|------|------|
| 閲嶅叆淇濇姢 | `nonReentrant` 淇グ绗?| 闃叉閲嶅叆鏀诲嚮 |
| 鏆傚仠鏈哄埗 | `depositPaused` `withdrawalPaused` | 绱ф€ユ儏鍐典笅鍙殏鍋滄搷浣?|
| 浠呮墍鏈夎€呴厤缃?| `onlyOwner` 淇グ绗?| 闃叉鏈巿鏉冧慨鏀?|
| 浠ｅ竵鐧藉悕鍗?| `tokenConfigs` 鏄犲皠 | 浠呮敮鎸佺粡杩囬獙璇佺殑浠ｅ竵 |
| 浣欓楠岃瘉 | 澶氬浣欓妫€鏌?| 闃叉瓒呴鎻愮幇 |

### 7.2 鏈€浣冲疄璺?

#### 瀵嗛挜绠＄悊
```javascript
// 浣跨敤澶氶噸绛惧悕鎺у埗YieldAggregator
// 2/3绛惧悕妯″紡锛?
// - 绠＄悊鍛楢锛氭棩甯哥淮鎶?
// - 绠＄悊鍛楤锛氬簲鎬ュ搷搴?
// - 绠＄悊鍛楥锛氱洃鐫ｅ璁?

// 閰嶇疆澶氱閽卞寘
const multisigAddress = 'TMultisig...';
const aggregator = new ethers.Contract(
    aggregatorAddress,
    aggregatorABI,
    multisigWallet // 浣跨敤澶氱閽卞寘绛惧悕
);
```

#### 椋庨櫓绠＄悊
```javascript
// 1. 鍒嗘暎瀛樻浠ｅ竵
const tokens = [usdtAddress, usdcAddress, wbtcAddress];
const amountPerToken = ethers.parseUnits("100000", 6); // 100,000 USDT

for (const token of tokens) {
    await aggregator.deposit(token, amountPerToken);
}

// 2. 璁剧疆鏀剁泭鍒嗗彂闃堝€?
// 绱Н鍒╂伅 > 10,000 USDT鎵嶅垎鍙?
if (interestAmount > ethers.parseUnits("10000", 6)) {
    await aggregator.distributeYield(usdtAddress, recipients);
}

// 3. 瀹氭湡瀹¤浣欓
setInterval(async () => {
    const stats = await aggregator.getStats();
    console.log(`Active Merchants: ${stats[0]}`);
    console.log(`TVL: $${Number(stats[3]) / 1e18} USD`);

    // 濡傛灉TVL寮傚父锛屽彂閫佽鎶?
    if (Number(stats[3]) < expectedMinTVL) {
        console.error("TVL dropped below expected minimum!");
        // 鍙戦€佺揣鎬ラ€氱煡
    }
}, 86400000); // 姣忓ぉ妫€鏌?
```

---

## 8. 浜嬩欢鐩戝惉涓庣洃鎺?

### 8.1 Web3浜嬩欢鐩戝惉

```javascript
// 鐩戝惉瀛樻浜嬩欢
aggregator.events.Deposited({
    filter: { merchant: merchantAddress }
})
.on('data', (event) => {
    const { token, amount, principal, timestamp } = event.returnValues;
    console.log(`[Deposit] ${amount/1e6} ${token}, Principal: ${principal/1e6}`);

    // 鏇存柊鏁版嵁搴?浠〃鏉?
    updateDashboard({
        action: 'deposit',
        amount: amount,
        token,
        timestamp
    });
})
.on('error', console.error);

// 鐩戝惉鎻愮幇浜嬩欢
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

// 鐩戝惉鏀剁泭鍒嗛厤浜嬩欢
aggregator.events.YieldDistributed({
    filter: { merchant: merchantAddress }
})
.on('data', (event) => {
    const { totalInterest, recipientCount, timestamp } = event.returnValues;
    console.log(`[Yield] Distributed ${totalInterest/1e6} USDT to ${recipientCount} recipients`);
});
```

### 8.2 瀹炴椂鏀剁泭杩借釜

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

// 浣跨敤
const tracker = new YieldTracker(aggregator, merchantAddress, usdtAddress);
await tracker.trackGrowth(3600000); // 姣忓皬鏃惰拷韪?
```

---

## 9. 娴嬭瘯鎸囧崡

### 9.1 鍗曞厓娴嬭瘯

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

### 9.2 杩愯娴嬭瘯

```bash
# 杩愯鎵€鏈夋祴璇?
npx hardhat test test/TronYieldAggregator.test.ts

# 杩愯娴嬭瘯瑕嗙洊鐜?
npx hardhat coverage --testfiles "test/TronYieldAggregator.test.ts"

# 璇︾粏杈撳嚭
npx hardhat test test/TronYieldAggregator.test.ts --verbose
```

---

## 10. 鎬ц兘浼樺寲

### 10.1 Gas浼樺寲

| 鎿嶄綔 | Gas娑堣€?| 浼樺寲寤鸿 |
|------|---------|---------|
| deposit() | ~250,000 | 鎵归噺瀛樻鍙妭鐪?|
| withdraw() | ~300,000 | 閮ㄥ垎鎻愮幇姣斿叏棰濇彁鐜版洿鐪乬as |
| distributeYield() | ~500,000 | 鍑忓皯鍙楃泭浜烘暟閲?|
| getMerchantBalance() | ~10,000锛坴iew锛?| 浣跨敤浜嬩欢缂撳瓨鏌ヨ |

### 10.2 鎵归噺鎿嶄綔

```javascript
// 鎵归噺瀛樻锛堝涓唬甯侊級
const tokens = [usdtAddress, usdcAddress, wbtcAddress];
const amounts = [
    ethers.parseUnits("50000", 6),   // 50,000 USDT
    ethers.parseUnits("50000", 6),   // 50,000 USDC
    ethers.parseUnits("1", 18)        // 1 WBTC
];

// 骞惰鎺堟潈
const approvePromises = tokens.map((token, i) =>
    ITRC20(token).approve(aggregatorAddress, amounts[i])
);
await Promise.all(approvePromises);

// 椤哄簭瀛樻锛堥伩鍏峮once鍐茬獊锛?
for (let i = 0; i < tokens.length; i++) {
    await aggregator.deposit(tokens[i], amounts[i]);
}
```

---

## 11. 鐩戞帶涓庡憡璀?

### 11.1 Prometheus鎸囨爣

```javascript
// 闆嗘垚Prometheus鐩戞帶
const promClient = require('prom-client');

// 瀹氫箟鎸囨爣
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

// 鏇存柊鎸囨爣
async function updateMetrics() {
    const stats = await aggregator.getStats();
    const tvl = stats[3];

    // TVL
    tvlGauge.set({ token: 'USDT' }, Number(tvl) / 1e18);

    // 姣忎釜鍟嗘埛鐨勫埄鎭?
    const merchants = ['0x...', '0x...'];
    for (const merchant of merchants) {
        const [balance, principal, interest] = await aggregator.getMerchantBalance(
            merchant,
            usdtAddress
        );
        interestGauge.set({ merchant, token: 'USDT' }, Number(interest) / 1e6);
    }
}

// 鏆撮湶metrics绔偣
// Express.js绀轰緥
app.get('/metrics', async (req, res) => {
    await updateMetrics();
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
});
```

### 11.2 鍛婅瑙勫垯

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

## 12. 甯歌闂锛團AQ锛?

### Q1: JustLend APY濡備綍璁＄畻锛?
JustLend APY = supplyRatePerBlock 脳 blocksPerYear 脳 100

TRON鍖哄潡鏃堕棿 = 3绉?鍧?
姣忓勾鍖哄潡鏁?= 365 脳 24 脳 3600 / 3 = 10,512,000鍧?

绀轰緥锛?
- supplyRatePerBlock = 0.0000000001 (1e-10)
- APY = 1e-10 脳 10,512,000 脳 100 = 0.1051% 鈮?0.11%

### Q2: 鍒╂伅澶氫箙澶嶅埄涓€娆★紵
JustLend鐨刯Token姹囩巼鎸佺画澧為暱锛堟瘡涓尯鍧楁洿鏂帮級锛屽疄璐ㄤ笂鏄?*姣?绉掑鍒╀竴娆?*銆?

### Q3: 鎻愮幇闇€瑕佸闀挎椂闂达紵
- 鏅€氭彁鐜帮細~5-10绉掞紙1-2涓尯鍧楋級
- 澶ч鎻愮幇锛氬彲鑳介渶瑕佹洿澶氭椂闂达紙Gas闄愬埗锛?

### Q4: 濡傛灉JustLend鍗忚鍑虹幇闂鎬庝箞鍔烇紵
鏀剁泭鑱氬悎鍣ㄦ湁鏆傚仠鏈哄埗锛岀鐞嗗憳鍙殏鍋滄彁鐜帮細
```javascript
// 鏆傚仠鎻愮幇
await aggregator.pauseWithdrawals();

// 绱ф€ュ彇娆撅紙浠呮墍鏈夎€咃級
await aggregator.emergencyWithdraw(usdtAddress, safeWallet, amount);
```

### Q5: 鏀寔鍝簺閾撅紵
Yield Aggregator褰撳墠浠呮敮鎸乀RON涓荤綉鍜孨ile娴嬭瘯缃戙€傝法閾剧増鏈紑鍙戜腑銆?

### Q6: 鏀剁泭鏄惁鍙互鍐嶈川鎶硷紵
鏀寔锛佸惎鐢╝utoCompound鍔熻兘鍚庯紝鏀剁泭浼氳嚜鍔ㄥ啀璐ㄦ娂鍒癑ustLend锛屽疄鐜板鍒╁闀裤€?

---

## 13. 鐩稿叧璧勬簮

- [JustLend瀹樻柟鏂囨。](https://justlend.org)
- [TRON寮€鍙戣€呮枃妗(https://developers.tron.network)
- [JustLend涓荤綉](https://justlend.org/)
- [JustLend Nile娴嬭瘯缃慮(https://testnet.justlend.org/)
- [TRONScan娴忚鍣╙(https://tronscan.org)
- [Nile娴嬭瘯缃戞祻瑙堝櫒](https://nile.tronscan.org)

---

## 14. 鏇存柊鏃ュ織

### v1.0.0 (2026-02-08)
- 鉁?瀹炵幇`IJustLend.sol` - JustLend鍗忚鎺ュ彛
- 鉁?瀹炵幇`TronYieldAggregator.sol` - 鏀剁泭鑱氬悎鍣ㄤ富鍚堢害
- 鉁?瀹炵幇`Mocks.sol` - 娴嬭瘯Mock鍚堢害
- 鉁?瀹屾暣鏂囨。鍜屼娇鐢ㄧず渚?
- 鉁?鏀寔USDT銆乁SDC銆乀RX绛変唬甯?
- 鉁?鏀剁泭鍒嗛厤鍔熻兘
- 鉁?鏀剁泭杩借釜鍜孉PY鏌ヨ

---

## 15. 璁稿彲璇?

GPL-3.0-only License
