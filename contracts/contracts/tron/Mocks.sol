// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "./ITRC20.sol";
import "./IJustLend.sol";

/**
 * @title MockJustToken
 * @dev Mock jToken for testing TronYieldAggregator
 * @notice Simulates JustLend's interest-bearing tokens with deterministic APY
 */
contract MockJustToken is ERC20Pausable {
    address public immutable underlying;
    uint256 private _exchangeRate;
    uint256 private _supplyRatePerBlock;
    uint256 private _borrowRatePerBlock;
    uint256 private _lastUpdateBlock;

    event ExchangeRateUpdated(uint256 oldRate, uint256 newRate);

    constructor(
        string memory name,
        string memory symbol,
        address _underlying,
        uint256 initialRate
    ) ERC20(name, symbol) {
        underlying = _underlying;
        _exchangeRate = initialRate;
        _supplyRatePerBlock = 100000000000000000; // ~0.0000000001 per block (simplified)
        _borrowIndex = 1e18;
        _lastUpdateBlock = block.number;
    }

    function exchangeRateCurrent() public view returns (uint256) {
        return _exchangeRate;
    }

    function exchangeRateStored() external view returns (uint256) {
        return _exchangeRate;
    }

    function supplyRatePerBlock() external view returns (uint256) {
        return _supplyRatePerBlock;
    }

    function borrowRatePerBlock() external view returns (uint256) {
        return _borrowRatePerBlock;
    }

    function collateralFactorMantissa() external pure returns (uint256) {
        return 750000000000000000; // 75% collateral factor
    }

    function getCash() external view returns (uint256) {
        return ITRC20(underlying).balanceOf(address(this));
    }

    function setExchangeRate(uint256 newRate) external {
        uint256 oldRate = _exchangeRate;
        _exchangeRate = newRate;
        emit ExchangeRateUpdated(oldRate, newRate);
    }

    function setSupplyRatePerBlock(uint256 rate) external {
        _supplyRatePerBlock = rate;
    }

    // Mock interest accrual
    function accrueInterest() external {
        uint256 blocksPassed = block.number - _lastUpdateBlock;
        if (blocksPassed > 0) {
            uint256 rateIncrease = (_supplyRatePerBlock * blocksPassed) / 1e18;
            uint256 newRate = _exchangeRate * (1e18 + rateIncrease) / 1e18;
            _exchangeRate = newRate;
            _lastUpdateBlock = block.number;
        }
    }

    // Borrow tracking
    mapping(address => uint256) private _borrowBalances;
    mapping(address => uint256) private _borrowIndexes;
    uint256 private _borrowIndex;

    function borrowBalanceCurrent(address account)
        external
        view
        returns (uint256 principal, uint256 borrowIndex)
    {
        return (_borrowBalances[account], _borrowIndexes[account]);
    }

    function mint(address minter, uint256 mintAmount) external whenNotPaused returns (uint256) {
        _mint(minter, mintAmount);
        return 0;
    }

    function redeem(address redeemer, uint256 redeemTokens, uint256 redeemAmount)
        external
        whenNotPaused
        returns (uint256)
    {
        require(redeemTokens <= balanceOf(redeemer), "Insufficient balance");
        _burn(redeemer, redeemTokens);
        return 0;
    }

    function borrow(address borrower, uint256 borrowAmount) external whenNotPaused returns (uint256) {
        // Mock borrow logic
        _borrowBalances[borrower] += borrowAmount;
        _borrowIndexes[borrower] = _borrowIndex;
        return 0;
    }

    function repayBorrow(address payer, address borrower, address, uint256 repayAmount)
        external
        whenNotPaused
        returns (uint256)
    {
        if (_borrowBalances[borrower] >= repayAmount) {
            _borrowBalances[borrower] -= repayAmount;
        }
        return 0;
    }
}

/**
 * @title MockJustLend
 * @dev Mock JustLend protocol for testing TronYieldAggregator
 * @notice Simulates JustLend's core lending/borrowing functionality
 */
contract MockJustLend is IJustLend {
    mapping(address => address) public tokenToJToken;
    address[] public supportedTokens;

    error InvalidToken();
    error InsufficientBalance();
    error NotSupported();

    event TokenAdded(address indexed token, address indexed jToken);
    event TokenRemoved(address indexed token);
    event DepositSuccessful(address indexed user, address indexed jToken, uint256 amount);
    event RedeemSuccessful(address indexed user, address indexed jToken, uint256 amount);

    constructor() {}

    function deposit(address jToken, uint256 underlyingAmount)
        external
        override
        returns (uint256)
    {
        if (tokenToJToken[jToken] == address(0)) revert NotSupported();

        ITRC20 jTokenContract = ITRC20(jToken);
        address underlyingAddress = MockJustToken(jToken).underlying();

        // Transfer underlying from user
        ITRC20(underlyingAddress).safeTransferFrom(msg.sender, address(this), underlyingAmount);

        // Get exchange rate and mint jTokens
        MockJustToken justToken = MockJustToken(jToken);
        uint256 exchangeRate = justToken.exchangeRateCurrent();
        uint256 jTokenAmount = (underlyingAmount * 1e18) / exchangeRate;

        // Mint jTokens
        justToken.mint(msg.sender, jTokenAmount);

        emit DepositSuccessful(msg.sender, jToken, underlyingAmount);

        return jTokenAmount;
    }

    function redeem(address jToken, uint256 jTokenAmount)
        external
        override
        returns (uint256)
    {
        if (tokenToJToken[jToken] == address(0)) revert NotSupported();

        MockJustToken justToken = MockJustToken(jToken);

        // Check user has enough jTokens
        if (justToken.balanceOf(msg.sender) < jTokenAmount) revert InsufficientBalance();

        // Redeem jTokens (burns them and calculates underlying amount)
        uint256 underlyingAmount = (jTokenAmount * justToken.exchangeRateCurrent()) / 1e18;

        justToken.redeem(msg.sender, jTokenAmount, underlyingAmount);

        // Transfer underlying to user
        address underlyingAddress = justToken.underlying();
        require(ITRC20(underlyingAddress).balanceOf(address(this)) >= underlyingAmount, "Insufficient contract balance");

        ITRC20(underlyingAddress).safeTransfer(msg.sender, underlyingAmount);

        emit RedeemSuccessful(msg.sender, jToken, underlyingAmount);

        return underlyingAmount;
    }

    function redeemAll(address jToken) external override returns (uint256) {
        MockJustToken justToken = MockJustToken(jToken);
        uint256 jTokenAmount = justToken.balanceOf(msg.sender);
        return redeem(jToken, jTokenAmount);
    }

    function borrow(address jToken, uint256 borrowAmount) external override {
        if (tokenToJToken[jToken] == address(0)) revert NotSupported();

        MockJustToken justToken = MockJustToken(jToken);
        address underlyingAddress = justToken.underlying();

        // Check contract has enough tokens
        require(
            ITRC20(underlyingAddress).balanceOf(address(this)) >= borrowAmount,
            "Insufficient liquidity"
        );

        // Transfer borrowed tokens to user
        ITRC20(underlyingAddress).safeTransfer(msg.sender, borrowAmount);

        // Record borrow (mock logic)
        justToken.borrow(msg.sender, borrowAmount);
    }

    function repayBorrow(address jToken, uint256 repayAmount) external override {
        if (tokenToJToken[jToken] == address(0)) revert NotSupported();

        MockJustToken justToken = MockJustToken(jToken);
        address underlyingAddress = justToken.underlying();

        // Transfer repay tokens from user
        ITRC20(underlyingAddress).safeTransferFrom(msg.sender, address(this), repayAmount);

        // Record repayment (mock logic)
        justToken.repayBorrow(msg.sender, msg.sender, jToken, repayAmount);
    }

    function enterMarkets(address[] memory jTokens) external override {
        for (uint256 i = 0; i < jTokens.length; i++) {
            if (tokenToJToken[jTokens[i]] == address(0)) revert NotSupported();
        }
        // Mock: just verify tokens are supported
    }

    function exitMarket(address jToken) external override {
        if (tokenToJToken[jToken] == address(0)) revert NotSupported();
        // Mock: just verify token is supported
    }

    function getAccountLiquidity(address account)
        external
        view
        override
        returns (
            uint256 accountLiquidity,
            uint256 accountShortfall
        )
    {
        // Mock: always return positive liquidity
        return (1000000 * 1e18, 0); // 1M USD liquidity
    }

    function claimComp(address account) external override returns (uint256) {
        // Mock: no COMP rewards
        return 0;
    }

    // Admin functions for testing
    function addSupportedToken(address token, address jToken) external {
        require(token != address(0) && jToken != address(0), "Invalid address");
        tokenToJToken[jToken] = token;
        supportedTokens.push(jToken);
        emit TokenAdded(token, jToken);
    }

    function removeSupportedToken(address jToken) external {
        require(tokenToJToken[jToken] != address(0), "Not supported");
        tokenToJToken[jToken] = address(0);
        // Remove from array
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == jToken) {
                supportedTokens[i] = supportedTokens[supportedTokens.length - 1];
                supportedTokens.pop();
                break;
            }
        }
        emit TokenRemoved(tokenToJToken[jToken]);
    }

    function getSupportedTokenCount() external view returns (uint256) {
        return supportedTokens.length;
    }
}

/**
 * @title MockUnitroller
 * @dev Mock Unitroller for testing TronYieldAggregator
 */
contract MockUnitroller is IUnitroller {
    mapping(address => address[]) private _userAssets;
    uint256 private _success = 0;

    function enterMarkets(address[] memory jTokens) external override returns (uint256[] memory) {
        uint256[] memory results = new uint256[](jTokens.length);
        for (uint256 i = 0; i < jTokens.length; i++) {
            bool exists = false;
            for (uint256 j = 0; j < _userAssets[msg.sender].length; j++) {
                if (_userAssets[msg.sender][j] == jTokens[i]) {
                    exists = true;
                    break;
                }
            }
            if (!exists) {
                _userAssets[msg.sender].push(jTokens[i]);
            }
            results[i] = 0;
        }
        return results;
    }

    function exitMarket(address jToken) external override returns (uint256) {
        // Remove jToken from user's assets
        for (uint256 i = 0; i < _userAssets[msg.sender].length; i++) {
            if (_userAssets[msg.sender][i] == jToken) {
                _userAssets[msg.sender][i] = _userAssets[msg.sender][_userAssets[msg.sender].length - 1];
                _userAssets[msg.sender].pop();
                break;
            }
        }
        return _success;
    }

    function getAccountLiquidity(address account)
        external
        view
        override
        returns (
            uint256 liquidity,
            uint256 shortfall
        )
    {
        return (1000000 * 1e18, 0); // Mock: 1M USD liquidity, no shortfall
    }

    function claimComp(
        address[] memory holders,
        address[] memory jTokens,
        bool borrowers,
        bool suppliers
    ) external override {
        // Mock: no COMP rewards
    }

    function getAssetsIn(address account) external view override returns (address[] memory) {
        return _userAssets[account];
    }
}

/**
 * @title MockPriceOracle
 * @dev Mock price oracle for testing TronYieldAggregator
 */
contract MockPriceOracle is IJustLendPriceOracle {
    mapping(address => uint256) private tokenPrices; // jToken => price (scaled by 1e18)

    // Common prices (USD, scaled by 1e18)
    uint256 public constant USDT_PRICE = 1e18;       // $1.00
    uint256 public constant USDC_PRICE = 1e18;       // $1.00
    uint256 public constant TRX_PRICE = 15e16;       // $0.15
    uint256 public constant WBTC_PRICE = 98000e18;   // $98,000
    uint256 public constant WETH_PRICE = 3500e18;    // $3,500

    constructor() {
        // Set default prices (using jToken addresses as keys for testing)
        // In real tests, would map actual jToken addresses
    }

    function getUnderlyingPrice(address jToken) external view override returns (uint256) {
        // Return mock price based on jToken or default to USDT price
        if (tokenPrices[jToken] != 0) {
            return tokenPrices[jToken];
        }
        return USDT_PRICE; // Default to $1.00
    }

    function setPrice(address jToken, uint256 price) external {
        tokenPrices[jToken] = price;
    }

    function setUSDTPrice(uint256 price) external {
        tokenPrices[address(0x1)] = price; // Use dummy address
    }

    function setTRXPrice(uint256 price) external {
        tokenPrices[address(0x2)] = price; // Use dummy address
    }

    function setupDefaultPrices(address usdtToken, address usdcToken, address trxToken) external {
        tokenPrices[usdtToken] = USDT_PRICE;
        tokenPrices[usdcToken] = USDC_PRICE;
        tokenPrices[trxToken] = TRX_PRICE;
    }
}

/**
 * @title MockTRC20
 * @dev Mock TRC20 token for testing
 */
contract MockTRC20 is ITRC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _initialSupply
    ) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        _mint(msg.sender, _initialSupply);
    }

    function transfer(address recipient, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external override returns (bool) {
        uint256 currentAllowance = allowance[sender][msg.sender];
        if (currentAllowance < amount) return false;

        allowance[sender][msg.sender] = currentAllowance - amount;
        _transfer(sender, recipient, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "Insufficient balance");

        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        emit Transfer(from, to, amount);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(balanceOf[from] >= amount, "Insufficient balance");
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }
}
