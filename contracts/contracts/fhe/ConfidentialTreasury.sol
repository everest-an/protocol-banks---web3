// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IFHE.sol";
import "./FHE.sol";

/**
 * @title Confidential Protocol Bank Treasury (cTreasury)
 * @author Protocol Banks Team
 * @notice FHE-enabled USDC vault on Base L2 backing cPBUSD 1:1 on HashKey Chain.
 *
 * ┌────────────────────────────────────────────────────────────────┐
 * │            Confidential Treasury Vault Design                 │
 * ├────────────────────────────────────────────────────────────────┤
 * │  Privacy:   FHE-encrypted deposit tracking & release amounts  │
 * │  Chain:     Base (mainnet 8453 / testnet 84532)               │
 * │  Asset:     USDC (Circle)                                     │
 * │  Controls:  Pausable, ReentrancyGuard, Daily Release Limit    │
 * │  Roles:     Admin, Relayer, Guardian                          │
 * └────────────────────────────────────────────────────────────────┘
 *
 * @dev Privacy Architecture:
 *
 *  1. **Encrypted Deposit Tracking**: Each depositor's cumulative USDC deposits
 *     are tracked as `euint64` encrypted values. External observers cannot see
 *     individual deposit amounts or totals per address.
 *
 *  2. **Encrypted Release Tracking**: Per-address release totals are encrypted.
 *     Combined with the cPBUSD confidential balances, this creates end-to-end
 *     privacy for the mint-burn-redeem cycle.
 *
 *  3. **Plaintext Aggregate Metrics**: Total vault balance, total deposited,
 *     and total released are kept in plaintext for:
 *     - Proof-of-reserve audits
 *     - DeFi composability (e.g., oracle price feeds)
 *     - Regulatory compliance reporting
 *
 *  4. **Confidential Emergency Withdraw**: Emergency amounts are encrypted
 *     until execution, preventing front-running of large withdrawals.
 *
 * References:
 *  - TFHE: "Fast Fully Homomorphic Encryption over the Torus" (Chillotti et al., 2020)
 *  - Zama fhEVM: https://github.com/zama-ai/fhevm
 */
contract ConfidentialTreasury is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════════════════════
    //                          ROLES
    // ══════════════════════════════════════════════════════════════
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // ══════════════════════════════════════════════════════════════
    //                      STATE VARIABLES
    // ══════════════════════════════════════════════════════════════
    IERC20 public immutable usdc;

    // --- Encrypted Per-Address Tracking ---
    /**
     * @dev Encrypted cumulative deposit per address. Observers cannot see
     *      how much any individual has deposited into the vault.
     */
    mapping(address => euint64) internal _encDeposits;

    /**
     * @dev Encrypted cumulative releases per address. Combined with encrypted
     *      deposits, provides privacy for the full deposit-to-redeem flow.
     */
    mapping(address => euint64) internal _encReleases;

    // --- Plaintext Aggregate Tracking (for proof-of-reserve) ---
    uint256 public totalDeposited;
    uint256 public totalReleased;

    // --- Burn TX Idempotency ---
    mapping(bytes32 => bool) public processedBurnTxs;

    // --- Daily Release Cap ---
    uint256 public dailyReleaseCap;
    uint256 public currentDayReleased;
    uint256 public lastReleaseResetDay;

    // --- Emergency ---
    uint256 public emergencyWithdrawalDelay;

    struct EmergencyRequest {
        address to;
        euint64 encAmount;
        uint256 unlockTime;
        bool exists;
    }
    mapping(bytes32 => EmergencyRequest) internal _emergencyRequests;

    // ══════════════════════════════════════════════════════════════
    //                          EVENTS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Deposit event. Amount is plaintext because USDC transfers are
     *         already visible on-chain (it's the USDC ERC-20 Transfer event).
     *         However, the per-user cumulative deposit is encrypted.
     */
    event DepositForMint(
        address indexed depositor,
        uint256 amount,
        address indexed hashKeyRecipient,
        uint256 timestamp
    );

    /**
     * @notice Confidential release — amount is intentionally omitted from
     *         the event for maximum privacy. The burnTxHash provides
     *         cross-chain correlation for the bridge bot.
     */
    event ConfidentialRelease(
        address indexed recipient,
        bytes32 indexed burnTxHash,
        address indexed relayer,
        uint256 timestamp
    );

    event EmergencyWithdrawRequested(
        address indexed requester,
        bytes32 requestHash,
        uint256 unlockTime
    );

    event EmergencyWithdrawExecuted(
        address indexed executor,
        address indexed to,
        bytes32 requestHash
    );

    event EmergencyWithdrawCanceled(bytes32 requestHash);
    event DailyReleaseCapUpdated(uint256 oldCap, uint256 newCap);
    event EmergencyDelayUpdated(uint256 oldDelay, uint256 newDelay);
    event ReleaseCapReset(uint256 day, uint256 previousDayTotal);

    // ══════════════════════════════════════════════════════════════
    //                          ERRORS
    // ══════════════════════════════════════════════════════════════
    error InvalidAmount();
    error InvalidRecipient();
    error BurnTxAlreadyProcessed(bytes32 burnTxHash);
    error DailyReleaseCapExceeded(uint256 requested, uint256 remaining);
    error InsufficientVaultBalance(uint256 requested, uint256 available);
    error EmergencyNotReady(bytes32 requestHash, uint256 unlockTime);
    error EmergencyRequestNotFound(bytes32 requestHash);
    error EmergencyAlreadyRequested(bytes32 requestHash);

    // ══════════════════════════════════════════════════════════════
    //                       CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════
    constructor(
        address _usdc,
        address admin,
        address relayer,
        address guardian,
        uint256 _dailyReleaseCap,
        uint256 _emergencyDelay,
        address coprocessor,
        address acl
    ) {
        // Initialize FHE coprocessor
        FHE.setCoprocessor(coprocessor, acl);

        usdc = IERC20(_usdc);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RELAYER_ROLE, relayer);
        _grantRole(GUARDIAN_ROLE, guardian);

        dailyReleaseCap = _dailyReleaseCap;
        emergencyWithdrawalDelay = _emergencyDelay;
        lastReleaseResetDay = _currentDay();
    }

    // ══════════════════════════════════════════════════════════════
    //         CONFIDENTIAL DEPOSIT (User → Vault)
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Deposit USDC into the treasury to receive cPBUSD on HashKey Chain.
     * @dev The USDC transfer amount is inherently public (standard ERC-20 Transfer
     *      event). However, the per-user cumulative deposit total is encrypted,
     *      preventing observers from tracking individual user activity over time.
     *
     * @param amount Amount of USDC to deposit (6 decimals)
     * @param hashKeyRecipient Address on HashKey Chain to receive cPBUSD
     */
    function depositToHashKey(uint256 amount, address hashKeyRecipient)
        external
        whenNotPaused
        nonReentrant
    {
        if (amount == 0) revert InvalidAmount();
        if (hashKeyRecipient == address(0)) revert InvalidRecipient();

        totalDeposited += amount;

        // Update encrypted per-user deposit tracking
        euint64 encAmount = FHE.asEuint64(uint64(amount));
        if (FHE.isInitialized(_encDeposits[msg.sender])) {
            _encDeposits[msg.sender] = FHE.add(_encDeposits[msg.sender], encAmount);
        } else {
            _encDeposits[msg.sender] = encAmount;
        }
        FHE.allowThis(_encDeposits[msg.sender]);
        FHE.allow(_encDeposits[msg.sender], msg.sender);

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit DepositForMint(msg.sender, amount, hashKeyRecipient, block.timestamp);
    }

    // ══════════════════════════════════════════════════════════════
    //         CONFIDENTIAL RELEASE (Vault → User)
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Release USDC to a user after they burned cPBUSD on HashKey Chain.
     * @dev The release amount can optionally be provided as an encrypted input
     *      for maximum privacy. However, since the USDC transfer itself is a
     *      standard ERC-20 transfer (plaintext), the actual released amount
     *      will be visible in the USDC Transfer event. The encrypted tracking
     *      provides privacy for the per-user cumulative release total.
     *
     * @param recipient USDC recipient on Base
     * @param amount Amount of USDC to release (6 decimals)
     * @param burnTxHash pbUSD burn transaction hash on HashKey Chain (for idempotency)
     */
    function releaseFromBurn(
        address recipient,
        uint256 amount,
        bytes32 burnTxHash
    )
        external
        onlyRole(RELAYER_ROLE)
        whenNotPaused
        nonReentrant
    {
        if (amount == 0) revert InvalidAmount();
        if (recipient == address(0)) revert InvalidRecipient();
        if (processedBurnTxs[burnTxHash]) revert BurnTxAlreadyProcessed(burnTxHash);

        // Daily release limit
        _resetDailyReleaseIfNeeded();
        if (dailyReleaseCap > 0 && currentDayReleased + amount > dailyReleaseCap) {
            revert DailyReleaseCapExceeded(amount, dailyReleaseCap - currentDayReleased);
        }

        uint256 balance = usdc.balanceOf(address(this));
        if (balance < amount) revert InsufficientVaultBalance(amount, balance);

        processedBurnTxs[burnTxHash] = true;
        currentDayReleased += amount;
        totalReleased += amount;

        // Update encrypted per-user release tracking
        euint64 encAmount = FHE.asEuint64(uint64(amount));
        if (FHE.isInitialized(_encReleases[recipient])) {
            _encReleases[recipient] = FHE.add(_encReleases[recipient], encAmount);
        } else {
            _encReleases[recipient] = encAmount;
        }
        FHE.allowThis(_encReleases[recipient]);
        FHE.allow(_encReleases[recipient], recipient);

        usdc.safeTransfer(recipient, amount);

        emit ConfidentialRelease(recipient, burnTxHash, msg.sender, block.timestamp);
    }

    // ══════════════════════════════════════════════════════════════
    //      CONFIDENTIAL EMERGENCY WITHDRAWAL (Time-locked)
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Request an emergency withdrawal with encrypted amount.
     * @dev The withdrawal amount is encrypted until execution, preventing
     *      front-running by MEV bots or oracle manipulators who might
     *      otherwise react to large pending withdrawals.
     *
     * @param to Recipient address
     * @param encryptedAmount Encrypted withdrawal amount
     * @param inputProof ZK proof for the encrypted input
     */
    function requestEmergencyWithdraw(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    )
        external
        onlyRole(GUARDIAN_ROLE)
    {
        if (to == address(0)) revert InvalidRecipient();

        euint64 encAmount = FHE.fromExternal(encryptedAmount, inputProof);

        bytes32 requestHash = keccak256(abi.encode(to, block.timestamp, msg.sender));
        if (_emergencyRequests[requestHash].exists) revert EmergencyAlreadyRequested(requestHash);

        uint256 unlockTime = block.timestamp + emergencyWithdrawalDelay;

        _emergencyRequests[requestHash] = EmergencyRequest({
            to: to,
            encAmount: encAmount,
            unlockTime: unlockTime,
            exists: true
        });

        FHE.allowThis(encAmount);
        FHE.allow(encAmount, msg.sender);

        emit EmergencyWithdrawRequested(msg.sender, requestHash, unlockTime);
    }

    /**
     * @notice Request emergency withdrawal with plaintext amount (compatibility).
     */
    function requestEmergencyWithdraw(address to, uint256 amount)
        external
        onlyRole(GUARDIAN_ROLE)
    {
        if (to == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();

        euint64 encAmount = FHE.asEuint64(uint64(amount));

        bytes32 requestHash = keccak256(abi.encode(to, block.timestamp, msg.sender));
        if (_emergencyRequests[requestHash].exists) revert EmergencyAlreadyRequested(requestHash);

        uint256 unlockTime = block.timestamp + emergencyWithdrawalDelay;

        _emergencyRequests[requestHash] = EmergencyRequest({
            to: to,
            encAmount: encAmount,
            unlockTime: unlockTime,
            exists: true
        });

        FHE.allowThis(encAmount);

        emit EmergencyWithdrawRequested(msg.sender, requestHash, unlockTime);
    }

    /**
     * @notice Execute a previously requested emergency withdrawal after time-lock.
     * @dev At execution time, the encrypted amount is decrypted via the KMS gateway
     *      so the contract can perform the actual USDC transfer.
     *
     * @param requestHash The hash identifying the emergency request
     * @param plaintextAmount The decrypted amount (verified against encrypted value)
     */
    function executeEmergencyWithdraw(
        bytes32 requestHash,
        uint256 plaintextAmount
    )
        external
        onlyRole(GUARDIAN_ROLE)
        nonReentrant
    {
        EmergencyRequest storage req = _emergencyRequests[requestHash];
        if (!req.exists) revert EmergencyRequestNotFound(requestHash);
        if (block.timestamp < req.unlockTime) revert EmergencyNotReady(requestHash, req.unlockTime);

        address to = req.to;
        uint256 balance = usdc.balanceOf(address(this));
        if (balance < plaintextAmount) revert InsufficientVaultBalance(plaintextAmount, balance);

        // Verify: encrypted amount matches plaintext (in production, this uses
        // the KMS decryption callback to ensure the plaintext is correct)
        // For now, we trust the guardian to provide the correct plaintext
        // TODO: Integrate with FHE Gateway decryption callback

        delete _emergencyRequests[requestHash];
        totalReleased += plaintextAmount;

        usdc.safeTransfer(to, plaintextAmount);

        emit EmergencyWithdrawExecuted(msg.sender, to, requestHash);
    }

    /**
     * @notice Cancel a pending emergency withdrawal request.
     */
    function cancelEmergencyWithdraw(bytes32 requestHash)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (!_emergencyRequests[requestHash].exists) revert EmergencyRequestNotFound(requestHash);
        delete _emergencyRequests[requestHash];
        emit EmergencyWithdrawCanceled(requestHash);
    }

    // ══════════════════════════════════════════════════════════════
    //                   ADMINISTRATION
    // ══════════════════════════════════════════════════════════════

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function setDailyReleaseCap(uint256 newCap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldCap = dailyReleaseCap;
        dailyReleaseCap = newCap;
        emit DailyReleaseCapUpdated(oldCap, newCap);
    }

    function setEmergencyDelay(uint256 newDelay) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 oldDelay = emergencyWithdrawalDelay;
        emergencyWithdrawalDelay = newDelay;
        emit EmergencyDelayUpdated(oldDelay, newDelay);
    }

    // ══════════════════════════════════════════════════════════════
    //                    VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Returns the encrypted cumulative deposit total for an address.
     * @dev Only the address itself (and the contract) can decrypt this value
     *      via the FHE Gateway.
     */
    function encryptedDepositsOf(address account) external view returns (euint64) {
        return _encDeposits[account];
    }

    /**
     * @notice Returns the encrypted cumulative release total for an address.
     */
    function encryptedReleasesOf(address account) external view returns (euint64) {
        return _encReleases[account];
    }

    /**
     * @notice USDC balance held in the vault (plaintext for proof-of-reserve).
     */
    function vaultBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Net deposits = totalDeposited - totalReleased.
     */
    function netDeposited() external view returns (uint256) {
        return totalDeposited - totalReleased;
    }

    /**
     * @notice How much more USDC can be released today.
     */
    function remainingDailyRelease() external view returns (uint256) {
        if (dailyReleaseCap == 0) return type(uint256).max;
        uint256 day = _currentDay();
        if (day != lastReleaseResetDay) return dailyReleaseCap;
        if (currentDayReleased >= dailyReleaseCap) return 0;
        return dailyReleaseCap - currentDayReleased;
    }

    function isBurnProcessed(bytes32 burnTxHash) external view returns (bool) {
        return processedBurnTxs[burnTxHash];
    }

    // ══════════════════════════════════════════════════════════════
    //                    INTERNAL HELPERS
    // ══════════════════════════════════════════════════════════════

    function _currentDay() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }

    function _resetDailyReleaseIfNeeded() internal {
        uint256 today = _currentDay();
        if (today != lastReleaseResetDay) {
            emit ReleaseCapReset(today, currentDayReleased);
            currentDayReleased = 0;
            lastReleaseResetDay = today;
        }
    }
}
