// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title MerchantYieldManager
 * @notice Aave V3 闆嗘垚鍚堢害 - 鍟嗘埛闂茬疆璧勯噾鑷姩鐢熸伅
 *
 * 鍔熻兘:
 * - 鍟嗘埛鍏呭€?USDT锛岃嚜鍔ㄥ瓨鍏?Aave V3 璧氬彇鍒╂伅
 * - 鍟嗘埛鎻愮幇鏃惰繛鏈甫鎭竴骞舵彁鍙?
 * - 瀹炴椂鏌ヨ鏀剁泭浣欓
 * - 鏀寔澶氬晢鎴风嫭绔嬭处鎴风鐞?
 *
 * 缃戠粶鏀寔:
 * - Ethereum Mainnet (Aave V3)
 * - Base (Aave V3)
 * - Arbitrum (Aave V3)
 */

interface IPool {
    /**
     * @notice Supplies an `amount` of underlying asset into the reserve, receiving in return overlying aTokens.
     * @param asset The address of the underlying asset to supply
     * @param amount The amount to be supplied
     * @param onBehalfOf The address that will receive the aTokens
     * @param referralCode Code used to register the integrator originating the operation (0 if no referrer)
     */
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    /**
     * @notice Withdraws an `amount` of underlying asset from the reserve, burning the equivalent aTokens owned
     * @param asset The address of the underlying asset to withdraw
     * @param amount The underlying amount to be withdrawn (use type(uint256).max to withdraw the whole aToken balance)
     * @param to The address that will receive the underlying
     * @return The final amount withdrawn
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);
}

interface IAToken is IERC20 {
    /**
     * @notice Returns the scaled balance of the user.
     * @param user The address of the user
     * @return The scaled balance of the user
     */
    function scaledBalanceOf(address user) external view returns (uint256);
}

contract MerchantYieldManager is Ownable, ReentrancyGuard, Pausable {
    // Aave V3 Pool 鍦板潃锛堜笉鍚岀綉缁滈渶瑕佷笉鍚屽湴鍧€锛?
    IPool public immutable aavePool;

    // USDT 浠ｅ竵鍦板潃
    IERC20 public immutable usdt;

    // aUSDT 浠ｅ竵鍦板潃 (Aave 鍒╂伅浠ｅ竵)
    IAToken public immutable aUsdt;

    // 鍟嗘埛鏈噾璁板綍 (merchant => principal amount)
    mapping(address => uint256) public merchantPrincipal;

    // 鍟嗘埛鏈€鍚庝竴娆℃搷浣滄椂闂?
    mapping(address => uint256) public lastOperationTime;

    // 鎬诲瓨娆剧粺璁?
    uint256 public totalDeposits;

    // 鎬绘彁鐜扮粺璁?
    uint256 public totalWithdrawals;

    // 骞冲彴鎵嬬画璐圭巼 (鍩虹偣, 10000 = 100%)
    uint256 public platformFeeRate = 500; // 5%

    // 骞冲彴鎵嬬画璐规帴鏀跺湴鍧€
    address public feeCollector;

    // 鏈€灏忓瓨娆鹃噾棰?(閬垮厤绮夊皹鏀诲嚮)
    uint256 public constant MIN_DEPOSIT = 1e6; // 1 USDT (6 decimals)

    // 鏈€灏忔彁鐜伴噾棰?
    uint256 public constant MIN_WITHDRAWAL = 1e6; // 1 USDT

    // 浜嬩欢
    event Deposited(
        address indexed merchant,
        uint256 amount,
        uint256 timestamp
    );

    event Withdrawn(
        address indexed merchant,
        uint256 principal,
        uint256 interest,
        uint256 platformFee,
        uint256 netAmount,
        uint256 timestamp
    );

    event PlatformFeeRateUpdated(
        uint256 oldRate,
        uint256 newRate,
        uint256 timestamp
    );

    event FeeCollectorUpdated(
        address indexed oldCollector,
        address indexed newCollector,
        uint256 timestamp
    );

    event EmergencyWithdrawal(
        address indexed merchant,
        uint256 amount,
        uint256 timestamp
    );

    /**
     * @notice 鏋勯€犲嚱鏁?
     * @param _aavePool Aave V3 Pool 鍚堢害鍦板潃
     * @param _usdt USDT 浠ｅ竵鍦板潃
     * @param _aUsdt aUSDT 浠ｅ竵鍦板潃
     * @param _feeCollector 鎵嬬画璐规帴鏀跺湴鍧€
     */
    constructor(
        address _aavePool,
        address _usdt,
        address _aUsdt,
        address _feeCollector
    ) {
        require(_aavePool != address(0), "Invalid Aave Pool address");
        require(_usdt != address(0), "Invalid USDT address");
        require(_aUsdt != address(0), "Invalid aUSDT address");
        require(_feeCollector != address(0), "Invalid fee collector address");

        aavePool = IPool(_aavePool);
        usdt = IERC20(_usdt);
        aUsdt = IAToken(_aUsdt);
        feeCollector = _feeCollector;
    }

    /**
     * @notice 鍟嗘埛瀛樻 (鑷姩瀛樺叆 Aave 璧氬彇鍒╂伅)
     * @param amount 瀛樻閲戦 (USDT, 6 decimals)
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount >= MIN_DEPOSIT, "Amount too small");
        require(usdt.balanceOf(msg.sender) >= amount, "Insufficient balance");

        // 杞叆 USDT
        require(
            usdt.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        // 璁板綍鍟嗘埛鏈噾
        merchantPrincipal[msg.sender] += amount;
        lastOperationTime[msg.sender] = block.timestamp;
        totalDeposits += amount;

        // 鎺堟潈 Aave Pool
        usdt.approve(address(aavePool), amount);

        // 瀛樺叆 Aave V3 (aUSDT 浼氳嚜鍔ㄩ摳閫犲埌鏈悎绾?
        aavePool.supply(address(usdt), amount, address(this), 0);

        emit Deposited(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice 鍟嗘埛鎻愮幇 (杩炴湰甯︽伅)
     * @param amount 鎻愮幇閲戦 (0 = 鍏ㄩ儴鎻愮幇)
     */
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        uint256 principal = merchantPrincipal[msg.sender];
        require(principal > 0, "No deposits found");

        // 璁＄畻鍟嗘埛褰撳墠鎬讳綑棰?(鏈噾 + 鍒╂伅)
        uint256 currentBalance = getMerchantBalance(msg.sender);
        require(currentBalance > 0, "No balance to withdraw");

        // 濡傛灉 amount = 0锛屾彁鍙栧叏閮?
        uint256 withdrawAmount = amount == 0 ? currentBalance : amount;
        require(withdrawAmount >= MIN_WITHDRAWAL, "Amount too small");
        require(withdrawAmount <= currentBalance, "Insufficient balance");

        // 璁＄畻鍒╂伅
        uint256 interest = currentBalance > principal
            ? currentBalance - principal
            : 0;

        // 璁＄畻骞冲彴鎵嬬画璐?(鍙粠鍒╂伅涓墸闄?
        uint256 platformFee = (interest * platformFeeRate) / 10000;

        // 鍑€鎻愮幇閲戦
        uint256 netAmount = withdrawAmount - platformFee;

        // 浠?Aave 鎻愬彇璧勯噾
        uint256 actualWithdrawn = aavePool.withdraw(
            address(usdt),
            withdrawAmount,
            address(this)
        );
        require(actualWithdrawn >= withdrawAmount, "Aave withdrawal failed");

        // 鏇存柊鍟嗘埛鏈噾 (鎸夋瘮渚嬪噺灏?
        uint256 principalToDeduct = withdrawAmount > principal
            ? principal
            : (principal * withdrawAmount) / currentBalance;

        merchantPrincipal[msg.sender] -= principalToDeduct;
        lastOperationTime[msg.sender] = block.timestamp;
        totalWithdrawals += withdrawAmount;

        // 杞处鎵嬬画璐圭粰骞冲彴
        if (platformFee > 0) {
            require(
                usdt.transfer(feeCollector, platformFee),
                "Fee transfer failed"
            );
        }

        // 杞处鍑€棰濈粰鍟嗘埛
        require(
            usdt.transfer(msg.sender, netAmount),
            "Merchant transfer failed"
        );

        emit Withdrawn(
            msg.sender,
            principalToDeduct,
            interest,
            platformFee,
            netAmount,
            block.timestamp
        );
    }

    /**
     * @notice 鏌ヨ鍟嗘埛浣欓 (鏈噾 + 鍒╂伅)
     * @param merchant 鍟嗘埛鍦板潃
     * @return 鍟嗘埛鎬讳綑棰?(USDT)
     */
    function getMerchantBalance(address merchant) public view returns (uint256) {
        uint256 principal = merchantPrincipal[merchant];
        if (principal == 0) {
            return 0;
        }

        // 璁＄畻鍟嗘埛浠介鍗犳瘮
        uint256 totalPrincipal = getTotalPrincipal();
        if (totalPrincipal == 0) {
            return 0;
        }

        // aUSDT 浣欓 (鍖呭惈鎵€鏈夊晢鎴风殑鏈噾 + 鍒╂伅)
        uint256 totalATokenBalance = aUsdt.balanceOf(address(this));

        // 鍟嗘埛浣欓 = (鍟嗘埛鏈噾 / 鎬绘湰閲? * aUSDT 鎬讳綑棰?
        return (principal * totalATokenBalance) / totalPrincipal;
    }

    /**
     * @notice 鏌ヨ鍟嗘埛鍒╂伅鏀剁泭
     * @param merchant 鍟嗘埛鍦板潃
     * @return 鍒╂伅鏀剁泭 (USDT)
     */
    function getMerchantInterest(address merchant) public view returns (uint256) {
        uint256 balance = getMerchantBalance(merchant);
        uint256 principal = merchantPrincipal[merchant];

        return balance > principal ? balance - principal : 0;
    }

    /**
     * @notice 鏌ヨ鍟嗘埛骞村寲鏀剁泭鐜?(APY)
     * @param merchant 鍟嗘埛鍦板潃
     * @return APY (鍩虹偣, 10000 = 100%)
     */
    function getMerchantAPY(address merchant) public view returns (uint256) {
        uint256 principal = merchantPrincipal[merchant];
        if (principal == 0) {
            return 0;
        }

        uint256 lastOpTime = lastOperationTime[merchant];
        if (lastOpTime == 0 || block.timestamp <= lastOpTime) {
            return 0;
        }

        uint256 interest = getMerchantInterest(merchant);
        uint256 elapsedTime = block.timestamp - lastOpTime;

        // APY = (鍒╂伅 / 鏈噾) * (365 澶?/ 缁忚繃鏃堕棿) * 10000
        // 娉ㄦ剰: 涓洪伩鍏嶆孩鍑猴紝鍏堣绠?(interest * 365 days * 10000) / (principal * elapsedTime)
        uint256 secondsPerYear = 365 days;
        return (interest * secondsPerYear * 10000) / (principal * elapsedTime);
    }

    /**
     * @notice 鏌ヨ鎵€鏈夊晢鎴风殑鎬绘湰閲?
     * @return 鎬绘湰閲?
     */
    function getTotalPrincipal() public view returns (uint256) {
        // 绠€鍖栬绠? 鎬诲瓨娆?- 鎬绘彁鐜?
        return totalDeposits - totalWithdrawals;
    }

    /**
     * @notice 鏌ヨ鍚堢害鍦?Aave 鐨勬€讳綑棰?(鎵€鏈夊晢鎴风殑鏈噾 + 鍒╂伅)
     * @return 鎬讳綑棰?(USDT)
     */
    function getTotalBalance() public view returns (uint256) {
        return aUsdt.balanceOf(address(this));
    }

    /**
     * @notice 鏌ヨ鍚堢害璧氬彇鐨勬€诲埄鎭?
     * @return 鎬诲埄鎭?(USDT)
     */
    function getTotalInterest() public view returns (uint256) {
        uint256 totalBalance = getTotalBalance();
        uint256 totalPrincipal = getTotalPrincipal();

        return totalBalance > totalPrincipal
            ? totalBalance - totalPrincipal
            : 0;
    }

    /**
     * @notice 鏇存柊骞冲彴鎵嬬画璐圭巼 (浠?Owner)
     * @param newRate 鏂拌垂鐜?(鍩虹偣, 10000 = 100%, 鏈€澶?10%)
     */
    function setPlatformFeeRate(uint256 newRate) external onlyOwner {
        require(newRate <= 1000, "Fee rate too high"); // 鏈€澶?10%

        uint256 oldRate = platformFeeRate;
        platformFeeRate = newRate;

        emit PlatformFeeRateUpdated(oldRate, newRate, block.timestamp);
    }

    /**
     * @notice 鏇存柊鎵嬬画璐规帴鏀跺湴鍧€ (浠?Owner)
     * @param newCollector 鏂版帴鏀跺湴鍧€
     */
    function setFeeCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "Invalid address");

        address oldCollector = feeCollector;
        feeCollector = newCollector;

        emit FeeCollectorUpdated(oldCollector, newCollector, block.timestamp);
    }

    /**
     * @notice 鏆傚仠鍚堢害 (绱ф€ユ儏鍐? 浠?Owner)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice 鎭㈠鍚堢害 (浠?Owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice 绱ф€ユ彁鐜?(浠?Owner, 鐢ㄤ簬鍚堢害鍗囩骇鎴栧畨鍏ㄤ簨浠?
     * @param merchant 鍟嗘埛鍦板潃
     * @param to 鎺ユ敹鍦板潃
     */
    function emergencyWithdraw(
        address merchant,
        address to
    ) external onlyOwner whenPaused {
        uint256 balance = getMerchantBalance(merchant);
        require(balance > 0, "No balance to withdraw");

        // 浠?Aave 鎻愬彇
        uint256 actualWithdrawn = aavePool.withdraw(
            address(usdt),
            balance,
            address(this)
        );
        require(actualWithdrawn >= balance, "Withdrawal failed");

        // 娓呴浂鏈噾
        merchantPrincipal[merchant] = 0;

        // 杞处缁欐寚瀹氬湴鍧€
        require(usdt.transfer(to, balance), "Transfer failed");

        emit EmergencyWithdrawal(merchant, balance, block.timestamp);
    }

    /**
     * @notice 鑾峰彇鍚堢害鐗堟湰
     * @return 鐗堟湰鍙?
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}
