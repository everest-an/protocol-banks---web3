/**
 * ProtocolBanks SDK
 * 
 * 多语言加密货币收单 SDK
 * 支持 10,000+ 并发客户端
 * 
 * @packageDocumentation
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Chain & Token
  ChainId,
  ChainName,
  TokenSymbol,
  ChainConfig,
  TokenConfig,
  
  // Configuration
  Environment,
  LogLevel,
  Logger,
  RetryConfig,
  RateLimitConfig,
  JWTConfig,
  EncryptionConfig,
  ProtocolBanksConfig,
  
  // Payment Link
  PaymentLinkParams,
  PaymentLink,
  LinkVerificationResult,
  HomoglyphDetails,
  
  // QR Code
  QRErrorCorrection,
  QRFormat,
  QROptions,
  QRCode,
  
  // Checkout
  CheckoutLocale,
  CheckoutTheme,
  CheckoutConfig,
  CheckoutSession,
  CheckoutResult,
  
  // x402
  X402Status,
  EIP712Domain,
  EIP712Types,
  TransferWithAuthorizationMessage,
  X402AuthorizationParams,
  X402Authorization,
  
  // Batch
  BatchRecipient,
  BatchValidationError,
  BatchItemStatus,
  BatchOptions,
  BatchSubmitResult,
  BatchStatus,
  
  // Webhook
  WebhookEventType,
  WebhookEvent,
  WebhookVerificationResult,
  
  // Error
  ErrorCategory,
  SDKError,
  
  // Security
  JWTPayload,
  TokenPair,
  EncryptedEnvelope,
  
  // API
  APIResponse,
  PaginatedResponse,
  
  // Module Interfaces
  IPaymentLinkModule,
  IX402Module,
  IBatchModule,
  IWebhookModule,
  ICheckoutModule,
  
  // Utility Types
  DeepPartial,
  RequiredFields,
  OmitFields,
} from './types';

// ============================================================================
// Monetizer Type Exports
// ============================================================================

export type {
  UpstreamConfig,
  MonetizeRateLimitConfig,
  MonetizeConfig,
  PaymentRequirement,
  PaymentProof,
  UsageRecord,
  IUsageTracker,
} from './modules/monetizer';

export type {
  PricingModel,
  PricingTier,
  TokenUsage,
  PricingConfig,
  PricingContext,
  PriceResult,
  PriceBreakdown,
  IPricingStrategy,
} from './modules/pricing';

// ============================================================================
// Constant Exports
// ============================================================================

export { ErrorCodes } from './types';

// ============================================================================
// Chain Configuration Exports
// ============================================================================

export {
  CHAIN_CONFIGS,
  TESTNET_CHAIN_CONFIGS,
  USDC_ADDRESSES,
  USDT_ADDRESSES,
  DAI_ADDRESSES,
  getChainConfig,
  getSupportedChainIds,
  getTokenConfig,
  getChainTokens,
  getChainsForToken,
  chainSupportsGasless,
  getGaslessTokens,
  isEVMChain,
  getTokenDecimals,
  getTokenAddress,
  formatAmount,
  parseAmount,
  DEFAULT_CHAIN_ID,
  DEFAULT_TOKEN,
  DEFAULT_EXPIRY_HOURS,
  MAX_EXPIRY_HOURS,
  MAX_BATCH_SIZE,
  MAX_AMOUNT,
  MIN_AMOUNT,
  API_BASE_URLS,
  PAYMENT_LINK_BASE_URL,
  CHECKOUT_WIDGET_URL,
} from './config/chains';

// ============================================================================
// Error Exports
// ============================================================================

export {
  ProtocolBanksError,
  getErrorMessage,
  extractCategory,
  isRetryable,
  isValidErrorCode,
  createValidationError,
  createAuthError,
  createNetworkError,
  assert,
  assertDefined,
  assertNotEmpty,
  assertInRange,
  wrapAsync,
  tryAsync,
  trySync,
  type Result,
} from './utils/errors';

// ============================================================================
// Crypto Exports
// ============================================================================

export {
  // Random
  randomBytes,
  randomHex,
  randomBase64,
  generateUUID,
  generateNonce,
  
  // Encoding
  bytesToHex,
  hexToBytes,
  bytesToBase64,
  base64ToBytes,
  stringToBytes,
  bytesToString,
  
  // HMAC
  hmacSign,
  hmacSignShort,
  hmacVerify,
  hmacVerifyShort,
  
  // Constant Time
  constantTimeEqual,
  constantTimeEqualBytes,
  
  // AES-256
  deriveKey,
  importKey,
  encrypt,
  decrypt,
  encryptWithPassword,
  decryptWithPassword,
  
  // Hash
  sha256,
  sha256Bytes,
  
  // Payment Link
  generatePaymentLinkSignature,
  verifyPaymentLinkSignature,
  
  // Webhook
  generateWebhookSignature,
  verifyWebhookSignature,
  
  // Sensitive Data
  maskSensitive,
  isSensitiveData,
  sanitizeForLogging,
} from './utils/crypto';

// ============================================================================
// HTTP Client Export
// ============================================================================

export { HttpClient, type HttpMethod, type RequestOptions } from './utils/http';

// ============================================================================
// Logger Export
// ============================================================================

export {
  SecureLogger,
  createSecureLogger,
  createSilentLogger,
  createConsoleLogger,
  createRequestLogger,
  createTimer,
  withTiming,
  type LogEntry,
  type LogHandler,
  type SecureLoggerOptions,
} from './utils/logger';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';

// ============================================================================
// Module Imports
// ============================================================================

import { PaymentLinkModule } from './modules/links';
import { X402Module } from './modules/x402';
import { BatchModule } from './modules/batch';
import { WebhookModule } from './modules/webhooks';
import { CheckoutModule } from './modules/checkout';

// ============================================================================
// Module Exports
// ============================================================================

export { PaymentLinkModule, createPaymentLinkModule } from './modules/links';
export { X402Module, createX402Module, buildTypedDataHash } from './modules/x402';
export { BatchModule, createBatchModule } from './modules/batch';
export {
  WebhookModule,
  createWebhookModule,
  createWebhookMiddleware,
  isPaymentEvent,
  isBatchEvent,
  isX402Event,
  isSuccessEvent,
  isFailureEvent,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from './modules/webhooks';
export { CheckoutModule, generateHostedCheckoutPage } from './modules/checkout';

// ============================================================================
// Monetizer Module Exports
// ============================================================================

export {
  APIMonetizer,
  createAPIMonetizer,
  createNextHandler,
  createExpressMiddleware,
} from './modules/monetizer';

export {
  PerRequestPricing,
  PerTokenPricing,
  DynamicPricing,
  TieredPricing,
  createPricingStrategy,
  parsePrice,
  formatPrice,
  usdToUSDC,
  usdcToUSD,
  AI_PRICING_PRESETS,
  type AIModelPreset,
} from './modules/pricing';

// ============================================================================
// Embed Code Generator Exports
// ============================================================================

export {
  EmbedCodeGenerator,
  generateEmbedCode,
  generateScriptTag,
  generateButtonCode,
  type EmbedCodeOptions,
  type GeneratedCode,
} from './utils/embed-generator';

// ============================================================================
// Validation Exports
// ============================================================================

export {
  validateAddress,
  validateAmount,
  validateToken,
  validateChainId,
  validateExpiryHours,
  validateMemo,
  validateBatchSize,
  isValidAddress,
  isValidEVMAddress,
  isValidSolanaAddress,
  isValidBitcoinAddress,
  isValidAmount,
  isValidToken,
  isExpired,
  detectHomoglyphs,
} from './utils/validation';

// ============================================================================
// Default Export - Main Client
// ============================================================================

import type {
  ProtocolBanksConfig,
  PaymentLinkParams,
  PaymentLink,
  LinkVerificationResult,
  QROptions,
  QRCode,
  X402AuthorizationParams,
  X402Authorization,
  BatchRecipient,
  BatchSubmitResult,
  BatchOptions,
  WebhookVerificationResult,
  ChainId,
  TokenSymbol,
  Logger,
} from './types';
import { ErrorCodes } from './types';
import { HttpClient } from './utils/http';
import { ProtocolBanksError } from './utils/errors';
import { sanitizeForLogging } from './utils/crypto';

/**
 * ProtocolBanks SDK Client
 * 
 * 主客户端类，集成所有模块
 * 支持 10,000+ 并发客户端
 * 
 * @example
 * ```typescript
 * const client = new ProtocolBanksClient({
 *   apiKey: 'pk_live_xxx',
 *   apiSecret: 'sk_live_xxx',
 *   environment: 'production',
 * });
 * 
 * await client.initialize();
 * 
 * // Generate payment link
 * const link = client.links.generate({
 *   to: '0x1234...',
 *   amount: '100',
 *   token: 'USDC',
 * });
 * 
 * // Create x402 gasless authorization
 * const auth = await client.x402.createAuthorization({
 *   to: '0x1234...',
 *   amount: '100',
 *   token: 'USDC',
 *   chainId: 137,
 * });
 * 
 * // Submit batch payment
 * const batch = await client.batch.submit([
 *   { address: '0x1234...', amount: '50', token: 'USDC' },
 *   { address: '0x5678...', amount: '50', token: 'USDC' },
 * ]);
 * ```
 */
export class ProtocolBanksClient {
  private config: ProtocolBanksConfig;
  private http: HttpClient;
  private logger?: Logger;
  private initialized = false;
  
  // Modules
  private _links: PaymentLinkModule;
  private _x402: X402Module;
  private _batch: BatchModule;
  private _webhooks: WebhookModule;
  private _checkout: CheckoutModule;
  
  constructor(config: ProtocolBanksConfig) {
    // Validate required config
    if (!config.apiKey) {
      throw new ProtocolBanksError({
        code: ErrorCodes.AUTH_INVALID_API_KEY,
        category: 'AUTH',
        message: 'API key is required',
        retryable: false,
      });
    }
    
    if (!config.apiSecret) {
      throw new ProtocolBanksError({
        code: ErrorCodes.AUTH_INVALID_SECRET,
        category: 'AUTH',
        message: 'API secret is required',
        retryable: false,
      });
    }
    
    this.config = config;
    if (config.logger) {
      this.logger = config.logger;
    }
    
    // Determine base URL
    const baseUrl = config.baseUrl ?? this.getDefaultBaseUrl(config.environment);
    
    // Initialize HTTP client with JWT auth
    this.http = new HttpClient({
      baseUrl,
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      timeout: config.timeout ?? 30000,
      ...(config.retryConfig && { retryConfig: config.retryConfig }),
      ...(config.rateLimitConfig && { rateLimitConfig: config.rateLimitConfig }),
      ...(config.jwtConfig && { jwtConfig: config.jwtConfig }),
      ...(config.logger && { logger: config.logger }),
    });
    
    // Initialize modules
    this._links = new PaymentLinkModule(config.apiSecret, `${baseUrl}/pay`);
    this._x402 = new X402Module(this.http);
    this._batch = new BatchModule(this.http);
    this._webhooks = new WebhookModule();
    this._checkout = new CheckoutModule(this.http, config.apiKey, baseUrl);
    
    this.logger?.debug('ProtocolBanksClient created', sanitizeForLogging({ 
      environment: config.environment,
      baseUrl,
    }));
  }
  
  // ============================================================================
  // Module Accessors
  // ============================================================================
  
  /**
   * Payment Link Module
   * Generate, verify, and parse payment links
   */
  get links(): PaymentLinkModule {
    return this._links;
  }
  
  /**
   * x402 Gasless Payment Module
   * Create EIP-712 authorizations for gasless payments
   */
  get x402(): X402Module {
    return this._x402;
  }
  
  /**
   * Batch Payment Module
   * Submit and track batch payments (up to 500 recipients)
   */
  get batch(): BatchModule {
    return this._batch;
  }
  
  /**
   * Webhook Module
   * Verify and parse webhook events
   */
  get webhooks(): WebhookModule {
    return this._webhooks;
  }
  
  /**
   * Checkout Module
   * Create hosted checkout sessions and embed codes
   */
  get checkout(): CheckoutModule {
    return this._checkout;
  }
  
  // ============================================================================
  // Lifecycle Methods
  // ============================================================================
  
  /**
   * Initialize the client
   * Validates credentials and establishes connection
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    this.logger?.info('Initializing ProtocolBanksClient...');
    
    try {
      // Validate credentials by making a test request
      await this.http.get('/health');
      
      this.initialized = true;
      this.logger?.info('ProtocolBanksClient initialized successfully');
      
    } catch (error) {
      this.logger?.error('Failed to initialize ProtocolBanksClient', error);
      throw error;
    }
  }
  
  /**
   * Close the client and cleanup resources
   */
  async close(): Promise<void> {
    this.logger?.info('Closing ProtocolBanksClient...');
    
    // Stop all batch polling
    this._batch.stopAllPolling();
    
    // Clear tokens
    this.http.clearTokens();
    
    this.initialized = false;
    this.logger?.info('ProtocolBanksClient closed');
  }
  
  // ============================================================================
  // Convenience Methods
  // ============================================================================
  
  /**
   * Generate a payment link (convenience method)
   */
  generatePaymentLink(params: PaymentLinkParams): PaymentLink {
    return this._links.generate(params);
  }
  
  /**
   * Verify a payment link (convenience method)
   */
  verifyPaymentLink(url: string): LinkVerificationResult {
    return this._links.verify(url);
  }
  
  /**
   * Generate QR code for payment link (convenience method)
   */
  async generateQR(link: PaymentLink, options?: QROptions): Promise<QRCode> {
    return this._links.generateQR(link, options);
  }
  
  /**
   * Create x402 authorization (convenience method)
   */
  async createX402Authorization(params: X402AuthorizationParams): Promise<X402Authorization> {
    return this._x402.createAuthorization(params);
  }
  
  /**
   * Submit batch payment (convenience method)
   */
  async submitBatch(
    recipients: BatchRecipient[],
    options?: BatchOptions
  ): Promise<BatchSubmitResult> {
    return this._batch.submit(recipients, options);
  }
  
  /**
   * Verify webhook signature (convenience method)
   */
  verifyWebhook(
    payload: string,
    signature: string,
    secret: string
  ): WebhookVerificationResult {
    return this._webhooks.verify(payload, signature, secret);
  }
  
  // ============================================================================
  // Info Methods
  // ============================================================================
  
  /**
   * Get SDK version
   */
  getVersion(): string {
    return VERSION;
  }
  
  /**
   * Get current configuration (with secrets masked)
   */
  getConfig(): Omit<ProtocolBanksConfig, 'apiSecret'> & { apiSecret: string } {
    return {
      ...this.config,
      apiSecret: '***',
    };
  }
  
  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Get HTTP client queue stats
   */
  getQueueStats(): { queued: number; active: number; rps: number } {
    return this.http.getQueueStats();
  }
  
  /**
   * Get supported chains
   */
  getSupportedChains(): ChainId[] {
    return this.config.supportedChains ?? [1, 137, 8453, 42161, 10, 56, 'solana', 'bitcoin'];
  }
  
  /**
   * Get supported tokens
   */
  getSupportedTokens(): TokenSymbol[] {
    return this.config.supportedTokens ?? ['USDC', 'USDT', 'DAI', 'ETH', 'MATIC', 'BNB', 'SOL', 'BTC'];
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  private getDefaultBaseUrl(environment: string): string {
    switch (environment) {
      case 'production':
        return 'https://api.protocolbanks.com';
      case 'sandbox':
        return 'https://sandbox-api.protocolbanks.com';
      case 'testnet':
      default:
        return 'https://testnet-api.protocolbanks.com';
    }
  }
}

export default ProtocolBanksClient;
