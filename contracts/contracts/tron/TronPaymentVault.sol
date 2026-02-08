// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ITRC20.sol";

/**
 * @title TronPaymentVault
 * @dev Multi-signature payment vault for TRC20 tokens on TRON blockchain
 * @notice Secure vault for USDT and other TRC20 tokens with multi-sig protection
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │              TRON Payment Vault Architecture                  │
 * ├───────────────────────────────────────────────────────────────┤
 * │  Chain:     TRON Mainnet (mainnet) / Nile Testnet           │
 * │  Asset:     USDT (TRC20), USDC, or any TRC20 token          │
 * │  Security:  Multi-signature + Time-lock + Rate limit         │
 * │  Roles:     Signers, Guardian, Pauser                          │
 * │  Features:  Emergency withdrawal, Daily limit, Replay protect │
 * └───────────────────────────────────────────────────────────────┘
 *
 * @dev Key Features:
 *  1. Multi-signature: Requires N of M signers to approve payments
 *  2. Time-lock: Critical operations have a minimum delay
 *  3. Daily limit: Prevents draining vault in case of key compromise
 *  4. Replay protection: Each payment has unique nonce
 *  5. Emergency mechanisms: Guardian can pause, time-locked recovery
 *
 * @notice Compatible with TRON address format (Base58 T-prefix)
 *         Smart contracts internally use 20-byte addresses like Ethereum
 */
contract TronPaymentVault {
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════════════════════
    //                          EVENTS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Emitted when a new signer is added
     */
    event SignerAdded(address indexed signer, uint256 threshold);

    /**
     * @notice Emitted when a signer is removed
     */
    event SignerRemoved(address indexed signer, uint256 threshold);

    /**
     * @notice Emitted when threshold is changed
     */
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    /**
     * @notice Emitted when a payment proposal is created
     */
    event PaymentProposed(
        uint256 indexed paymentId,
        address indexed token,
        address indexed to,
        uint256 amount,
        bytes data,
        uint256 proposedAt
    );

    /**
     * @notice Emitted when a signer approves a payment
     */
    event PaymentApproved(
        uint256 indexed paymentId,
        address indexed signer,
        uint256 approvals,
        uint256 required
    );

    /**
     * @notice Emitted when a payment is executed
     */
    event PaymentExecuted(
        uint256 indexed paymentId,
        address indexed token,
        address indexed to,
        uint256 amount,
        bytes txHash
    );

    /**
     * @notice Emitted when a payment is cancelled
     */
    event PaymentCancelled(uint256 indexed paymentId);

    /**
     * @notice Emitted when vault is paused
     */
    event VaultPaused(address indexed pauser);

    /**
     * @notice Emitted when vault is unpaused
     */
    event VaultUnpaused(address indexed unpauser);

    /**
     * @notice Emitted when emergency withdrawal is requested
     */
    event EmergencyWithdrawalRequested(
        address indexed to,
        address indexed token,
        uint256 amount,
        uint256 unlockTime
    );

    /**
     * @notice Emitted when emergency withdrawal is executed
     */
    event EmergencyWithdrawalExecuted(
        address indexed to,
        address indexed token,
        uint256 amount
    );

    /**
     * @notice Emitted when daily limit is updated
     */
    event DailyLimitUpdated(uint256 oldLimit, uint256 newLimit);

    /**
     * @notice Emitted when timelock is updated
     */
    event TimelockUpdated(uint256 oldTimelock, uint256 newTimelock);

    // ══════════════════════════════════════════════════════════════
    //                          ERRORS
    // ══════════════════════════════════════════════════════════════

    error InvalidAddress();
    error InvalidAmount();
    error InvalidThreshold();
    error SignerAlreadyExists(address signer);
    error SignerNotFound(address signer);
    error NotAuthorized(address signer);
    error InvalidPaymentId();
    error PaymentAlreadyApproved(address signer);
    error PaymentAlreadyExecuted();
    error PaymentAlreadyCancelled();
    error InsufficientApprovals(uint256 current, uint256 required);
    error DailyLimitExceeded(uint256 requested, uint256 remaining);
    error NotTimelocked(uint256 proposedAt, uint256 timelock, uint256 currentTime);
    error InvalidTimelock();
    error InvalidDailyLimit();
    error VaultIsPaused();
    error EmergencyNotReady(uint256 unlockTime, uint256 currentTime);
    error TokenNotSupported(address token);

    // ══════════════════════════════════════════════════════════════
    //                      STATE VARIABLES
    // ══════════════════════════════════════════════════════════════

    // --- Multi-signature ---
    mapping(address => bool) public isSigner;
    address[] public signers;
    uint256 public threshold; // Number of signatures required

    // --- Payment Proposals ---
    struct PaymentProposal {
        address token;        // TRC20 token address (USDT, USDC, etc.)
        address to;          // Recipient address
        uint256 amount;       // Amount to transfer
        bytes data;          // Optional call data (empty for simple transfer)
        mapping(address => bool) approvals; // Signer approvals
        uint256 approvalCount;
        bool executed;
        bool cancelled;
        uint256 proposedAt;  // Timestamp when proposed
    }

    mapping(uint256 => PaymentProposal) public payments;
    uint256 public nextPaymentId;

    // --- Security Controls ---
    bool public paused;
    uint256 public timelock; // Minimum delay before payment execution (in seconds)

    // --- Daily Limit ---
    uint256 public dailyLimit; // Maximum total amount that can be paid per day
    uint256 public dailyPaid;
    uint256 public lastDailyReset;

    // --- Supported Tokens ---
    mapping(address => bool) public supportedTokens;

    // --- Emergency Withdrawal ---
    struct EmergencyWithdrawRequest {
        address to;
        address token;
        uint256 amount;
        uint256 unlockTime;
        bool exists;
    }
    mapping(bytes32 => EmergencyWithdrawRequest) public emergencyRequests;

    // --- Admin/Guardian ---
    address public guardian; // Can pause and trigger emergency

    // ══════════════════════════════════════════════════════════════
    //                          MODIFIERS
    // ══════════════════════════════════════════════════════════════

    modifier onlySigner() {
        if (!isSigner[msg.sender]) revert NotAuthorized(msg.sender);
        _;
    }

    modifier onlyGuardian() {
        if (msg.sender != guardian) revert NotAuthorized(msg.sender);
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert VaultIsPaused();
        _;
    }

    // ══════════════════════════════════════════════════════════════
    //                       CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Initialize the TRON payment vault
     * @param _initialSigners Initial array of signer addresses
     * @param _threshold Number of signatures required to approve a payment
     * @param _guardian Guardian address (can pause and trigger emergency recovery)
     * @param _supportedTokens Array of supported TRC20 token addresses (e.g., USDT, USDC)
     * @param _timelock Minimum delay before payment execution (in seconds, 0 to disable)
     * @param _dailyLimit Daily payment limit (in token decimals, 0 for unlimited)
     */
    constructor(
        address[] memory _initialSigners,
        uint256 _threshold,
        address _guardian,
        address[] memory _supportedTokens,
        uint256 _timelock,
        uint256 _dailyLimit
    ) {
        // Validate inputs
        if (_initialSigners.length == 0) revert InvalidAddress();
        if (_guardian == address(0)) revert InvalidAddress();
        if (_threshold == 0 || _threshold > _initialSigners.length) revert InvalidThreshold();
        if (_timelock > 7 days) revert InvalidTimelock(); // Max 7 days timelock

        // Set initial signers
        for (uint256 i = 0; i < _initialSigners.length; i++) {
            address signer = _initialSigners[i];
            if (signer == address(0)) revert InvalidAddress();
            if (isSigner[signer]) revert SignerAlreadyExists(signer);

            isSigner[signer] = true;
            signers.push(signer);
        }

        threshold = _threshold;
        guardian = _guardian;
        timelock = _timelock;
        dailyLimit = _dailyLimit;
        lastDailyReset = block.timestamp;

        // Set supported tokens
        for (uint256 i = 0; i < _supportedTokens.length; i++) {
            address token = _supportedTokens[i];
            if (token == address(0)) revert InvalidAddress();
            supportedTokens[token] = true;
        }
    }

    // ══════════════════════════════════════════════════════════════
    //                    PAYMENT PROPOSALS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Propose a payment to a recipient
     * @dev Creates a new payment proposal that requires multi-sig approval
     * @param token TRC20 token address to pay with
     * @param to Recipient address
     * @param amount Amount to transfer (in token decimals)
     * @return paymentId Unique payment proposal ID
     */
    function proposePayment(
        address token,
        address to,
        uint256 amount,
        bytes calldata data
    ) external onlySigner whenNotPaused returns (uint256 paymentId) {
        // Validate inputs
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        if (!supportedTokens[token]) revert TokenNotSupported(token);

        paymentId = nextPaymentId++;

        // Store payment proposal
        PaymentProposal storage proposal = payments[paymentId];
        proposal.token = token;
        proposal.to = to;
        proposal.amount = amount;
        proposal.data = data;
        proposal.approvalCount = 0;
        proposal.executed = false;
        proposal.cancelled = false;
        proposal.proposedAt = block.timestamp;

        emit PaymentProposed(paymentId, token, to, amount, data, block.timestamp);
    }

    /**
     * @notice Approve a payment proposal
     * @dev Signers can approve, once threshold is reached, anyone can execute
     * @param paymentId Payment proposal ID to approve
     */
    function approvePayment(uint256 paymentId) external onlySigner {
        PaymentProposal storage proposal = payments[paymentId];

        if (paymentId >= nextPaymentId) revert InvalidPaymentId();
        if (proposal.approvals[msg.sender]) revert PaymentAlreadyApproved(msg.sender);
        if (proposal.executed) revert PaymentAlreadyExecuted();
        if (proposal.cancelled) revert PaymentAlreadyCancelled();

        proposal.approvals[msg.sender] = true;
        proposal.approvalCount++;

        emit PaymentApproved(paymentId, msg.sender, proposal.approvalCount, threshold);
    }

    /**
     * @notice Execute a payment proposal after reaching threshold
     * @dev Anyone can execute once enough approvals are received and timelock passed
     * @param paymentId Payment proposal ID to execute
     */
    function executePayment(uint256 paymentId) external whenNotPaused {
        PaymentProposal storage proposal = payments[paymentId];

        if (paymentId >= nextPaymentId) revert InvalidPaymentId();
        if (proposal.executed) revert PaymentAlreadyExecuted();
        if (proposal.cancelled) revert PaymentAlreadyCancelled();
        if (proposal.approvalCount < threshold) {
            revert InsufficientApprovals(proposal.approvalCount, threshold);
        }

        // Check timelock
        if (timelock > 0) {
            if (block.timestamp < proposal.proposedAt + timelock) {
                revert NotTimelocked(proposal.proposedAt, timelock, block.timestamp);
            }
        }

        // Check daily limit
        _checkDailyLimit(proposal.amount);

        // Execute payment
        proposal.executed = true;
        dailyPaid += proposal.amount;

        IERC20 tokenContract = IERC20(proposal.token);
        tokenContract.safeTransfer(proposal.to, proposal.amount);

        emit PaymentExecuted(paymentId, proposal.token, proposal.to, proposal.amount, "");
    }

    /**
     * @notice Cancel a payment proposal
     * @dev Only signers can cancel unexecuted payments
     * @param paymentId Payment proposal ID to cancel
     */
    function cancelPayment(uint256 paymentId) external onlySigner {
        PaymentProposal storage proposal = payments[paymentId];

        if (paymentId >= nextPaymentId) revert InvalidPaymentId();
        if (proposal.executed) revert PaymentAlreadyExecuted();
        if (proposal.cancelled) revert PaymentAlreadyCancelled();

        proposal.cancelled = true;

        emit PaymentCancelled(paymentId);
    }

    // ══════════════════════════════════════════════════════════════
    //                   SIGNER MANAGEMENT
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Add a new signer (requires existing signer approval)
     * @dev Must maintain sufficient signers for current threshold
     */
    function addSigner(address newSigner) external onlySigner {
        if (newSigner == address(0)) revert InvalidAddress();
        if (isSigner[newSigner]) revert SignerAlreadyExists(newSigner);

        isSigner[newSigner] = true;
        signers.push(newSigner);

        emit SignerAdded(newSigner, threshold);
    }

    /**
     * @notice Remove a signer
     * @dev Cannot remove if it would make threshold impossible to reach
     */
    function removeSigner(address signer) external onlySigner {
        if (!isSigner[signer]) revert SignerNotFound(signer);

        // Check: remaining signers >= threshold
        uint256 remainingSigners = signers.length;
        uint256 newThreshold = threshold;

        // If we're removing a signer, we might need to decrease threshold
        if (remainingSigners <= threshold) {
            newThreshold = remainingSigners - 1;
            require(newThreshold > 0, "Threshold would be zero");
            threshold = newThreshold;
        }

        isSigner[signer] = false;

        // Remove from array (swap with last and pop)
        for (uint256 i = 0; i < signers.length; i++) {
            if (signers[i] == signer) {
                signers[i] = signers[signers.length - 1];
                signers.pop();
                break;
            }
        }

        emit SignerRemoved(signer, threshold);
    }

    /**
     * @notice Update the signature threshold
     * @dev New threshold must be <= total signers
     * @param newThreshold New threshold value
     */
    function updateThreshold(uint256 newThreshold) external onlySigner {
        uint256 currentSignerCount = 0;
        for (uint256 i = 0; i < signers.length; i++) {
            if (isSigner[signers[i]]) currentSignerCount++;
        }

        if (newThreshold == 0 || newThreshold > currentSignerCount) revert InvalidThreshold();

        uint256 oldThreshold = threshold;
        threshold = newThreshold;

        emit ThresholdUpdated(oldThreshold, newThreshold);
    }

    // ══════════════════════════════════════════════════════════════
    //                   ADMIN & GUARDIAN
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Pause the vault (only guardian)
     * @dev Prevents new payments and executions
     */
    function pause() external onlyGuardian {
        paused = true;
        emit VaultPaused(msg.sender);
    }

    /**
     * @notice Unpause the vault (only guardian)
     */
    function unpause() external onlyGuardian {
        paused = false;
        emit VaultUnpaused(msg.sender);
    }

    /**
     * @notice Request emergency withdrawal (time-locked)
     * @dev Guardian can request withdrawal, must wait timelock period
     * @param to Recipient address
     * @param token Token to withdraw
     * @param amount Amount to withdraw
     */
    function requestEmergencyWithdrawal(
        address to,
        address token,
        uint256 amount
    ) external onlyGuardian {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        bytes32 requestHash = keccak256(abi.encode(to, token, amount, block.timestamp));
        if (emergencyRequests[requestHash].exists) revert(); // Already requested

        uint256 unlockTime = block.timestamp + timelock;

        emergencyRequests[requestHash] = EmergencyWithdrawRequest({
            to: to,
            token: token,
            amount: amount,
            unlockTime: unlockTime,
            exists: true
        });

        emit EmergencyWithdrawalRequested(to, token, amount, unlockTime);
    }

    /**
     * @notice Execute emergency withdrawal after timelock
     * @param to Recipient address
     * @param token Token to withdraw
     * @param amount Amount to withdraw
     * @param requestTimestamp Timestamp used when creating the request
     */
    function executeEmergencyWithdrawal(
        address to,
        address token,
        uint256 amount,
        uint256 requestTimestamp
    ) external onlyGuardian {
        bytes32 requestHash = keccak256(abi.encode(to, token, amount, requestTimestamp));
        EmergencyWithdrawRequest storage request = emergencyRequests[requestHash];

        if (!request.exists) revert(); // Request not found
        if (block.timestamp < request.unlockTime) {
            revert EmergencyNotReady(request.unlockTime, block.timestamp);
        }

        // Execute withdrawal
        delete emergencyRequests[requestHash];
        IERC20(token).safeTransfer(to, amount);

        emit EmergencyWithdrawalExecuted(to, token, amount);
    }

    /**
     * @notice Update daily limit
     * @param newLimit New daily limit (0 for unlimited)
     */
    function updateDailyLimit(uint256 newLimit) external onlyGuardian {
        uint256 oldLimit = dailyLimit;
        dailyLimit = newLimit;
        emit DailyLimitUpdated(oldLimit, newLimit);
    }

    /**
     * @notice Update timelock
     * @param newTimelock New timelock in seconds (max 7 days)
     */
    function updateTimelock(uint256 newTimelock) external onlyGuardian {
        if (newTimelock > 7 days) revert InvalidTimelock();

        uint256 oldTimelock = timelock;
        timelock = newTimelock;
        emit TimelockUpdated(oldTimelock, newTimelock);
    }

    /**
     * @notice Add supported token
     * @param token Token address to support
     */
    function addSupportedToken(address token) external onlyGuardian {
        if (token == address(0)) revert InvalidAddress();
        supportedTokens[token] = true;
    }

    /**
     * @notice Remove supported token
     * @param token Token address to remove
     */
    function removeSupportedToken(address token) external onlyGuardian {
        supportedTokens[token] = false;
    }

    // ══════════════════════════════════════════════════════════════
    //                      VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Get payment proposal details
     * @param paymentId Payment proposal ID
     * @return token Token address
     * @return to Recipient address
     * @return amount Amount to transfer
     * @return approvalCount Current number of approvals
     * @return required Threshold required
     * @return executed Whether payment is executed
     * @return cancelled Whether payment is cancelled
     * @return proposedAt Timestamp when proposed
     */
    function getPayment(uint256 paymentId)
        external
        view
        returns (
            address token,
            address to,
            uint256 amount,
            uint256 approvalCount,
            uint256 required,
            bool executed,
            bool cancelled,
            uint256 proposedAt
        )
    {
        PaymentProposal storage proposal = payments[paymentId];
        return (
            proposal.token,
            proposal.to,
            proposal.amount,
            proposal.approvalCount,
            threshold,
            proposal.executed,
            proposal.cancelled,
            proposal.proposedAt
        );
    }

    /**
     * @notice Check if a signer has approved a payment
     * @param paymentId Payment proposal ID
     * @param signer Signer address
     * @return approved Whether signer has approved
     */
    function hasApproved(uint256 paymentId, address signer) external view returns (bool) {
        PaymentProposal storage proposal = payments[paymentId];
        return proposal.approvals[signer];
    }

    /**
     * @notice Get all signers
     *   @return Array of signer addresses
     */
    function getSigners() external view returns (address[] memory) {
        // Return only active signers
        address[] memory activeSigners = new address[](signers.length);
        uint256 count = 0;
        for (uint256 i = 0; i < signers.length; i++) {
            if (isSigner[signers[i]]) {
                activeSigners[count] = signers[i];
                count++;
            }
        }
        // Trim to actual count
        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeSigners[i];
        }
        return result;
    }

    /**
     * @notice Get remaining daily limit
     * @return remaining Amount that can still be paid today
     */
    function getRemainingDailyLimit() external view returns (uint256 remaining) {
        if (dailyLimit == 0) return type(uint256).max;

        uint256 today = _getDay();
        if (today != lastDailyReset) return dailyLimit;

        if (dailyPaid >= dailyLimit) return 0;
        return dailyLimit - dailyPaid;
    }

    /**
     * @notice Get token balance in vault
     * @param token Token address
     * @return balance Token balance
     */
    function getBalance(address token) external view returns (uint256 balance) {
        return ITRC20(token).balanceOf(address(this));
    }

    // ══════════════════════════════════════════════════════════════
    //                    INTERNAL HELPERS
    // ══════════════════════════════════════════════════════════════

    function _getDay() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }

    function _checkDailyLimit(uint256 amount) internal {
        if (dailyLimit == 0) return; // Unlimited

        uint256 day = _getDay();
        if (day != lastDailyReset) {
            emit DailyLimitUpdated(dailyPaid, 0); // Emit reset event
            dailyPaid = 0;
            lastDailyReset = day;
        }

        if (dailyPaid + amount > dailyLimit) {
            revert DailyLimitExceeded(amount, dailyLimit - dailyPaid);
        }
    }
}
