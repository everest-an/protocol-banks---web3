/**
 * @module @protocol-bank/fhe-sdk
 * @description Client-side FHE SDK for Protocol Bank confidential transactions.
 *
 * This SDK provides TypeScript helpers for interacting with the ConfidentialPBUSD
 * and ConfidentialTreasury contracts. It handles:
 *   1. Client-side encryption of transaction amounts using the FHE public key
 *   2. Generation of input proofs (ZK proofs of well-formed ciphertexts)
 *   3. Decryption of encrypted balances via the KMS Gateway
 *   4. ABI encoding helpers for encrypted function calls
 *
 * Architecture:
 *   ┌─────────────┐     ┌──────────────┐     ┌───────────────┐
 *   │   User UI   │────▶│   FHE SDK    │────▶│  fhEVM Chain  │
 *   │  (Browser)  │◀────│  (this lib)  │◀────│  (Coprocessor)│
 *   └─────────────┘     └──────────────┘     └───────────────┘
 *         │                     │                     │
 *         │  plaintext amount   │  encrypted handle   │  TFHE ciphertext
 *         │  + wallet signing   │  + ZK input proof   │  + ACL permissions
 *
 * References:
 *   - Zama fhevmjs: https://github.com/zama-ai/fhevmjs
 *   - TFHE-rs: https://github.com/zama-ai/tfhe-rs
 *   - EIP-712: Typed structured data hashing
 */

import { ethers, type Contract, type Signer } from 'ethers';

// ══════════════════════════════════════════════════════════════
//                       TYPE DEFINITIONS
// ══════════════════════════════════════════════════════════════

/**
 * Opaque encrypted handle — a bytes32 value pointing to a TFHE ciphertext
 * stored in the FHE coprocessor.
 */
export type EncryptedHandle = string; // bytes32 hex string

/**
 * Encrypted input: the encrypted amount + proof to submit in a transaction.
 */
export interface EncryptedInput {
  /** The encrypted handle (bytes32) */
  handle: EncryptedHandle;
  /** ZK proof that the ciphertext is well-formed */
  inputProof: Uint8Array;
}

/**
 * Decrypted balance result from the KMS Gateway.
 */
export interface DecryptedBalance {
  /** The decrypted balance in token base units (6 decimals for pbUSD) */
  value: bigint;
  /** The encrypted handle that was decrypted */
  handle: EncryptedHandle;
  /** Timestamp of the decryption */
  timestamp: number;
}

/**
 * FHE network configuration.
 */
export interface FHEConfig {
  /** Chain ID of the FHE-enabled network */
  chainId: number;
  /** Address of the FHE coprocessor contract */
  coprocessorAddress: string;
  /** Address of the ACL contract */
  aclAddress: string;
  /** URL of the KMS Gateway for decryption requests */
  gatewayUrl: string;
  /** Network public key for client-side encryption (hex-encoded) */
  publicKey: string;
}

/**
 * Confidential transaction receipt.
 */
export interface ConfidentialTxReceipt {
  /** Transaction hash */
  txHash: string;
  /** Block number */
  blockNumber: number;
  /** Whether the transaction was mined successfully */
  success: boolean;
  /** Gas used */
  gasUsed: bigint;
}

// ══════════════════════════════════════════════════════════════
//                    KNOWN FHE CONFIGURATIONS
// ══════════════════════════════════════════════════════════════

/**
 * Pre-configured FHE network configs.
 */
export const FHE_NETWORKS: Record<string, FHEConfig> = {
  /** HashKey Chain Testnet with FHE coprocessor */
  hashkey_testnet: {
    chainId: 133,
    coprocessorAddress: '0x0000000000000000000000000000000000000000', // TBD: deploy
    aclAddress: '0x0000000000000000000000000000000000000000',         // TBD: deploy
    gatewayUrl: 'https://gateway.fhe.hashkey.com',
    publicKey: '',  // TBD: network setup
  },
  /** Zama devnet (for development) */
  zama_devnet: {
    chainId: 9000,
    coprocessorAddress: '0x000000000000000000000000000000000000005d',
    aclAddress: '0x000000000000000000000000000000000000005e',
    gatewayUrl: 'https://gateway.devnet.zama.ai',
    publicKey: '',  // Fetched from gateway at runtime
  },
  /** Local Hardhat (mock mode) */
  hardhat: {
    chainId: 31337,
    coprocessorAddress: '0x0000000000000000000000000000000000000000', // Will be deployed MockFHE
    aclAddress: '0x0000000000000000000000000000000000000000',
    gatewayUrl: 'http://localhost:8545', // Not used in mock mode
    publicKey: 'mock',
  },
};

// ══════════════════════════════════════════════════════════════
//                     FHE INSTANCE CLASS
// ══════════════════════════════════════════════════════════════

/**
 * FHEInstance manages client-side FHE operations for a connected wallet.
 *
 * Usage:
 * ```typescript
 * const fhe = new FHEInstance(FHE_NETWORKS.hashkey_testnet);
 * await fhe.initialize(signer);
 *
 * // Encrypt an amount for transfer
 * const encrypted = await fhe.encryptUint64(1000000n); // 1 pbUSD (6 decimals)
 *
 * // Call confidential transfer
 * const tx = await cpbusd.transfer(recipient, encrypted.handle, encrypted.inputProof);
 *
 * // Decrypt balance
 * const balance = await fhe.decryptBalance(cpbusd, signer.address);
 * console.log(`Balance: ${balance.value} (${formatUnits(balance.value, 6)} cPBUSD)`);
 * ```
 */
export class FHEInstance {
  private config: FHEConfig;
  private signer: Signer | null = null;
  private publicKeyBytes: Uint8Array | null = null;
  private initialized = false;

  constructor(config: FHEConfig) {
    this.config = config;
  }

  /**
   * Initialize the FHE instance with a signer.
   * Fetches the network public key if not already configured.
   */
  async initialize(signer: Signer): Promise<void> {
    this.signer = signer;

    // Fetch public key from gateway if not pre-configured
    if (!this.config.publicKey || this.config.publicKey === 'mock') {
      if (this.config.publicKey === 'mock') {
        // Mock mode: no real encryption needed
        this.publicKeyBytes = new Uint8Array(32);
        this.initialized = true;
        return;
      }

      try {
        const response = await fetch(`${this.config.gatewayUrl}/public-key`);
        const data = await response.json();
        this.config.publicKey = data.publicKey;
      } catch (error) {
        console.warn('Failed to fetch FHE public key from gateway, using mock mode');
        this.publicKeyBytes = new Uint8Array(32);
        this.initialized = true;
        return;
      }
    }

    // Parse the public key
    this.publicKeyBytes = ethers.getBytes(this.config.publicKey);
    this.initialized = true;
  }

  /**
   * Check if the instance is initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ══════════════════════════════════════════════════════════════
  //                    CLIENT-SIDE ENCRYPTION
  // ══════════════════════════════════════════════════════════════

  /**
   * Encrypt a uint64 value for use in confidential transactions.
   *
   * In production fhEVM:
   *   1. Generates a random encryption key (per-input)
   *   2. Encrypts the value using TFHE with the network public key
   *   3. Generates a ZK proof that the ciphertext is well-formed
   *   4. Returns the encrypted handle + proof
   *
   * In mock mode:
   *   - The "handle" is just the plaintext encoded as bytes32
   *   - The "proof" is empty
   *
   * @param value The plaintext uint64 value to encrypt
   * @returns EncryptedInput containing handle and proof
   */
  async encryptUint64(value: bigint): Promise<EncryptedInput> {
    this.requireInitialized();

    if (this.isMockMode()) {
      // Mock: encode plaintext as bytes32
      const handle = ethers.zeroPadValue(ethers.toBeHex(value), 32);
      return {
        handle,
        inputProof: new Uint8Array(0),
      };
    }

    // Production: use fhevmjs for real TFHE encryption
    // This would integrate with Zama's fhevmjs library:
    //   import { createInstance } from 'fhevmjs';
    //   const instance = await createInstance({ chainId, publicKey });
    //   const input = instance.createEncryptedInput(contractAddress, userAddress);
    //   input.add64(value);
    //   const { handles, inputProof } = input.encrypt();

    // For now, throw if not in mock mode (requires fhevmjs integration)
    throw new Error(
      'Production FHE encryption requires fhevmjs. Install with: pnpm add fhevmjs'
    );
  }

  /**
   * Encrypt a boolean value.
   */
  async encryptBool(value: boolean): Promise<EncryptedInput> {
    this.requireInitialized();

    if (this.isMockMode()) {
      const handle = ethers.zeroPadValue(ethers.toBeHex(value ? 1 : 0), 32);
      return {
        handle,
        inputProof: new Uint8Array(0),
      };
    }

    throw new Error('Production FHE encryption requires fhevmjs');
  }

  /**
   * Encrypt an address.
   */
  async encryptAddress(address: string): Promise<EncryptedInput> {
    this.requireInitialized();

    if (this.isMockMode()) {
      const handle = ethers.zeroPadValue(address, 32);
      return {
        handle,
        inputProof: new Uint8Array(0),
      };
    }

    throw new Error('Production FHE encryption requires fhevmjs');
  }

  // ══════════════════════════════════════════════════════════════
  //                  DECRYPTION VIA KMS GATEWAY
  // ══════════════════════════════════════════════════════════════

  /**
   * Request decryption of an encrypted balance from the KMS Gateway.
   *
   * The decryption flow:
   *   1. User signs an EIP-712 "decrypt" request with their wallet
   *   2. SDK sends the signed request to the KMS Gateway
   *   3. Gateway verifies the signature + ACL permissions
   *   4. Gateway runs MPC decryption (threshold of KMS nodes)
   *   5. Returns the plaintext value to the requesting user only
   *
   * @param contract The ConfidentialPBUSD contract instance
   * @param account The address whose balance to decrypt
   * @returns The decrypted balance
   */
  async decryptBalance(
    contract: Contract,
    account: string
  ): Promise<DecryptedBalance> {
    this.requireInitialized();

    // Get the encrypted balance handle from the contract
    const encHandle: string = await contract.balanceOf(account);

    if (this.isMockMode()) {
      // In mock mode with MockFHE deployed, we can read the plaintext directly
      return {
        value: BigInt(encHandle),
        handle: encHandle,
        timestamp: Date.now(),
      };
    }

    // Production: request decryption via KMS Gateway
    return this.requestDecryption(encHandle);
  }

  /**
   * Request decryption of any encrypted handle via the KMS Gateway.
   */
  async requestDecryption(handle: EncryptedHandle): Promise<DecryptedBalance> {
    this.requireInitialized();

    if (!this.signer) {
      throw new Error('Signer not configured');
    }

    if (this.isMockMode()) {
      return {
        value: BigInt(handle),
        handle,
        timestamp: Date.now(),
      };
    }

    // Sign EIP-712 decryption request
    const signerAddress = await this.signer.getAddress();
    const domain = {
      name: 'FHE Gateway',
      version: '1',
      chainId: this.config.chainId,
    };
    const types = {
      DecryptionRequest: [
        { name: 'handle', type: 'bytes32' },
        { name: 'requester', type: 'address' },
        { name: 'timestamp', type: 'uint256' },
      ],
    };
    const timestamp = Math.floor(Date.now() / 1000);
    const message = {
      handle,
      requester: signerAddress,
      timestamp,
    };

    const signature = await (this.signer as ethers.Signer & { signTypedData: Function }).signTypedData(
      domain,
      types,
      message
    );

    // Submit to KMS Gateway
    const response = await fetch(`${this.config.gatewayUrl}/decrypt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle,
        requester: signerAddress,
        timestamp,
        signature,
      }),
    });

    if (!response.ok) {
      throw new Error(`Decryption request failed: ${response.statusText}`);
    }

    const result = await response.json();
    return {
      value: BigInt(result.value),
      handle,
      timestamp: result.timestamp,
    };
  }

  // ══════════════════════════════════════════════════════════════
  //                  TRANSACTION HELPERS
  // ══════════════════════════════════════════════════════════════

  /**
   * Build a confidential transfer transaction.
   *
   * @param contract ConfidentialPBUSD contract instance
   * @param to Recipient address
   * @param amount Plaintext amount to transfer (will be encrypted)
   * @returns Transaction receipt
   */
  async confidentialTransfer(
    contract: Contract,
    to: string,
    amount: bigint
  ): Promise<ConfidentialTxReceipt> {
    this.requireInitialized();

    const encrypted = await this.encryptUint64(amount);

    const tx = await contract['transfer(address,bytes32,bytes)'](
      to,
      encrypted.handle,
      encrypted.inputProof
    );

    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      success: receipt.status === 1,
      gasUsed: receipt.gasUsed,
    };
  }

  /**
   * Build a confidential approve transaction.
   */
  async confidentialApprove(
    contract: Contract,
    spender: string,
    amount: bigint
  ): Promise<ConfidentialTxReceipt> {
    this.requireInitialized();

    const encrypted = await this.encryptUint64(amount);

    const tx = await contract['approve(address,bytes32,bytes)'](
      spender,
      encrypted.handle,
      encrypted.inputProof
    );

    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      success: receipt.status === 1,
      gasUsed: receipt.gasUsed,
    };
  }

  // ══════════════════════════════════════════════════════════════
  //                    UTILITY FUNCTIONS
  // ══════════════════════════════════════════════════════════════

  /**
   * Format a decrypted balance for display.
   * @param value Raw balance in base units
   * @param decimals Token decimals (default 6 for pbUSD)
   */
  static formatBalance(value: bigint, decimals: number = 6): string {
    return ethers.formatUnits(value, decimals);
  }

  /**
   * Parse a human-readable amount to base units.
   * @param amount Human-readable amount (e.g., "100.50")
   * @param decimals Token decimals (default 6)
   */
  static parseAmount(amount: string, decimals: number = 6): bigint {
    return ethers.parseUnits(amount, decimals);
  }

  /**
   * Check if running in mock mode (no real FHE).
   */
  isMockMode(): boolean {
    return (
      this.config.publicKey === 'mock' ||
      this.config.publicKey === '' ||
      this.config.chainId === 31337
    );
  }

  // ══════════════════════════════════════════════════════════════
  //                    INTERNAL HELPERS
  // ══════════════════════════════════════════════════════════════

  private requireInitialized(): void {
    if (!this.initialized) {
      throw new Error('FHEInstance not initialized. Call initialize(signer) first.');
    }
  }
}

// ══════════════════════════════════════════════════════════════
//                    CONVENIENCE EXPORTS
// ══════════════════════════════════════════════════════════════

/**
 * Create and initialize an FHE instance for the given network.
 */
export async function createFHEInstance(
  network: keyof typeof FHE_NETWORKS | FHEConfig,
  signer: Signer
): Promise<FHEInstance> {
  const config = typeof network === 'string' ? FHE_NETWORKS[network] : network;
  if (!config) {
    throw new Error(`Unknown FHE network: ${network}`);
  }
  const instance = new FHEInstance(config);
  await instance.initialize(signer);
  return instance;
}
