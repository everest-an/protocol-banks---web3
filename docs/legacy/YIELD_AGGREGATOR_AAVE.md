# 鑷姩鐢熸伅鍔熻兘 - 闆嗘垚 Aave 鍗忚

**鏇存柊鏃ユ湡:** 2026-02-08
**鐘舵€?** 璁捐瀹屾垚锛屽緟瀹炴柦

---

## 1. 鏋舵瀯姒傝

### 1.1 涓轰粈涔堜娇鐢?Aave锛?

**鉁?浼樺娍:**
- 缁忚繃澶氭瀹¤锛屽畨鍏ㄦ€ч珮
- TVL > $10B锛屾祦鍔ㄦ€у厖瓒?
- 鏀寔澶氶摼锛圗thereum, Base, Arbitrum, Polygon锛?
- 鍒╃巼鑷姩璋冩暣锛堜緵闇€骞宠　锛?
- 鏃犻渶缂栧啓鍜屽璁¤嚜瀹氫箟鍚堢害

**鉂?涓嶄娇鐢ㄨ嚜瀹氫箟鍚堢害鐨勫師鍥?**
- 鏅鸿兘鍚堢害瀹¤鎴愭湰楂橈紙$50k+锛?
- 瀹夊叏椋庨櫓澶э紙璧勯噾鎹熷け椋庨櫓锛?
- 闇€瑕佷笓涓氱殑 DeFi 鍥㈤槦缁存姢

### 1.2 澶氶摼绛栫暐

| 缃戠粶 | 鍗忚 | USDT 鏀剁泭鐜?| 闆嗘垚闅惧害 |
|------|------|------------|----------|
| **TRON** | JustLend | 8-12% APY | 猸愨瓙 涓瓑 |
| **Ethereum** | Aave V3 | 3-5% APY | 猸愨瓙猸?绠€鍗?|
| **Base** | Aave V3 | 4-6% APY | 猸愨瓙猸?绠€鍗?|
| **Arbitrum** | Aave V3 | 4-6% APY | 猸愨瓙猸?绠€鍗?|

---

## 2. Aave V3 闆嗘垚璁捐

### 2.1 鏍稿績姒傚康

**Aave 宸ヤ綔鍘熺悊:**
```
鐢ㄦ埛瀛樺叆 USDT
    鈫?
Aave 杩斿洖 aUSDT (鐢熸伅浠ｅ竵)
    鈫?
aUSDT 浣欓鑷姩澧為暱 (姣忕璁℃伅)
    鈫?
璧庡洖 aUSDT 鈫?鑾峰緱鏈噾 + 鍒╂伅
```

**鍏抽敭鍚堢害:**
- `Pool`: 瀛樻鍜屾彁娆剧殑涓诲悎绾?
- `aToken`: 鐢熸伅浠ｅ竵锛坅USDT, aUSDC锛?
- `PoolAddressesProvider`: 鑾峰彇 Pool 鍦板潃

### 2.2 鏅鸿兘鍚堢害璁捐

**绠€鍖栫増鍟嗘埛鐢熸伅绠＄悊鍣?**

```solidity
// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@aave/core-v3/contracts/interfaces/IAToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MerchantYieldManager
 * @notice 鍟嗘埛璧勯噾鑷姩鐢熸伅绠＄悊鍣?(闆嗘垚 Aave V3)
 * @dev 涓嶈嚜宸辩紪鍐欏€熻捶閫昏緫锛屼粎浣滀负 Aave 鐨勫皝瑁呭眰
 */
contract MerchantYieldManager is ReentrancyGuard {
    // Aave V3 Pool 鍚堢害
    IPool public immutable aavePool;

    // USDT 鍜?aUSDT 鍦板潃
    IERC20 public immutable usdt;
    IAToken public immutable aUSDT;

    // 鍟嗘埛浣欓鏄犲皠 (璁板綍鏈噾)
    mapping(address => uint256) public merchantPrincipal;

    // 浜嬩欢
    event Deposited(address indexed merchant, uint256 amount);
    event Withdrawn(address indexed merchant, uint256 principal, uint256 interest);

    /**
     * @notice 鏋勯€犲嚱鏁?
     * @param _aavePool Aave Pool 鍚堢害鍦板潃
     * @param _usdt USDT 浠ｅ竵鍦板潃
     * @param _aUSDT aUSDT 浠ｅ竵鍦板潃
     */
    constructor(
        address _aavePool,
        address _usdt,
        address _aUSDT
    ) {
        aavePool = IPool(_aavePool);
        usdt = IERC20(_usdt);
        aUSDT = IAToken(_aUSDT);
    }

    /**
     * @notice 鍟嗘埛瀛樺叆 USDT 鍒?Aave 鐢熸伅
     * @param amount 瀛樺叆閲戦
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");

        // 1. 浠庡晢鎴疯浆鍏?USDT
        require(
            usdt.transferFrom(msg.sender, address(this), amount),
            "USDT transfer failed"
        );

        // 2. 鎺堟潈 Aave Pool
        usdt.approve(address(aavePool), amount);

        // 3. 瀛樺叆 Aave (浼氳嚜鍔ㄦ敹鍒?aUSDT)
        aavePool.supply(
            address(usdt),    // 璧勪骇鍦板潃
            amount,           // 鏁伴噺
            address(this),    // 鎺ユ敹 aUSDT 鐨勫湴鍧€
            0                 // referralCode (鏈娇鐢?
        );

        // 4. 璁板綍鍟嗘埛鏈噾
        merchantPrincipal[msg.sender] += amount;

        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice 鍟嗘埛鎻愬彇鏈噾 + 鍒╂伅
     * @param amount 鎻愬彇鏈噾鏁伴噺 (0 = 鍏ㄩ儴鎻愬彇)
     */
    function withdraw(uint256 amount) external nonReentrant {
        uint256 principal = merchantPrincipal[msg.sender];
        require(principal > 0, "No deposit found");

        // 0 琛ㄧず鎻愬彇鍏ㄩ儴
        if (amount == 0) {
            amount = principal;
        }

        require(amount <= principal, "Insufficient principal");

        // 璁＄畻瀹為檯 USDT 鏁伴噺锛堝寘鍚埄鎭級
        uint256 aTokenBalance = aUSDT.balanceOf(address(this));
        uint256 shareRatio = (amount * 1e18) / getTotalPrincipal();
        uint256 withdrawAmount = (aTokenBalance * shareRatio) / 1e18;

        // 浠?Aave 璧庡洖
        uint256 actualWithdrawn = aavePool.withdraw(
            address(usdt),
            withdrawAmount,
            msg.sender  // 鐩存帴鍙戦€佺粰鍟嗘埛
        );

        // 鏇存柊鍟嗘埛鏈噾
        merchantPrincipal[msg.sender] -= amount;

        // 璁＄畻鍒╂伅
        uint256 interest = actualWithdrawn > amount ? actualWithdrawn - amount : 0;

        emit Withdrawn(msg.sender, amount, interest);
    }

    /**
     * @notice 鏌ヨ鍟嗘埛浣欓锛堟湰閲?+ 鍒╂伅锛?
     * @param merchant 鍟嗘埛鍦板潃
     * @return principal 鏈噾
     * @return interest 绱鍒╂伅
     * @return total 鎬讳綑棰?
     */
    function getMerchantBalance(address merchant)
        external
        view
        returns (
            uint256 principal,
            uint256 interest,
            uint256 total
        )
    {
        principal = merchantPrincipal[merchant];

        if (principal == 0) {
            return (0, 0, 0);
        }

        // 璁＄畻璇ュ晢鎴峰湪 aUSDT 涓殑浠介
        uint256 totalPrincipal = getTotalPrincipal();
        uint256 aTokenBalance = aUSDT.balanceOf(address(this));

        // 鎬讳环鍊?= aUSDT 浣欓锛堣嚜鍔ㄥ闀匡級
        uint256 shareRatio = (principal * 1e18) / totalPrincipal;
        total = (aTokenBalance * shareRatio) / 1e18;

        // 鍒╂伅 = 鎬讳环鍊?- 鏈噾
        interest = total > principal ? total - principal : 0;
    }

    /**
     * @notice 鑾峰彇褰撳墠 APY
     * @return 骞村寲鏀剁泭鐜?(basis points, 1% = 100)
     */
    function getCurrentAPY() external view returns (uint256) {
        // 浠?Aave Pool 鑾峰彇褰撳墠瀛樻鍒╃巼
        IPool.ReserveData memory reserveData = aavePool.getReserveData(address(usdt));
        return reserveData.currentLiquidityRate / 1e23; // 杞崲涓?basis points
    }

    /**
     * @notice 鑾峰彇鎬绘湰閲?
     * @return 鎵€鏈夊晢鎴风殑鏈噾鎬诲拰
     */
    function getTotalPrincipal() public view returns (uint256) {
        // 瀹為檯瀹炵幇闇€瑕侀亶鍘嗘垨缁存姢涓€涓€诲拰鍙橀噺
        // 杩欓噷绠€鍖栧鐞?
        return aUSDT.balanceOf(address(this));
    }

    /**
     * @notice 绱ф€ユ彁鍙栵紙浠呮墍鏈夎€咃級
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = usdt.balanceOf(address(this));
        require(usdt.transfer(owner(), balance), "Emergency withdraw failed");
    }
}
```

---

## 3. TRON JustLend 闆嗘垚

### 3.1 JustLend 鎺ュ彛

```solidity
// TRON JustLend 鎺ュ彛
interface IJustLend {
    // 瀛樺叆 USDT锛岃繑鍥?jUSDT
    function mint(uint256 mintAmount) external returns (uint256);

    // 璧庡洖 jUSDT锛岃幏寰?USDT
    function redeem(uint256 redeemTokens) external returns (uint256);

    // 鏌ヨ姹囩巼
    function exchangeRateStored() external view returns (uint256);

    // 鏌ヨ jUSDT 浣欓
    function balanceOf(address owner) external view returns (uint256);
}

/**
 * @title TronMerchantYieldManager
 * @notice TRON 鐗堟湰鐨勭敓鎭鐞嗗櫒
 */
contract TronMerchantYieldManager {
    IJustLend public immutable jUSDT;
    IERC20 public immutable usdt;

    mapping(address => uint256) public merchantPrincipal;

    constructor(address _justLend, address _usdt) {
        jUSDT = IJustLend(_justLend);
        usdt = IERC20(_usdt);
    }

    function deposit(uint256 amount) external {
        usdt.transferFrom(msg.sender, address(this), amount);
        usdt.approve(address(jUSDT), amount);

        // 瀛樺叆 JustLend
        uint256 result = jUSDT.mint(amount);
        require(result == 0, "JustLend mint failed");

        merchantPrincipal[msg.sender] += amount;
    }

    function withdraw(uint256 amount) external {
        // 璁＄畻闇€瑕佽祹鍥炵殑 jUSDT 鏁伴噺
        uint256 exchangeRate = jUSDT.exchangeRateStored();
        uint256 jTokensToRedeem = (amount * 1e18) / exchangeRate;

        // 浠?JustLend 璧庡洖
        uint256 result = jUSDT.redeem(jTokensToRedeem);
        require(result == 0, "JustLend redeem failed");

        // 杞处缁欏晢鎴?
        usdt.transfer(msg.sender, amount);

        merchantPrincipal[msg.sender] -= amount;
    }

    function getMerchantBalance(address merchant)
        external
        view
        returns (uint256 principal, uint256 interest, uint256 total)
    {
        principal = merchantPrincipal[merchant];

        // 鏍规嵁 jUSDT 浣欓鍜屾眹鐜囪绠楁€讳环鍊?
        uint256 jTokenBalance = jUSDT.balanceOf(address(this));
        uint256 exchangeRate = jUSDT.exchangeRateStored();
        uint256 totalValue = (jTokenBalance * exchangeRate) / 1e18;

        // 鎸夋瘮渚嬭绠楄鍟嗘埛鐨勪唤棰?
        uint256 shareRatio = (principal * 1e18) / getTotalPrincipal();
        total = (totalValue * shareRatio) / 1e18;

        interest = total > principal ? total - principal : 0;
    }

    function getTotalPrincipal() internal view returns (uint256) {
        uint256 jTokenBalance = jUSDT.balanceOf(address(this));
        uint256 exchangeRate = jUSDT.exchangeRateStored();
        return (jTokenBalance * exchangeRate) / 1e18;
    }
}
```

---

## 4. 鍓嶇闆嗘垚

### 4.1 TypeScript Service

```typescript
// lib/services/yield/aave-yield.service.ts

import { ethers } from 'ethers'

/**
 * Aave V3 鍚堢害 ABI (绠€鍖栫増)
 */
const AAVE_POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
  'function withdraw(address asset, uint256 amount, address to) returns (uint256)',
  'function getReserveData(address asset) view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowRate, uint128 stableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))'
]

const MERCHANT_YIELD_ABI = [
  'function deposit(uint256 amount)',
  'function withdraw(uint256 amount)',
  'function getMerchantBalance(address merchant) view returns (uint256 principal, uint256 interest, uint256 total)',
  'function getCurrentAPY() view returns (uint256)'
]

/**
 * Aave 鐢熸伅鏈嶅姟
 */
export class AaveYieldService {
  private provider: ethers.providers.Provider
  private yieldContract: ethers.Contract

  constructor(network: 'ethereum' | 'base' | 'arbitrum') {
    this.provider = this.getProvider(network)

    const contractAddress = this.getContractAddress(network)
    this.yieldContract = new ethers.Contract(
      contractAddress,
      MERCHANT_YIELD_ABI,
      this.provider
    )
  }

  /**
   * 瀛樺叆 USDT 鐢熸伅
   */
  async deposit(amount: string, signer: ethers.Signer) {
    const contract = this.yieldContract.connect(signer)

    // 1. 鍏堟巿鏉?USDT
    const usdtAddress = this.getUSDTAddress()
    const usdt = new ethers.Contract(
      usdtAddress,
      ['function approve(address spender, uint256 amount)'],
      signer
    )

    const amountWei = ethers.utils.parseUnits(amount, 6)  // USDT 鏄?6 浣嶅皬鏁?

    console.log('[AaveYield] Approving USDT...')
    const approveTx = await usdt.approve(this.yieldContract.address, amountWei)
    await approveTx.wait()

    // 2. 瀛樺叆
    console.log('[AaveYield] Depositing...')
    const depositTx = await contract.deposit(amountWei)
    const receipt = await depositTx.wait()

    return {
      success: true,
      txHash: receipt.transactionHash,
      amount
    }
  }

  /**
   * 鎻愬彇鏈噾 + 鍒╂伅
   */
  async withdraw(amount: string, signer: ethers.Signer) {
    const contract = this.yieldContract.connect(signer)
    const amountWei = ethers.utils.parseUnits(amount, 6)

    console.log('[AaveYield] Withdrawing...')
    const tx = await contract.withdraw(amountWei)
    const receipt = await tx.wait()

    return {
      success: true,
      txHash: receipt.transactionHash,
      amount
    }
  }

  /**
   * 鏌ヨ浣欓
   */
  async getBalance(merchantAddress: string) {
    const [principal, interest, total] = await this.yieldContract.getMerchantBalance(
      merchantAddress
    )

    return {
      principal: ethers.utils.formatUnits(principal, 6),
      interest: ethers.utils.formatUnits(interest, 6),
      total: ethers.utils.formatUnits(total, 6)
    }
  }

  /**
   * 鑾峰彇褰撳墠 APY
   */
  async getCurrentAPY(): Promise<number> {
    const apyBps = await this.yieldContract.getCurrentAPY()
    return apyBps.toNumber() / 100  // 杞崲涓虹櫨鍒嗘瘮
  }

  private getProvider(network: string): ethers.providers.Provider {
    const rpcUrls: Record<string, string> = {
      ethereum: 'https://eth.llamarpc.com',
      base: 'https://mainnet.base.org',
      arbitrum: 'https://arb1.arbitrum.io/rpc'
    }

    return new ethers.providers.JsonRpcProvider(rpcUrls[network])
  }

  private getContractAddress(network: string): string {
    const addresses: Record<string, string> = {
      ethereum: '0xYourDeployedContract',
      base: '0xYourDeployedContract',
      arbitrum: '0xYourDeployedContract'
    }

    return addresses[network]
  }

  private getUSDTAddress(): string {
    return '0xdAC17F958D2ee523a2206206994597C13D831ec7'  // Ethereum USDT
  }
}
```

---

## 5. 鍚堢害鍦板潃閰嶇疆

### 5.1 Aave V3 瀹樻柟鍦板潃

```typescript
// lib/config/aave-addresses.ts

export const AAVE_V3_ADDRESSES = {
  ethereum: {
    pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    poolAddressesProvider: '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e',
    usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    aUSDT: '0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a'
  },
  base: {
    pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
    poolAddressesProvider: '0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D',
    usdt: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',  // Base 涓婄殑 USDT
    aUSDT: '0xYourATokenAddress'
  },
  arbitrum: {
    pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    poolAddressesProvider: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
    usdt: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    aUSDT: '0xYourATokenAddress'
  }
}

export const JUSTLEND_ADDRESSES = {
  tron: {
    jUSDT: 'TBcGYZDDzQSfG1oSrkoFPyXLJwUBCNLHLK',
    usdt: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
  }
}
```

---

## 6. 閮ㄧ讲璁″垝

### 6.1 閮ㄧ讲姝ラ

```bash
# 1. 瀹夎渚濊禆
npm install @aave/core-v3 @openzeppelin/contracts

# 2. 缂栧啓閮ㄧ讲鑴氭湰
# scripts/deploy-yield-manager.ts

import { ethers } from 'hardhat'
import { AAVE_V3_ADDRESSES } from '../lib/config/aave-addresses'

async function main() {
  const network = 'base'  // 鎴?'ethereum', 'arbitrum'
  const addresses = AAVE_V3_ADDRESSES[network]

  const MerchantYieldManager = await ethers.getContractFactory('MerchantYieldManager')
  const yieldManager = await MerchantYieldManager.deploy(
    addresses.pool,
    addresses.usdt,
    addresses.aUSDT
  )

  await yieldManager.deployed()

  console.log('MerchantYieldManager deployed to:', yieldManager.address)
}

main()
```

### 6.2 娴嬭瘯缃戦儴缃?

```bash
# Base Sepolia Testnet
npx hardhat run scripts/deploy-yield-manager.ts --network base-sepolia

# 楠岃瘉鍚堢害
npx hardhat verify --network base-sepolia <CONTRACT_ADDRESS> \
  <POOL_ADDRESS> <USDT_ADDRESS> <AUSDT_ADDRESS>
```

---

## 7. 浼樺娍鎬荤粨

### 鉁?浣跨敤 Aave 鐨勪紭鍔?

| 鏂归潰 | 鑷畾涔夊悎绾?| Aave 闆嗘垚 |
|------|-----------|-----------|
| **瀹夊叏鎬?* | 闇€瑕佸璁?($50k+) | 鉁?宸插璁★紝涔呯粡鑰冮獙 |
| **寮€鍙戞椂闂?* | 4-6 鍛?| 鉁?1 鍛?|
| **娴佸姩鎬?* | 闇€瑕佽嚜寤?| 鉁?$10B+ TVL |
| **鍒╃巼** | 闇€瑕佽璁＄畻娉?| 鉁?鑷姩璋冩暣 |
| **缁存姢鎴愭湰** | 楂?| 鉁?浣庯紙Aave 鍥㈤槦缁存姢锛墊

---

## 8. 涓嬩竴姝ヨ鍔?

1. 鉁?閮ㄧ讲娴嬭瘯鍚堢害鍒?Base Sepolia
2. 鉁?鍓嶇闆嗘垚娴嬭瘯
3. 鉁?缂栧啓瀹屾暣娴嬭瘯鐢ㄤ緥
4. 鉁?瀹¤鍚堢害浠ｇ爜锛堢畝鍗曞皝瑁呭眰锛岄闄╀綆锛?
5. 鉁?涓荤綉閮ㄧ讲

**棰勮鏃堕棿:** 1-2 鍛?

---

**缁撹:** 浣跨敤 Aave/JustLend 鏄渶浣虫柟妗堬紝瀹夊叏銆侀珮鏁堛€佹垚鐔熴€?
