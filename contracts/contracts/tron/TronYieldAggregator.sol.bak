// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./ITRC20.sol";
import "./IJustLend.sol";

/**
 * @title TronYieldAggregator
 * @dev Yield aggregator for TRON blockchain using JustLend protocol
 * @notice Automatically deposits idle merchant funds into JustLend for yield, withdraws on demand
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │            TRON Yield Aggregator Architecture                │
 * ├───────────────────────────────────────────────────────────────┤
 * │  Protocol:  JustLend (TRON's Aave equivalent)                │
 * │  Yield Source: jTokens (interest-bearing tokens)              │
 * │  Supported Tokens: USDT, USDC, TRX, WBTC, WETH, etc.         │
 * │  Features:  Auto-reinvest, Compound interest, Yield tracking   │
 * │  Security:   ReentrancyGuard, Owner controls, Auto-compound   │
 * └───────────────────────────────────────────────────────────────┘
 *
 * @dev Key Features:
 *  1. Auto-Deposit: Users can deposit TRC20 tokens, auto-staked in JustLend
 *  2. Yield Computation: Real-time APY calculation from JustLend rates
 *  3. Balance Tracking: Separate tracking of principal vs interest earned
 *  4. Flexible Withdrawal: Withdraw specific amount or all funds
 *  5. Auto-Reinvest: Compound interest automatically (optional)
 *  6. Merchant Isolation: Each merchant has isolated balance tracking
 *  7. Yield Distribution: Interest can be distributed to multiple addresses
 *
 * @notice JustLend jTokens earn interest by appreciating in exchange rate:
 *  - Deposit 1000 USDT → Get 998 jUSDT (exchange rate = 1.002)
 *  - After 1 year, exchange rate = 1.01
 *  - Redeem 998 jUSDT → Get 1008 USDT (8 USDT interest = 0.8% APY)
 */
contract TronYieldAggregator is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════════════════════
    //                          EVENTS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Emitted when a merchant deposits tokens
     */
    event Deposited(
        address indexed merchant,
        address indexed token,
        uint256 amount,
        uint256 principal,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a merchant withdraws tokens
     */
    event Withdrawn(
        address indexed merchant,
        address indexed token,
        uint256 amount,
        uint256 principal,
        uint256 interest,
        uint256 newPrincipal,
        uint256 timestamp
    );

    /**
     * @notice Emitted when yield is distributed to multiple recipients
     */
    event YieldDistributed(
        address indexed merchant,
        address indexed token,
        uint256 totalInterest,
        uint256 recipientCount,
        uint256 timestamp
    );

    /**
     * @notice Emitted when auto-compound is toggled
     */
    event AutoCompoundToggled(bool enabled);

    /**
     * @notice Emitted when a new supported token is added
     */
    event TokenAdded(address indexed token, address indexed jToken, uint256 exchangeRate);

    /**
     * @notice Emitted when a token is removed
     */
    event TokenRemoved(address indexed token);

    /**
     * @notice Emitted when emergency withdrawal is executed
     */
    event EmergencyWithdrawn(
        address indexed token,
        uint256 amount,
        address indexed to
    );

    /**
     * @notice Emitted when contract is paused
     */
    event ContractPaused();

    /**
     * @notice Emitted when contract is unpaused
     */
    event ContractUnpaused();

    /**
     * @notice Emitted when interest is claimed from JustLend
     */
    event InterestClaimed(
        address indexed token,
        uint256 interestAmount,
        uint256 timestamp
    );

    // ══════════════════════════════════════════════════════════════
    //                          ERRORS
    // ══════════════════════════════════════════════════════════════

    error InvalidAddress();
    error InvalidAmount();
    error InsufficientBalance(uint256 requested, uint256 available);
    error TokenNotSupported(address token);
    error InsufficientPrincipal(uint256 principal, uint256 amount);
    error InvalidRecipientCount();
    error ZeroDeposit();
    error WithdrawalPaused();
    error DepositPaused();
    error NotOwner();
    error NoInterestToDistribute();
    error ArrayLengthMismatch();

    // ══════════════════════════════════════════════════════════════
    //                         STRUCTS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Merchant deposit tracking
     */
    struct MerchantDeposit {
        uint256 principal;     // Original deposit amount (in token decimals)
        uint256 lastUpdated;   // Last update timestamp
        uint256 accruedInterest; // Total interest earned (not yet withdrawn)
        bool isActive;         // Whether merchant has active deposit
    }

    /**
     * @notice Token configuration with JustLend jToken mapping
     */
    struct TokenConfig {
        address token;         // Underlying token address (USDT, USDC, etc.)
        address jToken;        // JustLend jToken address (interest-bearing)
        bool supported;       // Whether token is supported
        uint256 apy;          // Current APY (scaled by 1e18, e.g., 1e17 = 10%)
        uint256 totalDeposited; // Total deposited by all merchants
        uint256 totalInterest;  // Total interest earned by all merchants
    }

    /**
     * @notice Recipient for yield distribution
     */
    struct YieldRecipient {
        address account;       // Recipient address
        uint256 percentage;    // Percentage (in basis points, 10000 = 100%)
        uint256 fixedAmount;   // Fixed amount (if not percentage-based)
    }

    // ══════════════════════════════════════════════════════════════
    //                      STATE VARIABLES
    // ══════════════════════════════════════════════════════════════

    // --- JustLend Integration ---
    IJustLend public justLend;         // JustLend protocol
    IUnitroller public unitroller;     // JustLend Unitroller
    IJustLendPriceOracle public oracle; // Price oracle

    // --- Token Configuration ---
    mapping(address => TokenConfig) public tokenConfigs; // token => TokenConfig
    address[] public supportedTokens;  // List of supported token addresses

    // --- Merchant Deposits ---
    // merchant => token => MerchantDeposit
    mapping(address => mapping(address => MerchantDeposit)) public merchantDeposits;

    // --- Yield Distribution ---
    // merchant => recipients
    mapping(address => YieldRecipient[]) public yieldRecipients;

    // --- Configuration ---
    bool public autoCompoundEnabled; // Auto-reinvest earned interest
    bool public depositPaused;        // Whether deposits are paused
    bool public withdrawalPaused;    // Whether withdrawals are paused

    // --- Statistics ---
    uint256 public totalMerchants;    // Total active merchants
    uint256 public totalValueLocked;  // Total TVL in USD (scaled by 1e18)

    // ══════════════════════════════════════════════════════════════
    //                          MODIFIERS
    // ══════════════════════════════════════════════════════════════

    modifier onlyNotPaused() {
        require(!depositPaused && !withdrawalPaused, "Contract paused");
        _;
    }

    modifier validToken(address token) {
        if (!tokenConfigs[token].supported) revert TokenNotSupported(token);
        _;
    }

    // ══════════════════════════════════════════════════════════════
    //                       CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Initialize the TRON yield aggregator
     * @param _justLend JustLend protocol address
     * @param _unitroller Unitroller address
     * @param _oracle Price oracle address
     * @param _initialTokens Initial supported tokens and jTokens
     * @param _initialJTokens Corresponding jToken addresses
     */
    constructor(
        address _justLend,
        address _unitroller,
        address _oracle,
        address[] memory _initialTokens,
        address[] memory _initialJTokens
    ) Ownable(msg.sender) {
        if (_justLend == address(0) || _unitroller == address(0) || _oracle == address(0)) {
            revert InvalidAddress();
        }

        justLend = IJustLend(_justLend);
        unitroller = IUnitroller(_unitroller);
        oracle = IJustLendPriceOracle(_oracle);

        // Add initial tokens
        if (_initialTokens.length != _initialJTokens.length) {
            revert ArrayLengthMismatch();
        }

        for (uint256 i = 0; i < _initialTokens.length; i++) {
            _addToken(_initialTokens[i], _initialJTokens[i]);
        }

        autoCompoundEnabled = true;
    }

    // ══════════════════════════════════════════════════════════════
    //                    DEPOSIT & WITHDRAW
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Deposit tokens into yield aggregator (auto-staked in JustLend)
     * @param token Token address to deposit
     * @param amount Amount to deposit (in token decimals)
     */
    function deposit(address token, uint256 amount)
        external
        nonReentrant
        whenNotPaused
        validToken(token)
    {
        if (amount == 0) revert ZeroDeposit();
        if (depositPaused) revert DepositPaused();

        TokenConfig storage config = tokenConfigs[token];
        MerchantDeposit storage deposit = merchantDeposits[msg.sender][token];

        // Transfer tokens from user
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Approve JustLend to spend tokens
        IERC20(token).approve(address(justLend), amount);

        // Deposit into JustLend (becomes jTokens)
        uint256 jTokenAmount = justLend.deposit(config.jToken, amount);

        // Update merchant deposit
        if (!deposit.isActive) {
            // First time deposit
            deposit.principal = amount;
            deposit.isActive = true;
            deposit.lastUpdated = block.timestamp;
            totalMerchants++;
        } else {
            // Additional deposit
            deposit.principal += amount;
            deposit.lastUpdated = block.timestamp;
        }

        // Update config stats
        config.totalDeposited += amount;

        // Enter market (enable as collateral)
        address[] memory jTokens = new address[](1);
        jTokens[0] = config.jToken;
        unitroller.enterMarkets(jTokens);

        emit Deposited(msg.sender, token, amount, deposit.principal, block.timestamp);
    }

    /**
     * @notice Withdraw tokens from yield aggregator (redeem from JustLend)
     * @param token Token address to withdraw
     * @param amount Amount to withdraw (in token decimals), 0 = withdraw all
     * @return withdrawnAmount Amount actually withdrawn
     * @return principalAmount Portion of original principal withdrawn
     * @return interestAmount Interest earned portion withdrawn
     */
    function withdraw(address token, uint256 amount)
        external
        nonReentrant
        whenNotPaused
        validToken(token)
        returns (
            uint256 withdrawnAmount,
            uint256 principalAmount,
            uint256 interestAmount
        )
    {
        if (withdrawalPaused) revert WithdrawalPaused();

        TokenConfig storage config = tokenConfigs[token];
        MerchantDeposit storage deposit = merchantDeposits[msg.sender][token];

        if (!deposit.isActive || deposit.principal == 0) {
            revert InsufficientBalance(amount, 0);
        }

        // Get current jToken balance
        IJustToken jTokenContract = IJustToken(config.jToken);
        uint256 jTokenBalance = jTokenContract.balanceOf(address(this));

        if (jTokenBalance == 0) {
            revert InsufficientBalance(amount, 0);
        }

        // Calculate withdrawable amount
        uint256 exchangeRate = jTokenContract.exchangeRateCurrent();
        uint256 underlyingBalance = (jTokenBalance * exchangeRate) / 1e18;

        if (amount == 0 || amount > underlyingBalance) {
            amount = underlyingBalance; // Withdraw all
        }

        // Redee jTokens from JustLend
        uint256 jTokenRedeemAmount = (amount * 1e18) / exchangeRate;
        justLend.redeem(config.jToken, jTokenRedeemAmount);

        // Calculate principal vs interest
        uint256 remainingPrincipal = deposit.principal;
        if (amount >= deposit.principal) {
            principalAmount = deposit.principal;
            interestAmount = amount - principalAmount;
            remainingPrincipal = 0;
        } else {
            principalAmount = amount;
            // Proportional interest
            interestAmount = (deposit.accruedInterest * principalAmount) / deposit.principal;
            remainingPrincipal = deposit.principal - principalAmount;
        }

        // Transfer tokens to user
        IERC20(token).safeTransfer(msg.sender, amount);

        // Update merchant deposit
        deposit.principal = remainingPrincipal;
        deposit.accruedInterest -= interestAmount;
        deposit.lastUpdated = block.timestamp;

        if (remainingPrincipal == 0) {
            deposit.isActive = false;
            totalMerchants--;
        }

        // Update config stats
        config.totalDeposited -= principalAmount;
        config.totalInterest -= interestAmount;

        emit Withdrawn(
            msg.sender,
            token,
            amount,
            principalAmount,
            interestAmount,
            remainingPrincipal,
            block.timestamp
        );

        return (amount, principalAmount, interestAmount);
    }

    // ══════════════════════════════════════════════════════════════
    //                    YIELD MANAGEMENT
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Calculate merchant's balance (principal + interest)
     * @param merchant Merchant address
     * @param token Token address
     * @return balance Total balance (principal + accrued interest)
     * @return principal Principal amount
     * @return interest Accrued interest
     */
    function getMerchantBalance(address merchant, address token)
        external
        view
        validToken(token)
        returns (
            uint256 balance,
            uint256 principal,
            uint256 interest
        )
    {
        MerchantDeposit storage deposit = merchantDeposits[merchant][token];

        if (!deposit.isActive) {
            return (0, 0, 0);
        }

        // Get current exchange rate
        TokenConfig storage config = tokenConfigs[token];
        IJustToken jTokenContract = IJustToken(config.jToken);
        uint256 exchangeRate = jTokenContract.exchangeRateCurrent();

        // Estimate current value
        // Note: This is an estimate because jToken balance is shared across all merchants
        uint256 jTokenBalance = jTokenContract.balanceOf(address(this));
        uint256 totalUnderlying = (jTokenBalance * exchangeRate) / 1e18;
        uint256 totalPrincipal = config.totalDeposited;

        uint256 merchantShare = 0;
        if (totalPrincipal > 0) {
            merchantShare = (totalUnderlying * deposit.principal) / totalPrincipal;
        }

        uint256 currentPrincipal = deposit.principal;
        uint256 currentInterest = 0;

        if (merchantShare > currentPrincipal) {
            currentInterest = merchantShare - currentPrincipal;
        }

        return (merchantShare, currentPrincipal, currentInterest);
    }

    /**
     * @notice Get current APY for a token
     * @param token Token address
     * @return apy Current APY (scaled by 1e18)
     * @return exchangeRate Current exchange rate
     */
    function getTokenAPY(address token)
        external
        view
        validToken(token)
        returns (uint256 apy, uint256 exchangeRate)
    {
        TokenConfig storage config = tokenConfigs[token];
        IJustToken jTokenContract = IJustToken(config.jToken);

        // Get supply rate per block
        uint256 supplyRatePerBlock = jTokenContract.supplyRatePerBlock();

        // Convert to APY (assuming TRON blocks = 3 seconds, ~10,512,000 blocks/year)
        // APY = (1 + rate/blocks_per_year)^blocks_per_year - 1
        // Simplified: APY ≈ rate * blocks_per_year
        uint256 blocksPerYear = 10512000; // 3 seconds per block
        uint256 apyCalculated = (supplyRatePerBlock * blocksPerYear) / 1e18;

        return (apyCalculated, jTokenContract.exchangeRateCurrent());
    }

    /**
     * @notice Distribute accrued interest to multiple recipients
     * @param token Token address
     * @param recipients Array of recipients
     */
    function distributeYield(
        address token,
        YieldRecipient[] memory recipients
    ) external nonReentrant validToken(token) {
        MerchantDeposit storage deposit = merchantDeposits[msg.sender][token];

        if (!deposit.isActive || deposit.accruedInterest == 0) {
            revert NoInterestToDistribute();
        }

        uint256 totalInterest = deposit.accruedInterest;
        if (totalInterest == 0) revert NoInterestToDistribute();

        // Calculate shares for each recipient
        uint256 totalPercentage = 0;
        uint256 totalFixedAmount = 0;

        for (uint256 i = 0; i < recipients.length; i++) {
            totalPercentage += recipients[i].percentage;
            totalFixedAmount += recipients[i].fixedAmount;
        }

        // Determine distribution mode
        bool percentageMode = totalPercentage == 10000 && totalFixedAmount == 0;

        uint256 remaining = totalInterest;

        // Transfer to recipients
        for (uint256 i = 0; i < recipients.length; i++) {
            YieldRecipient memory recipient = recipients[i];

            uint256 share;
            if (percentageMode) {
                // Percentage-based distribution
                share = (totalInterest * recipient.percentage) / 10000;
            } else if (totalFixedAmount > 0) {
                // Fixed amount distribution
                share = recipient.fixedAmount;
            } else {
                share = 0;
            }

            if (share > 0 && share <= remaining) {
                // Redee from JustLend to get tokens
                TokenConfig storage config = tokenConfigs[token];
                IJustToken jTokenContract = IJustToken(config.jToken);
                uint256 exchangeRate = jTokenContract.exchangeRateCurrent();
                uint256 jTokenRedeemAmount = (share * 1e18) / exchangeRate;

                justLend.redeem(config.jToken, jTokenRedeemAmount);

                // Transfer to recipient
                IERC20(token).safeTransfer(recipient.account, share);
                remaining -= share;
            }
        }

        // Update merchant deposit
        deposit.accruedInterest = 0;

        emit YieldDistributed(msg.sender, token, totalInterest, recipients.length, block.timestamp);
    }

    /**
     * @notice Set yield recipients for a merchant
     * @param token Token address
     * @param recipients Array of recipients
     */
    function setYieldRecipients(
        address token,
        YieldRecipient[] memory recipients
    ) external validToken(token) {
        MerchantDeposit storage deposit = merchantDeposits[msg.sender][token];

        if (!deposit.isActive) revert InsufficientBalance(0, 0);

        delete yieldRecipients[msg.sender];

        for (uint256 i = 0; i < recipients.length; i++) {
            yieldRecipients[msg.sender].push(recipients[i]);
        }
    }

    // ══════════════════════════════════════════════════════════════
    //                    ADMIN FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Add a supported token
     * @param token Token address
     * @param jToken Corresponding jToken address
     */
    function addToken(address token, address jToken) external onlyOwner {
        _addToken(token, jToken);
    }

    /**
     * @notice Remove a supported token
     * @param token Token address
     */
    function removeToken(address token) external onlyOwner {
        TokenConfig storage config = tokenConfigs[token];

        if (!config.supported) revert TokenNotSupported(token);

        config.supported = false;

        // Remove from array
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == token) {
                supportedTokens[i] = supportedTokens[supportedTokens.length - 1];
                supportedTokens.pop();
                break;
            }
        }

        emit TokenRemoved(token);
    }

    /**
     * @notice Toggle auto-compound
     * @param enabled Whether to enable auto-compound
     */
    function toggleAutoCompound(bool enabled) external onlyOwner {
        autoCompoundEnabled = enabled;
        emit AutoCompoundToggled(enabled);
    }

    /**
     * @notice Pause deposits
     */
    function pauseDeposits() external onlyOwner {
        depositPaused = true;
        emit ContractPaused();
    }

    /**
     * @notice Unpause deposits
     */
    function unpauseDeposits() external onlyOwner {
        depositPaused = false;
        emit ContractUnpaused();
    }

    /**
     * @notice Pause withdrawals
     */
    function pauseWithdrawals() external onlyOwner {
        withdrawalPaused = true;
        emit ContractPaused();
    }

    /**
     * @notice Unpause withdrawals
     */
    function unpauseWithdrawals() external onlyOwner {
        withdrawalPaused = false;
        emit ContractUnpaused();
    }

    /**
     * @notice Emergency withdraw tokens from contract
     * @param token Token address
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance < amount) revert InsufficientBalance(amount, balance);

        IERC20(token).safeTransfer(to, amount);
        emit EmergencyWithdrawn(token, amount, to);
    }

    /**
     * @notice Update APY for a token (manual override)
     * @param token Token address
     * @param apy New APY (scaled by 1e18)
     */
    function updateAPY(address token, uint256 apy) external onlyOwner validToken(token) {
        tokenConfigs[token].apy = apy;
    }

    /**
     * @notice Update JustLend addresses
     * @param _justLend New JustLend address
     * @param _unitroller New Unitroller address
     * @param _oracle New oracle address
     */
    function updateJustLendAddresses(
        address _justLend,
        address _unitroller,
        address _oracle
    ) external onlyOwner {
        justLend = IJustLend(_justLend);
        unitroller = IUnitroller(_unitroller);
        oracle = IJustLendPriceOracle(_oracle);
    }

    // ══════════════════════════════════════════════════════════════
    //                      VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Get all supported tokens
     * @return tokens Array of supported token addresses
     */
    function getSupportedTokens() external view returns (address[] memory tokens) {
        return supportedTokens;
    }

    /**
     * @notice Get token configuration
     * @param token Token address
     * @return tokenAddress The token address
     * @return jTokenAddress The jToken address
     * @return supported Whether the token is supported
     * @return apy The APY for the token
     */
    function getTokenConfig(address token)
        external
        view
        returns (
            address tokenAddress,
            address jTokenAddress,
            bool supported,
            uint256 apy
        )
    {
        TokenConfig storage config = tokenConfigs[token];
        return (config.token, config.jToken, config.supported, config.apy);
    }

    /**
     * @notice Get merchant yield recipients
     * @param merchant Merchant address
     * @return recipients Array of yield recipients
     */
    function getYieldRecipients(address merchant)
        external
        view
        returns (YieldRecipient[] memory recipients)
    {
        return yieldRecipients[merchant];
    }

    /**
     * @notice Get contract TVL in USD
     * @return tvl Total value locked (scaled by 1e18)
     */
    function getTVL() public view returns (uint256 tvl) {
        uint256 totalUsd = 0;

        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            TokenConfig storage config = tokenConfigs[token];

            if (!config.supported) continue;

            // Get jToken balance
            IJustToken jTokenContract = IJustToken(config.jToken);
            uint256 jTokenBalance = jTokenContract.balanceOf(address(this));

            // Convert to underlying
            uint256 exchangeRate = jTokenContract.exchangeRateCurrent();
            uint256 underlyingBalance = (jTokenBalance * exchangeRate) / 1e18;

            // Get price from oracle
            if (address(oracle) != address(0)) {
                uint256 price = oracle.getUnderlyingPrice(config.jToken);
                totalUsd += (underlyingBalance * price) / 1e18;
            }
        }

        return totalUsd;
    }

    /**
     * @notice Get total deposits for all merchants
     * @param token Token address
     * @return totalDeposits Total deposits by all merchants
     */
    function getTotalDeposits(address token)
        external
        view
        validToken(token)
        returns (uint256 totalDeposits)
    {
        return tokenConfigs[token].totalDeposited;
    }

    /**
     * @notice Get total interest earned by all merchants
     * @param token Token address
     * @return totalInterest Total interest earned
     */
    function getTotalInterest(address token)
        external
        view
        validToken(token)
        returns (uint256 totalInterest)
    {
        return tokenConfigs[token].totalInterest;
    }

    /**
     * @notice Get all active merchants
     * @return merchantCount Number of active merchants
     */
    function getActiveMerchantCount() external view returns (uint256 merchantCount) {
        return totalMerchants;
    }

    /**
     * @notice Get contract statistics
     * @return activeMerchants Number of active merchants
     * @return supportedTokenCount Number of supported tokens
     * @return tvl Total value locked
     * @return autoCompound Whether auto-compound is enabled
     * @return depositsPaused Whether deposits are paused
     * @return withdrawalsPaused Whether withdrawals are paused
     */
    function getStats()
        external
        view
        returns (
            uint256 activeMerchants,
            uint256 supportedTokenCount,
            uint256 tvl,
            bool autoCompound,
            bool depositsPaused,
            bool withdrawalsPaused
        )
    {
        return (
            totalMerchants,
            supportedTokens.length,
            getTVL(),
            autoCompoundEnabled,
            depositPaused,
            withdrawalPaused
        );
    }

    // ══════════════════════════════════════════════════════════════
    //                    INTERNAL HELPERS
    // ══════════════════════════════════════════════════════════════

    function _addToken(address token, address jToken) internal {
        if (token == address(0) || jToken == address(0)) revert InvalidAddress();

        TokenConfig storage config = tokenConfigs[token];

        if (config.supported) {
            // Token already exists, just update jToken
            config.jToken = jToken;
        } else {
            // New token
            config.token = token;
            config.jToken = jToken;
            config.supported = true;
            config.apy = 0;
            supportedTokens.push(token);
        }

        emit TokenAdded(token, jToken, config.apy);
    }
}
