// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BatchTransfer
 * @dev 批量转账合约 - 一次签名发送多笔ERC20代币转账
 * @notice 支持单次交易向多个地址转账，节省Gas和签名次数
 */
contract BatchTransfer is Ownable, ReentrancyGuard {

    // ============================================
    // Events
    // ============================================

    event BatchTransferCompleted(
        address indexed token,
        address indexed sender,
        uint256 recipientCount,
        uint256 totalAmount,
        uint256 timestamp
    );

    event TransferFailed(
        address indexed recipient,
        uint256 amount,
        string reason
    );

    event FeeCollected(
        address indexed token,
        address indexed sender,
        uint256 feeAmount
    );

    // ============================================
    // State Variables
    // ============================================

    // 平台手续费（基点，1 = 0.01%，例如 10 = 0.1%）
    uint16 public platformFeeBps = 0; // 默认0手续费

    // 手续费收取地址
    address public feeCollector;

    // 最大单次批量转账数量（防止Gas耗尽）
    uint256 public maxBatchSize = 200;

    // 统计数据
    uint256 public totalBatchesProcessed;
    uint256 public totalRecipientsServed;

    // ============================================
    // Constructor
    // ============================================

    constructor(address _feeCollector) Ownable(msg.sender) {
        require(_feeCollector != address(0), "Invalid fee collector");
        feeCollector = _feeCollector;
    }

    // ============================================
    // Main Functions
    // ============================================

    /**
     * @notice 批量转账ERC20代币（推荐使用此方法）
     * @param token ERC20代币合约地址
     * @param recipients 接收地址数组
     * @param amounts 对应金额数组（必须与recipients长度一致）
     * @return successCount 成功转账数量
     */
    function batchTransfer(
        address token,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external nonReentrant returns (uint256 successCount) {
        require(recipients.length == amounts.length, "Length mismatch");
        require(recipients.length > 0, "Empty recipients");
        require(recipients.length <= maxBatchSize, "Batch too large");
        require(token != address(0), "Invalid token");

        IERC20 tokenContract = IERC20(token);
        uint256 totalAmount = 0;

        // 计算总金额
        for (uint256 i = 0; i < amounts.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            require(amounts[i] > 0, "Invalid amount");
            totalAmount += amounts[i];
        }

        // 计算手续费
        uint256 feeAmount = 0;
        if (platformFeeBps > 0) {
            feeAmount = (totalAmount * platformFeeBps) / 10000;
            require(feeAmount < totalAmount, "Fee too high");
        }

        uint256 totalRequired = totalAmount + feeAmount;

        // 检查并转入代币到合约
        require(
            tokenContract.transferFrom(msg.sender, address(this), totalRequired),
            "Transfer to contract failed"
        );

        // 收取手续费
        if (feeAmount > 0) {
            require(
                tokenContract.transfer(feeCollector, feeAmount),
                "Fee transfer failed"
            );
            emit FeeCollected(token, msg.sender, feeAmount);
        }

        // 批量转账
        successCount = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            bool success = tokenContract.transfer(recipients[i], amounts[i]);
            if (success) {
                successCount++;
            } else {
                emit TransferFailed(recipients[i], amounts[i], "Transfer failed");
            }
        }

        // 更新统计
        totalBatchesProcessed++;
        totalRecipientsServed += successCount;

        emit BatchTransferCompleted(
            token,
            msg.sender,
            successCount,
            totalAmount,
            block.timestamp
        );

        return successCount;
    }

    /**
     * @notice 批量转账（相同金额）- Gas优化版本
     * @param token ERC20代币合约地址
     * @param recipients 接收地址数组
     * @param amount 每个地址接收的金额（所有人相同）
     * @return successCount 成功转账数量
     */
    function batchTransferEqual(
        address token,
        address[] calldata recipients,
        uint256 amount
    ) external nonReentrant returns (uint256 successCount) {
        require(recipients.length > 0, "Empty recipients");
        require(recipients.length <= maxBatchSize, "Batch too large");
        require(token != address(0), "Invalid token");
        require(amount > 0, "Invalid amount");

        IERC20 tokenContract = IERC20(token);
        uint256 totalAmount = amount * recipients.length;

        // 计算手续费
        uint256 feeAmount = 0;
        if (platformFeeBps > 0) {
            feeAmount = (totalAmount * platformFeeBps) / 10000;
        }

        uint256 totalRequired = totalAmount + feeAmount;

        // 转入代币
        require(
            tokenContract.transferFrom(msg.sender, address(this), totalRequired),
            "Transfer to contract failed"
        );

        // 收取手续费
        if (feeAmount > 0) {
            require(
                tokenContract.transfer(feeCollector, feeAmount),
                "Fee transfer failed"
            );
            emit FeeCollected(token, msg.sender, feeAmount);
        }

        // 批量转账
        successCount = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            bool success = tokenContract.transfer(recipients[i], amount);
            if (success) {
                successCount++;
            } else {
                emit TransferFailed(recipients[i], amount, "Transfer failed");
            }
        }

        // 更新统计
        totalBatchesProcessed++;
        totalRecipientsServed += successCount;

        emit BatchTransferCompleted(
            token,
            msg.sender,
            successCount,
            totalAmount,
            block.timestamp
        );

        return successCount;
    }

    // ============================================
    // Admin Functions
    // ============================================

    /**
     * @notice 设置平台手续费（仅管理员）
     * @param newFeeBps 新手续费（基点，最大500 = 5%）
     */
    function setPlatformFee(uint16 newFeeBps) external onlyOwner {
        require(newFeeBps <= 500, "Fee too high"); // 最高5%
        platformFeeBps = newFeeBps;
    }

    /**
     * @notice 设置手续费收取地址（仅管理员）
     * @param newCollector 新的手续费收取地址
     */
    function setFeeCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "Invalid collector");
        feeCollector = newCollector;
    }

    /**
     * @notice 设置最大批量大小（仅管理员）
     * @param newMaxSize 新的最大批量大小
     */
    function setMaxBatchSize(uint256 newMaxSize) external onlyOwner {
        require(newMaxSize > 0 && newMaxSize <= 500, "Invalid size");
        maxBatchSize = newMaxSize;
    }

    /**
     * @notice 紧急提取代币（仅管理员，用于救援意外发送的代币）
     * @param token 代币地址
     * @param amount 提取数量
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @notice 计算批量转账所需的总金额（包含手续费）
     * @param amounts 金额数组
     * @return totalRequired 所需总金额
     * @return feeAmount 手续费金额
     */
    function calculateTotalRequired(uint256[] calldata amounts)
        external
        view
        returns (uint256 totalRequired, uint256 feeAmount)
    {
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        feeAmount = (totalAmount * platformFeeBps) / 10000;
        totalRequired = totalAmount + feeAmount;
    }

    /**
     * @notice 获取合约统计信息
     * @return batchesProcessed 已处理批次数
     * @return recipientsServed 已服务接收者数
     * @return currentFee 当前手续费率
     * @return currentMaxBatch 当前最大批量大小
     */
    function getStats()
        external
        view
        returns (
            uint256 batchesProcessed,
            uint256 recipientsServed,
            uint16 currentFee,
            uint256 currentMaxBatch
        )
    {
        return (
            totalBatchesProcessed,
            totalRecipientsServed,
            platformFeeBps,
            maxBatchSize
        );
    }
}
