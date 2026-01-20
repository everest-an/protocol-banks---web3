/**
 * ProtocolBanks SDK - Error Handling System
 * 
 * 统一错误处理，支持:
 * - 错误码格式 (PB_XXX_NNN)
 * - 错误本地化 (英文/中文)
 * - 可重试判断
 * - 错误详情
 */

import type { SDKError, ErrorCategory } from '../types';
import { ErrorCodes } from '../types';

// ============================================================================
// Error Messages (Localized)
// ============================================================================

/** Error messages in English */
const ERROR_MESSAGES_EN: Record<string, string> = {
  // Authentication errors
  [ErrorCodes.AUTH_INVALID_API_KEY]: 'Invalid API key',
  [ErrorCodes.AUTH_INVALID_SECRET]: 'Invalid API secret',
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: 'Authentication token has expired',
  [ErrorCodes.AUTH_TOKEN_INVALID]: 'Invalid authentication token',
  [ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions for this operation',
  
  // Payment link errors
  [ErrorCodes.LINK_INVALID_ADDRESS]: 'Invalid recipient address format',
  [ErrorCodes.LINK_INVALID_AMOUNT]: 'Invalid payment amount',
  [ErrorCodes.LINK_INVALID_TOKEN]: 'Unsupported token',
  [ErrorCodes.LINK_INVALID_CHAIN]: 'Unsupported blockchain',
  [ErrorCodes.LINK_EXPIRED]: 'Payment link has expired',
  [ErrorCodes.LINK_TAMPERED]: 'Payment link has been tampered with',
  [ErrorCodes.LINK_HOMOGLYPH_DETECTED]: 'Potential homoglyph attack detected in address',
  [ErrorCodes.LINK_INVALID_EXPIRY]: 'Invalid expiry time',
  
  // x402 errors
  [ErrorCodes.X402_UNSUPPORTED_CHAIN]: 'Chain does not support gasless payments',
  [ErrorCodes.X402_UNSUPPORTED_TOKEN]: 'Token does not support gasless payments',
  [ErrorCodes.X402_AUTHORIZATION_EXPIRED]: 'Authorization has expired',
  [ErrorCodes.X402_INVALID_SIGNATURE]: 'Invalid authorization signature',
  [ErrorCodes.X402_NONCE_REUSED]: 'Nonce has already been used',
  [ErrorCodes.X402_INSUFFICIENT_BALANCE]: 'Insufficient token balance',
  [ErrorCodes.X402_RELAYER_ERROR]: 'Relayer service error',
  
  // Batch errors
  [ErrorCodes.BATCH_SIZE_EXCEEDED]: 'Batch size exceeds maximum limit of 500',
  [ErrorCodes.BATCH_VALIDATION_FAILED]: 'Batch validation failed',
  [ErrorCodes.BATCH_NOT_FOUND]: 'Batch not found',
  [ErrorCodes.BATCH_ALREADY_PROCESSING]: 'Batch is already being processed',
  
  // Network errors
  [ErrorCodes.NET_CONNECTION_FAILED]: 'Network connection failed',
  [ErrorCodes.NET_TIMEOUT]: 'Request timed out',
  [ErrorCodes.NET_DNS_FAILED]: 'DNS resolution failed',
  [ErrorCodes.NET_SSL_ERROR]: 'SSL/TLS error',
  
  // Rate limit errors
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
  [ErrorCodes.RATE_QUOTA_EXCEEDED]: 'API quota exceeded',
  
  // Validation errors
  [ErrorCodes.VALID_REQUIRED_FIELD]: 'Required field is missing',
  [ErrorCodes.VALID_INVALID_FORMAT]: 'Invalid field format',
  [ErrorCodes.VALID_OUT_OF_RANGE]: 'Value is out of allowed range',
  
  // Cryptography errors
  [ErrorCodes.CRYPTO_ENCRYPTION_FAILED]: 'Encryption failed',
  [ErrorCodes.CRYPTO_DECRYPTION_FAILED]: 'Decryption failed',
  [ErrorCodes.CRYPTO_SIGNATURE_FAILED]: 'Signature generation failed',
  [ErrorCodes.CRYPTO_KEY_DERIVATION_FAILED]: 'Key derivation failed',
  
  // Chain errors
  [ErrorCodes.CHAIN_UNSUPPORTED]: 'Blockchain not supported',
  [ErrorCodes.CHAIN_RPC_ERROR]: 'Blockchain RPC error',
  [ErrorCodes.CHAIN_TRANSACTION_FAILED]: 'Transaction failed',
};

/** Error messages in Chinese */
const ERROR_MESSAGES_ZH: Record<string, string> = {
  // Authentication errors
  [ErrorCodes.AUTH_INVALID_API_KEY]: 'API 密钥无效',
  [ErrorCodes.AUTH_INVALID_SECRET]: 'API 密钥密码无效',
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: '认证令牌已过期',
  [ErrorCodes.AUTH_TOKEN_INVALID]: '认证令牌无效',
  [ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS]: '权限不足',
  
  // Payment link errors
  [ErrorCodes.LINK_INVALID_ADDRESS]: '收款地址格式无效',
  [ErrorCodes.LINK_INVALID_AMOUNT]: '支付金额无效',
  [ErrorCodes.LINK_INVALID_TOKEN]: '不支持的代币',
  [ErrorCodes.LINK_INVALID_CHAIN]: '不支持的区块链',
  [ErrorCodes.LINK_EXPIRED]: '支付链接已过期',
  [ErrorCodes.LINK_TAMPERED]: '支付链接已被篡改',
  [ErrorCodes.LINK_HOMOGLYPH_DETECTED]: '检测到地址中可能存在同形字符攻击',
  [ErrorCodes.LINK_INVALID_EXPIRY]: '过期时间无效',
  
  // x402 errors
  [ErrorCodes.X402_UNSUPPORTED_CHAIN]: '该链不支持免 Gas 支付',
  [ErrorCodes.X402_UNSUPPORTED_TOKEN]: '该代币不支持免 Gas 支付',
  [ErrorCodes.X402_AUTHORIZATION_EXPIRED]: '授权已过期',
  [ErrorCodes.X402_INVALID_SIGNATURE]: '授权签名无效',
  [ErrorCodes.X402_NONCE_REUSED]: 'Nonce 已被使用',
  [ErrorCodes.X402_INSUFFICIENT_BALANCE]: '代币余额不足',
  [ErrorCodes.X402_RELAYER_ERROR]: '中继服务错误',
  
  // Batch errors
  [ErrorCodes.BATCH_SIZE_EXCEEDED]: '批量大小超过最大限制 500',
  [ErrorCodes.BATCH_VALIDATION_FAILED]: '批量验证失败',
  [ErrorCodes.BATCH_NOT_FOUND]: '批次未找到',
  [ErrorCodes.BATCH_ALREADY_PROCESSING]: '批次正在处理中',
  
  // Network errors
  [ErrorCodes.NET_CONNECTION_FAILED]: '网络连接失败',
  [ErrorCodes.NET_TIMEOUT]: '请求超时',
  [ErrorCodes.NET_DNS_FAILED]: 'DNS 解析失败',
  [ErrorCodes.NET_SSL_ERROR]: 'SSL/TLS 错误',
  
  // Rate limit errors
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: '请求频率超限',
  [ErrorCodes.RATE_QUOTA_EXCEEDED]: 'API 配额已用完',
  
  // Validation errors
  [ErrorCodes.VALID_REQUIRED_FIELD]: '缺少必填字段',
  [ErrorCodes.VALID_INVALID_FORMAT]: '字段格式无效',
  [ErrorCodes.VALID_OUT_OF_RANGE]: '值超出允许范围',
  
  // Cryptography errors
  [ErrorCodes.CRYPTO_ENCRYPTION_FAILED]: '加密失败',
  [ErrorCodes.CRYPTO_DECRYPTION_FAILED]: '解密失败',
  [ErrorCodes.CRYPTO_SIGNATURE_FAILED]: '签名生成失败',
  [ErrorCodes.CRYPTO_KEY_DERIVATION_FAILED]: '密钥派生失败',
  
  // Chain errors
  [ErrorCodes.CHAIN_UNSUPPORTED]: '不支持的区块链',
  [ErrorCodes.CHAIN_RPC_ERROR]: '区块链 RPC 错误',
  [ErrorCodes.CHAIN_TRANSACTION_FAILED]: '交易失败',
};

// ============================================================================
// Error Class
// ============================================================================

/** ProtocolBanks SDK Error */
export class ProtocolBanksError extends Error implements SDKError {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly details?: unknown;
  readonly retryable: boolean;
  readonly retryAfter?: number;
  readonly timestamp: Date;
  readonly requestId?: string;

  constructor(error: Partial<SDKError> & { code: string }) {
    const message = error.message ?? getErrorMessage(error.code, 'en');
    super(message);
    
    this.name = 'ProtocolBanksError';
    this.code = error.code;
    this.category = error.category ?? extractCategory(error.code);
    this.details = error.details;
    this.retryable = error.retryable ?? isRetryable(error.code);
    this.retryAfter = error.retryAfter;
    this.timestamp = error.timestamp ?? new Date();
    this.requestId = error.requestId;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProtocolBanksError);
    }
  }

  /** Get localized message */
  getLocalizedMessage(locale: 'en' | 'zh' = 'en'): string {
    return getErrorMessage(this.code, locale);
  }

  /** Convert to JSON */
  toJSON(): SDKError {
    return {
      code: this.code,
      category: this.category,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }

  /** Create from unknown error */
  static from(error: unknown, defaultCode?: string): ProtocolBanksError {
    if (error instanceof ProtocolBanksError) {
      return error;
    }

    if (error instanceof Error) {
      return new ProtocolBanksError({
        code: defaultCode ?? ErrorCodes.NET_CONNECTION_FAILED,
        message: error.message,
        details: { originalError: error.name, stack: error.stack },
      });
    }

    return new ProtocolBanksError({
      code: defaultCode ?? ErrorCodes.NET_CONNECTION_FAILED,
      message: String(error),
      details: error,
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Get error message by code and locale */
export function getErrorMessage(code: string, locale: 'en' | 'zh' = 'en'): string {
  const messages = locale === 'zh' ? ERROR_MESSAGES_ZH : ERROR_MESSAGES_EN;
  return messages[code] ?? `Unknown error: ${code}`;
}

/** Extract category from error code */
export function extractCategory(code: string): ErrorCategory {
  const match = code.match(/^PB_([A-Z]+)_/);
  if (match?.[1]) {
    const category = match[1] as ErrorCategory;
    const validCategories: ErrorCategory[] = [
      'AUTH', 'LINK', 'X402', 'BATCH', 'NET', 'RATE', 'VALID', 'CRYPTO', 'CHAIN'
    ];
    if (validCategories.includes(category)) {
      return category;
    }
  }
  return 'NET';
}

/** Check if error is retryable */
export function isRetryable(code: string): boolean {
  const category = extractCategory(code);
  
  // Network and rate limit errors are generally retryable
  if (category === 'NET' || category === 'RATE') {
    return true;
  }
  
  // Specific retryable errors
  const retryableCodes = [
    ErrorCodes.X402_RELAYER_ERROR,
    ErrorCodes.CHAIN_RPC_ERROR,
  ];
  
  return retryableCodes.includes(code as typeof ErrorCodes[keyof typeof ErrorCodes]);
}

/** Validate error code format */
export function isValidErrorCode(code: string): boolean {
  return /^PB_[A-Z]+_[0-9]{3}$/.test(code);
}

/** Create validation error */
export function createValidationError(
  field: string,
  message: string,
  code: string = ErrorCodes.VALID_INVALID_FORMAT
): ProtocolBanksError {
  return new ProtocolBanksError({
    code,
    category: 'VALID',
    message: `${field}: ${message}`,
    details: { field },
    retryable: false,
  });
}

/** Create authentication error */
export function createAuthError(
  message: string,
  code: string = ErrorCodes.AUTH_INVALID_API_KEY
): ProtocolBanksError {
  return new ProtocolBanksError({
    code,
    category: 'AUTH',
    message,
    retryable: false,
  });
}

/** Create network error */
export function createNetworkError(
  message: string,
  code: string = ErrorCodes.NET_CONNECTION_FAILED,
  retryAfter?: number
): ProtocolBanksError {
  return new ProtocolBanksError({
    code,
    category: 'NET',
    message,
    retryable: true,
    retryAfter,
  });
}

// ============================================================================
// Error Assertion Helpers
// ============================================================================

/** Assert condition or throw error */
export function assert(
  condition: boolean,
  code: string,
  message?: string
): asserts condition {
  if (!condition) {
    throw new ProtocolBanksError({
      code,
      message: message ?? getErrorMessage(code, 'en'),
    });
  }
}

/** Assert value is defined */
export function assertDefined<T>(
  value: T | null | undefined,
  code: string,
  message?: string
): asserts value is T {
  assert(value !== null && value !== undefined, code, message);
}

/** Assert string is not empty */
export function assertNotEmpty(
  value: string | null | undefined,
  fieldName: string
): asserts value is string {
  assert(
    typeof value === 'string' && value.trim().length > 0,
    ErrorCodes.VALID_REQUIRED_FIELD,
    `${fieldName} is required`
  );
}

/** Assert number is in range */
export function assertInRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): void {
  assert(
    value >= min && value <= max,
    ErrorCodes.VALID_OUT_OF_RANGE,
    `${fieldName} must be between ${min} and ${max}`
  );
}

// ============================================================================
// Error Wrapping
// ============================================================================

/** Wrap async function with error handling */
export function wrapAsync<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  defaultErrorCode?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw ProtocolBanksError.from(error, defaultErrorCode);
    }
  }) as T;
}

/** Try-catch wrapper that returns Result type */
export type Result<T, E = ProtocolBanksError> = 
  | { success: true; data: T }
  | { success: false; error: E };

export async function tryAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: ProtocolBanksError.from(error) };
  }
}

export function trySync<T>(fn: () => T): Result<T> {
  try {
    const data = fn();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: ProtocolBanksError.from(error) };
  }
}
