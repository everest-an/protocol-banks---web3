// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title Protocol Bank USD (pbUSD)
 * @dev Synthetic stablecoin for Protocol Bank ecosystem on HashKey Chain.
 * @notice Features:
 *  - 1:1 Backed by USDC on Base Treasury
 *  - Pausable (Emergency Stop)
 *  - Blacklist (Compliance/Sanctions)
 *  - Access Control (Minter/Admin)
 */
contract ProtocolBankUSD is ERC20, ERC20Burnable, ERC20Permit, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");

    // Compliance Blacklist
    mapping(address => bool) public isBlacklisted;

    event RedeemRequested(
        address indexed burner, 
        uint256 amount, 
        address indexed baseRecipient,
        uint256 timestamp
    );

    event BlacklistUpdated(address indexed account, bool isBlacklisted);

    constructor(address defaultAdmin, address minter, address pauser, address compliance) 
        ERC20("Protocol Bank USD", "pbUSD") 
        ERC20Permit("Protocol Bank USD")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(COMPLIANCE_ROLE, compliance);
    }

    /**
     * @dev Hook that is called before any transfer of tokens.
     * Checks:
     * 1. Contract is not paused.
     * 2. Sender is not blacklisted.
     * 3. Recipient is not blacklisted.
     */
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) {
        require(!isBlacklisted[from], "Sender is blacklisted");
        require(!isBlacklisted[to], "Recipient is blacklisted");
        super._update(from, to, value);
    }

    /**
     * @notice Mint new pbUSD tokens. Only callable by the bridge bot.
     * @param to The address to receive the tokens.
     * @param amount The amount to mint.
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @notice Burn pbUSD to redeem USDC on the Source chain (Base).
     * @param amount The amount of pbUSD to burn.
     * @param baseRecipient The USDC recipient address on Base chain.
     */
    function burnAndRedeem(uint256 amount, address baseRecipient) public whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(baseRecipient != address(0), "Invalid recipient");

        _burn(msg.sender, amount);
        emit RedeemRequested(msg.sender, amount, baseRecipient, block.timestamp);
    }

    // --- Administration ---

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Add or remove an address from the blacklist.
     * @param account The address to modify.
     * @param status True to blacklist, false to whitelist.
     */
    function setBlacklist(address account, bool status) public onlyRole(COMPLIANCE_ROLE) {
        isBlacklisted[account] = status;
        emit BlacklistUpdated(account, status);
    }
}
