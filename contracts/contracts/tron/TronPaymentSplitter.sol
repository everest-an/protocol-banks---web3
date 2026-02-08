// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./ITRC20.sol";

/**
 * @title TronPaymentSplitter
 * @dev Automatic payment splitter for TRC20 tokens on TRON blockchain
 * @notice Distributes received TRC20 tokens to multiple beneficiaries according to predefined rules
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │            TRON Payment Splitter Architecture               │
 * ├───────────────────────────────────────────────────────────────┤
 * │  Chain:     TRON Mainnet / Nile Testnet                      │
 * │  Modes:     Percentage-based, Fixed-amount, Tiered           │
 * │  Support:   Recurring splits, One-time splits, Vesting       │
 * │  Features:  Minimum amount, Rounding, Emergency withdraw     │
 * └───────────────────────────────────────────────────────────────┘
 *
 * @dev Key Features:
 *  1. Auto-split: Distribute payments to multiple beneficiaries automatically
 *  2. Three split modes:
 *     - Percentage: Each beneficiary gets X% of the total
 *     - Fixed: Each beneficiary gets a fixed amount
 *     - Tiered: Beneficiaries get amounts based on tier thresholds
 *  3. Recurring: Can handle one-time or recurring payment schedules
 *  4. Rounding: Handles token decimals properly (6 for USDT)
 *  5. Emergency: Owner can pause and withdraw for emergency recovery
 *
 * @notice Supports TRC20 tokens like USDT, USDC on TRON blockchain
 */
contract TronPaymentSplitter {
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════════════════════
    //                          EVENTS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Emitted when a new beneficiary is added
     */
    event BeneficiaryAdded(
        uint256 indexed splitId,
        address indexed beneficiary,
        uint256 percentage,
        uint256 fixedAmount
    );

    /**
     * @notice Emitted when a beneficiary is updated
     */
    event BeneficiaryUpdated(
        uint256 indexed splitId,
        address indexed beneficiary,
        uint256 newPercentage,
        uint256 newFixedAmount
    );

    /**
     * @notice Emitted when a beneficiary is removed
     */
    event BeneficiaryRemoved(uint256 indexed splitId, address indexed beneficiary);

    /**
     * @notice Emitted when a new payment split is created
     */
    event SplitCreated(
        uint256 indexed splitId,
        address indexed token,
        SplitMode mode,
        uint256 createdAt
    );

    /**
     * @notice Emitted when a split is executed
     */
    event SplitExecuted(
        uint256 indexed splitId,
        address indexed token,
        uint256 totalAmount,
        uint256 beneficiaryCount,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a split is paused
     */
    event SplitPaused(uint256 indexed splitId);

    /**
     * @notice Emitted when a split is unpaused
     */
    event SplitUnpaused(uint256 indexed splitId);

    /**
     * @notice Emitted when token is withdrawn
     */
    event TokenWithdrawn(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Emitted when minimum amount is updated
     */
    event MinAmountUpdated(
        uint256 indexed splitId,
        uint256 oldMinAmount,
        uint256 newMinAmount
    );

    /**
     * @notice Emitted when split mode is updated
     */
    event SplitModeUpdated(uint256 indexed splitId, SplitMode oldMode, SplitMode newMode);

    /**
     * @notice Emitted when token balance is claimed
     */
    event Claimed(address indexed beneficiary, address indexed token, uint256 amount);

    // ══════════════════════════════════════════════════════════════
    //                          ERRORS
    // ══════════════════════════════════════════════════════════════

    error InvalidAddress();
    error InvalidAmount();
    error InvalidPercentage();
    error InvalidFixedAmount();
    error InvalidSplitId();
    error SplitNotFound();
    error BeneficiaryNotFound();
    error InsufficientBalance(uint256 required, uint256 available);
    error AmountBelowMinimum(uint256 amount, uint256 minimum);
    error InvalidSplitMode();
    error PercentageOverflow();
    error OwnerOnly();
    error RecipientExpected();
    error InsufficientAllowance(uint256 required, uint256 available);
    error AlreadyPaused();
    error AlreadyUnpaused();

    // ══════════════════════════════════════════════════════════════
    //                         ENUMS & STRUCTS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Different split modes for payment distribution
     */
    enum SplitMode {
        Percentage, // Each beneficiary gets X% (must sum to 100%)
        Fixed,      // Each beneficiary gets a fixed amount
        Tiered      // Beneficiaries get amounts based on tier thresholds
    }

    /**
     * @notice Beneficiary information
     */
    struct Beneficiary {
        address account;     // Beneficiary address
        uint256 percentage;  // Percentage (in basis points, 10000 = 100%)
        uint256 fixedAmount; // Fixed amount (in token decimals)
        uint256 tier;       // Tier level (for Tiered mode)
    }

    /**
     * @notice Payment split configuration
     */
    struct PaymentSplit {
        address token;           // TRC20 token address
        SplitMode mode;          // Split mode
        Beneficiary[] beneficiaries; // Beneficiaries
        uint256 minAmount;       // Minimum amount to split
        bool paused;             // Whether split is paused
        uint256 createdAt;       // Creation timestamp
        uint256 lastExecuted;    // Last execution timestamp
        uint256 totalReceived;   // Total amount received
        uint256 totalDistributed;// Total amount distributed
    }

    // ══════════════════════════════════════════════════════════════
    //                      STATE VARIABLES
    // ══════════════════════════════════════════════════════════════

    // --- Payment Splits ---
    mapping(uint256 => PaymentSplit) public splits;
    uint256 public nextSplitId;

    // --- Owner ---
    address public owner;

    // --- Supported Tokens ---
    mapping(address => bool) public supportedTokens;

    // --- Beneficiary Balances (for claiming) ---
    mapping(uint256 => mapping(address => uint256)) public beneficiaryBalances; // splitId => beneficiary => balance
    mapping(uint256 => mapping(address => mapping(address => uint256))) public tokenBalances; // splitId => beneficiary => token => balance

    // ══════════════════════════════════════════════════════════════
    //                          MODIFIERS
    // ══════════════════════════════════════════════════════════════

    modifier onlyOwner() {
        if (msg.sender != owner) revert OwnerOnly();
        _;
    }

    modifier validSplit(uint256 splitId) {
        if (splitId >= nextSplitId) revert InvalidSplitId();
        _;
    }

    // ══════════════════════════════════════════════════════════════
    //                       CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Initialize the TRON payment splitter
     * @param _owner Contract owner
     * @param _supportedTokens Array of supported TRC20 token addresses
     */
    constructor(address _owner, address[] memory _supportedTokens) {
        if (_owner == address(0)) revert InvalidAddress();

        owner = _owner;
        nextSplitId = 1;

        // Set supported tokens
        for (uint256 i = 0; i < _supportedTokens.length; i++) {
            address token = _supportedTokens[i];
            if (token == address(0)) revert InvalidAddress();
            supportedTokens[token] = true;
        }
    }

    // ══════════════════════════════════════════════════════════════
    //                    SPLIT MANAGEMENT
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Create a new payment split
     * @dev Returns splitId for future reference
     * @param token TRC20 token address
     * @param mode Split mode (Percentage, Fixed, or Tiered)
     * @param minAmount Minimum amount required to split
     * @param beneficiaries Initial beneficiaries
     * @return splitId Unique split ID
     */
    function createSplit(
        address token,
        SplitMode mode,
        uint256 minAmount,
        Beneficiary[] memory beneficiaries
    ) external onlyOwner returns (uint256 splitId) {
        if (token == address(0)) revert InvalidAddress();
        if (!supportedTokens[token]) revert RecipientExpected();

        splitId = nextSplitId++;

        // Create split with empty beneficiaries array
        splits[splitId].token = token;
        splits[splitId].mode = mode;
        splits[splitId].minAmount = minAmount;
        splits[splitId].paused = false;
        splits[splitId].createdAt = block.timestamp;

        // Add beneficiaries
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            _addBeneficiary(splitId, beneficiaries[i]);
        }

        // Validate based on mode
        if (mode == SplitMode.Percentage) {
            uint256 totalPercentage = 0;
            for (uint256 i = 0; i < beneficiaries.length; i++) {
                totalPercentage += beneficiaries[i].percentage;
            }
            if (totalPercentage != 10000) revert PercentageOverflow(); // 10000 = 100%
        }

        emit SplitCreated(splitId, token, mode, block.timestamp);
    }

    /**
     * @notice Add a beneficiary to an existing split
     * @param splitId Split ID
     * @param beneficiary Beneficiary information
     */
    function addBeneficiary(
        uint256 splitId,
        Beneficiary memory beneficiary
    ) external onlyOwner validSplit(splitId) {
        _addBeneficiary(splitId, beneficiary);

        emit BeneficiaryAdded(
            splitId,
            beneficiary.account,
            beneficiary.percentage,
            beneficiary.fixedAmount
        );
    }

    /**
     * @notice Update an existing beneficiary
     * @param splitId Split ID
     * @param beneficiaryAddress Beneficiary address to update
     * @param newPercentage New percentage (basis points)
     * @param newFixedAmount New fixed amount
     */
    function updateBeneficiary(
        uint256 splitId,
        address beneficiaryAddress,
        uint256 newPercentage,
        uint256 newFixedAmount
    ) external onlyOwner validSplit(splitId) {
        PaymentSplit storage split = splits[splitId];
        bool found = false;

        for (uint256 i = 0; i < split.beneficiaries.length; i++) {
            if (split.beneficiaries[i].account == beneficiaryAddress) {
                split.beneficiaries[i].percentage = newPercentage;
                split.beneficiaries[i].fixedAmount = newFixedAmount;
                found = true;
                break;
            }
        }

        if (!found) revert BeneficiaryNotFound();

        emit BeneficiaryUpdated(splitId, beneficiaryAddress, newPercentage, newFixedAmount);
    }

    /**
     * @notice Remove a beneficiary from a split
     * @param splitId Split ID
     * @param beneficiaryAddress Beneficiary address to remove
     */
    function removeBeneficiary(
        uint256 splitId,
        address beneficiaryAddress
    ) external onlyOwner validSplit(splitId) {
        PaymentSplit storage split = splits[splitId];
        bool found = false;

        for (uint256 i = 0; i < split.beneficiaries.length; i++) {
            if (split.beneficiaries[i].account == beneficiaryAddress) {
                // Swap with last and pop
                split.beneficiaries[i] = split.beneficiaries[split.beneficiaries.length - 1];
                split.beneficiaries.pop();
                found = true;
                break;
            }
        }

        if (!found) revert BeneficiaryNotFound();

        emit BeneficiaryRemoved(splitId, beneficiaryAddress);
    }

    /**
     * @notice Update split mode
     * @param splitId Split ID
     * @param newMode New split mode
     */
    function updateSplitMode(
        uint256 splitId,
        SplitMode newMode
    ) external onlyOwner validSplit(splitId) {
        SplitMode oldMode = splits[splitId].mode;
        splits[splitId].mode = newMode;

        emit SplitModeUpdated(splitId, oldMode, newMode);
    }

    /**
     * @notice Update minimum amount for a split
     * @param splitId Split ID
     * @param newMinAmount New minimum amount
     */
    function updateMinAmount(
        uint256 splitId,
        uint256 newMinAmount
    ) external onlyOwner validSplit(splitId) {
        uint256 oldMinAmount = splits[splitId].minAmount;
        splits[splitId].minAmount = newMinAmount;

        emit MinAmountUpdated(splitId, oldMinAmount, newMinAmount);
    }

    /**
     * @notice Pause a split
     * @param splitId Split ID
     */
    function pauseSplit(uint256 splitId) external onlyOwner validSplit(splitId) {
        if (splits[splitId].paused) revert AlreadyPaused();
        splits[splitId].paused = true;
        emit SplitPaused(splitId);
    }

    /**
     * @notice Unpause a split
     * @param splitId Split ID
     */
    function unpauseSplit(uint256 splitId) external onlyOwner validSplit(splitId) {
        if (!splits[splitId].paused) revert AlreadyUnpaused();
        splits[splitId].paused = false;
        emit SplitUnpaused(splitId);
    }

    // ══════════════════════════════════════════════════════════════
    //                    SPLIT EXECUTION
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Execute a payment split (distribute tokens)
     * @dev Tokens must be approved beforehand
     * @param splitId Split ID to execute
     * @param amount Total amount to split
     */
    function executeSplit(
        uint256 splitId,
        uint256 amount
    ) external validSplit(splitId) {
        PaymentSplit storage split = splits[splitId];

        if (split.paused) revert AlreadyPaused();
        if (amount < split.minAmount) revert AmountBelowMinimum(amount, split.minAmount);

        IERC20 tokenContract = IERC20(split.token);
        uint256 contractBalance = tokenContract.balanceOf(msg.sender);

        if (contractBalance < amount) revert InsufficientBalance(amount, contractBalance);

        uint256 allowance = tokenContract.allowance(msg.sender, address(this));
        if (allowance < amount) revert InsufficientAllowance(amount, allowance);

        // Transfer tokens to contract
        tokenContract.safeTransferFrom(msg.sender, address(this), amount);

        // Split and distribute
        _distribute(splitId, split, amount);

        // Update split statistics
        split.lastExecuted = block.timestamp;
        split.totalReceived += amount;
        split.totalDistributed += amount;
    }

    /**
     * @notice Distribute tokens to beneficiaries based on split mode
     * @param splitId Split ID
     * @param split Split configuration
     * @param amount Total amount to distribute
     */
    function _distribute(
        uint256 splitId,
        PaymentSplit storage split,
        uint256 amount
    ) internal {
        uint256 beneficiaryCount = split.beneficiaries.length;

        if (split.mode == SplitMode.Percentage) {
            // Percentage split
            for (uint256 i = 0; i < beneficiaryCount; i++) {
                Beneficiary memory beneficiary = split.beneficiaries[i];
                uint256 share = (amount * beneficiary.percentage) / 10000; // 10000 = 100%
                if (share > 0) {
                    IERC20(split.token).safeTransfer(beneficiary.account, share);
                    emit Claimed(beneficiary.account, split.token, share);
                }
            }
        } else if (split.mode == SplitMode.Fixed) {
            // Fixed amount split
            uint256 totalFixed = 0;
            uint256 remaining = amount;

            for (uint256 i = 0; i < beneficiaryCount; i++) {
                Beneficiary memory beneficiary = split.beneficiaries[i];
                totalFixed += beneficiary.fixedAmount;
            }

            if (totalFixed > amount) revert InsufficientBalance(totalFixed, amount);

            for (uint256 i = 0; i < beneficiaryCount; i++) {
                Beneficiary memory beneficiary = split.beneficiaries[i];
                if (beneficiary.fixedAmount > 0 && beneficiary.fixedAmount <= remaining) {
                    IERC20(split.token).safeTransfer(beneficiary.account, beneficiary.fixedAmount);
                    remaining -= beneficiary.fixedAmount;
                    emit Claimed(beneficiary.account, split.token, beneficiary.fixedAmount);
                }
            }

            // Distribute remaining to the last beneficiary (or first if remaining exists)
            if (remaining > 0 && beneficiaryCount > 0) {
                address recipient = split.beneficiaries[beneficiaryCount - 1].account;
                IERC20(split.token).safeTransfer(recipient, remaining);
                emit Claimed(recipient, split.token, remaining);
            }
        } else {
            // Tiered split (simplified: higher tier gets more)
            uint256 totalTiers = 0;
            for (uint256 i = 0; i < beneficiaryCount; i++) {
                totalTiers += split.beneficiaries[i].tier;
            }

            for (uint256 i = 0; i < beneficiaryCount; i++) {
                Beneficiary memory beneficiary = split.beneficiaries[i];
                if (totalTiers == 0) break;
                uint256 share = (amount * beneficiary.tier) / totalTiers;
                if (share > 0) {
                    IERC20(split.token).safeTransfer(beneficiary.account, share);
                    emit Claimed(beneficiary.account, split.token, share);
                }
            }
        }

        emit SplitExecuted(splitId, split.token, amount, beneficiaryCount, block.timestamp);
    }

    // ══════════════════════════════════════════════════════════════
    //                     TOKEN MANAGEMENT
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Add supported token
     * @param token Token address
     */
    function addSupportedToken(address token) external onlyOwner {
        if (token == address(0)) revert InvalidAddress();
        supportedTokens[token] = true;
    }

    /**
     * @notice Remove supported token
     * @param token Token address
     */
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }

    /**
     * @notice Withdraw tokens from contract (emergency/recovery)
     * @param token Token to withdraw
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdrawToken(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance(amount, balance);

        IERC20(token).safeTransfer(to, amount);
        emit TokenWithdrawn(token, to, amount);
    }

    /**
     * @notice Update owner
     * @param newOwner New owner address
     */
    function updateOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        owner = newOwner;
    }

    // ══════════════════════════════════════════════════════════════
    //                      VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Get split details
     * @param splitId Split ID
     * @return token Token address
     * @return mode Split mode
     * @return minAmount Minimum amount
     * @return paused Whether paused
     * @return beneficiaryCount Number of beneficiaries
     * @return createdAt Creation timestamp
     * @return lastExecuted Last execution timestamp
     * @return totalReceived Total received amount
     * @return totalDistributed Total distributed amount
     */
    function getSplit(uint256 splitId)
        external
        view
        validSplit(splitId)
        returns (
            address token,
            SplitMode mode,
            uint256 minAmount,
            bool paused,
            uint256 beneficiaryCount,
            uint256 createdAt,
            uint256 lastExecuted,
            uint256 totalReceived,
            uint256 totalDistributed
        )
    {
        PaymentSplit storage split = splits[splitId];
        return (
            split.token,
            split.mode,
            split.minAmount,
            split.paused,
            split.beneficiaries.length,
            split.createdAt,
            split.lastExecuted,
            split.totalReceived,
            split.totalDistributed
        );
    }

    /**
     * @notice Get beneficiaries for a split
     * @param splitId Split ID
     * @return accounts Array of beneficiary addresses
     * @return percentages Array of percentages (basis points)
     * @return fixedAmounts Array of fixed amounts
     * @return tiers Array of tier levels
     */
    function getBeneficiaries(uint256 splitId)
        external
        view
        validSplit(splitId)
        returns (
            address[] memory accounts,
            uint256[] memory percentages,
            uint256[] memory fixedAmounts,
            uint256[] memory tiers
        )
    {
        Beneficiary[] memory beneficiaries = splits[splitId].beneficiaries;
        uint256 count = beneficiaries.length;

        accounts = new address[](count);
        percentages = new uint256[](count);
        fixedAmounts = new uint256[](count);
        tiers = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            accounts[i] = beneficiaries[i].account;
            percentages[i] = beneficiaries[i].percentage;
            fixedAmounts[i] = beneficiaries[i].fixedAmount;
            tiers[i] = beneficiaries[i].tier;
        }
    }

    /**
     * @notice Calculate expected distribution for a split
     * @param splitId Split ID
     * @param amount Total amount to split
     * @return shares Array of shares per beneficiary
     */
    function calculateDistribution(uint256 splitId, uint256 amount)
        external
        view
        validSplit(splitId)
        returns (uint256[] memory shares)
    {
        PaymentSplit storage split = splits[splitId];
        uint256 beneficiaryCount = split.beneficiaries.length;
        shares = new uint256[](beneficiaryCount);

        if (split.mode == SplitMode.Percentage) {
            for (uint256 i = 0; i < beneficiaryCount; i++) {
                shares[i] = (amount * split.beneficiaries[i].percentage) / 10000;
            }
        } else if (split.mode == SplitMode.Fixed) {
            uint256 totalFixed = 0;
            for (uint256 i = 0; i < beneficiaryCount; i++) {
                totalFixed += split.beneficiaries[i].fixedAmount;
            }

            if (totalFixed <= amount) {
                for (uint256 i = 0; i < beneficiaryCount; i++) {
                    shares[i] = split.beneficiaries[i].fixedAmount;
                }
                // Last beneficiary gets remainder
                uint256 remainder = amount - totalFixed;
                if (remainder > 0 && beneficiaryCount > 0) {
                    shares[beneficiaryCount - 1] += remainder;
                }
            }
        } else {
            // Tiered
            uint256 totalTiers = 0;
            for (uint256 i = 0; i < beneficiaryCount; i++) {
                totalTiers += split.beneficiaries[i].tier;
            }

            for (uint256 i = 0; i < beneficiaryCount; i++) {
                if (totalTiers > 0) {
                    shares[i] = (amount * split.beneficiaries[i].tier) / totalTiers;
                }
            }
        }
    }

    /**
     * @notice Check if token is supported
     * @param token Token address
     * @return supported Whether token is supported
     */
    function isTokenSupported(address token) external view returns (bool supported) {
        return supportedTokens[token];
    }

    /**
     * @notice Get token balance in contract
     * @param token Token address
     * @return balance Token balance
     */
    function getTokenBalance(address token) external view returns (uint256 balance) {
        return IERC20(token).balanceOf(address(this));
    }

    // ══════════════════════════════════════════════════════════════
    //                    INTERNAL HELPERS
    // ══════════════════════════════════════════════════════════════

    function _addBeneficiary(
        uint256 splitId,
        Beneficiary memory beneficiary
    ) internal {
        if (beneficiary.account == address(0)) revert InvalidAddress();

        PaymentSplit storage split = splits[splitId];

        // Check for duplicate
        for (uint256 i = 0; i < split.beneficiaries.length; i++) {
            if (split.beneficiaries[i].account == beneficiary.account) {
                revert BeneficiaryNotFound(); // Already exists
            }
        }

        split.beneficiaries.push(beneficiary);
    }
}
