// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ProofRegistry (PB-Proof)
 * @author ProtocolBanks
 * @notice On-chain registry for immutable proof storage
 * @dev Stores hashes of off-chain data (payslips, transactions, audits) for verification
 *
 * Key Features:
 * - Store proof hashes with metadata
 * - Batch proof submission
 * - Proof verification
 * - Event emission for indexing
 */
contract ProofRegistry is Ownable, ReentrancyGuard {
    // ============================================================================
    // Types
    // ============================================================================

    enum ProofType {
        PAYSLIP,        // Salary payment proof
        TRANSACTION,    // General transaction proof
        AUDIT,          // Audit trail entry
        SPLIT,          // Salary split execution
        SETTLEMENT,     // Payment channel settlement
        SESSION_KEY,    // Session key operation
        CUSTOM          // Custom proof type
    }

    struct Proof {
        bytes32 dataHash;       // SHA256 hash of the data
        ProofType proofType;    // Type of proof
        address submitter;      // Who submitted the proof
        uint256 timestamp;      // When it was submitted
        bytes32 referenceId;    // External reference (e.g., payslip ID)
        string metadata;        // Additional metadata (JSON)
        bool exists;            // Whether this proof exists
    }

    struct ProofBatch {
        bytes32[] proofIds;
        uint256 timestamp;
        address submitter;
    }

    // ============================================================================
    // State Variables
    // ============================================================================

    // Mapping from proof ID to Proof
    mapping(bytes32 => Proof) public proofs;

    // Mapping from reference ID to proof IDs
    mapping(bytes32 => bytes32[]) public referenceToProofs;

    // Mapping from submitter to their proof IDs
    mapping(address => bytes32[]) public submitterProofs;

    // Batch records
    mapping(bytes32 => ProofBatch) public batches;

    // Authorized submitters (can be updated by owner)
    mapping(address => bool) public authorizedSubmitters;

    // Total proof count
    uint256 public proofCount;

    // ============================================================================
    // Events
    // ============================================================================

    event ProofSubmitted(
        bytes32 indexed proofId,
        bytes32 indexed dataHash,
        ProofType proofType,
        address indexed submitter,
        bytes32 referenceId,
        uint256 timestamp
    );

    event BatchSubmitted(
        bytes32 indexed batchId,
        uint256 proofCount,
        address indexed submitter,
        uint256 timestamp
    );

    event SubmitterAuthorized(address indexed submitter, bool authorized);

    // ============================================================================
    // Modifiers
    // ============================================================================

    modifier onlyAuthorized() {
        require(
            authorizedSubmitters[msg.sender] || msg.sender == owner(),
            "ProofRegistry: Not authorized"
        );
        _;
    }

    // ============================================================================
    // Constructor
    // ============================================================================

    constructor() Ownable(msg.sender) {
        // Owner is automatically authorized
        authorizedSubmitters[msg.sender] = true;
    }

    // ============================================================================
    // External Functions
    // ============================================================================

    /**
     * @notice Submit a single proof
     * @param dataHash SHA256 hash of the data being proven
     * @param proofType Type of the proof
     * @param referenceId External reference ID
     * @param metadata Additional metadata (JSON string)
     * @return proofId The unique identifier for this proof
     */
    function submitProof(
        bytes32 dataHash,
        ProofType proofType,
        bytes32 referenceId,
        string calldata metadata
    ) external onlyAuthorized nonReentrant returns (bytes32 proofId) {
        require(dataHash != bytes32(0), "ProofRegistry: Invalid data hash");

        proofId = _generateProofId(dataHash, msg.sender, block.timestamp);
        require(!proofs[proofId].exists, "ProofRegistry: Proof already exists");

        proofs[proofId] = Proof({
            dataHash: dataHash,
            proofType: proofType,
            submitter: msg.sender,
            timestamp: block.timestamp,
            referenceId: referenceId,
            metadata: metadata,
            exists: true
        });

        referenceToProofs[referenceId].push(proofId);
        submitterProofs[msg.sender].push(proofId);
        proofCount++;

        emit ProofSubmitted(
            proofId,
            dataHash,
            proofType,
            msg.sender,
            referenceId,
            block.timestamp
        );

        return proofId;
    }

    /**
     * @notice Submit multiple proofs in a batch
     * @param dataHashes Array of data hashes
     * @param proofTypes Array of proof types
     * @param referenceIds Array of reference IDs
     * @param metadatas Array of metadata strings
     * @return batchId The unique identifier for this batch
     */
    function submitBatch(
        bytes32[] calldata dataHashes,
        ProofType[] calldata proofTypes,
        bytes32[] calldata referenceIds,
        string[] calldata metadatas
    ) external onlyAuthorized nonReentrant returns (bytes32 batchId) {
        uint256 length = dataHashes.length;
        require(length > 0, "ProofRegistry: Empty batch");
        require(
            length == proofTypes.length &&
            length == referenceIds.length &&
            length == metadatas.length,
            "ProofRegistry: Array length mismatch"
        );
        require(length <= 100, "ProofRegistry: Batch too large");

        batchId = keccak256(abi.encodePacked(msg.sender, block.timestamp, proofCount));
        bytes32[] memory proofIds = new bytes32[](length);

        for (uint256 i = 0; i < length; i++) {
            require(dataHashes[i] != bytes32(0), "ProofRegistry: Invalid data hash");

            bytes32 proofId = _generateProofId(dataHashes[i], msg.sender, block.timestamp + i);

            proofs[proofId] = Proof({
                dataHash: dataHashes[i],
                proofType: proofTypes[i],
                submitter: msg.sender,
                timestamp: block.timestamp,
                referenceId: referenceIds[i],
                metadata: metadatas[i],
                exists: true
            });

            referenceToProofs[referenceIds[i]].push(proofId);
            submitterProofs[msg.sender].push(proofId);
            proofIds[i] = proofId;

            emit ProofSubmitted(
                proofId,
                dataHashes[i],
                proofTypes[i],
                msg.sender,
                referenceIds[i],
                block.timestamp
            );
        }

        batches[batchId] = ProofBatch({
            proofIds: proofIds,
            timestamp: block.timestamp,
            submitter: msg.sender
        });

        proofCount += length;

        emit BatchSubmitted(batchId, length, msg.sender, block.timestamp);

        return batchId;
    }

    /**
     * @notice Verify a proof exists and matches the expected data
     * @param proofId The proof ID to verify
     * @param expectedHash The expected data hash
     * @return valid Whether the proof is valid
     */
    function verifyProof(bytes32 proofId, bytes32 expectedHash) external view returns (bool valid) {
        Proof storage proof = proofs[proofId];
        return proof.exists && proof.dataHash == expectedHash;
    }

    /**
     * @notice Get proof details
     * @param proofId The proof ID
     * @return dataHash The data hash
     * @return proofType The type of proof
     * @return submitter The submitter address
     * @return timestamp The submission timestamp
     * @return referenceId The reference ID
     */
    function getProof(bytes32 proofId) external view returns (
        bytes32 dataHash,
        ProofType proofType,
        address submitter,
        uint256 timestamp,
        bytes32 referenceId
    ) {
        Proof storage proof = proofs[proofId];
        require(proof.exists, "ProofRegistry: Proof not found");

        return (
            proof.dataHash,
            proof.proofType,
            proof.submitter,
            proof.timestamp,
            proof.referenceId
        );
    }

    /**
     * @notice Get proofs by reference ID
     * @param referenceId The reference ID
     * @return proofIds Array of proof IDs
     */
    function getProofsByReference(bytes32 referenceId) external view returns (bytes32[] memory) {
        return referenceToProofs[referenceId];
    }

    /**
     * @notice Get proofs by submitter
     * @param submitter The submitter address
     * @return proofIds Array of proof IDs
     */
    function getProofsBySubmitter(address submitter) external view returns (bytes32[] memory) {
        return submitterProofs[submitter];
    }

    /**
     * @notice Get batch details
     * @param batchId The batch ID
     * @return proofIds Array of proof IDs in the batch
     * @return timestamp Batch submission timestamp
     * @return submitter Batch submitter
     */
    function getBatch(bytes32 batchId) external view returns (
        bytes32[] memory proofIds,
        uint256 timestamp,
        address submitter
    ) {
        ProofBatch storage batch = batches[batchId];
        return (batch.proofIds, batch.timestamp, batch.submitter);
    }

    // ============================================================================
    // Admin Functions
    // ============================================================================

    /**
     * @notice Authorize or revoke a submitter
     * @param submitter The address to authorize/revoke
     * @param authorized Whether to authorize or revoke
     */
    function setAuthorizedSubmitter(address submitter, bool authorized) external onlyOwner {
        authorizedSubmitters[submitter] = authorized;
        emit SubmitterAuthorized(submitter, authorized);
    }

    /**
     * @notice Batch authorize submitters
     * @param submitters Array of addresses
     * @param authorized Whether to authorize or revoke
     */
    function batchSetAuthorizedSubmitters(
        address[] calldata submitters,
        bool authorized
    ) external onlyOwner {
        for (uint256 i = 0; i < submitters.length; i++) {
            authorizedSubmitters[submitters[i]] = authorized;
            emit SubmitterAuthorized(submitters[i], authorized);
        }
    }

    // ============================================================================
    // Internal Functions
    // ============================================================================

    /**
     * @notice Generate a unique proof ID
     */
    function _generateProofId(
        bytes32 dataHash,
        address submitter,
        uint256 timestamp
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(dataHash, submitter, timestamp, proofCount));
    }
}
