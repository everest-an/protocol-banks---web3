/**
 * ProtocolBanks SDK - x402 Gasless Payment Module
 * 
 * EIP-712 签名授权，支持:
 * - TransferWithAuthorization (ERC-3009)
 * - Gasless 支付
 * - Nonce 管理
 * - 授权生命周期
 * - CDP Facilitator (Base 链 USDC 免费结算)
 */

import type {
  X402AuthorizationParams,
  X402Authorization,
  X402Status,
  EIP712Domain,
  EIP712Types,
  TransferWithAuthorizationMessage,
  ChainId,
  TokenSymbol,
  IX402Module,
} from '../types';
import { ErrorCodes } from '../types';
import { ProtocolBanksError } from '../utils/errors';
import { generateNonce, generateUUID } from '../utils/crypto';
import { validateAddress, validateAmount, validateToken } from '../utils/validation';
import { USDC_ADDRESSES, getTokenConfig, parseAmount } from '../config/chains';
import type { HttpClient } from '../utils/http';

// ============================================================================
// Constants
// ============================================================================

/** Default authorization validity (1 hour) */
const DEFAULT_VALIDITY_SECONDS = 3600;

/** Maximum authorization validity (24 hours) */
const MAX_VALIDITY_SECONDS = 86400;

/** Chains that support x402 gasless payments */
const X402_SUPPORTED_CHAINS: number[] = [1, 137, 8453, 42161, 10];

/** Chains that support CDP Facilitator (free settlement) */
const CDP_SUPPORTED_CHAINS: number[] = [8453]; // Base mainnet

/** Tokens that support x402 (ERC-3009) */
const X402_SUPPORTED_TOKENS: TokenSymbol[] = ['USDC', 'DAI'];

/** EIP-712 type definitions for TransferWithAuthorization */
const TRANSFER_WITH_AUTHORIZATION_TYPES: EIP712Types = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

// ============================================================================
// Settlement Method Types
// ============================================================================

export type SettlementMethod = 'cdp' | 'relayer' | 'auto';

export interface SettlementResult {
  success: boolean;
  method: SettlementMethod;
  transactionHash?: string;
  network?: string;
  fee?: string;
  error?: string;
}

// ============================================================================
// x402 Module Implementation
// ============================================================================

export class X402Module implements IX402Module {
  private http: HttpClient;
  private authorizations: Map<string, X402Authorization> = new Map();
  
  constructor(http: HttpClient) {
    this.http = http;
  }
  
  // ============================================================================
  // Public Methods
  // ============================================================================
  
  /**
   * Create EIP-712 authorization for signing
   */
  async createAuthorization(params: X402AuthorizationParams): Promise<X402Authorization> {
    // Validate parameters
    this.validateParams(params);
    
    // Check chain support
    if (!this.isChainSupported(params.chainId)) {
      throw new ProtocolBanksError({
        code: ErrorCodes.X402_UNSUPPORTED_CHAIN,
        category: 'X402',
        message: `Chain ${params.chainId} does not support x402 gasless payments`,
        details: { chainId: params.chainId, supportedChains: X402_SUPPORTED_CHAINS },
        retryable: false,
      });
    }
    
    // Check token support
    if (!this.isTokenSupported(params.chainId, params.token)) {
      throw new ProtocolBanksError({
        code: ErrorCodes.X402_UNSUPPORTED_TOKEN,
        category: 'X402',
        message: `Token ${params.token} does not support x402 on chain ${params.chainId}`,
        details: { token: params.token, chainId: params.chainId },
        retryable: false,
      });
    }
    
    // Get token config
    const tokenConfig = getTokenConfig(params.chainId as ChainId, params.token);
    if (!tokenConfig) {
      throw new ProtocolBanksError({
        code: ErrorCodes.X402_UNSUPPORTED_TOKEN,
        category: 'X402',
        message: `Token ${params.token} not found on chain ${params.chainId}`,
        retryable: false,
      });
    }
    
    // Calculate timestamps
    const now = Math.floor(Date.now() / 1000);
    const validFor = Math.min(
      params.validFor ?? DEFAULT_VALIDITY_SECONDS,
      MAX_VALIDITY_SECONDS
    );
    const validAfter = now;
    const validBefore = now + validFor;
    
    // Generate unique nonce
    const nonce = generateNonce();
    
    // Get token contract address
    const tokenAddress = this.getTokenAddress(params.chainId, params.token);
    
    // Build EIP-712 domain
    const domain: EIP712Domain = {
      name: this.getTokenName(params.token),
      version: '2', // USDC uses version 2
      chainId: params.chainId,
      verifyingContract: tokenAddress,
    };
    
    // Build message
    const value = parseAmount(params.amount, tokenConfig.decimals);
    const message: TransferWithAuthorizationMessage = {
      from: '', // Will be filled by signer
      to: params.to,
      value,
      validAfter,
      validBefore,
      nonce,
    };
    
    // Generate authorization ID
    const id = `x402_${generateUUID().replace(/-/g, '')}`;
    
    // Create authorization object
    const authorization: X402Authorization = {
      id,
      domain,
      types: TRANSFER_WITH_AUTHORIZATION_TYPES,
      message,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(validBefore * 1000),
    };
    
    // Store locally
    this.authorizations.set(id, authorization);
    
    // Register with backend (optional)
    try {
      await this.http.post('/x402/authorizations', {
        id,
        chainId: params.chainId,
        token: params.token,
        to: params.to,
        amount: params.amount,
        validBefore,
        nonce,
      });
    } catch {
      // Continue even if backend registration fails
      // Authorization can still be used locally
    }
    
    return authorization;
  }
  
  /**
   * Submit signed authorization to relayer
   * @param authId - Authorization ID
   * @param signature - EIP-712 signature
   * @param method - Settlement method: 'cdp' (free on Base), 'relayer', or 'auto' (default)
   */
  async submitSignature(
    authId: string, 
    signature: string,
    method: SettlementMethod = 'auto'
  ): Promise<X402Authorization> {
    const auth = this.authorizations.get(authId);
    
    if (!auth) {
      throw new ProtocolBanksError({
        code: ErrorCodes.X402_AUTHORIZATION_EXPIRED,
        category: 'X402',
        message: 'Authorization not found or expired',
        retryable: false,
      });
    }
    
    // Check if expired
    if (this.isExpired(auth)) {
      auth.status = 'expired';
      throw new ProtocolBanksError({
        code: ErrorCodes.X402_AUTHORIZATION_EXPIRED,
        category: 'X402',
        message: 'Authorization has expired',
        retryable: false,
      });
    }
    
    // Validate signature format
    if (!this.isValidSignature(signature)) {
      throw new ProtocolBanksError({
        code: ErrorCodes.X402_INVALID_SIGNATURE,
        category: 'X402',
        message: 'Invalid signature format',
        retryable: false,
      });
    }
    
    // Update status
    auth.status = 'signed';
    auth.signature = signature;
    
    // Determine settlement method
    const settlementMethod = this.determineSettlementMethod(auth, method);
    
    // Submit to appropriate endpoint
    try {
      const endpoint = settlementMethod === 'cdp' ? '/x402/settle' : '/x402/submit';
      
      const response = await this.http.post<{ 
        transactionHash: string; 
        status: X402Status;
        method?: string;
        fee?: string;
      }>(
        endpoint,
        {
          authorizationId: authId,
          signature,
          domain: auth.domain,
          message: auth.message,
          preferCDP: settlementMethod === 'cdp' || settlementMethod === 'auto',
        }
      );
      
      auth.status = response.status;
      auth.transactionHash = response.transactionHash;
      
      // Store settlement info
      (auth as any).settlementMethod = response.method || settlementMethod;
      (auth as any).settlementFee = response.fee || '0';
      
    } catch (error) {
      auth.status = 'failed';
      throw error;
    }
    
    return auth;
  }
  
  /**
   * Determine the best settlement method
   */
  private determineSettlementMethod(
    auth: X402Authorization, 
    preferred: SettlementMethod
  ): SettlementMethod {
    // If explicitly requested, use that method
    if (preferred !== 'auto') {
      return preferred;
    }
    
    // Auto: prefer CDP for Base chain USDC (free settlement)
    const chainId = auth.domain.chainId;
    if (this.isCDPSupported(chainId)) {
      return 'cdp';
    }
    
    return 'relayer';
  }
  
  /**
   * Check if CDP Facilitator is supported for this chain
   */
  isCDPSupported(chainId: number): boolean {
    return CDP_SUPPORTED_CHAINS.includes(chainId);
  }
  
  /**
   * Get settlement fee estimate
   * @returns Fee in USD (0 for CDP on Base)
   */
  getSettlementFeeEstimate(chainId: number, amount: string): { fee: string; method: SettlementMethod } {
    if (this.isCDPSupported(chainId)) {
      return { fee: '0', method: 'cdp' };
    }
    
    // Relayer fee: 0.5% with $5 cap
    const amountNum = parseFloat(amount);
    const fee = Math.min(amountNum * 0.005, 5);
    return { fee: fee.toFixed(2), method: 'relayer' };
  }
  
  /**
   * Get authorization status
   */
  async getStatus(authId: string): Promise<X402Authorization> {
    // Check local cache first
    const localAuth = this.authorizations.get(authId);
    
    if (localAuth) {
      // Check if expired
      if (this.isExpired(localAuth) && localAuth.status === 'pending') {
        localAuth.status = 'expired';
      }
      
      // If not final status, fetch from backend
      if (!this.isFinalStatus(localAuth.status)) {
        try {
          const response = await this.http.get<X402Authorization>(`/x402/authorizations/${authId}`);
          
          // Update local cache
          localAuth.status = response.status;
          if (response.transactionHash) {
            localAuth.transactionHash = response.transactionHash;
          }
          
        } catch {
          // Return local state if backend unavailable
        }
      }
      
      return localAuth;
    }
    
    // Fetch from backend
    const response = await this.http.get<X402Authorization>(`/x402/authorizations/${authId}`);
    
    // Cache locally
    this.authorizations.set(authId, response);
    
    return response;
  }
  
  /**
   * Cancel pending authorization
   */
  async cancel(authId: string): Promise<void> {
    const auth = this.authorizations.get(authId);
    
    if (!auth) {
      throw new ProtocolBanksError({
        code: ErrorCodes.X402_AUTHORIZATION_EXPIRED,
        category: 'X402',
        message: 'Authorization not found',
        retryable: false,
      });
    }
    
    // Can only cancel pending authorizations
    if (auth.status !== 'pending' && auth.status !== 'signed') {
      throw new ProtocolBanksError({
        code: ErrorCodes.X402_AUTHORIZATION_EXPIRED,
        category: 'X402',
        message: `Cannot cancel authorization in ${auth.status} status`,
        retryable: false,
      });
    }
    
    // Update status
    auth.status = 'cancelled';
    
    // Notify backend
    try {
      await this.http.post(`/x402/authorizations/${authId}/cancel`, {});
    } catch {
      // Continue even if backend notification fails
    }
  }
  
  /**
   * Poll authorization status until final
   */
  poll(
    authId: string,
    callback: (auth: X402Authorization) => void,
    interval = 2000
  ): () => void {
    let stopped = false;
    
    const checkStatus = async () => {
      if (stopped) return;
      
      try {
        const auth = await this.getStatus(authId);
        callback(auth);
        
        // Continue polling if not final
        if (!this.isFinalStatus(auth.status)) {
          setTimeout(checkStatus, interval);
        }
      } catch (error) {
        // Stop polling on error
        stopped = true;
      }
    };
    
    // Start polling
    checkStatus();
    
    // Return stop function
    return () => {
      stopped = true;
    };
  }
  
  /**
   * Wait for authorization to reach final status
   */
  async waitForCompletion(
    authId: string,
    timeoutMs = 120000
  ): Promise<X402Authorization> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const auth = await this.getStatus(authId);
      
      if (this.isFinalStatus(auth.status)) {
        return auth;
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new ProtocolBanksError({
      code: ErrorCodes.NET_TIMEOUT,
      category: 'NET',
      message: 'Timeout waiting for authorization completion',
      retryable: true,
    });
  }
  
  /**
   * Get all pending authorizations
   */
  getPendingAuthorizations(): X402Authorization[] {
    return Array.from(this.authorizations.values())
      .filter(auth => auth.status === 'pending' || auth.status === 'signed');
  }
  
  /**
   * Clean up expired authorizations
   */
  cleanupExpired(): number {
    let cleaned = 0;
    
    for (const [id, auth] of this.authorizations) {
      if (this.isExpired(auth)) {
        if (auth.status === 'pending') {
          auth.status = 'expired';
        }
        this.authorizations.delete(id);
        cleaned++;
      }
    }
    
    return cleaned;
  }
  
  /**
   * Check if chain supports x402
   */
  isChainSupported(chainId: number): boolean {
    return X402_SUPPORTED_CHAINS.includes(chainId);
  }
  
  /**
   * Check if token supports x402 on chain
   */
  isTokenSupported(chainId: number, token: TokenSymbol): boolean {
    if (!this.isChainSupported(chainId)) {
      return false;
    }
    
    const tokenConfig = getTokenConfig(chainId as ChainId, token);
    return tokenConfig?.supportsGasless ?? false;
  }
  
  /**
   * Get supported chains
   */
  getSupportedChains(): number[] {
    return [...X402_SUPPORTED_CHAINS];
  }
  
  /**
   * Get supported tokens for chain
   */
  getSupportedTokens(chainId: number): TokenSymbol[] {
    if (!this.isChainSupported(chainId)) {
      return [];
    }
    
    return X402_SUPPORTED_TOKENS.filter(token => 
      this.isTokenSupported(chainId, token)
    );
  }
  
  /**
   * Get EIP-712 typed data for signing
   */
  getTypedData(auth: X402Authorization, fromAddress: string): {
    domain: EIP712Domain;
    types: EIP712Types;
    primaryType: string;
    message: TransferWithAuthorizationMessage;
  } {
    return {
      domain: auth.domain,
      types: auth.types,
      primaryType: 'TransferWithAuthorization',
      message: {
        ...auth.message,
        from: fromAddress,
      },
    };
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  private validateParams(params: X402AuthorizationParams): void {
    validateAddress(params.to, params.chainId as ChainId);
    validateAmount(params.amount);
    validateToken(params.token);
    
    if (params.validFor !== undefined) {
      if (params.validFor < 60 || params.validFor > MAX_VALIDITY_SECONDS) {
        throw new ProtocolBanksError({
          code: ErrorCodes.VALID_OUT_OF_RANGE,
          category: 'VALID',
          message: `validFor must be between 60 and ${MAX_VALIDITY_SECONDS} seconds`,
          retryable: false,
        });
      }
    }
  }
  
  private getTokenAddress(chainId: number, token: TokenSymbol): string {
    if (token === 'USDC') {
      return USDC_ADDRESSES[chainId] ?? '';
    }
    
    const tokenConfig = getTokenConfig(chainId as ChainId, token);
    return tokenConfig?.address ?? '';
  }
  
  private getTokenName(token: TokenSymbol): string {
    const names: Record<TokenSymbol, string> = {
      'USDC': 'USD Coin',
      'USDT': 'Tether USD',
      'DAI': 'Dai Stablecoin',
      'ETH': 'Ethereum',
      'MATIC': 'Polygon',
      'BNB': 'BNB',
      'SOL': 'Solana',
      'BTC': 'Bitcoin',
    };
    return names[token] ?? token;
  }
  
  private isExpired(auth: X402Authorization): boolean {
    return new Date() > auth.expiresAt;
  }
  
  private isFinalStatus(status: X402Status): boolean {
    return ['executed', 'failed', 'expired', 'cancelled'].includes(status);
  }
  
  private isValidSignature(signature: string): boolean {
    // EIP-712 signature should be 65 bytes (130 hex chars + 0x prefix)
    return /^0x[a-fA-F0-9]{130}$/.test(signature);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new X402Module instance
 */
export function createX402Module(http: HttpClient): X402Module {
  return new X402Module(http);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build EIP-712 typed data hash for signing
 */
export function buildTypedDataHash(
  domain: EIP712Domain,
  message: TransferWithAuthorizationMessage
): string {
  // This would use ethers.js TypedDataEncoder in production
  // Simplified version for reference
  const domainSeparator = hashDomain(domain);
  const messageHash = hashMessage(message);
  
  return `0x${domainSeparator}${messageHash}`;
}

function hashDomain(domain: EIP712Domain): string {
  // Simplified - use ethers.js in production
  const data = `${domain.name}${domain.version}${domain.chainId}${domain.verifyingContract}`;
  return simpleHash(data);
}

function hashMessage(message: TransferWithAuthorizationMessage): string {
  // Simplified - use ethers.js in production
  const data = `${message.from}${message.to}${message.value}${message.validAfter}${message.validBefore}${message.nonce}`;
  return simpleHash(data);
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}
