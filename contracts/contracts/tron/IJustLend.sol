// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IJustLend
 * @dev Interface for JustLend protocol on TRON blockchain
 * @notice JustLend is TRON's largest lending protocol (similar to Aave on Ethereum)
 *
 * ┌───────────────────────────────────────────────────────────────┐
 * │            JustLend Protocol Architecture                    │
 * ├───────────────────────────────────────────────────────────────┤
 * │  Type:     Decentralized Lending & Borrowing Protocol         │
 * │  Chain:    TRON Mainnet                                      │
 * │  Tokens:   TRX, USDT, USDC, WBTC, WETH, etc.                │
 * │  Features: Collateralized loans, Interest bearing tokens      │
 * │  Docs:     https://justlend.org                             │
 * └───────────────────────────────────────────────────────────────┘
 *
 * @dev JustLend uses jToken (Interest bearing tokens) similar to aTokens on Aave
 *  - Deposit: TRX/USDT → exchangeRate jTRX/jUSDT
 *  - Borrow: Collateral → Borrow TRX/USDT (with interest)
 *  - Withdraw: jTRX/jUSDT → TRX/USDT + accrued interest
 *  - Repay: TRX/USDT → Reduce debt
 */
interface IJustLend {
    /**
     * @notice Deposit tokens into JustLend and receive jTokens
     * @param jToken The jToken address to deposit
     * @param underlyingAmount The amount of underlying tokens to deposit
     * @return The jToken amount received
     */
    function deposit(address jToken, uint256 underlyingAmount) external returns (uint256);

    /**
     * @notice Redeem jTokens for underlying tokens
     * @param jToken The jToken address to redeem
     * @param jTokenAmount The amount of jTokens to redeem
     * @return The underlying token amount received
     */
    function redeem(address jToken, uint256 jTokenAmount) external returns (uint256);

    /**
     * @notice Redeem all jTokens for underlying tokens
     * @param jToken The jToken address to redeem
     * @return The underlying token amount received
     */
    function redeemAll(address jToken) external returns (uint256);

    /**
     * @notice Borrow tokens with collateral
     * @param jToken The jToken (as collateral) to borrow from market
     * @param borrowAmount The amount to borrow
     */
    function borrow(address jToken, uint256 borrowAmount) external;

    /**
     * @notice Repay borrowed tokens
     * @param jToken The jToken to repay
     * @param repayAmount The amount to repay
     */
    function repayBorrow(address jToken, uint256 repayAmount) external;

    /**
     * @notice Enter markets (collateralize tokens)
     * @param jTokens Array of jToken addresses to enter as collateral
     */
    function enterMarkets(address[] memory jTokens) external;

    /**
     * @notice Exit markets (remove collateral)
     * @param jToken The jToken to exit from
     */
    function exitMarket(address jToken) external;

    /**
     * @notice Get account liquidity (borrowing power)
     * @param account Account address
     * @return accountLiquidity Account liquidity
     * @return accountShortfall Account shortfall if any
     */
    function getAccountLiquidity(address account)
        external
        view
        returns (
            uint256 accountLiquidity,
            uint256 accountShortfall
        );

    /**
     * @notice Get claimable COMP (JustLend governance token)
     * @param account Account address
     * @return Claimable COMP amount
     */
    function claimComp(address account) external returns (uint256);
}

/**
 * @title IJustToken
 * @dev Interface for JustLend interest-bearing tokens (jTokens)
 * @notice Similar to aTokens on Aave: jTokens earn interest by accruing exchange rate
 */
interface IJustToken {
    /**
     * @notice Underlying asset address
     */
    function underlying() external view returns (address);

    /**
     * @notice Get account balance (including accrued interest)
     * @param account Account address
     * @return jToken balance
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @notice Get exchange rate (jToken ↔ underlying)
     * @return Exchange rate (scaled by 1e18)
     */
    function exchangeRateCurrent() external view returns (uint256);

    /**
     * @notice Get exchange rate stored (not updated)
     * @return Exchange rate (scaled by 1e18)
     */
    function exchangeRateStored() external view returns (uint256);

    /**
     * @notice Supply APY (annual percentage yield)
     * @return Supply APY (scaled by 1e18)
     */
    function supplyRatePerBlock() external view returns (uint256);

    /**
     * @notice Borrow APY (annual percentage yield)
     * @return Borrow APY (scaled by 1e18)
     */
    function borrowRatePerBlock() external view returns (uint256);

    /**
     * @notice Get cash (underlying tokens in market)
     * @return Cash amount
     */
    function getCash() external view returns (uint256);

    /**
     * @notice Total supply of jTokens
     * @return Total jToken supply
     */
    function totalSupply() external view returns (uint256);

    /**
     * @notice Mint jTokens (called by JustLend on deposit)
     * @param minter Address minting jTokens
     * @param mintAmount Amount of jTokens to mint
     * @return Success
     */
    function mint(address minter, uint256 mintAmount) external returns (uint256);

    /**
     * @notice Redeem jTokens for underlying tokens
     * @param redeemer Address redeeming jTokens
     * @param redeemTokens Amount of jTokens to redeem
     * @param redeemAmount Amount of underlying to receive
     * @return Success
     */
    function redeem(
        address redeemer,
        uint256 redeemTokens,
        uint256 redeemAmount
    ) external returns (uint256);

    /**
     * @notice Borrow underlying tokens
     * @param borrower Address borrowing tokens
     * @param borrowAmount Amount to borrow
     * @return Success
     */
    function borrow(address borrower, uint256 borrowAmount) external returns (uint256);

    /**
     * @notice Repay borrowed tokens
     * @param payer Address repaying tokens
     * @param borrower Address whose debt is being repaid
     * @param repayAmount Amount to repay
     * @return Success
     */
    function repayBorrow(
        address payer,
        address borrower,
        address jToken,
        uint256 repayAmount
    ) external returns (uint256);

    /**
     * @notice Get user borrow balance
     * @param account Account address
     * @return principal Principal borrow balance
     * @return borrowIndex Borrow index
     */
    function borrowBalanceCurrent(address account)
        external
        view
        returns (uint256 principal, uint256 borrowIndex);

    /**
     * @notice Get cash for markets (collateral factor)
     * @return collateralFactorMantissa Collateral factor (scaled by 1e18)
     */
    function collateralFactorMantissa() external view returns (uint256);
}

/**
 * @title IJustLendPriceOracle
 * @dev Interface for JustLend price oracle
 */
interface IJustLendPriceOracle {
    /**
     * @notice Get price of underlying token
     * @param jToken jToken address
     * @return Price (scaled by 1e18)
     */
    function getUnderlyingPrice(address jToken) external view returns (uint256);
}

/**
 * @title IUnitroller
 * @dev Interface for JustLend Unitroller (comptroller)
 */
interface IUnitroller {
    /**
     * @notice Enter markets (enable as collateral)
     * @param jTokens Array of jToken addresses
     * @return Array of success booleans
     */
    function enterMarkets(address[] memory jTokens) external returns (uint256[] memory);

    /**
     * @notice Exit market (disable as collateral)
     * @param jToken jToken address
     * @return Success
     */
    function exitMarket(address jToken) external returns (uint256);

    /**
     * @notice Get account liquidity
     * @param account Account address
     * @return liquidity Liquidity in USD (scaled by 1e18)
     * @return shortfall Shortfall in USD (scaled by 1e18)
     */
    function getAccountLiquidity(address account)
        external
        view
        returns (
            uint256 liquidity,
            uint256 shortfall
        );

    /**
     * @notice Claim COMP rewards
     * @param holders Array of holder addresses
     * @param jTokens Array of jToken addresses
     * @param borrowers Boolean to include borrowers
     * @param suppliers Boolean to include suppliers
     */
    function claimComp(
        address[] memory holders,
        address[] memory jTokens,
        bool borrowers,
        bool suppliers
    ) external;

    /**
     * @notice Get markets entered by account
     * @param account Account address
     * @return Array of jToken addresses
     */
    function getAssetsIn(address account) external view returns (address[] memory);
}
