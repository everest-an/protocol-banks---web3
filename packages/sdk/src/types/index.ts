/**
 * ProtocolBanks SDK - Core Type Definitions
 * 
 * 支持多链、多币种的加密货币收单 SDK
 * Supports 10,000+ concurrent clients
 */

// ============================================================================
// Chain & Token Types
// ============================================================================

/** Supported chain IDs */
export type ChainId = 1 | 137 | 8453 | 42161 | 10 | 56 | 'solana' | 'bitcoin';

/** Chain names for display */
export type ChainName = 
  | 'Ethereum' 
  | 'Polygon' 
  | 'Base' 
  | 'Arbitrum' 
  | 'Optimism' 
  | 'BSC' 
  | 'Solana' 
  | 'Bitcoin';

/** Supported token symbols */
export type TokenSymbol = 'USDC' | 'USDT' | 'DAI' | 'ETH' | 'MATIC' | 'BNB' | 'SOL' | 'BTC';

/** Chain configuration */
export interface ChainConfig {
  id: ChainId;
  name: ChainName;
  nativeCurrency: TokenSymbol;
  rpcUrl: string;
  explorerUrl: string;
  tokens: TokenConfig[];
  isTestnet?: boolean;
}

/** Token configuration */
export interface TokenConfig {
  symbol: TokenSymbol;
  name: string;
  address: string;        // Contract address or 'native'
  decimals: number;
  supportsGasless: boolean;  // x402 support
  minAmount?: string;
  maxAmount?: string;
}

// ============================================================================
// SDK Configuration Types
// ============================================================================

/** SDK environment */
export type Environment = 'production' | 'sandbox' | 'testnet';

/** Log level */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/** Logger interface */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/** Retry configuration */
export interface RetryConfig {
  maxRetries: number;       // Default: 3
  initialDelay: number;     // Default: 1000ms
  maxDelay: number;         // Default: 30000ms
  backoffMultiplier: number; // Default: 2
}

/** Rate limit configuration for high concurrency */
export interface RateLimitConfig {
  maxRequestsPerSecond: number;  // Default: 100
  maxConcurrent: number;         // Default: 50
  queueSize: number;             // Default: 10000
}

/** JWT Token configuration */
export interface JWTConfig {
  algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
  expiresIn: number;        // Seconds, default: 3600
  refreshThreshold: number; // Seconds before expiry to refresh, default: 300
}

/** AES-256 Encryption configuration */
export interface EncryptionConfig {
  algorithm: 'aes-256-gcm' | 'aes-256-cbc';
  keyDerivation: 'pbkdf2' | 'scrypt';
  iterations?: number;      // For PBKDF2, default: 100000
}

/** Main SDK configuration */
export interface ProtocolBanksConfig {
  apiKey: string;
  apiSecret: string;
  environment: Environment;
  baseUrl?: string;
  timeout?: number;         // Default: 30000ms
  retryConfig?: RetryConfig;
  rateLimitConfig?: RateLimitConfig;
  jwtConfig?: JWTConfig;
  encryptionConfig?: EncryptionConfig;
  logger?: Logger;
  defaultChain?: ChainId;
  supportedChains?: ChainId[];
  supportedTokens?: TokenSymbol[];
}

// ============================================================================
// Payment Link Types
// ============================================================================

/** Payment link generation parameters */
export interface PaymentLinkParams {
  to: string;               // Recipient address
  amount: string;           // Amount in token units
  token?: TokenSymbol;      // Default: USDC
  chain?: ChainId;          // Specific chain
  expiryHours?: number;     // Default: 24, max: 168
  memo?: string;            // Optional reference (max 256 chars)
  orderId?: string;         // Merchant order ID
  callbackUrl?: string;     // Redirect URL after payment
  webhookUrl?: string;      // Webhook notification URL
  allowedChains?: ChainId[];
  allowedTokens?: TokenSymbol[];
  metadata?: Record<string, string>;  // Custom metadata (encrypted)
}

/** Generated payment link */
export interface PaymentLink {
  url: string;
  shortUrl: string;
  params: PaymentLinkParams;
  signature: string;
  expiresAt: Date;
  createdAt: Date;
  paymentId: string;
}

/** Link verification result */
export interface LinkVerificationResult {
  valid: boolean;
  expired: boolean;
  tamperedFields: string[];
  params?: PaymentLinkParams;
  error?: string;
  homoglyphDetected?: boolean;
  homoglyphDetails?: HomoglyphDetails;
}

/** Homoglyph attack detection details */
export interface HomoglyphDetails {
  originalAddress: string;
  detectedCharacters: Array<{
    position: number;
    character: string;
    unicodePoint: string;
    expectedCharacter: string;
  }>;
}

// ============================================================================
// QR Code Types
// ============================================================================

/** QR code error correction level */
export type QRErrorCorrection = 'L' | 'M' | 'Q' | 'H';

/** QR code output format */
export type QRFormat = 'svg' | 'png' | 'base64' | 'dataUrl';

/** QR code generation options */
export interface QROptions {
  size?: number;            // 100-1000 pixels
  format?: QRFormat;
  errorCorrection?: QRErrorCorrection;
  logo?: string;            // Logo URL or base64
  logoSize?: number;        // 0.1-0.3 ratio
  foreground?: string;      // Hex color
  background?: string;      // Hex color
  margin?: number;          // Quiet zone modules
}

/** Generated QR code */
export interface QRCode {
  data: string;
  format: QRFormat;
  size: number;
  paymentLink: string;
}

// ============================================================================
// Checkout Types (Embedded Widget)
// ============================================================================

/** Checkout locale */
export type CheckoutLocale = 'en' | 'zh' | 'es' | 'ja' | 'ko' | 'de' | 'fr';

/** Checkout theme */
export interface CheckoutTheme {
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
  fontFamily?: string;
  logo?: string;
  companyName?: string;
  darkMode?: boolean;
}

/** Checkout configuration */
export interface CheckoutConfig {
  amount: string;
  currency?: string;        // Fiat display currency (USD, EUR, CNY)
  token?: TokenSymbol;
  chain?: ChainId;
  allowedChains?: ChainId[];
  allowedTokens?: TokenSymbol[];
  recipientAddress: string;
  orderId?: string;
  memo?: string;
  callbackUrl?: string;
  webhookUrl?: string;
  theme?: CheckoutTheme;
  locale?: CheckoutLocale;
  metadata?: Record<string, string>;
}

/** Checkout session */
export interface CheckoutSession {
  sessionId: string;
  url: string;
  expiresAt: Date;
  config: CheckoutConfig;
}

/** Checkout result */
export interface CheckoutResult {
  success: boolean;
  paymentId: string;
  transactionHash?: string;
  chain: ChainId;
  token: TokenSymbol;
  amount: string;
  fee?: string;
  error?: string;
  timestamp: Date;
}

// ============================================================================
// x402 Gasless Payment Types
// ============================================================================

/** x402 authorization status */
export type X402Status = 
  | 'pending' 
  | 'signed' 
  | 'submitted' 
  | 'executed' 
  | 'failed' 
  | 'expired' 
  | 'cancelled';

/** EIP-712 domain */
export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

/** EIP-712 types */
export interface EIP712Types {
  [key: string]: Array<{ name: string; type: string }>;
}

/** TransferWithAuthorization message */
export interface TransferWithAuthorizationMessage {
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
}

/** x402 authorization parameters */
export interface X402AuthorizationParams {
  to: string;
  amount: string;
  token: TokenSymbol;
  chainId: number;
  validFor?: number;        // Seconds, default: 3600
}

/** x402 authorization */
export interface X402Authorization {
  id: string;
  domain: EIP712Domain;
  types: EIP712Types;
  message: TransferWithAuthorizationMessage;
  status: X402Status;
  transactionHash?: string;
  createdAt: Date;
  expiresAt: Date;
  signature?: string;
  relayerFee?: string;
}

// ============================================================================
// Batch Payment Types
// ============================================================================

/** Batch recipient */
export interface BatchRecipient {
  address: string;
  amount: string;
  token: TokenSymbol;
  memo?: string;
  orderId?: string;
}

/** Batch validation error */
export interface BatchValidationError {
  index: number;
  address: string;
  errors: string[];
}

/** Batch item status */
export interface BatchItemStatus {
  index: number;
  address: string;
  amount: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transactionHash?: string;
  error?: string;
}

/** Batch submit options */
export interface BatchOptions {
  chain?: ChainId;
  priority?: 'low' | 'medium' | 'high';
  webhookUrl?: string;
  idempotencyKey?: string;
}

/** Batch submit result */
export interface BatchSubmitResult {
  batchId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  validCount: number;
  invalidCount: number;
  errors: BatchValidationError[];
  estimatedFee?: string;
}

/** Batch status */
export interface BatchStatus {
  batchId: string;
  status: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
  };
  items: BatchItemStatus[];
  totalAmount: string;
  totalFee?: string;
  createdAt: Date;
  completedAt?: Date;
}

// ============================================================================
// Webhook Types
// ============================================================================

/** Webhook event types */
export type WebhookEventType = 
  | 'payment.created'
  | 'payment.completed'
  | 'payment.failed'
  | 'payment.expired'
  | 'batch.created'
  | 'batch.processing'
  | 'batch.completed'
  | 'batch.failed'
  | 'x402.created'
  | 'x402.signed'
  | 'x402.executed'
  | 'x402.failed'
  | 'x402.expired';

/** Webhook event */
export interface WebhookEvent<T = Record<string, unknown>> {
  id: string;
  type: WebhookEventType;
  timestamp: Date;
  data: T;
  signature: string;
}

/** Webhook verification result */
export interface WebhookVerificationResult {
  valid: boolean;
  event?: WebhookEvent;
  error?: string;
  timestampValid?: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

/** Error categories */
export type ErrorCategory = 
  | 'AUTH'      // Authentication errors
  | 'LINK'      // Payment link errors
  | 'X402'      // x402 protocol errors
  | 'BATCH'     // Batch payment errors
  | 'NET'       // Network errors
  | 'RATE'      // Rate limit errors
  | 'VALID'     // Validation errors
  | 'CRYPTO'    // Cryptography errors
  | 'CHAIN';    // Blockchain errors

/** SDK Error */
export interface SDKError {
  code: string;             // Format: PB_{CATEGORY}_{NNN}
  category: ErrorCategory;
  message: string;
  details?: unknown;
  retryable: boolean;
  retryAfter?: number;      // Seconds
  timestamp: Date;
  requestId?: string;
}

/** Error code constants */
export const ErrorCodes = {
  // Authentication errors (PB_AUTH_xxx)
  AUTH_INVALID_API_KEY: 'PB_AUTH_001',
  AUTH_INVALID_SECRET: 'PB_AUTH_002',
  AUTH_TOKEN_EXPIRED: 'PB_AUTH_003',
  AUTH_TOKEN_INVALID: 'PB_AUTH_004',
  AUTH_INSUFFICIENT_PERMISSIONS: 'PB_AUTH_005',
  
  // Payment link errors (PB_LINK_xxx)
  LINK_INVALID_ADDRESS: 'PB_LINK_001',
  LINK_INVALID_AMOUNT: 'PB_LINK_002',
  LINK_INVALID_TOKEN: 'PB_LINK_003',
  LINK_INVALID_CHAIN: 'PB_LINK_004',
  LINK_EXPIRED: 'PB_LINK_005',
  LINK_TAMPERED: 'PB_LINK_006',
  LINK_HOMOGLYPH_DETECTED: 'PB_LINK_007',
  LINK_INVALID_EXPIRY: 'PB_LINK_008',
  
  // x402 errors (PB_X402_xxx)
  X402_UNSUPPORTED_CHAIN: 'PB_X402_001',
  X402_UNSUPPORTED_TOKEN: 'PB_X402_002',
  X402_AUTHORIZATION_EXPIRED: 'PB_X402_003',
  X402_INVALID_SIGNATURE: 'PB_X402_004',
  X402_NONCE_REUSED: 'PB_X402_005',
  X402_INSUFFICIENT_BALANCE: 'PB_X402_006',
  X402_RELAYER_ERROR: 'PB_X402_007',
  
  // Batch errors (PB_BATCH_xxx)
  BATCH_SIZE_EXCEEDED: 'PB_BATCH_001',
  BATCH_VALIDATION_FAILED: 'PB_BATCH_002',
  BATCH_NOT_FOUND: 'PB_BATCH_003',
  BATCH_ALREADY_PROCESSING: 'PB_BATCH_004',
  
  // Network errors (PB_NET_xxx)
  NET_CONNECTION_FAILED: 'PB_NET_001',
  NET_TIMEOUT: 'PB_NET_002',
  NET_DNS_FAILED: 'PB_NET_003',
  NET_SSL_ERROR: 'PB_NET_004',
  
  // Rate limit errors (PB_RATE_xxx)
  RATE_LIMIT_EXCEEDED: 'PB_RATE_001',
  RATE_QUOTA_EXCEEDED: 'PB_RATE_002',
  
  // Validation errors (PB_VALID_xxx)
  VALID_REQUIRED_FIELD: 'PB_VALID_001',
  VALID_INVALID_FORMAT: 'PB_VALID_002',
  VALID_OUT_OF_RANGE: 'PB_VALID_003',
  
  // Cryptography errors (PB_CRYPTO_xxx)
  CRYPTO_ENCRYPTION_FAILED: 'PB_CRYPTO_001',
  CRYPTO_DECRYPTION_FAILED: 'PB_CRYPTO_002',
  CRYPTO_SIGNATURE_FAILED: 'PB_CRYPTO_003',
  CRYPTO_KEY_DERIVATION_FAILED: 'PB_CRYPTO_004',
  
  // Chain errors (PB_CHAIN_xxx)
  CHAIN_UNSUPPORTED: 'PB_CHAIN_001',
  CHAIN_RPC_ERROR: 'PB_CHAIN_002',
  CHAIN_TRANSACTION_FAILED: 'PB_CHAIN_003',
} as const;

// ============================================================================
// JWT & Security Types
// ============================================================================

/** JWT payload */
export interface JWTPayload {
  sub: string;              // Subject (API key ID)
  iss: string;              // Issuer
  aud: string;              // Audience
  exp: number;              // Expiration time
  iat: number;              // Issued at
  jti: string;              // JWT ID (unique)
  scope: string[];          // Permissions
}

/** JWT token pair */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tokenType: 'Bearer';
}

/** Encrypted data envelope */
export interface EncryptedEnvelope {
  ciphertext: string;       // Base64 encoded
  iv: string;               // Base64 encoded initialization vector
  tag: string;              // Base64 encoded auth tag (for GCM)
  algorithm: string;
  keyId?: string;           // Key identifier for rotation
}

// ============================================================================
// API Response Types
// ============================================================================

/** API response wrapper */
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: SDKError;
  requestId: string;
  timestamp: Date;
}

/** Paginated response */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// Module Interfaces
// ============================================================================

/** Payment Link Module interface */
export interface IPaymentLinkModule {
  generate(params: PaymentLinkParams): PaymentLink;
  verify(url: string): LinkVerificationResult;
  parse(url: string): PaymentLinkParams | null;
  generateQR(link: PaymentLink, options?: QROptions): Promise<QRCode>;
  getSupportedChains(token: TokenSymbol): ChainId[];
  getSupportedTokens(chain: ChainId): TokenSymbol[];
}

/** x402 Module interface */
export interface IX402Module {
  createAuthorization(params: X402AuthorizationParams): Promise<X402Authorization>;
  submitSignature(authId: string, signature: string): Promise<X402Authorization>;
  getStatus(authId: string): Promise<X402Authorization>;
  cancel(authId: string): Promise<void>;
  isChainSupported(chainId: number): boolean;
  isTokenSupported(chainId: number, token: TokenSymbol): boolean;
}

/** Batch Module interface */
export interface IBatchModule {
  validate(recipients: BatchRecipient[]): Promise<BatchValidationError[]>;
  submit(recipients: BatchRecipient[], options?: BatchOptions): Promise<BatchSubmitResult>;
  getStatus(batchId: string): Promise<BatchStatus>;
  retry(batchId: string, itemIndices?: number[]): Promise<BatchSubmitResult>;
  poll(batchId: string, callback: (status: BatchStatus) => void, interval?: number): () => void;
}

/** Webhook Module interface */
export interface IWebhookModule {
  verify(payload: string, signature: string, secret: string): WebhookVerificationResult;
  parse(payload: string): WebhookEvent;
  sign(payload: string, secret: string): string;
}

/** Checkout Module interface */
export interface ICheckoutModule {
  open(config: CheckoutConfig): Promise<CheckoutResult>;
  close(): void;
  createSession(config: CheckoutConfig): Promise<CheckoutSession>;
  getSessionStatus(sessionId: string): Promise<CheckoutResult>;
  getEmbedCode(config: CheckoutConfig): string;
}

// ============================================================================
// Utility Types
// ============================================================================

/** Deep partial type */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** Required fields */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** Omit fields */
export type OmitFields<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
