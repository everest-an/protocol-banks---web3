# pbUSD Stablecoin System Design

## 1. Overview

**pbUSD (Protocol Bank USD)** is a synthetic, fully-backed stablecoin designed to solve liquidity fragmentation on emerging EVM chains like HashKey Chain. It functions on a "Mint-and-Burn" or "Lock-and-Mint" bridge model, ensuring 1:1 backing by USDC held in a secure treasury on a highly liquid chain (Base).

- **Source Chain**: Base (holding native USDC).
- **Destination Chain**: HashKey Chain (holding synthetic pbUSD).
- **Peg Mechanism**: 1 pbUSD = 1 USDC (Guaranteed by Treasury Reserves).

---

## 2. Architecture

### 2.1 Core Components

1.  **Base Treasury Vault (Smart Contract)**
    *   **Function**: Accepts USDC deposits and emits `Deposit` events.
    *   **Security**: Non-upgradable (or Time-lock controlled), verified on Basescan.
    *   **Address**: `0x...` (To be deployed)

2.  **HashKey Minter Controller (Oracle/Bot)**
    *   **Function**: Listens to `Deposit` events on Base.
    *   **Action**: Calls `mint()` on the HashKey token contract.
    *   **Security**: Multi-sig controlled off-chain worker (MPC).

3.  **pbUSD Token Contract (HashKey)**
    *   **Standard**: ERC-20 + AccessControl.
    *   **Roles**:
        *   `MINTER_ROLE`: Only the Controller Bot.
        *   `BURNER_ROLE`: Controller Bot (for redemptions) + Token Holder (for burning).

### 2.2 Workflows

#### A. Issue (Minting) Flow
User wants to pay salaries on HashKey but only has USDC on Base.

1.  **User Action**: Calls `Vault.deposit(amount, hashkey_recipient)` on Base.
2.  **On-Chain**: Base Vault transfers USDC from User to Vault Address. Emits `Deposited(user, amount, recipient)`.
3.  **Off-Chain**: Protocol Bot detects event after $N$ blocks confirmation.
4.  **Action**: Bot signs transaction to call `pbUSD.mint(recipient, amount)` on HashKey.
5.  **Result**: Recipient gets `pbUSD` on HashKey.

#### B. Redemption (Burning) Flow - *Primary Use Case: RWA/Fiat Withdrawals*
User has `pbUSD` and wants to exit to Fiat via RWA channels (e.g., HashKey Exchange).

*(Note: Corporate Batch Transfers should remain on Base/Arbitrum due to tooling maturity. HashKey is optimized for RWA/Fiat exits.)*

1.  **User Action**: Calls `pbUSD.burn(amount, base_recipient)` on HashKey.
2.  **On-Chain**: `pbUSD` tokens are destroyed. Emits `Burned(user, amount, recipient)`.
3.  **Off-Chain**: Protocol Bot detects event.
4.  **Action**: Bot signs transaction to call `Vault.release(recipient, amount)` on Base.
5.  **Fiat Exit**: User transfers released USDC to OTC/Exchange for Fiat settlement.
5.  **Result**: Recipient gets USDC on Base.

---

## 3. Smart Contract Specifications

### 3.1 Base Vault (`ProtocolBankTreasury.sol`)

```solidity
interface IProtocolBankTreasury {
    // User deposits USDC, specifies destination address on HashKey
    function depositToHashKey(uint256 amount, address recipient) external;
    
    // Admin/Bot releases funds (triggered by burn on HashKey)
    function releaseFromBurn(uint256 amount, address recipient, bytes32 burnTxHash) external onlyRole(RELAYER_ROLE);
}
```

### 3.2 HashKey Token (`ProtocolBankUSD.sol`)

```solidity
contract ProtocolBankUSD is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor() ERC20("Protocol Bank USD", "pbUSD") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // Called by Relayer Bot when deposit is detected on Base
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    // Called by user to redeem
    function burn(uint256 amount, address baseRecipient) external {
        _burn(msg.sender, amount);
        emit RedeemRequested(msg.sender, amount, baseRecipient);
    }
}
```

---

## 4. Risk Management

### 4.1 Proof of Reserves (PoR)
*   **Transparency**: The Base Treasury address is public. Anyone can verify `USDC Balance >= pbUSD Total Supply`.
*   **Automation**: A Chainlink PoR feed or a simple API endpoint can publish this ratio in real-time.

### 4.2 Security Delays
*   To prevent bridge hacks, large withdrawals (>$10k) can have a 1-hour delay in the Relayer Bot logic.
*   **Emergency Pause**: Admin multisig can pause minting/redemption on both chains.

### 4.3 Liquidity Risks
*   **Risk**: If the Treasury is hacked, pbUSD becomes worthless.
*   **Mitigation**: Use MPC (Fireblocks/Reown) for the Relayer key. Limit the Hot Wallet balance of the Relayer; require manual approval for Treasury releases from Cold Storage if necessary.
