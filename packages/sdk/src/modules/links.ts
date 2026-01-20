/**
 * ProtocolBanks SDK - Payment Link Module
 * 
 * 支付链接生成、验证、解析
 * 支持多链、多币种
 */

import type {
  PaymentLinkParams,
  PaymentLink,
  LinkVerificationResult,
  QROptions,
  QRCode,
  ChainId,
  TokenSymbol,
  IPaymentLinkModule,
} from '../types';
import { ErrorCodes } from '../types';
import { ProtocolBanksError } from '../utils/errors';
import {
  generatePaymentLinkSignature,
  verifyPaymentLinkSignature,
  generateUUID,
} from '../utils/crypto';
import {
  validateAddress,
  validateAmount,
  validateToken,
  validateChainId,
  validateExpiryHours,
  validateMemo,
  isExpired,
  detectHomoglyphs,
  isValidAddress,
} from '../utils/validation';
import {
  PAYMENT_LINK_BASE_URL,
  DEFAULT_TOKEN,
  DEFAULT_EXPIRY_HOURS,
  getChainsForToken,
  getChainTokens,
} from '../config/chains';

// ============================================================================
// Payment Link Module Implementation
// ============================================================================

export class PaymentLinkModule implements IPaymentLinkModule {
  private apiSecret: string;
  private baseUrl: string;
  
  constructor(apiSecret: string, baseUrl?: string) {
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl ?? PAYMENT_LINK_BASE_URL;
  }
  
  // ============================================================================
  // Generate Payment Link
  // ============================================================================
  
  /**
   * Generate a signed payment link
   */
  generate(params: PaymentLinkParams): PaymentLink {
    // Validate required parameters
    this.validateParams(params);
    
    // Set defaults
    const token = (params.token ?? DEFAULT_TOKEN) as TokenSymbol;
    const expiryHours = params.expiryHours ?? DEFAULT_EXPIRY_HOURS;
    
    // Calculate expiry timestamp
    const now = Date.now();
    const expiresAt = new Date(now + expiryHours * 60 * 60 * 1000);
    const expiryTimestamp = expiresAt.getTime();
    
    // Generate payment ID
    const paymentId = `pay_${generateUUID().replace(/-/g, '')}`;
    
    // Generate signature (synchronous version for generate)
    const signatureData = {
      to: params.to,
      amount: params.amount,
      token,
      expiry: expiryTimestamp,
      memo: params.memo,
    };
    
    // Use synchronous signature generation
    const signature = this.generateSignatureSync(signatureData);
    
    // Build URL
    const url = this.buildUrl(params, token, expiryTimestamp, signature, paymentId);
    
    // Build short URL (placeholder - would use URL shortener service)
    const shortUrl = `${this.baseUrl.replace('/pay', '')}/p/${paymentId.slice(4, 12)}`;
    
    return {
      url,
      shortUrl,
      params: {
        ...params,
        token,
        expiryHours,
      },
      signature,
      expiresAt,
      createdAt: new Date(now),
      paymentId,
    };
  }
  
  // ============================================================================
  // Verify Payment Link
  // ============================================================================
  
  /**
   * Verify payment link integrity and expiry
   */
  verify(url: string): LinkVerificationResult {
    try {
      // Parse URL
      const parsed = this.parseUrl(url);
      if (!parsed) {
        return {
          valid: false,
          expired: false,
          tamperedFields: [],
          error: 'Invalid payment link URL format',
        };
      }
      
      const { params, signature, expiry } = parsed;
      
      // Check for homoglyphs
      const homoglyphDetails = detectHomoglyphs(params.to);
      if (homoglyphDetails) {
        return {
          valid: false,
          expired: false,
          tamperedFields: ['to'],
          params,
          error: 'Homoglyph attack detected in address',
          homoglyphDetected: true,
          homoglyphDetails,
        };
      }
      
      // Check expiry
      const expired = isExpired(expiry);
      
      // Verify signature
      const signatureData = {
        to: params.to,
        amount: params.amount,
        token: params.token ?? DEFAULT_TOKEN,
        expiry,
        memo: params.memo,
      };
      
      const expectedSignature = this.generateSignatureSync(signatureData);
      const signatureValid = signature === expectedSignature;
      
      // Detect tampered fields
      const tamperedFields: string[] = [];
      if (!signatureValid) {
        // Try to identify which field was tampered
        // This is a simplified check - in production, you'd compare against stored data
        tamperedFields.push('signature');
      }
      
      return {
        valid: signatureValid && !expired,
        expired,
        tamperedFields,
        params,
        error: expired ? 'Payment link has expired' : 
               !signatureValid ? 'Payment link signature is invalid' : undefined,
      };
      
    } catch (error) {
      return {
        valid: false,
        expired: false,
        tamperedFields: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  // ============================================================================
  // Parse Payment Link
  // ============================================================================
  
  /**
   * Parse payment link URL to extract parameters
   */
  parse(url: string): PaymentLinkParams | null {
    const parsed = this.parseUrl(url);
    return parsed?.params ?? null;
  }
  
  // ============================================================================
  // QR Code Generation
  // ============================================================================
  
  /**
   * Generate QR code for payment link
   */
  async generateQR(link: PaymentLink, options?: QROptions): Promise<QRCode> {
    const size = options?.size ?? 300;
    const format = options?.format ?? 'svg';
    
    // Validate size
    if (size < 100 || size > 1000) {
      throw new ProtocolBanksError({
        code: ErrorCodes.VALID_OUT_OF_RANGE,
        category: 'VALID',
        message: 'QR code size must be between 100 and 1000 pixels',
        retryable: false,
      });
    }
    
    // Generate QR code data
    // In production, this would use a QR code library like 'qrcode'
    const qrData = await this.generateQRData(link.url, {
      size,
      format,
      errorCorrection: options?.errorCorrection ?? 'M',
      foreground: options?.foreground ?? '#000000',
      background: options?.background ?? '#ffffff',
      logo: options?.logo,
      logoSize: options?.logoSize ?? 0.2,
    });
    
    return {
      data: qrData,
      format,
      size,
      paymentLink: link.url,
    };
  }
  
  // ============================================================================
  // Chain/Token Support
  // ============================================================================
  
  /**
   * Get supported chains for a token
   */
  getSupportedChains(token: TokenSymbol): ChainId[] {
    return getChainsForToken(token);
  }
  
  /**
   * Get supported tokens for a chain
   */
  getSupportedTokens(chain: ChainId): TokenSymbol[] {
    return getChainTokens(chain).map(t => t.symbol);
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  private validateParams(params: PaymentLinkParams): void {
    // Validate recipient address
    validateAddress(params.to, params.chain);
    
    // Validate amount
    validateAmount(params.amount);
    
    // Validate token if provided
    if (params.token) {
      validateToken(params.token);
    }
    
    // Validate chain if provided
    if (params.chain) {
      validateChainId(params.chain);
    }
    
    // Validate expiry hours if provided
    if (params.expiryHours !== undefined) {
      validateExpiryHours(params.expiryHours);
    }
    
    // Validate memo if provided
    if (params.memo) {
      validateMemo(params.memo);
    }
    
    // Validate allowed chains
    if (params.allowedChains) {
      for (const chain of params.allowedChains) {
        validateChainId(chain);
      }
    }
    
    // Validate allowed tokens
    if (params.allowedTokens) {
      for (const token of params.allowedTokens) {
        validateToken(token);
      }
    }
  }
  
  private buildUrl(
    params: PaymentLinkParams,
    token: string,
    expiry: number,
    signature: string,
    paymentId: string
  ): string {
    const url = new URL(this.baseUrl);
    
    // Required params
    url.searchParams.set('to', params.to);
    url.searchParams.set('amount', params.amount);
    url.searchParams.set('token', token);
    url.searchParams.set('exp', expiry.toString());
    url.searchParams.set('sig', signature);
    url.searchParams.set('id', paymentId);
    
    // Optional params
    if (params.chain) {
      url.searchParams.set('chain', String(params.chain));
    }
    if (params.memo) {
      url.searchParams.set('memo', params.memo);
    }
    if (params.orderId) {
      url.searchParams.set('orderId', params.orderId);
    }
    if (params.callbackUrl) {
      url.searchParams.set('callback', params.callbackUrl);
    }
    if (params.allowedChains?.length) {
      url.searchParams.set('chains', params.allowedChains.join(','));
    }
    if (params.allowedTokens?.length) {
      url.searchParams.set('tokens', params.allowedTokens.join(','));
    }
    
    return url.toString();
  }
  
  private parseUrl(url: string): {
    params: PaymentLinkParams;
    signature: string;
    expiry: number;
  } | null {
    try {
      const parsed = new URL(url);
      
      // Extract required params
      const to = parsed.searchParams.get('to');
      const amount = parsed.searchParams.get('amount');
      const signature = parsed.searchParams.get('sig');
      const expiryStr = parsed.searchParams.get('exp');
      
      if (!to || !amount || !signature || !expiryStr) {
        return null;
      }
      
      const expiry = parseInt(expiryStr, 10);
      if (isNaN(expiry)) {
        return null;
      }
      
      // Extract optional params
      const token = parsed.searchParams.get('token') ?? DEFAULT_TOKEN;
      const chainStr = parsed.searchParams.get('chain');
      const memo = parsed.searchParams.get('memo') ?? undefined;
      const orderId = parsed.searchParams.get('orderId') ?? undefined;
      const callbackUrl = parsed.searchParams.get('callback') ?? undefined;
      const chainsStr = parsed.searchParams.get('chains');
      const tokensStr = parsed.searchParams.get('tokens');
      
      // Parse chain
      let chain: ChainId | undefined;
      if (chainStr) {
        const chainNum = parseInt(chainStr, 10);
        chain = isNaN(chainNum) ? chainStr as ChainId : chainNum as ChainId;
      }
      
      // Parse allowed chains
      let allowedChains: ChainId[] | undefined;
      if (chainsStr) {
        allowedChains = chainsStr.split(',').map(c => {
          const num = parseInt(c, 10);
          return isNaN(num) ? c as ChainId : num as ChainId;
        });
      }
      
      // Parse allowed tokens
      let allowedTokens: TokenSymbol[] | undefined;
      if (tokensStr) {
        allowedTokens = tokensStr.split(',') as TokenSymbol[];
      }
      
      // Calculate expiry hours from timestamp
      const now = Date.now();
      const expiryHours = Math.max(1, Math.ceil((expiry - now) / (60 * 60 * 1000)));
      
      return {
        params: {
          to,
          amount,
          token: token as TokenSymbol,
          chain,
          expiryHours,
          memo,
          orderId,
          callbackUrl,
          allowedChains,
          allowedTokens,
        },
        signature,
        expiry,
      };
      
    } catch {
      return null;
    }
  }
  
  private generateSignatureSync(params: {
    to: string;
    amount: string;
    token: string;
    expiry: number;
    memo?: string;
  }): string {
    // Normalize parameters
    const normalized = {
      amount: params.amount,
      expiry: params.expiry.toString(),
      memo: params.memo ?? '',
      to: params.to.toLowerCase(),
      token: params.token.toUpperCase(),
    };
    
    // Create canonical string (sorted keys)
    const dataToSign = Object.entries(normalized)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    
    // Simple HMAC-like signature (synchronous)
    // In production, use proper HMAC-SHA256
    return this.simpleHash(dataToSign + this.apiSecret).substring(0, 16);
  }
  
  private simpleHash(str: string): string {
    // Simple hash for synchronous operation
    // In production, use proper crypto
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    // Convert to hex and pad
    const hex = Math.abs(hash).toString(16);
    return hex.padStart(16, '0').repeat(4).substring(0, 64);
  }
  
  private async generateQRData(
    content: string,
    options: {
      size: number;
      format: string;
      errorCorrection: string;
      foreground: string;
      background: string;
      logo?: string;
      logoSize: number;
    }
  ): Promise<string> {
    // Placeholder QR generation
    // In production, use 'qrcode' library
    
    if (options.format === 'svg') {
      return this.generateSVGQR(content, options);
    }
    
    // Return base64 placeholder
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
  }
  
  private generateSVGQR(
    content: string,
    options: {
      size: number;
      foreground: string;
      background: string;
    }
  ): string {
    // Simple SVG QR placeholder
    // In production, use proper QR generation
    const { size, foreground, background } = options;
    
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="100%" height="100%" fill="${background}"/>
      <text x="50%" y="50%" text-anchor="middle" fill="${foreground}" font-size="12">
        QR: ${content.substring(0, 20)}...
      </text>
    </svg>`;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new PaymentLinkModule instance
 */
export function createPaymentLinkModule(
  apiSecret: string,
  baseUrl?: string
): PaymentLinkModule {
  return new PaymentLinkModule(apiSecret, baseUrl);
}
