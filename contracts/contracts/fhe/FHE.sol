// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IFHE.sol";

/**
 * @title FHE - Static Library for FHE Operations
 * @author Protocol Banks Team
 * @notice Provides a Solidity-native API for FHE operations, wrapping the
 *         coprocessor interface. Compatible with Zama fhEVM's FHE.sol pattern.
 *
 * @dev On an fhEVM-enabled chain, operations route to the TFHE precompile/coprocessor.
 *      The library uses typed wrappers (euint64, ebool, eaddress) for compile-time safety.
 *
 * Usage in contracts:
 *   import "./FHE.sol";
 *   euint64 encBalance = FHE.asEuint64(1000);
 *   euint64 result = FHE.add(encBalance, amount);
 *   ebool sufficient = FHE.le(amount, encBalance);
 *   euint64 transfer = FHE.select(sufficient, amount, FHE.asEuint64(0));
 */
library FHE {
    // ══════════════════════════════════════════════════════════════
    //                  COPROCESSOR CONFIGURATION
    // ══════════════════════════════════════════════════════════════

    /// @dev Storage slot for the coprocessor address (EIP-7201 style)
    // keccak256("protocolbank.fhe.coprocessor.address")
    bytes32 private constant COPROCESSOR_SLOT = 0x2213e27a69620589bdc2328df8f4c3a2839d393438318617d33d9d300e84323b;

    /// @dev Address of the ACL contract for access control
    // keccak256("protocolbank.fhe.acl.address")
    bytes32 private constant ACL_SLOT = 0x82f254e4a7a8f94602f3099951664c39f0003504358f237efb99e7c5d4f3b723;

    /**
     * @notice Configure the FHE coprocessor and ACL addresses.
     * @dev Must be called in the constructor of each FHE-enabled contract.
     * @param coprocessor Address of the FHE executor / coprocessor contract
     * @param acl Address of the ACL contract
     */
    function setCoprocessor(address coprocessor, address acl) internal {
        bytes32 cpSlot = COPROCESSOR_SLOT;
        bytes32 aclSlot = ACL_SLOT;
        assembly {
            sstore(cpSlot, coprocessor)
            sstore(aclSlot, acl)
        }
    }

    function _coprocessor() private view returns (address addr) {
        bytes32 slot = COPROCESSOR_SLOT;
        assembly {
            addr := sload(slot)
        }
    }

    function _acl() private view returns (address addr) {
        bytes32 slot = ACL_SLOT;
        assembly {
            addr := sload(slot)
        }
    }

    // ══════════════════════════════════════════════════════════════
    //                 TRIVIAL ENCRYPTION (Plaintext → Ciphertext)
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Encrypt a plaintext uint64 into an encrypted euint64.
     * @dev This is "trivial encryption" — the coprocessor creates a ciphertext
     *      from the plaintext. Only use for contract-internal values, never for
     *      user secrets (those should use client-side encryption via externalEuint64).
     */
    function asEuint64(uint64 value) internal returns (euint64) {
        address cop = _coprocessor();
        if (cop == address(0)) {
            // Mock mode: store plaintext as handle for testing
            return euint64.wrap(bytes32(uint256(value)));
        }
        bytes32 result = IFHE(cop).asEuint64(value);
        return euint64.wrap(result);
    }

    /**
     * @notice Encrypt a plaintext boolean into an encrypted ebool.
     */
    function asEbool(bool value) internal returns (ebool) {
        address cop = _coprocessor();
        if (cop == address(0)) {
            return ebool.wrap(bytes32(uint256(value ? 1 : 0)));
        }
        bytes32 result = IFHE(cop).asEbool(value);
        return ebool.wrap(result);
    }

    /**
     * @notice Encrypt a plaintext address into an encrypted eaddress.
     */
    function asEaddress(address value) internal returns (eaddress) {
        address cop = _coprocessor();
        if (cop == address(0)) {
            return eaddress.wrap(bytes32(uint256(uint160(value))));
        }
        bytes32 result = IFHE(cop).asEaddress(value);
        return eaddress.wrap(result);
    }

    /**
     * @notice Convert an external encrypted input (from user) to internal euint64.
     * @dev Validates the input proof (ZKP or encryption proof from client SDK).
     */
    function fromExternal(externalEuint64 handle, bytes calldata inputProof) internal returns (euint64) {
        address cop = _coprocessor();
        if (cop == address(0)) {
            return euint64.wrap(externalEuint64.unwrap(handle));
        }
        bytes32 result = IFHE(cop).fromExternal(externalEuint64.unwrap(handle), inputProof);
        return euint64.wrap(result);
    }

    // ══════════════════════════════════════════════════════════════
    //                    ARITHMETIC OPERATIONS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Homomorphic addition: result = lhs + rhs (encrypted).
     * @dev Both operands remain encrypted. Addition is performed by the coprocessor
     *      on the TFHE ciphertexts without decryption.
     */
    function add(euint64 lhs, euint64 rhs) internal returns (euint64) {
        address cop = _coprocessor();
        if (cop == address(0)) {
            // Mock: plaintext arithmetic
            uint256 a = uint256(euint64.unwrap(lhs));
            uint256 b = uint256(euint64.unwrap(rhs));
            return euint64.wrap(bytes32(a + b));
        }
        bytes32 result = IFHE(cop).add(euint64.unwrap(lhs), euint64.unwrap(rhs));
        return euint64.wrap(result);
    }

    /**
     * @notice Homomorphic addition with plaintext scalar: result = lhs + plaintext.
     */
    function add(euint64 lhs, uint64 rhs) internal returns (euint64) {
        return add(lhs, asEuint64(rhs));
    }

    /**
     * @notice Homomorphic subtraction: result = lhs - rhs (encrypted).
     */
    function sub(euint64 lhs, euint64 rhs) internal returns (euint64) {
        address cop = _coprocessor();
        if (cop == address(0)) {
            uint256 a = uint256(euint64.unwrap(lhs));
            uint256 b = uint256(euint64.unwrap(rhs));
            return euint64.wrap(bytes32(a - b));
        }
        bytes32 result = IFHE(cop).sub(euint64.unwrap(lhs), euint64.unwrap(rhs));
        return euint64.wrap(result);
    }

    /**
     * @notice Homomorphic multiplication: result = lhs * rhs (encrypted).
     */
    function mul(euint64 lhs, euint64 rhs) internal returns (euint64) {
        address cop = _coprocessor();
        if (cop == address(0)) {
            uint256 a = uint256(euint64.unwrap(lhs));
            uint256 b = uint256(euint64.unwrap(rhs));
            return euint64.wrap(bytes32(a * b));
        }
        bytes32 result = IFHE(cop).mul(euint64.unwrap(lhs), euint64.unwrap(rhs));
        return euint64.wrap(result);
    }

    // ══════════════════════════════════════════════════════════════
    //                   COMPARISON OPERATIONS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Homomorphic less-than-or-equal: result = (lhs <= rhs) as encrypted bool.
     * @dev Critical for balance checks: `FHE.le(amount, balance)` verifies
     *      sufficient funds without revealing either value.
     */
    function le(euint64 lhs, euint64 rhs) internal returns (ebool) {
        address cop = _coprocessor();
        if (cop == address(0)) {
            uint256 a = uint256(euint64.unwrap(lhs));
            uint256 b = uint256(euint64.unwrap(rhs));
            return ebool.wrap(bytes32(uint256(a <= b ? 1 : 0)));
        }
        bytes32 result = IFHE(cop).le(euint64.unwrap(lhs), euint64.unwrap(rhs));
        return ebool.wrap(result);
    }

    /**
     * @notice Homomorphic less-than: result = (lhs < rhs) as encrypted bool.
     */
    function lt(euint64 lhs, euint64 rhs) internal returns (ebool) {
        address cop = _coprocessor();
        if (cop == address(0)) {
            uint256 a = uint256(euint64.unwrap(lhs));
            uint256 b = uint256(euint64.unwrap(rhs));
            return ebool.wrap(bytes32(uint256(a < b ? 1 : 0)));
        }
        bytes32 result = IFHE(cop).lt(euint64.unwrap(lhs), euint64.unwrap(rhs));
        return ebool.wrap(result);
    }

    /**
     * @notice Homomorphic equality: result = (lhs == rhs) as encrypted bool.
     */
    function eq(euint64 lhs, euint64 rhs) internal returns (ebool) {
        address cop = _coprocessor();
        if (cop == address(0)) {
            uint256 a = uint256(euint64.unwrap(lhs));
            uint256 b = uint256(euint64.unwrap(rhs));
            return ebool.wrap(bytes32(uint256(a == b ? 1 : 0)));
        }
        bytes32 result = IFHE(cop).eq(euint64.unwrap(lhs), euint64.unwrap(rhs));
        return ebool.wrap(result);
    }

    // ══════════════════════════════════════════════════════════════
    //                    LOGICAL OPERATIONS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Homomorphic AND: result = lhs AND rhs (encrypted booleans).
     */
    function and_(ebool lhs, ebool rhs) internal returns (ebool) {
        address cop = _coprocessor();
        if (cop == address(0)) {
            uint256 a = uint256(ebool.unwrap(lhs));
            uint256 b = uint256(ebool.unwrap(rhs));
            return ebool.wrap(bytes32(a & b));
        }
        bytes32 result = IFHE(cop).and_(ebool.unwrap(lhs), ebool.unwrap(rhs));
        return ebool.wrap(result);
    }

    /**
     * @notice Homomorphic NOT: result = !value (encrypted boolean).
     */
    function not_(ebool value) internal returns (ebool) {
        address cop = _coprocessor();
        if (cop == address(0)) {
            uint256 v = uint256(ebool.unwrap(value));
            return ebool.wrap(bytes32(v == 0 ? uint256(1) : uint256(0)));
        }
        bytes32 result = IFHE(cop).not_(ebool.unwrap(value));
        return ebool.wrap(result);
    }

    // ══════════════════════════════════════════════════════════════
    //                   CONDITIONAL SELECT (MUX)
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Encrypted ternary: result = condition ? ifTrue : ifFalse
     * @dev This is the core privacy primitive. The condition, both branches,
     *      AND the result are all encrypted. An observer cannot determine
     *      which branch was taken.
     *
     * Common pattern for confidential transfers:
     *   euint64 transferValue = FHE.select(hasFunds, amount, FHE.asEuint64(0));
     *   // If sender has enough → transfer amount; otherwise → transfer 0
     *   // External observers see the same gas cost regardless of outcome
     */
    function select(ebool condition, euint64 ifTrue, euint64 ifFalse) internal returns (euint64) {
        address cop = _coprocessor();
        if (cop == address(0)) {
            uint256 c = uint256(ebool.unwrap(condition));
            if (c != 0) {
                return ifTrue;
            } else {
                return ifFalse;
            }
        }
        bytes32 result = IFHE(cop).select(
            ebool.unwrap(condition),
            euint64.unwrap(ifTrue),
            euint64.unwrap(ifFalse)
        );
        return euint64.wrap(result);
    }

    // ══════════════════════════════════════════════════════════════
    //              ACCESS CONTROL (ACL) WRAPPERS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Grant decryption permission to a specific address.
     * @dev Only the handle owner (or the contract that created it) can grant access.
     *      This is essential for allowing users to decrypt their own balances.
     */
    function allow(euint64 handle, address account) internal {
        address cop = _coprocessor();
        if (cop != address(0)) {
            IFHE(cop).allow(euint64.unwrap(handle), account);
        }
    }

    function allow(ebool handle, address account) internal {
        address cop = _coprocessor();
        if (cop != address(0)) {
            IFHE(cop).allow(ebool.unwrap(handle), account);
        }
    }

    /**
     * @notice Grant decryption permission to the calling contract itself.
     * @dev Required for the contract to perform operations on the encrypted value
     *      in future transactions.
     */
    function allowThis(euint64 handle) internal {
        address cop = _coprocessor();
        if (cop != address(0)) {
            IFHE(cop).allowThis(euint64.unwrap(handle));
        }
    }

    function allowThis(ebool handle) internal {
        address cop = _coprocessor();
        if (cop != address(0)) {
            IFHE(cop).allowThis(ebool.unwrap(handle));
        }
    }

    /**
     * @notice Check if the msg.sender is allowed to use this encrypted handle.
     */
    function isSenderAllowed(euint64 handle) internal view returns (bool) {
        address cop = _coprocessor();
        if (cop == address(0)) return true; // Mock mode
        return IFHE(cop).isSenderAllowed(euint64.unwrap(handle));
    }

    // ══════════════════════════════════════════════════════════════
    //                    DECRYPTION REQUEST
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Request public decryption of an encrypted value.
     * @dev Triggers the KMS MPC protocol. The decrypted value will be available
     *      asynchronously via callback or gateway query.
     *      WARNING: Use sparingly — decryption reveals the plaintext!
     */
    function makePubliclyDecryptable(euint64 handle) internal {
        address cop = _coprocessor();
        if (cop != address(0)) {
            IFHE(cop).makePubliclyDecryptable(euint64.unwrap(handle));
        }
    }

    // ══════════════════════════════════════════════════════════════
    //                    UTILITY: ZERO CHECK
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Check if an encrypted handle represents an uninitialized (zero) value.
     * @dev In the mock implementation, bytes32(0) means uninitialized.
     *      In production fhEVM, the handle is never zero for valid ciphertexts.
     */
    function isInitialized(euint64 handle) internal pure returns (bool) {
        return euint64.unwrap(handle) != bytes32(0);
    }
}
