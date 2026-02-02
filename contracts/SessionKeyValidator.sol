// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title SessionKeyValidator
 * @dev AI Agent 会话密钥验证合约 - 支持 Base 和 HashKey Chain
 * @notice 允许 AI Agent 在预算限制内自主执行链上操作
 * 
 * 核心功能:
 * - createSessionKey: 创建带有预算限制的会话密钥
 * - validateAndRecord: 验证操作并记录消费
 * - freezeSessionKey / unfreezeSessionKey: 紧急冻结/解冻
 * - revokeSessionKey: 撤销会话密钥
 */
contract SessionKeyValidator is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============================================
    // Types
    // ============================================

    struct SessionKey {
        address owner;              // 会话所有者（创建者）
        address sessionKey;         // 会话密钥地址
        uint256 maxBudget;          // 最大预算 (wei)
        uint256 usedBudget;         // 已使用预算 (wei)
        uint256 maxSingleTx;        // 单笔最大金额 (wei)
        uint256 expiresAt;          // 过期时间 (timestamp)
        uint256 createdAt;          // 创建时间 (timestamp)
        bool isActive;              // 是否激活
        bool isFrozen;              // 是否冻结
        address[] allowedTokens;    // 允许操作的代币列表
        address[] allowedTargets;   // 允许调用的合约列表
    }

    struct UsageRecord {
        uint256 timestamp;
        uint256 amount;
        address token;
        address target;
        bytes32 txHash;
    }

    // ============================================
    // Events
    // ============================================

    event SessionKeyCreated(
        bytes32 indexed sessionId,
        address indexed owner,
        address indexed sessionKey,
        uint256 maxBudget,
        uint256 expiresAt
    );

    event SessionKeyUsed(
        bytes32 indexed sessionId,
        address indexed sessionKey,
        uint256 amount,
        address token,
        address target
    );

    event SessionKeyFrozen(
        bytes32 indexed sessionId,
        address indexed frozenBy,
        string reason
    );

    event SessionKeyUnfrozen(
        bytes32 indexed sessionId,
        address indexed unfrozenBy
    );

    event SessionKeyRevoked(
        bytes32 indexed sessionId,
        address indexed revokedBy,
        uint256 remainingBudget
    );

    event BudgetTopUp(
        bytes32 indexed sessionId,
        uint256 additionalBudget,
        uint256 newTotalBudget
    );

    // ============================================
    // State Variables
    // ============================================

    // sessionId => SessionKey
    mapping(bytes32 => SessionKey) public sessionKeys;

    // sessionId => UsageRecord[]
    mapping(bytes32 => UsageRecord[]) public usageHistory;

    // owner => sessionId[]
    mapping(address => bytes32[]) public ownerSessions;

    // sessionKey address => sessionId
    mapping(address => bytes32) public sessionKeyToId;

    // 全局配置
    uint256 public minSessionDuration = 1 hours;
    uint256 public maxSessionDuration = 30 days;
    uint256 public maxAllowedTokens = 20;
    uint256 public maxAllowedTargets = 50;

    // 统计
    uint256 public totalSessionsCreated;
    uint256 public totalBudgetAllocated;
    uint256 public totalBudgetUsed;

    // ============================================
    // Modifiers
    // ============================================

    modifier onlySessionOwner(bytes32 sessionId) {
        require(sessionKeys[sessionId].owner == msg.sender, "Not session owner");
        _;
    }

    modifier sessionExists(bytes32 sessionId) {
        require(sessionKeys[sessionId].createdAt > 0, "Session not found");
        _;
    }

    modifier sessionActive(bytes32 sessionId) {
        SessionKey storage session = sessionKeys[sessionId];
        require(session.isActive, "Session not active");
        require(!session.isFrozen, "Session is frozen");
        require(block.timestamp < session.expiresAt, "Session expired");
        _;
    }

    // ============================================
    // Constructor
    // ============================================

    constructor() Ownable(msg.sender) {}

    // ============================================
    // Core Functions
    // ============================================

    /**
     * @notice 创建新的会话密钥
     * @param sessionKey 会话密钥地址
     * @param maxBudget 最大预算 (wei)
     * @param maxSingleTx 单笔最大金额 (wei)
     * @param duration 会话有效期 (seconds)
     * @param allowedTokens 允许操作的代币列表
     * @param allowedTargets 允许调用的合约列表
     * @return sessionId 会话ID
     */
    function createSessionKey(
        address sessionKey,
        uint256 maxBudget,
        uint256 maxSingleTx,
        uint256 duration,
        address[] calldata allowedTokens,
        address[] calldata allowedTargets
    ) external nonReentrant returns (bytes32 sessionId) {
        require(sessionKey != address(0), "Invalid session key");
        require(sessionKey != msg.sender, "Session key cannot be owner");
        require(maxBudget > 0, "Budget must be positive");
        require(maxSingleTx > 0 && maxSingleTx <= maxBudget, "Invalid single tx limit");
        require(duration >= minSessionDuration && duration <= maxSessionDuration, "Invalid duration");
        require(allowedTokens.length <= maxAllowedTokens, "Too many tokens");
        require(allowedTargets.length <= maxAllowedTargets, "Too many targets");
        require(sessionKeyToId[sessionKey] == bytes32(0), "Session key already used");

        // 生成唯一的 sessionId
        sessionId = keccak256(abi.encodePacked(
            msg.sender,
            sessionKey,
            block.timestamp,
            block.chainid,
            totalSessionsCreated
        ));

        // 创建会话
        sessionKeys[sessionId] = SessionKey({
            owner: msg.sender,
            sessionKey: sessionKey,
            maxBudget: maxBudget,
            usedBudget: 0,
            maxSingleTx: maxSingleTx,
            expiresAt: block.timestamp + duration,
            createdAt: block.timestamp,
            isActive: true,
            isFrozen: false,
            allowedTokens: allowedTokens,
            allowedTargets: allowedTargets
        });

        // 更新映射
        ownerSessions[msg.sender].push(sessionId);
        sessionKeyToId[sessionKey] = sessionId;

        // 更新统计
        totalSessionsCreated++;
        totalBudgetAllocated += maxBudget;

        emit SessionKeyCreated(sessionId, msg.sender, sessionKey, maxBudget, block.timestamp + duration);

        return sessionId;
    }

    /**
     * @notice 验证会话密钥操作并记录消费
     * @param sessionId 会话ID
     * @param amount 消费金额 (wei)
     * @param token 代币地址 (address(0) 表示 ETH)
     * @param target 目标合约地址
     * @param signature 会话密钥签名
     * @return success 是否验证成功
     */
    function validateAndRecord(
        bytes32 sessionId,
        uint256 amount,
        address token,
        address target,
        bytes calldata signature
    ) external nonReentrant sessionExists(sessionId) sessionActive(sessionId) returns (bool success) {
        SessionKey storage session = sessionKeys[sessionId];

        // 验证金额
        require(amount > 0, "Amount must be positive");
        require(amount <= session.maxSingleTx, "Exceeds single tx limit");
        require(session.usedBudget + amount <= session.maxBudget, "Exceeds budget");

        // 验证代币是否在白名单
        if (session.allowedTokens.length > 0) {
            require(_isTokenAllowed(session.allowedTokens, token), "Token not allowed");
        }

        // 验证目标合约是否在白名单
        if (session.allowedTargets.length > 0) {
            require(_isTargetAllowed(session.allowedTargets, target), "Target not allowed");
        }

        // 验证签名
        bytes32 messageHash = keccak256(abi.encodePacked(
            sessionId,
            amount,
            token,
            target,
            block.chainid,
            session.usedBudget // 使用 nonce 防止重放
        ));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);
        require(signer == session.sessionKey, "Invalid signature");

        // 记录消费
        session.usedBudget += amount;
        totalBudgetUsed += amount;

        // 保存使用记录
        usageHistory[sessionId].push(UsageRecord({
            timestamp: block.timestamp,
            amount: amount,
            token: token,
            target: target,
            txHash: keccak256(abi.encodePacked(block.timestamp, amount, token, target))
        }));

        emit SessionKeyUsed(sessionId, session.sessionKey, amount, token, target);

        return true;
    }

    /**
     * @notice 冻结会话密钥（紧急情况）
     * @param sessionId 会话ID
     * @param reason 冻结原因
     */
    function freezeSessionKey(
        bytes32 sessionId,
        string calldata reason
    ) external sessionExists(sessionId) onlySessionOwner(sessionId) {
        SessionKey storage session = sessionKeys[sessionId];
        require(session.isActive, "Session not active");
        require(!session.isFrozen, "Already frozen");

        session.isFrozen = true;

        emit SessionKeyFrozen(sessionId, msg.sender, reason);
    }

    /**
     * @notice 解冻会话密钥
     * @param sessionId 会话ID
     */
    function unfreezeSessionKey(
        bytes32 sessionId
    ) external sessionExists(sessionId) onlySessionOwner(sessionId) {
        SessionKey storage session = sessionKeys[sessionId];
        require(session.isActive, "Session not active");
        require(session.isFrozen, "Not frozen");
        require(block.timestamp < session.expiresAt, "Session expired");

        session.isFrozen = false;

        emit SessionKeyUnfrozen(sessionId, msg.sender);
    }

    /**
     * @notice 撤销会话密钥
     * @param sessionId 会话ID
     */
    function revokeSessionKey(
        bytes32 sessionId
    ) external sessionExists(sessionId) onlySessionOwner(sessionId) {
        SessionKey storage session = sessionKeys[sessionId];
        require(session.isActive, "Session not active");

        uint256 remainingBudget = session.maxBudget - session.usedBudget;
        session.isActive = false;

        // 清除 sessionKey 映射以允许复用
        delete sessionKeyToId[session.sessionKey];

        emit SessionKeyRevoked(sessionId, msg.sender, remainingBudget);
    }

    /**
     * @notice 为会话密钥追加预算
     * @param sessionId 会话ID
     * @param additionalBudget 追加金额 (wei)
     */
    function topUpBudget(
        bytes32 sessionId,
        uint256 additionalBudget
    ) external sessionExists(sessionId) onlySessionOwner(sessionId) {
        require(additionalBudget > 0, "Must be positive");
        SessionKey storage session = sessionKeys[sessionId];
        require(session.isActive, "Session not active");
        require(block.timestamp < session.expiresAt, "Session expired");

        session.maxBudget += additionalBudget;
        totalBudgetAllocated += additionalBudget;

        emit BudgetTopUp(sessionId, additionalBudget, session.maxBudget);
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @notice 获取会话详情
     */
    function getSessionKey(bytes32 sessionId) external view returns (
        address owner,
        address sessionKey,
        uint256 maxBudget,
        uint256 usedBudget,
        uint256 remainingBudget,
        uint256 maxSingleTx,
        uint256 expiresAt,
        bool isActive,
        bool isFrozen
    ) {
        SessionKey storage session = sessionKeys[sessionId];
        return (
            session.owner,
            session.sessionKey,
            session.maxBudget,
            session.usedBudget,
            session.maxBudget - session.usedBudget,
            session.maxSingleTx,
            session.expiresAt,
            session.isActive,
            session.isFrozen
        );
    }

    /**
     * @notice 获取会话允许的代币列表
     */
    function getAllowedTokens(bytes32 sessionId) external view returns (address[] memory) {
        return sessionKeys[sessionId].allowedTokens;
    }

    /**
     * @notice 获取会话允许的目标合约列表
     */
    function getAllowedTargets(bytes32 sessionId) external view returns (address[] memory) {
        return sessionKeys[sessionId].allowedTargets;
    }

    /**
     * @notice 获取用户所有会话
     */
    function getOwnerSessions(address owner) external view returns (bytes32[] memory) {
        return ownerSessions[owner];
    }

    /**
     * @notice 获取会话使用记录
     */
    function getUsageHistory(bytes32 sessionId) external view returns (UsageRecord[] memory) {
        return usageHistory[sessionId];
    }

    /**
     * @notice 检查会话是否可用
     */
    function isSessionValid(bytes32 sessionId) external view returns (bool) {
        SessionKey storage session = sessionKeys[sessionId];
        return session.isActive &&
               !session.isFrozen &&
               block.timestamp < session.expiresAt &&
               session.usedBudget < session.maxBudget;
    }

    /**
     * @notice 获取会话剩余预算
     */
    function getRemainingBudget(bytes32 sessionId) external view returns (uint256) {
        SessionKey storage session = sessionKeys[sessionId];
        if (!session.isActive || session.isFrozen || block.timestamp >= session.expiresAt) {
            return 0;
        }
        return session.maxBudget - session.usedBudget;
    }

    // ============================================
    // Admin Functions
    // ============================================

    /**
     * @notice 更新会话时长限制
     */
    function setSessionDurationLimits(
        uint256 _minDuration,
        uint256 _maxDuration
    ) external onlyOwner {
        require(_minDuration > 0 && _minDuration < _maxDuration, "Invalid limits");
        minSessionDuration = _minDuration;
        maxSessionDuration = _maxDuration;
    }

    /**
     * @notice 更新白名单限制
     */
    function setWhitelistLimits(
        uint256 _maxTokens,
        uint256 _maxTargets
    ) external onlyOwner {
        maxAllowedTokens = _maxTokens;
        maxAllowedTargets = _maxTargets;
    }

    // ============================================
    // Internal Functions
    // ============================================

    function _isTokenAllowed(address[] storage allowedTokens, address token) internal view returns (bool) {
        for (uint256 i = 0; i < allowedTokens.length; i++) {
            if (allowedTokens[i] == token) {
                return true;
            }
        }
        return false;
    }

    function _isTargetAllowed(address[] storage allowedTargets, address target) internal view returns (bool) {
        for (uint256 i = 0; i < allowedTargets.length; i++) {
            if (allowedTargets[i] == target) {
                return true;
            }
        }
        return false;
    }
}
