// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IFHE - FHE Type Definitions & Interface
 * @author Protocol Banks Team
 * @notice Abstraction layer for Fully Homomorphic Encryption operations.
 * 
 * This file provides type aliases and the FHE precompile interface compatible
 * with Zama's fhEVM (TFHE-rs based coprocessor). When deployed on an FHE-enabled
 * chain (e.g., Fhenix, Inco Network, or a Zama-powered L2/L3), the FHE library
 * resolves to real TFHE operations. For non-FHE chains or testing, a mock
 * implementation is provided.
 *
 * @dev References:
 *  - Zama fhEVM: https://github.com/zama-ai/fhevm
 *  - TFHE-rs: https://github.com/zama-ai/tfhe-rs
 *  - Paper: "TFHE: Fast Fully Homomorphic Encryption over the Torus" (Chillotti et al., 2020)
 *  - ERC-7984: Confidential ERC-20 (OpenZeppelin draft)
 *
 * Encrypted Types:
 *  - euint64:   Encrypted unsigned 64-bit integer (handles amounts up to ~1.8×10^19)
 *  - ebool:     Encrypted boolean
 *  - eaddress:  Encrypted Ethereum address (160-bit)
 *  - ebytes256: Encrypted 256-byte blob
 *
 * All encrypted values are represented on-chain as opaque bytes32 "handles"
 * pointing to ciphertexts stored in the FHE coprocessor.
 */

// ══════════════════════════════════════════════════════════════
//                    ENCRYPTED TYPE ALIASES
// ══════════════════════════════════════════════════════════════

/// @dev Encrypted uint64 — used for balances, amounts, caps
type euint64 is bytes32;

/// @dev Encrypted boolean — used for comparison results, access control
type ebool is bytes32;

/// @dev Encrypted address — used for confidential recipient/sender
type eaddress is bytes32;

/// @dev External encrypted input (from user's client-side encryption)
type externalEuint64 is bytes32;

/// @dev External encrypted boolean input
type externalEbool is bytes32;

/// @dev External encrypted address input
type externalEaddress is bytes32;

// ══════════════════════════════════════════════════════════════
//                    FHE LIBRARY INTERFACE
// ══════════════════════════════════════════════════════════════

/**
 * @title IFHE
 * @notice Interface for FHE operations. In production, resolves to the
 *         TFHE precompile. In testing, uses MockFHE.
 */
interface IFHE {
    // --- Arithmetic ---
    function add(bytes32 lhs, bytes32 rhs) external returns (bytes32);
    function sub(bytes32 lhs, bytes32 rhs) external returns (bytes32);
    function mul(bytes32 lhs, bytes32 rhs) external returns (bytes32);

    // --- Comparison ---
    function le(bytes32 lhs, bytes32 rhs) external returns (bytes32);  // <=
    function lt(bytes32 lhs, bytes32 rhs) external returns (bytes32);  // <
    function ge(bytes32 lhs, bytes32 rhs) external returns (bytes32);  // >=
    function gt(bytes32 lhs, bytes32 rhs) external returns (bytes32);  // >
    function eq(bytes32 lhs, bytes32 rhs) external returns (bytes32);  // ==
    function ne(bytes32 lhs, bytes32 rhs) external returns (bytes32);  // !=

    // --- Logic ---
    function and_(bytes32 lhs, bytes32 rhs) external returns (bytes32);
    function or_(bytes32 lhs, bytes32 rhs) external returns (bytes32);
    function not_(bytes32 value) external returns (bytes32);

    // --- Control ---
    function select(bytes32 condition, bytes32 ifTrue, bytes32 ifFalse) external returns (bytes32);

    // --- Encryption / Trivial Encrypt ---
    function asEuint64(uint64 value) external returns (bytes32);
    function asEbool(bool value) external returns (bytes32);
    function asEaddress(address value) external returns (bytes32);
    function fromExternal(bytes32 handle, bytes calldata inputProof) external returns (bytes32);

    // --- Access Control (ACL) ---
    function allow(bytes32 handle, address account) external;
    function allowThis(bytes32 handle) external;
    function isSenderAllowed(bytes32 handle) external view returns (bool);

    // --- Decryption Request ---
    function makePubliclyDecryptable(bytes32 handle) external;
    function publicDecrypt(bytes32 handle) external view returns (uint256);
}
