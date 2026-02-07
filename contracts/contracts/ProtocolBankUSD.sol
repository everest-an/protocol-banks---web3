// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title Protocol Bank USD (pbUSD)
 * @author Protocol Banks Team
 * @dev Synthetic stablecoin for Protocol Bank ecosystem on HashKey Chain.
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │                     pbUSD Token Design                      │
 * ├──────────────────────────────────────────────────────────────┤
 * │  Backing:    1:1 by USDC in Base Treasury Vault             │
 * │  Standard:   ERC-20 + ERC-2612 (Permit) + ERC-3009 (Auth)  │
 * │  Controls:   Pausable, Blacklist, Mint Cap, Transfer Fee    │
 * │  Roles:      Admin, Minter, Pauser, Compliance, FeeManager │
 * └──────────────────────────────────────────────────────────────┘
 *
 * @notice Security Features:
 *  - Daily Mint Cap: prevents bridge bot from minting unbounded amounts
 *  - Transfer Fee: optional protocol fee (default 0, max 50 bps)
 *  - Blacklist: compliance/sanctions enforcement
 *  - Pausable: emergency circuit breaker
 *  - ERC-3009: gasless TransferWithAuthorization for x402 compatibility
 */
contract ProtocolBankUSD is ERC20, ERC20Burnable, ERC20Permit, ERC20Pausable, AccessControl {
    // ══════════════════════════════════════════════════════════════
    //                          ROLES
    // ══════════════════════════════════════════════════════════════
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");

    // ══════════════════════════════════════════════════════════════
    //                      STATE VARIABLES
    // ══════════════════════════════════════════════════════════════

    // --- Compliance ---
    mapping(address => bool) public isBlacklisted;

    // --- Daily Mint Cap ---
    uint256 public dailyMintCap;
    uint256 public currentDayMinted;
    uint256 public lastMintResetDay;

    // --- Transfer Fee ---
    uint256 public transferFeeBps; // basis points (1 bp = 0.01%)
    uint256 public constant MAX_FEE_BPS = 50; // max 0.50%
    address public feeCollector;
    mapping(address => bool) public isFeeExempt;

    // --- Supply Tracking ---
    uint256 public totalMinted;
    uint256 public totalBurned;

    // --- ERC-3009 Authorization State ---
    mapping(address => mapping(bytes32 => bool)) public authorizationState;

    // ══════════════════════════════════════════════════════════════
    //                          EVENTS
    // ══════════════════════════════════════════════════════════════
    event RedeemRequested(
        address indexed burner,
        uint256 amount,
        address indexed baseRecipient,
        uint256 timestamp
    );

    event BlacklistUpdated(address indexed account, bool isBlacklisted);
    event DailyMintCapUpdated(uint256 oldCap, uint256 newCap);
    event TransferFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event FeeCollectorUpdated(address oldCollector, address newCollector);
    event FeeExemptUpdated(address indexed account, bool exempt);
    event FeeCollected(address indexed from, address indexed to, uint256 feeAmount);
    event MintCapReset(uint256 day, uint256 previousDayTotal);

    // ERC-3009 events
    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);
    event AuthorizationCanceled(address indexed authorizer, bytes32 indexed nonce);

    // ══════════════════════════════════════════════════════════════
    //                        ERRORS
    // ══════════════════════════════════════════════════════════════
    error SenderBlacklisted(address account);
    error RecipientBlacklisted(address account);
    error DailyMintCapExceeded(uint256 requested, uint256 remaining);
    error InvalidMintCap();
    error FeeTooHigh(uint256 requested, uint256 max);
    error InvalidFeeCollector();
    error InvalidRecipient();
    error InvalidAmount();
    error AuthorizationAlreadyUsed(address authorizer, bytes32 nonce);
    error AuthorizationExpired(uint256 deadline);
    error InvalidSignature();
    error CallerNotPayee();

    // ══════════════════════════════════════════════════════════════
    //                       CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════
    constructor(
        address defaultAdmin,
        address minter,
        address pauser,
        address compliance,
        uint256 _dailyMintCap
    )
        ERC20("Protocol Bank USD", "pbUSD")
        ERC20Permit("Protocol Bank USD")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(COMPLIANCE_ROLE, compliance);
        _grantRole(FEE_MANAGER_ROLE, defaultAdmin);

        dailyMintCap = _dailyMintCap;
        lastMintResetDay = _currentDay();
        feeCollector = defaultAdmin;
        
        // Fee-exempt: the contract itself
        isFeeExempt[address(this)] = true;
    }

    /**
     * @dev Overrides default decimals to 6 to match USDC.
     */
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    // ══════════════════════════════════════════════════════════════
    //                    CORE TOKEN LOGIC
    // ══════════════════════════════════════════════════════════════

    /**
     * @dev Override _update to enforce:
     *  1. Blacklist checks (sender & receiver)
     *  2. Pause checks (via ERC20Pausable)
     *  3. Transfer fee collection
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        if (isBlacklisted[from]) revert SenderBlacklisted(from);
        if (isBlacklisted[to]) revert RecipientBlacklisted(to);

        // Calculate fee (skip for mint/burn and fee-exempt addresses)
        uint256 fee = 0;
        if (
            transferFeeBps > 0 &&
            from != address(0) &&    // not mint
            to != address(0) &&      // not burn
            !isFeeExempt[from] &&
            !isFeeExempt[to] &&
            feeCollector != address(0)
        ) {
            fee = (value * transferFeeBps) / 10000;
            if (fee > 0) {
                super._update(from, feeCollector, fee);
                emit FeeCollected(from, to, fee);
            }
        }

        super._update(from, to, value - fee);
    }

    // ══════════════════════════════════════════════════════════════
    //                     MINT / BURN
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Mint new pbUSD tokens. Only callable by bridge bot (MINTER_ROLE).
     * @dev Enforces daily mint cap to limit exposure in case of bridge compromise.
     * @param to The address to receive the tokens.
     * @param amount The amount to mint (18 decimals).
     */
    function mint(address to, uint256 amount)
        public
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        if (amount == 0) revert InvalidAmount();
        if (to == address(0)) revert InvalidRecipient();

        // Reset daily counter if new day
        _resetDailyMintIfNeeded();

        // Check daily cap
        if (dailyMintCap > 0 && currentDayMinted + amount > dailyMintCap) {
            revert DailyMintCapExceeded(amount, dailyMintCap - currentDayMinted);
        }

        currentDayMinted += amount;
        totalMinted += amount;

        _mint(to, amount);
    }

    /**
     * @notice Burn pbUSD to redeem USDC on the Source chain (Base).
     * @param amount The amount of pbUSD to burn.
     * @param baseRecipient The USDC recipient address on Base chain.
     */
    function burnAndRedeem(uint256 amount, address baseRecipient)
        public
        whenNotPaused
    {
        if (amount == 0) revert InvalidAmount();
        if (baseRecipient == address(0)) revert InvalidRecipient();

        totalBurned += amount;
        _burn(msg.sender, amount);

        emit RedeemRequested(msg.sender, amount, baseRecipient, block.timestamp);
    }

    // ══════════════════════════════════════════════════════════════
    //                ERC-3009: TransferWithAuthorization
    // ══════════════════════════════════════════════════════════════

    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)");

    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH =
        keccak256("ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)");

    bytes32 public constant CANCEL_AUTHORIZATION_TYPEHASH =
        keccak256("CancelAuthorization(address authorizer,bytes32 nonce)");

    /**
     * @notice Execute a transfer with a signed authorization (ERC-3009).
     * @dev Enables gasless transfers compatible with x402 protocol.
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused {
        if (block.timestamp <= validAfter || block.timestamp >= validBefore) {
            revert AuthorizationExpired(validBefore);
        }
        if (authorizationState[from][nonce]) {
            revert AuthorizationAlreadyUsed(from, nonce);
        }

        bytes32 structHash = keccak256(
            abi.encode(TRANSFER_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce)
        );
        _verifySignature(from, structHash, v, r, s);

        authorizationState[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);

        _transfer(from, to, value);
    }

    /**
     * @notice Receive a transfer with a signed authorization (ERC-3009).
     * @dev Caller must be the payee (to).
     */
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused {
        if (to != msg.sender) revert CallerNotPayee();
        if (block.timestamp <= validAfter || block.timestamp >= validBefore) {
            revert AuthorizationExpired(validBefore);
        }
        if (authorizationState[from][nonce]) {
            revert AuthorizationAlreadyUsed(from, nonce);
        }

        bytes32 structHash = keccak256(
            abi.encode(RECEIVE_WITH_AUTHORIZATION_TYPEHASH, from, to, value, validAfter, validBefore, nonce)
        );
        _verifySignature(from, structHash, v, r, s);

        authorizationState[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);

        _transfer(from, to, value);
    }

    /**
     * @notice Cancel an authorization (ERC-3009).
     */
    function cancelAuthorization(
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (authorizationState[msg.sender][nonce]) {
            revert AuthorizationAlreadyUsed(msg.sender, nonce);
        }

        bytes32 structHash = keccak256(
            abi.encode(CANCEL_AUTHORIZATION_TYPEHASH, msg.sender, nonce)
        );
        _verifySignature(msg.sender, structHash, v, r, s);

        authorizationState[msg.sender][nonce] = true;
        emit AuthorizationCanceled(msg.sender, nonce);
    }

    // ══════════════════════════════════════════════════════════════
    //                    ADMINISTRATION
    // ══════════════════════════════════════════════════════════════

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function setBlacklist(address account, bool status)
        public
        onlyRole(COMPLIANCE_ROLE)
    {
        isBlacklisted[account] = status;
        emit BlacklistUpdated(account, status);
    }

    function setDailyMintCap(uint256 newCap)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        uint256 oldCap = dailyMintCap;
        dailyMintCap = newCap;
        emit DailyMintCapUpdated(oldCap, newCap);
    }

    function setTransferFee(uint256 newFeeBps)
        public
        onlyRole(FEE_MANAGER_ROLE)
    {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_FEE_BPS);
        uint256 oldFee = transferFeeBps;
        transferFeeBps = newFeeBps;
        emit TransferFeeUpdated(oldFee, newFeeBps);
    }

    function setFeeCollector(address newCollector)
        public
        onlyRole(FEE_MANAGER_ROLE)
    {
        if (newCollector == address(0)) revert InvalidFeeCollector();
        address oldCollector = feeCollector;
        feeCollector = newCollector;
        emit FeeCollectorUpdated(oldCollector, newCollector);
    }

    function setFeeExempt(address account, bool exempt)
        public
        onlyRole(FEE_MANAGER_ROLE)
    {
        isFeeExempt[account] = exempt;
        emit FeeExemptUpdated(account, exempt);
    }

    // ══════════════════════════════════════════════════════════════
    //                     VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    function circulatingSupply() external view returns (uint256) {
        return totalMinted - totalBurned;
    }

    function remainingDailyMint() external view returns (uint256) {
        if (dailyMintCap == 0) return type(uint256).max;
        uint256 day = _currentDay();
        if (day != lastMintResetDay) return dailyMintCap;
        if (currentDayMinted >= dailyMintCap) return 0;
        return dailyMintCap - currentDayMinted;
    }

    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view override returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ══════════════════════════════════════════════════════════════
    //                    INTERNAL HELPERS
    // ══════════════════════════════════════════════════════════════

    function _currentDay() internal view returns (uint256) {
        return block.timestamp / 1 days;
    }

    function _resetDailyMintIfNeeded() internal {
        uint256 today = _currentDay();
        if (today != lastMintResetDay) {
            emit MintCapReset(today, currentDayMinted);
            currentDayMinted = 0;
            lastMintResetDay = today;
        }
    }

    function _verifySignature(address expected, bytes32 structHash, uint8 v, bytes32 r, bytes32 s) internal view {
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0) || signer != expected) {
            revert InvalidSignature();
        }
    }
}
