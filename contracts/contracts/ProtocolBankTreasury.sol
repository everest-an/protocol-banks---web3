// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Protocol Bank Treasury
 * @dev Holds the USDC reserves on Base Chain backing the pbUSD on HashKey Chain.
 */
contract ProtocolBankTreasury is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    
    // The backing asset (USDC)
    IERC20 public immutable usdc;

    // Events
    event DepositedToHashKey(
        address indexed depositor, 
        uint256 amount, 
        address indexed hashKeyRecipient,
        uint256 timestamp
    );

    event ReleasedFromBurn(
        address indexed recipient, 
        uint256 amount, 
        bytes32 indexed burnTxHash,
        uint256 timestamp
    );

    // Prevent double spending of burn proofs
    mapping(bytes32 => bool) public processedBurnTx;

    constructor(address _usdc, address _admin) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_admin != address(0), "Invalid admin address");
        
        usdc = IERC20(_usdc);
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(RELAYER_ROLE, _admin);
    }

    /**
     * @notice User deposits USDC to bridge to HashKey Chain.
     * @param amount Amount of USDC to deposit.
     * @param hashKeyRecipient Recipient address on HashKey Chain.
     */
    function depositToHashKey(uint256 amount, address hashKeyRecipient) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(hashKeyRecipient != address(0), "Invalid recipient");

        // Transfer USDC from user to Treasury
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit DepositedToHashKey(msg.sender, amount, hashKeyRecipient, block.timestamp);
    }

    /**
     * @notice Relayer releases USDC to user after confirming burn on HashKey.
     * @param recipient Recipient of USDC on Base.
     * @param amount Amount to release.
     * @param burnTxHash Hash of the burn transaction on HashKey (for idempotency).
     */
    function releaseFromBurn(
        address recipient, 
        uint256 amount, 
        bytes32 burnTxHash
    ) external onlyRole(RELAYER_ROLE) nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(!processedBurnTx[burnTxHash], "Tx already processed");
        
        // Ensure enough balance
        require(usdc.balanceOf(address(this)) >= amount, "Insufficient liquidity in Treasury");

        // Mark as processed BEFORE transfer
        processedBurnTx[burnTxHash] = true;

        usdc.safeTransfer(recipient, amount);

        emit ReleasedFromBurn(recipient, amount, burnTxHash, block.timestamp);
    }
    
    /**
     * @notice Emergency withdraw function for Admin.
     * @param token Token address to rescue.
     * @param amount Amount to rescue.
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
