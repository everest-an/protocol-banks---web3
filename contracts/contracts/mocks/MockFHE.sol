// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../fhe/IFHE.sol";

/**
 * @title MockFHE - Mock FHE Coprocessor for Testing
 * @author Protocol Banks Team
 * @notice Plaintext-backed implementation of the FHE coprocessor interface.
 *
 * @dev This contract stores "encrypted" values as plaintext uint256 values
 *      behind bytes32 handles. It implements all IFHE operations using standard
 *      Solidity arithmetic, making it suitable for Hardhat/Foundry unit testing
 *      without needing a real TFHE coprocessor.
 *
 *      IMPORTANT: This contract provides ZERO actual encryption. It is ONLY for
 *      testing business logic. Security/privacy testing requires a real fhEVM
 *      devnet (e.g., Zama's fhEVM-native or Fhenix testnet).
 *
 * Architecture:
 *   - Each "ciphertext" is stored in a mapping: handle → plaintext value
 *   - Handle = keccak256(counter++) — deterministic, unique per value
 *   - ACL is tracked as mapping(handle → mapping(address → bool))
 *   - All operations produce new handles (immutable ciphertext pattern)
 */
contract MockFHE is IFHE {
    // ══════════════════════════════════════════════════════════════
    //                     INTERNAL STATE
    // ══════════════════════════════════════════════════════════════

    /// @dev Counter for generating unique handles
    uint256 private _handleCounter;

    /// @dev Mapping from handle → plaintext value
    mapping(bytes32 => uint256) public plaintextValues;

    /// @dev ACL: handle → address → allowed
    mapping(bytes32 => mapping(address => bool)) public acl;

    /// @dev Publicly decryptable handles
    mapping(bytes32 => bool) public isPubliclyDecryptable;

    // ══════════════════════════════════════════════════════════════
    //                         EVENTS
    // ══════════════════════════════════════════════════════════════
    event MockEncrypt(bytes32 indexed handle, uint256 value);
    event MockOperation(string op, bytes32 indexed result, uint256 value);
    event MockACLGrant(bytes32 indexed handle, address indexed account);
    event MockDecryptRequest(bytes32 indexed handle, uint256 value);

    // ══════════════════════════════════════════════════════════════
    //                     TRIVIAL ENCRYPTION
    // ══════════════════════════════════════════════════════════════

    function asEuint64(uint64 value) external override returns (bytes32) {
        return _newHandle(uint256(value));
    }

    function asEbool(bool value) external override returns (bytes32) {
        return _newHandle(value ? 1 : 0);
    }

    function asEaddress(address value) external override returns (bytes32) {
        return _newHandle(uint256(uint160(value)));
    }

    function fromExternal(bytes32 handle, bytes calldata /* inputProof */) external override returns (bytes32) {
        // In mock mode, the "external" handle is just a bytes32 wrapping the plaintext.
        // We create a proper internal handle for it.
        uint256 plaintext = uint256(handle);
        return _newHandle(plaintext);
    }

    // ══════════════════════════════════════════════════════════════
    //                    ARITHMETIC OPERATIONS
    // ══════════════════════════════════════════════════════════════

    function add(bytes32 lhs, bytes32 rhs) external override returns (bytes32) {
        uint256 a = plaintextValues[lhs];
        uint256 b = plaintextValues[rhs];
        uint256 result = a + b;
        // Overflow check for uint64
        require(result <= type(uint64).max, "MockFHE: euint64 overflow");
        bytes32 handle = _newHandle(result);
        emit MockOperation("add", handle, result);
        return handle;
    }

    function sub(bytes32 lhs, bytes32 rhs) external override returns (bytes32) {
        uint256 a = plaintextValues[lhs];
        uint256 b = plaintextValues[rhs];
        uint256 result = a >= b ? a - b : 0; // TFHE wraps to 0 on underflow
        bytes32 handle = _newHandle(result);
        emit MockOperation("sub", handle, result);
        return handle;
    }

    function mul(bytes32 lhs, bytes32 rhs) external override returns (bytes32) {
        uint256 a = plaintextValues[lhs];
        uint256 b = plaintextValues[rhs];
        uint256 result = a * b;
        require(result <= type(uint64).max, "MockFHE: euint64 overflow");
        bytes32 handle = _newHandle(result);
        emit MockOperation("mul", handle, result);
        return handle;
    }

    // ══════════════════════════════════════════════════════════════
    //                   COMPARISON OPERATIONS
    // ══════════════════════════════════════════════════════════════

    function le(bytes32 lhs, bytes32 rhs) external override returns (bytes32) {
        uint256 a = plaintextValues[lhs];
        uint256 b = plaintextValues[rhs];
        bytes32 handle = _newHandle(a <= b ? 1 : 0);
        emit MockOperation("le", handle, a <= b ? 1 : 0);
        return handle;
    }

    function lt(bytes32 lhs, bytes32 rhs) external override returns (bytes32) {
        uint256 a = plaintextValues[lhs];
        uint256 b = plaintextValues[rhs];
        bytes32 handle = _newHandle(a < b ? 1 : 0);
        emit MockOperation("lt", handle, a < b ? 1 : 0);
        return handle;
    }

    function ge(bytes32 lhs, bytes32 rhs) external override returns (bytes32) {
        uint256 a = plaintextValues[lhs];
        uint256 b = plaintextValues[rhs];
        bytes32 handle = _newHandle(a >= b ? 1 : 0);
        return handle;
    }

    function gt(bytes32 lhs, bytes32 rhs) external override returns (bytes32) {
        uint256 a = plaintextValues[lhs];
        uint256 b = plaintextValues[rhs];
        bytes32 handle = _newHandle(a > b ? 1 : 0);
        return handle;
    }

    function eq(bytes32 lhs, bytes32 rhs) external override returns (bytes32) {
        uint256 a = plaintextValues[lhs];
        uint256 b = plaintextValues[rhs];
        bytes32 handle = _newHandle(a == b ? 1 : 0);
        return handle;
    }

    function ne(bytes32 lhs, bytes32 rhs) external override returns (bytes32) {
        uint256 a = plaintextValues[lhs];
        uint256 b = plaintextValues[rhs];
        bytes32 handle = _newHandle(a != b ? 1 : 0);
        return handle;
    }

    // ══════════════════════════════════════════════════════════════
    //                    LOGICAL OPERATIONS
    // ══════════════════════════════════════════════════════════════

    function and_(bytes32 lhs, bytes32 rhs) external override returns (bytes32) {
        uint256 a = plaintextValues[lhs];
        uint256 b = plaintextValues[rhs];
        return _newHandle(a & b);
    }

    function or_(bytes32 lhs, bytes32 rhs) external override returns (bytes32) {
        uint256 a = plaintextValues[lhs];
        uint256 b = plaintextValues[rhs];
        return _newHandle(a | b);
    }

    function not_(bytes32 value) external override returns (bytes32) {
        uint256 v = plaintextValues[value];
        return _newHandle(v == 0 ? 1 : 0);
    }

    // ══════════════════════════════════════════════════════════════
    //                    CONDITIONAL SELECT
    // ══════════════════════════════════════════════════════════════

    function select(bytes32 condition, bytes32 ifTrue, bytes32 ifFalse) external override returns (bytes32) {
        uint256 c = plaintextValues[condition];
        uint256 result = c != 0 ? plaintextValues[ifTrue] : plaintextValues[ifFalse];
        bytes32 handle = _newHandle(result);
        emit MockOperation("select", handle, result);
        return handle;
    }

    // ══════════════════════════════════════════════════════════════
    //                    ACCESS CONTROL (ACL)
    // ══════════════════════════════════════════════════════════════

    function allow(bytes32 handle, address account) external override {
        acl[handle][account] = true;
        emit MockACLGrant(handle, account);
    }

    function allowThis(bytes32 handle) external override {
        acl[handle][msg.sender] = true;
        emit MockACLGrant(handle, msg.sender);
    }

    function isSenderAllowed(bytes32 handle) external view override returns (bool) {
        return acl[handle][msg.sender];
    }

    // ══════════════════════════════════════════════════════════════
    //                      DECRYPTION
    // ══════════════════════════════════════════════════════════════

    function makePubliclyDecryptable(bytes32 handle) external override {
        isPubliclyDecryptable[handle] = true;
        emit MockDecryptRequest(handle, plaintextValues[handle]);
    }

    /**
     * @notice Decrypt a handle to its plaintext value.
     * @dev In production, this would go through the KMS MPC protocol.
     *      In mock mode, it simply returns the stored plaintext.
     */
    function publicDecrypt(bytes32 handle) external view override returns (uint256) {
        require(isPubliclyDecryptable[handle], "MockFHE: not publicly decryptable");
        return plaintextValues[handle];
    }

    // ══════════════════════════════════════════════════════════════
    //                    TEST HELPER FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice Get the plaintext value behind an encrypted handle (test only).
     * @dev This function does NOT exist in production FHE. It's a testing backdoor.
     */
    function revealPlaintext(bytes32 handle) external view returns (uint256) {
        return plaintextValues[handle];
    }

    /**
     * @notice Get the current handle counter (for debugging).
     */
    function handleCount() external view returns (uint256) {
        return _handleCounter;
    }

    // ══════════════════════════════════════════════════════════════
    //                    INTERNAL HELPERS
    // ══════════════════════════════════════════════════════════════

    /**
     * @dev Create a new handle pointing to the given plaintext value.
     */
    function _newHandle(uint256 value) internal returns (bytes32) {
        _handleCounter++;
        bytes32 handle = keccak256(abi.encodePacked("mock_fhe_handle_", _handleCounter));
        plaintextValues[handle] = value;
        emit MockEncrypt(handle, value);
        return handle;
    }
}
