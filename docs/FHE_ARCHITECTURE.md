# FHE Architecture — Protocol Bank Privacy Layer

> **Version**: 1.0.0  
> **Date**: 2025-07-17  
> **Status**: Implementation Phase  
> **Authors**: Protocol Banks Team

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Technology Overview: Fully Homomorphic Encryption](#technology-overview)
4. [Architecture Design](#architecture-design)
5. [Contract Specifications](#contract-specifications)
6. [Client SDK](#client-sdk)
7. [Performance Analysis](#performance-analysis)
8. [Security Considerations](#security-considerations)
9. [Academic References](#academic-references)
10. [Deployment Roadmap](#deployment-roadmap)

---

## 1. Executive Summary

Protocol Bank integrates **Fully Homomorphic Encryption (FHE)** to provide on-chain privacy for the pbUSD stablecoin and HashKey Chain treasury operations. Using Zama's TFHE (Torus FHE) scheme via the fhEVM coprocessor architecture, we enable:

- **Encrypted balances**: User token balances are stored as TFHE ciphertexts
- **Encrypted transfers**: Transaction amounts are never visible on-chain
- **Encrypted state**: Contract state (allowances, caps) computed homomorphically
- **Confidential compliance**: Blacklist enforcement without revealing balance data

This is achieved without modifying the EVM execution model — the fhEVM coprocessor performs FHE computations off-chain while the EVM manages symbolic handles on-chain.

## 2. Problem Statement

### Current Privacy Gaps

| Component | Exposure | Risk Level |
|-----------|----------|------------|
| ERC-20 balances | Fully public via `balanceOf()` | **Critical** |
| Transfer amounts | Public in `Transfer` event logs | **Critical** |
| Allowances | Public via `allowance()` | **High** |
| Mint/burn patterns | Public supply tracking | **Medium** |
| Treasury deposits | Public USDC transfers | **Medium** |

### Regulatory Context

- **Hong Kong PDPO**: Personal financial data (balances) requires protection
- **HashKey Chain compliance**: Institutional users require confidential transactions
- **Competitive advantage**: Privacy-preserving stablecoins are a differentiator

## 3. Technology Overview

### 3.1 What is FHE?

Fully Homomorphic Encryption allows computation on encrypted data without decryption:

$$E(a) \oplus E(b) = E(a + b)$$

$$E(a) \otimes E(b) = E(a \times b)$$

Where $E()$ is the encryption function, and $\oplus$, $\otimes$ are homomorphic addition and multiplication.

### 3.2 TFHE (Torus FHE)

Protocol Bank uses **TFHE** (Torus Fully Homomorphic Encryption), specifically the TFHE-rs Rust implementation by Zama:

- **Lattice-based**: Security from Learning with Errors (LWE) problem
- **Bootstrapping**: Gate bootstrapping refreshes noise after each operation
- **Programmable**: Supports arbitrary boolean and arithmetic circuits
- **Post-quantum**: Resistant to quantum computing attacks (Shor's algorithm)

**Key Paper**: *"TFHE: Fast Fully Homomorphic Encryption over the Torus"* — Chillotti, Gama, Georgieva, Izabachène (Journal of Cryptology, 2020)

### 3.3 fhEVM Architecture

The fhEVM (Zama) architecture separates symbolic execution from FHE computation:

```
┌──────────────────────────────────────────────────────────┐
│                    On-Chain (EVM)                         │
│  ┌─────────────────┐    ┌────────────────────────────┐   │
│  │ ConfidentialPBUSD│    │  Symbolic FHE Handles      │   │
│  │ Contract         │───▶│  (bytes32 pointers to      │   │
│  │                  │    │   ciphertexts in coprocessor)│  │
│  └─────────────────┘    └────────────────────────────┘   │
│          │                           │                    │
│          ▼                           ▼                    │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  FHE Precompile / Coprocessor Gateway               │ │
│  │  (Routes FHE operations off-chain)                  │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│                Off-Chain (Coprocessor)                    │
│  ┌──────────────────┐  ┌──────────────────────────────┐ │
│  │   TFHE Engine     │  │  Ciphertext Storage          │ │
│  │   (tfhe-rs)       │  │  (encrypted values)          │ │
│  │   - add, sub, mul │  │  - balance ciphertexts       │ │
│  │   - compare, mux  │  │  - allowance ciphertexts     │ │
│  └──────────────────┘  └──────────────────────────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────────┐│
│  │            KMS (Key Management Service)              ││
│  │  - Threshold decryption (MPC)                        ││
│  │  - ACL enforcement                                   ││
│  │  - Re-encryption for user wallets                    ││
│  └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### 3.4 Encrypted Types

| Type | Size | Use Case | Solidity Type |
|------|------|----------|---------------|
| `euint64` | 64-bit encrypted uint | Balances, amounts, caps | `bytes32` handle |
| `ebool` | Encrypted boolean | Comparison results, flags | `bytes32` handle |
| `eaddress` | Encrypted address | Confidential recipients | `bytes32` handle |

## 4. Architecture Design

### 4.1 Contract Hierarchy

```
contracts/fhe/
├── IFHE.sol                  # FHE type definitions & coprocessor interface
├── FHE.sol                   # Static library wrapping coprocessor operations
├── ConfidentialPBUSD.sol      # FHE-enabled pbUSD token (cPBUSD)
└── ConfidentialTreasury.sol   # FHE-enabled USDC treasury vault

contracts/mocks/
└── MockFHE.sol               # Plaintext-backed mock for testing

lib/fhe/
├── fhe-sdk.ts                # Client-side FHE TypeScript SDK
└── index.ts                  # Module exports
```

### 4.2 Encrypted Balance Storage

```solidity
// Standard ERC-20 (public):
mapping(address => uint256) public balanceOf;

// Confidential pbUSD (FHE-encrypted):
mapping(address => euint64) internal _encBalances;
```

The `euint64` type is a `bytes32` handle pointing to a TFHE ciphertext in the coprocessor. Even the contract cannot "see" the plaintext — it operates on opaque handles.

### 4.3 Confidential Transfer Algorithm

```
1. Sender provides: encrypted amount (from client SDK)
2. Contract checks: FHE.le(amount, senderBalance) → encrypted bool
3. Compute: transferValue = FHE.select(hasFunds, amount, 0)
4. Update:  senderBalance = FHE.sub(senderBalance, transferValue)
5. Update:  recipientBalance = FHE.add(recipientBalance, transferValue)
6. Set ACL: FHE.allowThis() + FHE.allow(handle, owner)
```

**Key property**: Steps 3-5 execute identically whether the transfer succeeds or fails. An external observer sees the same gas cost and state changes (updated handles) regardless. This prevents timing/gas side-channel attacks.

### 4.4 Dual Interface

Each function has two variants:

| Variant | Privacy | Use Case |
|---------|---------|----------|
| `transfer(to, externalEuint64, proof)` | **Full** — amount encrypted end-to-end | DeFi, P2P |
| `transfer(to, uint256)` | **Partial** — amount in calldata but balance encrypted | Legacy compatibility |

## 5. Contract Specifications

### 5.1 ConfidentialPBUSD (cPBUSD)

| Feature | Implementation |
|---------|---------------|
| **Name** | "Confidential Protocol Bank USD" |
| **Symbol** | cPBUSD |
| **Decimals** | 6 (matches USDC/pbUSD) |
| **Balances** | `euint64` (encrypted) |
| **Allowances** | `euint64` (encrypted) |
| **Total Supply** | `uint256` (plaintext for composability) |
| **Mint** | Plaintext amount → encrypted balance (compliance) |
| **Transfer** | Fully encrypted amount + balance updates |
| **Burn** | Plaintext amount for bridge bot (encrypted balance deduction) |
| **ERC-3009** | Supported for x402 compatibility (plaintext auth amount) |
| **Blacklist** | Plaintext (compliance requirement) |
| **Roles** | MINTER, PAUSER, COMPLIANCE, FEE_MANAGER |

### 5.2 ConfidentialTreasury (cTreasury)

| Feature | Implementation |
|---------|---------------|
| **Deposit Tracking** | Per-address `euint64` encrypted cumulative |
| **Release Tracking** | Per-address `euint64` encrypted cumulative |
| **Aggregate Totals** | Plaintext (proof-of-reserve) |
| **Emergency Withdraw** | Encrypted amount until execution |
| **Daily Release Cap** | Plaintext (operational limit) |

## 6. Client SDK

### 6.1 Usage Example

```typescript
import { FHEInstance, FHE_NETWORKS } from '@protocol-bank/fhe';

// Initialize
const fhe = new FHEInstance(FHE_NETWORKS.hashkey_testnet);
await fhe.initialize(signer);

// Encrypt & transfer
const encrypted = await fhe.encryptUint64(1_000_000n); // 1 cPBUSD
await cpbusd.transfer(recipient, encrypted.handle, encrypted.inputProof);

// Decrypt balance
const balance = await fhe.decryptBalance(cpbusd, myAddress);
console.log(`Balance: ${FHEInstance.formatBalance(balance.value)} cPBUSD`);
```

### 6.2 Decryption Flow

```
User Wallet  ──▶  Sign EIP-712 Decrypt Request
                      │
                      ▼
              KMS Gateway (API)
                      │
                      ▼
         Verify Signature + ACL
                      │
                      ▼
      MPC Threshold Decryption (n-of-m KMS nodes)
                      │
                      ▼
          Return Plaintext to Requester Only
```

## 7. Performance Analysis

### 7.1 Gas Cost Comparison

| Operation | Standard ERC-20 | Confidential cPBUSD | Overhead |
|-----------|----------------|---------------------|----------|
| Transfer | ~65,000 gas | ~600,000-800,000 gas | ~10-12x |
| Approve | ~46,000 gas | ~300,000 gas | ~6.5x |
| BalanceOf | ~2,600 gas (view) | ~2,600 gas (returns handle) | 1x |
| Mint | ~70,000 gas | ~400,000 gas | ~5.7x |

### 7.2 Latency

| Component | Latency |
|-----------|---------|
| FHE coprocessor (per operation) | ~10-50ms |
| Bootstrapping (noise refresh) | ~100ms |
| KMS decryption (threshold MPC) | ~500ms-2s |
| Client-side encryption | ~200-500ms |

### 7.3 Optimization Strategies

1. **Batch operations**: Combine multiple FHE ops in single coprocessor call
2. **Lazy bootstrapping**: Only refresh noise when necessary
3. **Amortized decryption**: Batch decrypt requests to KMS
4. **Client-side caching**: Cache decrypted balances with TTL

## 8. Security Considerations

### 8.1 Threat Model

| Threat | Mitigation |
|--------|-----------|
| Balance leakage via gas patterns | Constant-gas `FHE.select()` pattern |
| Side-channel via revert | No revert on insufficient funds (transfers 0) |
| KMS compromise | Threshold decryption (no single point of failure) |
| Chosen-ciphertext attacks | Input proofs (ZK) validate ciphertext well-formedness |
| Replay attacks | ACL + nonce tracking (ERC-3009) |
| Quantum attacks | TFHE lattice-based (post-quantum secure) |

### 8.2 Known Limitations

1. **Total supply is public**: Required for DeFi composability. Individual balances remain private.
2. **Mint amounts are public**: Compliance requirement for auditable token issuance.
3. **USDC transfers are public**: The underlying USDC ERC-20 on Base has plaintext transfers.
4. **Fee calculation v1**: Transfer fees are deferred to v2 for full homomorphic computation.
5. **Gas overhead**: ~10x compared to standard ERC-20. Acceptable for privacy-critical use cases.

### 8.3 Post-Quantum Security

TFHE is based on the **Learning with Errors (LWE)** problem, which is conjectured to be hard even for quantum computers. The security parameter λ ≥ 128 provides:

$$2^{128} \text{ classical operations}$$
$$2^{64} \text{ quantum operations (Grover's bound)}$$

This exceeds NIST Post-Quantum Cryptography (PQC) Level 1 requirements.

## 9. Academic References

### Primary References

1. **TFHE: Fast Fully Homomorphic Encryption over the Torus**  
   Chillotti, I., Gama, N., Georgieva, M., & Izabachène, M.  
   *Journal of Cryptology*, 33(1), 34-91, 2020.  
   DOI: [10.1007/s00145-019-09319-x](https://doi.org/10.1007/s00145-019-09319-x)

2. **fhEVM: Confidential EVM Smart Contracts using Fully Homomorphic Encryption**  
   Zama Team, 2023.  
   GitHub: [zama-ai/fhevm](https://github.com/zama-ai/fhevm)

3. **TFHE-rs: A Pure Rust Implementation of TFHE for Boolean and Integer Arithmetics**  
   Zama Team, 2022.  
   GitHub: [zama-ai/tfhe-rs](https://github.com/zama-ai/tfhe-rs)

### Secondary References

4. **Fully Homomorphic Encryption from Ring-LWE and Security for Key Dependent Messages**  
   Brakerski, Z., & Vaikuntanathan, V.  
   *CRYPTO 2011*, Springer LNCS 6841, pp. 505-524.

5. **Somewhat Practical Fully Homomorphic Encryption**  
   Fan, J., & Vercauteren, F.  
   *IACR ePrint Archive*, 2012/144.

6. **Homomorphic Encryption for Arithmetic of Approximate Numbers (CKKS)**  
   Cheon, J.H., Kim, A., Kim, M., & Song, Y.  
   *ASIACRYPT 2017*, Springer LNCS 10624.

7. **OpenFHE: Open-Source Fully Homomorphic Encryption Library**  
   Al Badawi, A., et al.  
   *ACM CCS 2022 Workshop on Encrypted Computing and Applied Homomorphic Cryptography*.

### Industry & Standards

8. **ERC-7984: Confidential ERC-20 Token (Draft)**  
   OpenZeppelin, 2024.  
   Ethereum Improvement Proposals.

9. **Homomorphic Encryption Standard**  
   HomomorphicEncryption.org, 2018.  
   [https://homomorphicencryption.org/standard/](https://homomorphicencryption.org/standard/)

10. **NIST Post-Quantum Cryptography Standardization**  
    NIST, 2024.  
    Lattice-based schemes: CRYSTALS-Kyber, CRYSTALS-Dilithium.

## 10. Deployment Roadmap

### Phase 1: Development (Current)
- [x] FHE type system (`IFHE.sol`, `FHE.sol`)
- [x] ConfidentialPBUSD contract
- [x] ConfidentialTreasury contract
- [x] MockFHE for local testing
- [x] Client-side SDK
- [x] Unit tests with MockFHE

### Phase 2: Testnet (Q3 2025)
- [ ] Deploy on Zama fhEVM devnet
- [ ] Integration testing with real TFHE coprocessor
- [ ] KMS Gateway integration
- [ ] Performance benchmarking
- [ ] Security audit (FHE-specific)

### Phase 3: HashKey Chain Integration (Q4 2025)
- [ ] Deploy FHE coprocessor on HashKey Chain L2
- [ ] Bridge bot upgrade for encrypted events
- [ ] Wallet SDK integration (Reown/WalletConnect)
- [ ] Regulatory review with HashKey compliance team

### Phase 4: Mainnet (Q1 2026)
- [ ] Gradual migration: pbUSD → cPBUSD
- [ ] Dual-running period (both contracts active)
- [ ] Full privacy mode activation
- [ ] Sunset plaintext pbUSD

---

*This document is part of the Protocol Banks technical documentation. For questions, contact the engineering team.*
