// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title SessionKeyValidatorUpgradeable
 * @dev AI Agent 会话密钥验证合约 - 可升级版本 (UUPS Proxy)
 * @notice 支持 Base 和 HashKey Chain，合约可通过代理升级
 * 
 * 核心功能:
 * - createSessionKey: 创建带有预算限制的会话密钥
 * - validateAndRecord: 验证操作并记录消费
 * - freezeSessionKey / unfreezeSessionKey: 紧急冻结/解冻
 * - revokeSessionKey: 撤销会话密钥
 * - upgradeTo: 升级合约实现 (仅限 owner)
 */
contract SessionKeyValidatorUpgradeable is 
    Initializable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable 
{
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

    // Configuration
    uint256 public minSessionDuration;
    uint256 public maxSessionDuration;
    uint256 public maxBudgetLimit;

    // Version tracking for upgrades
    uint256 public version;

    // ============================================
    // Initializer (replaces constructor)
    // ============================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        minSessionDuration = 1 hours;
        maxSessionDuration = 30 days;
        maxBudgetLimit = 1000 ether;
        version = 1;
    }

    // ============================================
    // UUPS Upgrade Authorization
    // ============================================

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============================================
    // Core Functions
    // ============================================

    /**
     * @notice 创建新的会话密钥
     * @param _sessionKey 会话密钥地址
     * @param _maxBudget 最大预算
     * @param _maxSingleTx 单笔最大金额
     * @param _duration 有效期（秒）
     * @param _allowedTokens 允许的代币列表
     * @param _allowedTargets 允许的目标合约列表
     */
    function createSessionKey(
        address _sessionKey,
        uint256 _maxBudget,
        uint256 _maxSingleTx,
        uint256 _duration,
        address[] calldata _allowedTokens,
        address[] calldata _allowedTargets
    ) external returns (bytes32 sessionId) {
        require(_sessionKey != address(0), "Invalid session key");
        require(_maxBudget > 0 && _maxBudget <= maxBudgetLimit, "Invalid budget");
        require(_maxSingleTx > 0 && _maxSingleTx <= _maxBudget, "Invalid single tx limit");
        require(_duration >= minSessionDuration && _duration <= maxSessionDuration, "Invalid duration");
        require(sessionKeyToId[_sessionKey] == bytes32(0), "Session key already in use");

        sessionId = keccak256(abi.encodePacked(
            msg.sender,
            _sessionKey,
            block.timestamp,
            block.chainid
        ));

        require(!sessionKeys[sessionId].isActive, "Session already exists");

        sessionKeys[sessionId] = SessionKey({
            owner: msg.sender,
            sessionKey: _sessionKey,
            maxBudget: _maxBudget,
            usedBudget: 0,
            maxSingleTx: _maxSingleTx,
            expiresAt: block.timestamp + _duration,
            createdAt: block.timestamp,
            isActive: true,
            isFrozen: false,
            allowedTokens: _allowedTokens,
            allowedTargets: _allowedTargets
        });

        sessionKeyToId[_sessionKey] = sessionId;
        ownerSessions[msg.sender].push(sessionId);

        emit SessionKeyCreated(
            sessionId,
            msg.sender,
            _sessionKey,
            _maxBudget,
            block.timestamp + _duration
        );
    }

    /**
     * @notice 验证并记录消费
     * @param _sessionId 会话ID
     * @param _amount 消费金额
     * @param _token 代币地址
     * @param _target 目标合约
     * @param _signature 会话密钥签名
     */
    function validateAndRecord(
        bytes32 _sessionId,
        uint256 _amount,
        address _token,
        address _target,
        bytes calldata _signature
    ) external nonReentrant returns (bool) {
        SessionKey storage session = sessionKeys[_sessionId];

        require(session.isActive, "Session not active");
        require(!session.isFrozen, "Session is frozen");
        require(block.timestamp < session.expiresAt, "Session expired");
        require(_amount <= session.maxSingleTx, "Exceeds single tx limit");
        require(session.usedBudget + _amount <= session.maxBudget, "Exceeds budget");

        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            _sessionId,
            _amount,
            _token,
            _target,
            block.chainid
        ));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(_signature);
        require(signer == session.sessionKey, "Invalid signature");

        // Check allowed tokens (empty = all allowed)
        if (session.allowedTokens.length > 0) {
            bool tokenAllowed = false;
            for (uint i = 0; i < session.allowedTokens.length; i++) {
                if (session.allowedTokens[i] == _token) {
                    tokenAllowed = true;
                    break;
                }
            }
            require(tokenAllowed, "Token not allowed");
        }

        // Check allowed targets (empty = all allowed)
        if (session.allowedTargets.length > 0) {
            bool targetAllowed = false;
            for (uint i = 0; i < session.allowedTargets.length; i++) {
                if (session.allowedTargets[i] == _target) {
                    targetAllowed = true;
                    break;
                }
            }
            require(targetAllowed, "Target not allowed");
        }

        // Record usage
        session.usedBudget += _amount;
        usageHistory[_sessionId].push(UsageRecord({
            timestamp: block.timestamp,
            amount: _amount,
            token: _token,
            target: _target,
            txHash: keccak256(abi.encodePacked(block.timestamp, _amount, _token, _target))
        }));

        emit SessionKeyUsed(_sessionId, session.sessionKey, _amount, _token, _target);

        return true;
    }

    /**
     * @notice 冻结会话密钥
     * @param _sessionId 会话ID
     * @param _reason 冻结原因
     */
    function freezeSessionKey(bytes32 _sessionId, string calldata _reason) external {
        SessionKey storage session = sessionKeys[_sessionId];
        require(session.isActive, "Session not active");
        require(msg.sender == session.owner || msg.sender == owner(), "Not authorized");
        require(!session.isFrozen, "Already frozen");

        session.isFrozen = true;
        emit SessionKeyFrozen(_sessionId, msg.sender, _reason);
    }

    /**
     * @notice 解冻会话密钥
     * @param _sessionId 会话ID
     */
    function unfreezeSessionKey(bytes32 _sessionId) external {
        SessionKey storage session = sessionKeys[_sessionId];
        require(session.isActive, "Session not active");
        require(msg.sender == session.owner || msg.sender == owner(), "Not authorized");
        require(session.isFrozen, "Not frozen");

        session.isFrozen = false;
        emit SessionKeyUnfrozen(_sessionId, msg.sender);
    }

    /**
     * @notice 撤销会话密钥
     * @param _sessionId 会话ID
     */
    function revokeSessionKey(bytes32 _sessionId) external {
        SessionKey storage session = sessionKeys[_sessionId];
        require(session.isActive, "Session not active");
        require(msg.sender == session.owner || msg.sender == owner(), "Not authorized");

        uint256 remainingBudget = session.maxBudget - session.usedBudget;

        session.isActive = false;
        delete sessionKeyToId[session.sessionKey];

        emit SessionKeyRevoked(_sessionId, msg.sender, remainingBudget);
    }

    /**
     * @notice 增加预算
     * @param _sessionId 会话ID
     * @param _additionalBudget 增加的预算
     */
    function topUpBudget(bytes32 _sessionId, uint256 _additionalBudget) external {
        SessionKey storage session = sessionKeys[_sessionId];
        require(session.isActive, "Session not active");
        require(msg.sender == session.owner, "Not session owner");
        require(session.maxBudget + _additionalBudget <= maxBudgetLimit, "Exceeds max budget limit");

        session.maxBudget += _additionalBudget;

        emit BudgetTopUp(_sessionId, _additionalBudget, session.maxBudget);
    }

    // ============================================
    // View Functions
    // ============================================

    function getSessionKey(bytes32 _sessionId) external view returns (SessionKey memory) {
        return sessionKeys[_sessionId];
    }

    function getUsageHistory(bytes32 _sessionId) external view returns (UsageRecord[] memory) {
        return usageHistory[_sessionId];
    }

    function getOwnerSessions(address _owner) external view returns (bytes32[] memory) {
        return ownerSessions[_owner];
    }

    function getRemainingBudget(bytes32 _sessionId) external view returns (uint256) {
        SessionKey storage session = sessionKeys[_sessionId];
        if (!session.isActive) return 0;
        return session.maxBudget - session.usedBudget;
    }

    function isSessionValid(bytes32 _sessionId) external view returns (bool) {
        SessionKey storage session = sessionKeys[_sessionId];
        return session.isActive && 
               !session.isFrozen && 
               block.timestamp < session.expiresAt &&
               session.usedBudget < session.maxBudget;
    }

    // ============================================
    // Admin Functions
    // ============================================

    function setMinSessionDuration(uint256 _duration) external onlyOwner {
        minSessionDuration = _duration;
    }

    function setMaxSessionDuration(uint256 _duration) external onlyOwner {
        maxSessionDuration = _duration;
    }

    function setMaxBudgetLimit(uint256 _limit) external onlyOwner {
        maxBudgetLimit = _limit;
    }

    /**
     * @notice 获取当前合约版本
     */
    function getVersion() external view returns (uint256) {
        return version;
    }
}
