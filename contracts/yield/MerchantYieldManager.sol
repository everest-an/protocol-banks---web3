// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title MerchantYieldManager
 * @notice Aave V3 集成合约 - 商户闲置资金自动生息
 *
 * 功能:
 * - 商户充值 USDT，自动存入 Aave V3 赚取利息
 * - 商户提现时连本带息一并提取
 * - 实时查询收益余额
 * - 支持多商户独立账户管理
 *
 * 网络支持:
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
    // Aave V3 Pool 地址（不同网络需要不同地址）
    IPool public immutable aavePool;

    // USDT 代币地址
    IERC20 public immutable usdt;

    // aUSDT 代币地址 (Aave 利息代币)
    IAToken public immutable aUsdt;

    // 商户本金记录 (merchant => principal amount)
    mapping(address => uint256) public merchantPrincipal;

    // 商户最后一次操作时间
    mapping(address => uint256) public lastOperationTime;

    // 总存款统计
    uint256 public totalDeposits;

    // 总提现统计
    uint256 public totalWithdrawals;

    // 平台手续费率 (基点, 10000 = 100%)
    uint256 public platformFeeRate = 500; // 5%

    // 平台手续费接收地址
    address public feeCollector;

    // 最小存款金额 (避免粉尘攻击)
    uint256 public constant MIN_DEPOSIT = 1e6; // 1 USDT (6 decimals)

    // 最小提现金额
    uint256 public constant MIN_WITHDRAWAL = 1e6; // 1 USDT

    // 事件
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
     * @notice 构造函数
     * @param _aavePool Aave V3 Pool 合约地址
     * @param _usdt USDT 代币地址
     * @param _aUsdt aUSDT 代币地址
     * @param _feeCollector 手续费接收地址
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
     * @notice 商户存款 (自动存入 Aave 赚取利息)
     * @param amount 存款金额 (USDT, 6 decimals)
     */
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount >= MIN_DEPOSIT, "Amount too small");
        require(usdt.balanceOf(msg.sender) >= amount, "Insufficient balance");

        // 转入 USDT
        require(
            usdt.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        // 记录商户本金
        merchantPrincipal[msg.sender] += amount;
        lastOperationTime[msg.sender] = block.timestamp;
        totalDeposits += amount;

        // 授权 Aave Pool
        usdt.approve(address(aavePool), amount);

        // 存入 Aave V3 (aUSDT 会自动铸造到本合约)
        aavePool.supply(address(usdt), amount, address(this), 0);

        emit Deposited(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice 商户提现 (连本带息)
     * @param amount 提现金额 (0 = 全部提现)
     */
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        uint256 principal = merchantPrincipal[msg.sender];
        require(principal > 0, "No deposits found");

        // 计算商户当前总余额 (本金 + 利息)
        uint256 currentBalance = getMerchantBalance(msg.sender);
        require(currentBalance > 0, "No balance to withdraw");

        // 如果 amount = 0，提取全部
        uint256 withdrawAmount = amount == 0 ? currentBalance : amount;
        require(withdrawAmount >= MIN_WITHDRAWAL, "Amount too small");
        require(withdrawAmount <= currentBalance, "Insufficient balance");

        // 计算利息
        uint256 interest = currentBalance > principal
            ? currentBalance - principal
            : 0;

        // 计算平台手续费 (只从利息中扣除)
        uint256 platformFee = (interest * platformFeeRate) / 10000;

        // 净提现金额
        uint256 netAmount = withdrawAmount - platformFee;

        // 从 Aave 提取资金
        uint256 actualWithdrawn = aavePool.withdraw(
            address(usdt),
            withdrawAmount,
            address(this)
        );
        require(actualWithdrawn >= withdrawAmount, "Aave withdrawal failed");

        // 更新商户本金 (按比例减少)
        uint256 principalToDeduct = withdrawAmount > principal
            ? principal
            : (principal * withdrawAmount) / currentBalance;

        merchantPrincipal[msg.sender] -= principalToDeduct;
        lastOperationTime[msg.sender] = block.timestamp;
        totalWithdrawals += withdrawAmount;

        // 转账手续费给平台
        if (platformFee > 0) {
            require(
                usdt.transfer(feeCollector, platformFee),
                "Fee transfer failed"
            );
        }

        // 转账净额给商户
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
     * @notice 查询商户余额 (本金 + 利息)
     * @param merchant 商户地址
     * @return 商户总余额 (USDT)
     */
    function getMerchantBalance(address merchant) public view returns (uint256) {
        uint256 principal = merchantPrincipal[merchant];
        if (principal == 0) {
            return 0;
        }

        // 计算商户份额占比
        uint256 totalPrincipal = getTotalPrincipal();
        if (totalPrincipal == 0) {
            return 0;
        }

        // aUSDT 余额 (包含所有商户的本金 + 利息)
        uint256 totalATokenBalance = aUsdt.balanceOf(address(this));

        // 商户余额 = (商户本金 / 总本金) * aUSDT 总余额
        return (principal * totalATokenBalance) / totalPrincipal;
    }

    /**
     * @notice 查询商户利息收益
     * @param merchant 商户地址
     * @return 利息收益 (USDT)
     */
    function getMerchantInterest(address merchant) public view returns (uint256) {
        uint256 balance = getMerchantBalance(merchant);
        uint256 principal = merchantPrincipal[merchant];

        return balance > principal ? balance - principal : 0;
    }

    /**
     * @notice 查询商户年化收益率 (APY)
     * @param merchant 商户地址
     * @return APY (基点, 10000 = 100%)
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

        // APY = (利息 / 本金) * (365 天 / 经过时间) * 10000
        // 注意: 为避免溢出，先计算 (interest * 365 days * 10000) / (principal * elapsedTime)
        uint256 secondsPerYear = 365 days;
        return (interest * secondsPerYear * 10000) / (principal * elapsedTime);
    }

    /**
     * @notice 查询所有商户的总本金
     * @return 总本金
     */
    function getTotalPrincipal() public view returns (uint256) {
        // 简化计算: 总存款 - 总提现
        return totalDeposits - totalWithdrawals;
    }

    /**
     * @notice 查询合约在 Aave 的总余额 (所有商户的本金 + 利息)
     * @return 总余额 (USDT)
     */
    function getTotalBalance() public view returns (uint256) {
        return aUsdt.balanceOf(address(this));
    }

    /**
     * @notice 查询合约赚取的总利息
     * @return 总利息 (USDT)
     */
    function getTotalInterest() public view returns (uint256) {
        uint256 totalBalance = getTotalBalance();
        uint256 totalPrincipal = getTotalPrincipal();

        return totalBalance > totalPrincipal
            ? totalBalance - totalPrincipal
            : 0;
    }

    /**
     * @notice 更新平台手续费率 (仅 Owner)
     * @param newRate 新费率 (基点, 10000 = 100%, 最大 10%)
     */
    function setPlatformFeeRate(uint256 newRate) external onlyOwner {
        require(newRate <= 1000, "Fee rate too high"); // 最大 10%

        uint256 oldRate = platformFeeRate;
        platformFeeRate = newRate;

        emit PlatformFeeRateUpdated(oldRate, newRate, block.timestamp);
    }

    /**
     * @notice 更新手续费接收地址 (仅 Owner)
     * @param newCollector 新接收地址
     */
    function setFeeCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "Invalid address");

        address oldCollector = feeCollector;
        feeCollector = newCollector;

        emit FeeCollectorUpdated(oldCollector, newCollector, block.timestamp);
    }

    /**
     * @notice 暂停合约 (紧急情况, 仅 Owner)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice 恢复合约 (仅 Owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice 紧急提现 (仅 Owner, 用于合约升级或安全事件)
     * @param merchant 商户地址
     * @param to 接收地址
     */
    function emergencyWithdraw(
        address merchant,
        address to
    ) external onlyOwner whenPaused {
        uint256 balance = getMerchantBalance(merchant);
        require(balance > 0, "No balance to withdraw");

        // 从 Aave 提取
        uint256 actualWithdrawn = aavePool.withdraw(
            address(usdt),
            balance,
            address(this)
        );
        require(actualWithdrawn >= balance, "Withdrawal failed");

        // 清零本金
        merchantPrincipal[merchant] = 0;

        // 转账给指定地址
        require(usdt.transfer(to, balance), "Transfer failed");

        emit EmergencyWithdrawal(merchant, balance, block.timestamp);
    }

    /**
     * @notice 获取合约版本
     * @return 版本号
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}
