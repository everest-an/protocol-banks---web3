// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title Protocol Bank USD (pbUSD)
 * @dev Synthetic stablecoin for Protocol Bank ecosystem on HashKey Chain.
 * Backed 1:1 by USDC reserves on Base Chain.
 */
contract ProtocolBankUSD is ERC20, ERC20Burnable, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // Event emitted when user requests bridging back to Base
    event RedeemRequested(
        address indexed burner, 
        uint256 amount, 
        address indexed baseRecipient,
        uint256 timestamp
    );

    constructor() 
        ERC20("Protocol Bank USD", "pbUSD") 
        ERC20Permit("Protocol Bank USD")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
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
    function burnAndRedeem(uint256 amount, address baseRecipient) public {
        require(amount > 0, "Amount must be > 0");
        require(baseRecipient != address(0), "Invalid recipient");

        _burn(msg.sender, amount);
        emit RedeemRequested(msg.sender, amount, baseRecipient, block.timestamp);
    }
}
