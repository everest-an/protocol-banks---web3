/**
 * AWS CloudHSM Signer Integration
 * 
 * This module provides HSM-based signing for production deployments.
 * 
 * Prerequisites:
 *   1. AWS CloudHSM cluster setup
 *   2. HSM client SDK installed
 *   3. Crypto User (CU) credentials configured
 * 
 * Environment Variables:
 *   - HSM_CLUSTER_ID: CloudHSM cluster identifier
 *   - HSM_USER: Crypto User username
 *   - HSM_PASSWORD: Crypto User password (use secrets manager in prod)
 *   - HSM_KEY_LABEL: Label for the signing key
 */

import { ethers, type TransactionRequest, type SignatureLike } from 'ethers';
import { createLogger } from '@/lib/logger';

const logger = createLogger('hsm-signer');

// ============================================
// Types
// ============================================

export interface HSMConfig {
  clusterId: string;
  user: string;
  keyLabel: string;
  region?: string;
}

export interface HSMSignerOptions {
  config: HSMConfig;
  chainId: number;
}

// ============================================
// HSM Signer Class
// ============================================

/**
 * HSM Signer for Ethereum transactions
 * 
 * Uses AWS CloudHSM for secure key storage and signing operations.
 * Keys never leave the HSM boundary.
 */
export class HSMSigner extends ethers.AbstractSigner {
  private config: HSMConfig;
  private chainId: number;
  private publicKey: string | null = null;
  private address: string | null = null;

  constructor(provider: ethers.Provider | null, options: HSMSignerOptions) {
    super(provider);
    this.config = options.config;
    this.chainId = options.chainId;
  }

  /**
   * Initialize HSM connection and retrieve public key
   */
  async initialize(): Promise<void> {
    logger.info('Initializing HSM connection', { 
      clusterId: this.config.clusterId,
      keyLabel: this.config.keyLabel 
    });

    try {
      // TODO: Implement actual CloudHSM connection
      // This is a placeholder for the CloudHSM PKCS#11 integration
      
      // Example implementation outline:
      // 1. Load PKCS#11 library
      // const pkcs11 = require('pkcs11js');
      // const pkcs11Module = new pkcs11.PKCS11();
      // pkcs11Module.load('/opt/cloudhsm/lib/libcloudhsm_pkcs11.so');
      
      // 2. Initialize and login
      // pkcs11Module.C_Initialize();
      // const slots = pkcs11Module.C_GetSlotList(true);
      // const session = pkcs11Module.C_OpenSession(slots[0], pkcs11.CKF_SERIAL_SESSION | pkcs11.CKF_RW_SESSION);
      // pkcs11Module.C_Login(session, pkcs11.CKU_USER, this.config.user);
      
      // 3. Find key by label
      // const publicKey = findKeyByLabel(session, this.config.keyLabel);
      
      // 4. Derive Ethereum address from public key
      // this.publicKey = publicKey;
      // this.address = computeAddress(publicKey);

      logger.info('HSM connection established');
    } catch (error) {
      logger.error('Failed to initialize HSM', { error: String(error) });
      throw new Error(`HSM initialization failed: ${error}`);
    }
  }

  /**
   * Get the Ethereum address for this signer
   */
  async getAddress(): Promise<string> {
    if (!this.address) {
      await this.initialize();
    }
    if (!this.address) {
      throw new Error('HSM signer not initialized');
    }
    return this.address;
  }

  /**
   * Sign a message using HSM
   */
  async signMessage(message: string | Uint8Array): Promise<string> {
    const messageHash = ethers.hashMessage(message);
    return this.signDigest(messageHash);
  }

  /**
   * Sign a typed data hash using HSM
   */
  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, unknown>
  ): Promise<string> {
    const hash = ethers.TypedDataEncoder.hash(domain, types, value);
    return this.signDigest(hash);
  }

  /**
   * Sign a transaction using HSM
   */
  async signTransaction(tx: TransactionRequest): Promise<string> {
    const address = await this.getAddress();
    
    // Populate transaction
    const populatedTx = await this.populateTransaction(tx);
    
    // Serialize unsigned transaction
    const unsignedTx = ethers.Transaction.from({
      ...populatedTx,
      chainId: this.chainId,
      from: address,
    });
    
    // Get transaction hash for signing
    const txHash = unsignedTx.unsignedHash;
    
    // Sign with HSM
    const signature = await this.signDigest(txHash);
    
    // Return serialized signed transaction
    const signedTx = ethers.Transaction.from({
      ...populatedTx,
      chainId: this.chainId,
      signature: signature,
    });
    
    return signedTx.serialized;
  }

  /**
   * Connect to a provider
   */
  connect(provider: ethers.Provider): HSMSigner {
    return new HSMSigner(provider, {
      config: this.config,
      chainId: this.chainId,
    });
  }

  /**
   * Sign a digest (hash) using HSM
   * This is where the actual HSM signing happens
   */
  private async signDigest(digest: string): Promise<string> {
    logger.debug('Signing digest with HSM', { digestPrefix: digest.slice(0, 10) });

    try {
      // TODO: Implement actual CloudHSM signing
      // 
      // Example implementation outline:
      // 
      // 1. Prepare mechanism for ECDSA signing
      // const mechanism = { mechanism: pkcs11.CKM_ECDSA };
      //
      // 2. Sign the digest
      // const digestBytes = ethers.getBytes(digest);
      // pkcs11Module.C_SignInit(session, mechanism, privateKeyHandle);
      // const signature = pkcs11Module.C_Sign(session, digestBytes);
      //
      // 3. Convert DER signature to Ethereum format (r, s, v)
      // const { r, s } = parseSignature(signature);
      // const v = calculateRecoveryParam(digest, r, s, publicKey);
      //
      // 4. Return concatenated signature
      // return ethers.Signature.from({ r, s, v }).serialized;

      throw new Error('HSM signing not implemented - configure CloudHSM first');
    } catch (error) {
      logger.error('HSM signing failed', { error: String(error) });
      throw error;
    }
  }
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create an HSM signer from environment variables
 */
export function createHSMSigner(
  provider: ethers.Provider,
  chainId: number
): HSMSigner {
  const config: HSMConfig = {
    clusterId: process.env.HSM_CLUSTER_ID || '',
    user: process.env.HSM_USER || '',
    keyLabel: process.env.HSM_KEY_LABEL || 'protocol-banks-signer',
    region: process.env.AWS_REGION || 'us-east-1',
  };

  if (!config.clusterId || !config.user) {
    throw new Error('HSM configuration incomplete. Set HSM_CLUSTER_ID and HSM_USER environment variables.');
  }

  return new HSMSigner(provider, { config, chainId });
}

/**
 * Check if HSM is configured
 */
export function isHSMConfigured(): boolean {
  return !!(process.env.HSM_CLUSTER_ID && process.env.HSM_USER);
}

// ============================================
// Migration Guide
// ============================================

/**
 * MIGRATION FROM KMS TO HSM
 * 
 * Current Setup (KMS):
 *   - Keys stored in AWS KMS
 *   - Signing via KMS API
 *   - Good for most use cases
 * 
 * HSM Setup (CloudHSM):
 *   - Keys stored in dedicated HSM hardware
 *   - FIPS 140-2 Level 3 certified
 *   - Required for certain compliance (PCI-DSS, etc.)
 * 
 * Steps to migrate:
 * 
 * 1. Set up CloudHSM cluster:
 *    aws cloudhsmv2 create-cluster --hsm-type hsm1.medium --subnet-ids subnet-xxx
 * 
 * 2. Initialize HSM and create crypto user:
 *    cloudhsm_cli_config --cluster-id cluster-xxx
 *    loginHSM -u PRECO -p
 *    createUser CU protocol-banks-user <password>
 * 
 * 3. Generate or import signing key:
 *    genECCKeyPair -i secp256k1 -l protocol-banks-signer
 *    # Or import existing key
 *    importPrivateKey -f key.pem -l protocol-banks-signer
 * 
 * 4. Update environment variables:
 *    HSM_CLUSTER_ID=cluster-xxx
 *    HSM_USER=protocol-banks-user
 *    HSM_PASSWORD=<from secrets manager>
 *    HSM_KEY_LABEL=protocol-banks-signer
 * 
 * 5. Update signer initialization in payout service:
 *    // Before:
 *    const signer = new KMSSigner(provider, { keyId: kmsKeyId, chainId });
 *    
 *    // After:
 *    const signer = isHSMConfigured() 
 *      ? createHSMSigner(provider, chainId)
 *      : new KMSSigner(provider, { keyId: kmsKeyId, chainId });
 */

export default HSMSigner;
