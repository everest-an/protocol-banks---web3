// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title BatchTransfer
 * @dev 鎵归噺杞处鍚堢害 - 涓€娆＄鍚嶅彂閫佸绗擡RC20浠ｅ竵杞处
 * @notice 鏀寔鍗曟浜ゆ槗鍚戝涓湴鍧€杞处锛岃妭鐪丟as鍜岀鍚嶆鏁? */
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

    // 骞冲彴鎵嬬画璐癸紙鍩虹偣锛? = 0.01%锛屼緥濡?10 = 0.1%锛?    uint16 public platformFeeBps = 0; // 榛樿0鎵嬬画璐?
    // 鎵嬬画璐规敹鍙栧湴鍧€
    address public feeCollector;

    // 鏈€澶у崟娆℃壒閲忚浆璐︽暟閲忥紙闃叉Gas鑰楀敖锛?    uint256 public maxBatchSize = 200;

    // 缁熻鏁版嵁
    uint256 public totalBatchesProcessed;
    uint256 public totalRecipientsServed;

    // ============================================
    // Constructor
    // ============================================

    constructor(address _feeCollector) {
        require(_feeCollector != address(0), "Invalid fee collector");
        feeCollector = _feeCollector;
    }

    // ============================================
    // Main Functions
    // ============================================

    /**
     * @notice 鎵归噺杞处ERC20浠ｅ竵锛堟帹鑽愪娇鐢ㄦ鏂规硶锛?     * @param token ERC20浠ｅ竵鍚堢害鍦板潃
     * @param recipients 鎺ユ敹鍦板潃鏁扮粍
     * @param amounts 瀵瑰簲閲戦鏁扮粍锛堝繀椤讳笌recipients闀垮害涓€鑷达級
     * @return successCount 鎴愬姛杞处鏁伴噺
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

        // 璁＄畻鎬婚噾棰?        for (uint256 i = 0; i < amounts.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            require(amounts[i] > 0, "Invalid amount");
            totalAmount += amounts[i];
        }

        // 璁＄畻鎵嬬画璐?        uint256 feeAmount = 0;
        if (platformFeeBps > 0) {
            feeAmount = (totalAmount * platformFeeBps) / 10000;
            require(feeAmount < totalAmount, "Fee too high");
        }

        uint256 totalRequired = totalAmount + feeAmount;

        // 妫€鏌ュ苟杞叆浠ｅ竵鍒板悎绾?        require(
            tokenContract.transferFrom(msg.sender, address(this), totalRequired),
            "Transfer to contract failed"
        );

        // 鏀跺彇鎵嬬画璐?        if (feeAmount > 0) {
            require(
                tokenContract.transfer(feeCollector, feeAmount),
                "Fee transfer failed"
            );
            emit FeeCollected(token, msg.sender, feeAmount);
        }

        // 鎵归噺杞处
        successCount = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            bool success = tokenContract.transfer(recipients[i], amounts[i]);
            if (success) {
                successCount++;
            } else {
                emit TransferFailed(recipients[i], amounts[i], "Transfer failed");
            }
        }

        // 鏇存柊缁熻
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
     * @notice 鎵归噺杞处锛堢浉鍚岄噾棰濓級- Gas浼樺寲鐗堟湰
     * @param token ERC20浠ｅ竵鍚堢害鍦板潃
     * @param recipients 鎺ユ敹鍦板潃鏁扮粍
     * @param amount 姣忎釜鍦板潃鎺ユ敹鐨勯噾棰濓紙鎵€鏈変汉鐩稿悓锛?     * @return successCount 鎴愬姛杞处鏁伴噺
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

        // 璁＄畻鎵嬬画璐?        uint256 feeAmount = 0;
        if (platformFeeBps > 0) {
            feeAmount = (totalAmount * platformFeeBps) / 10000;
        }

        uint256 totalRequired = totalAmount + feeAmount;

        // 杞叆浠ｅ竵
        require(
            tokenContract.transferFrom(msg.sender, address(this), totalRequired),
            "Transfer to contract failed"
        );

        // 鏀跺彇鎵嬬画璐?        if (feeAmount > 0) {
            require(
                tokenContract.transfer(feeCollector, feeAmount),
                "Fee transfer failed"
            );
            emit FeeCollected(token, msg.sender, feeAmount);
        }

        // 鎵归噺杞处
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

        // 鏇存柊缁熻
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
     * @notice 璁剧疆骞冲彴鎵嬬画璐癸紙浠呯鐞嗗憳锛?     * @param newFeeBps 鏂版墜缁垂锛堝熀鐐癸紝鏈€澶?00 = 5%锛?     */
    function setPlatformFee(uint16 newFeeBps) external onlyOwner {
        require(newFeeBps <= 500, "Fee too high"); // 鏈€楂?%
        platformFeeBps = newFeeBps;
    }

    /**
     * @notice 璁剧疆鎵嬬画璐规敹鍙栧湴鍧€锛堜粎绠＄悊鍛橈級
     * @param newCollector 鏂扮殑鎵嬬画璐规敹鍙栧湴鍧€
     */
    function setFeeCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "Invalid collector");
        feeCollector = newCollector;
    }

    /**
     * @notice 璁剧疆鏈€澶ф壒閲忓ぇ灏忥紙浠呯鐞嗗憳锛?     * @param newMaxSize 鏂扮殑鏈€澶ф壒閲忓ぇ灏?     */
    function setMaxBatchSize(uint256 newMaxSize) external onlyOwner {
        require(newMaxSize > 0 && newMaxSize <= 500, "Invalid size");
        maxBatchSize = newMaxSize;
    }

    /**
     * @notice 绱ф€ユ彁鍙栦唬甯侊紙浠呯鐞嗗憳锛岀敤浜庢晳鎻存剰澶栧彂閫佺殑浠ｅ竵锛?     * @param token 浠ｅ竵鍦板潃
     * @param amount 鎻愬彇鏁伴噺
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @notice 璁＄畻鎵归噺杞处鎵€闇€鐨勬€婚噾棰濓紙鍖呭惈鎵嬬画璐癸級
     * @param amounts 閲戦鏁扮粍
     * @return totalRequired 鎵€闇€鎬婚噾棰?     * @return feeAmount 鎵嬬画璐归噾棰?     */
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
     * @notice 鑾峰彇鍚堢害缁熻淇℃伅
     * @return batchesProcessed 宸插鐞嗘壒娆℃暟
     * @return recipientsServed 宸叉湇鍔℃帴鏀惰€呮暟
     * @return currentFee 褰撳墠鎵嬬画璐圭巼
     * @return currentMaxBatch 褰撳墠鏈€澶ф壒閲忓ぇ灏?     */
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
