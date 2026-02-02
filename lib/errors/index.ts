/**
 * Unified Error Handling System
 * 统一错误处理系统
 */

// ============================================
// Error Codes
// ============================================

export const ErrorCodes = {
  // Authentication Errors (1xxx)
  AUTH_REQUIRED: "AUTH_1001",
  AUTH_INVALID_TOKEN: "AUTH_1002",
  AUTH_EXPIRED: "AUTH_1003",
  AUTH_INSUFFICIENT_PERMISSIONS: "AUTH_1004",
  AUTH_INVALID_SIGNATURE: "AUTH_1005",
  AUTH_WALLET_NOT_CONNECTED: "AUTH_1006",

  // Validation Errors (2xxx)
  VALIDATION_FAILED: "VAL_2001",
  VALIDATION_INVALID_ADDRESS: "VAL_2002",
  VALIDATION_INVALID_AMOUNT: "VAL_2003",
  VALIDATION_INVALID_TOKEN: "VAL_2004",
  VALIDATION_MISSING_FIELD: "VAL_2005",
  VALIDATION_INVALID_FORMAT: "VAL_2006",

  // Resource Errors (3xxx)
  RESOURCE_NOT_FOUND: "RES_3001",
  RESOURCE_ALREADY_EXISTS: "RES_3002",
  RESOURCE_CONFLICT: "RES_3003",
  RESOURCE_LOCKED: "RES_3004",

  // Payment Errors (4xxx)
  PAYMENT_INSUFFICIENT_BALANCE: "PAY_4001",
  PAYMENT_INSUFFICIENT_ALLOWANCE: "PAY_4002",
  PAYMENT_TRANSACTION_FAILED: "PAY_4003",
  PAYMENT_NONCE_EXPIRED: "PAY_4004",
  PAYMENT_GAS_ESTIMATION_FAILED: "PAY_4005",
  PAYMENT_SIGNATURE_INVALID: "PAY_4006",
  PAYMENT_LIMIT_EXCEEDED: "PAY_4007",
  PAYMENT_APPROVAL_REQUIRED: "PAY_4008",

  // Blockchain Errors (5xxx)
  BLOCKCHAIN_CONNECTION_FAILED: "CHAIN_5001",
  BLOCKCHAIN_TRANSACTION_REVERTED: "CHAIN_5002",
  BLOCKCHAIN_TIMEOUT: "CHAIN_5003",
  BLOCKCHAIN_UNSUPPORTED_CHAIN: "CHAIN_5004",
  BLOCKCHAIN_CONTRACT_ERROR: "CHAIN_5005",

  // Rate Limit Errors (6xxx)
  RATE_LIMIT_EXCEEDED: "RATE_6001",
  RATE_LIMIT_DAILY_EXCEEDED: "RATE_6002",

  // External Service Errors (7xxx)
  EXTERNAL_SERVICE_UNAVAILABLE: "EXT_7001",
  EXTERNAL_SERVICE_TIMEOUT: "EXT_7002",
  EXTERNAL_SERVICE_ERROR: "EXT_7003",

  // Internal Errors (9xxx)
  INTERNAL_ERROR: "INT_9001",
  INTERNAL_DATABASE_ERROR: "INT_9002",
  INTERNAL_CONFIGURATION_ERROR: "INT_9003",
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

// ============================================
// Error Messages (Localized)
// ============================================

export const ErrorMessages: Record<ErrorCode, { en: string; zh: string }> = {
  // Authentication
  [ErrorCodes.AUTH_REQUIRED]: {
    en: "Authentication required",
    zh: "需要身份验证",
  },
  [ErrorCodes.AUTH_INVALID_TOKEN]: {
    en: "Invalid authentication token",
    zh: "无效的身份验证令牌",
  },
  [ErrorCodes.AUTH_EXPIRED]: {
    en: "Authentication expired",
    zh: "身份验证已过期",
  },
  [ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS]: {
    en: "Insufficient permissions",
    zh: "权限不足",
  },
  [ErrorCodes.AUTH_INVALID_SIGNATURE]: {
    en: "Invalid signature",
    zh: "无效的签名",
  },
  [ErrorCodes.AUTH_WALLET_NOT_CONNECTED]: {
    en: "Wallet not connected",
    zh: "钱包未连接",
  },

  // Validation
  [ErrorCodes.VALIDATION_FAILED]: {
    en: "Validation failed",
    zh: "验证失败",
  },
  [ErrorCodes.VALIDATION_INVALID_ADDRESS]: {
    en: "Invalid wallet address",
    zh: "无效的钱包地址",
  },
  [ErrorCodes.VALIDATION_INVALID_AMOUNT]: {
    en: "Invalid amount",
    zh: "无效的金额",
  },
  [ErrorCodes.VALIDATION_INVALID_TOKEN]: {
    en: "Invalid or unsupported token",
    zh: "无效或不支持的代币",
  },
  [ErrorCodes.VALIDATION_MISSING_FIELD]: {
    en: "Required field is missing",
    zh: "缺少必填字段",
  },
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: {
    en: "Invalid format",
    zh: "格式无效",
  },

  // Resource
  [ErrorCodes.RESOURCE_NOT_FOUND]: {
    en: "Resource not found",
    zh: "资源不存在",
  },
  [ErrorCodes.RESOURCE_ALREADY_EXISTS]: {
    en: "Resource already exists",
    zh: "资源已存在",
  },
  [ErrorCodes.RESOURCE_CONFLICT]: {
    en: "Resource conflict",
    zh: "资源冲突",
  },
  [ErrorCodes.RESOURCE_LOCKED]: {
    en: "Resource is locked",
    zh: "资源已锁定",
  },

  // Payment
  [ErrorCodes.PAYMENT_INSUFFICIENT_BALANCE]: {
    en: "Insufficient balance",
    zh: "余额不足",
  },
  [ErrorCodes.PAYMENT_INSUFFICIENT_ALLOWANCE]: {
    en: "Insufficient token allowance",
    zh: "代币授权额度不足",
  },
  [ErrorCodes.PAYMENT_TRANSACTION_FAILED]: {
    en: "Transaction failed",
    zh: "交易失败",
  },
  [ErrorCodes.PAYMENT_NONCE_EXPIRED]: {
    en: "Transaction nonce expired",
    zh: "交易 nonce 已过期",
  },
  [ErrorCodes.PAYMENT_GAS_ESTIMATION_FAILED]: {
    en: "Gas estimation failed",
    zh: "Gas 估算失败",
  },
  [ErrorCodes.PAYMENT_SIGNATURE_INVALID]: {
    en: "Payment signature invalid",
    zh: "支付签名无效",
  },
  [ErrorCodes.PAYMENT_LIMIT_EXCEEDED]: {
    en: "Payment limit exceeded",
    zh: "超出支付限额",
  },
  [ErrorCodes.PAYMENT_APPROVAL_REQUIRED]: {
    en: "Payment requires approval",
    zh: "支付需要审批",
  },

  // Blockchain
  [ErrorCodes.BLOCKCHAIN_CONNECTION_FAILED]: {
    en: "Blockchain connection failed",
    zh: "区块链连接失败",
  },
  [ErrorCodes.BLOCKCHAIN_TRANSACTION_REVERTED]: {
    en: "Transaction reverted",
    zh: "交易已回滚",
  },
  [ErrorCodes.BLOCKCHAIN_TIMEOUT]: {
    en: "Blockchain operation timed out",
    zh: "区块链操作超时",
  },
  [ErrorCodes.BLOCKCHAIN_UNSUPPORTED_CHAIN]: {
    en: "Unsupported blockchain",
    zh: "不支持的区块链",
  },
  [ErrorCodes.BLOCKCHAIN_CONTRACT_ERROR]: {
    en: "Smart contract error",
    zh: "智能合约错误",
  },

  // Rate Limit
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: {
    en: "Rate limit exceeded",
    zh: "请求频率超限",
  },
  [ErrorCodes.RATE_LIMIT_DAILY_EXCEEDED]: {
    en: "Daily limit exceeded",
    zh: "超出每日限额",
  },

  // External Service
  [ErrorCodes.EXTERNAL_SERVICE_UNAVAILABLE]: {
    en: "External service unavailable",
    zh: "外部服务不可用",
  },
  [ErrorCodes.EXTERNAL_SERVICE_TIMEOUT]: {
    en: "External service timed out",
    zh: "外部服务超时",
  },
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: {
    en: "External service error",
    zh: "外部服务错误",
  },

  // Internal
  [ErrorCodes.INTERNAL_ERROR]: {
    en: "Internal server error",
    zh: "内部服务器错误",
  },
  [ErrorCodes.INTERNAL_DATABASE_ERROR]: {
    en: "Database error",
    zh: "数据库错误",
  },
  [ErrorCodes.INTERNAL_CONFIGURATION_ERROR]: {
    en: "Configuration error",
    zh: "配置错误",
  },
}

// ============================================
// HTTP Status Mapping
// ============================================

export const ErrorHttpStatus: Partial<Record<ErrorCode, number>> = {
  // 400 Bad Request
  [ErrorCodes.VALIDATION_FAILED]: 400,
  [ErrorCodes.VALIDATION_INVALID_ADDRESS]: 400,
  [ErrorCodes.VALIDATION_INVALID_AMOUNT]: 400,
  [ErrorCodes.VALIDATION_INVALID_TOKEN]: 400,
  [ErrorCodes.VALIDATION_MISSING_FIELD]: 400,
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: 400,

  // 401 Unauthorized
  [ErrorCodes.AUTH_REQUIRED]: 401,
  [ErrorCodes.AUTH_INVALID_TOKEN]: 401,
  [ErrorCodes.AUTH_EXPIRED]: 401,
  [ErrorCodes.AUTH_INVALID_SIGNATURE]: 401,
  [ErrorCodes.AUTH_WALLET_NOT_CONNECTED]: 401,

  // 403 Forbidden
  [ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS]: 403,

  // 404 Not Found
  [ErrorCodes.RESOURCE_NOT_FOUND]: 404,

  // 409 Conflict
  [ErrorCodes.RESOURCE_ALREADY_EXISTS]: 409,
  [ErrorCodes.RESOURCE_CONFLICT]: 409,
  [ErrorCodes.RESOURCE_LOCKED]: 423,

  // 402 Payment Required
  [ErrorCodes.PAYMENT_INSUFFICIENT_BALANCE]: 402,
  [ErrorCodes.PAYMENT_INSUFFICIENT_ALLOWANCE]: 402,

  // 422 Unprocessable Entity
  [ErrorCodes.PAYMENT_TRANSACTION_FAILED]: 422,
  [ErrorCodes.PAYMENT_NONCE_EXPIRED]: 422,
  [ErrorCodes.PAYMENT_GAS_ESTIMATION_FAILED]: 422,
  [ErrorCodes.PAYMENT_SIGNATURE_INVALID]: 422,
  [ErrorCodes.PAYMENT_LIMIT_EXCEEDED]: 422,
  [ErrorCodes.PAYMENT_APPROVAL_REQUIRED]: 422,

  // 429 Too Many Requests
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCodes.RATE_LIMIT_DAILY_EXCEEDED]: 429,

  // 502 Bad Gateway
  [ErrorCodes.EXTERNAL_SERVICE_UNAVAILABLE]: 502,
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 502,

  // 504 Gateway Timeout
  [ErrorCodes.BLOCKCHAIN_TIMEOUT]: 504,
  [ErrorCodes.EXTERNAL_SERVICE_TIMEOUT]: 504,

  // 500 Internal Server Error (default)
  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.INTERNAL_DATABASE_ERROR]: 500,
  [ErrorCodes.INTERNAL_CONFIGURATION_ERROR]: 500,
}

// ============================================
// Custom Error Class
// ============================================

export interface ApiErrorOptions {
  code: ErrorCode
  message?: string
  details?: Record<string, any>
  field?: string
  cause?: Error
}

export class ApiError extends Error {
  public readonly code: ErrorCode
  public readonly httpStatus: number
  public readonly details?: Record<string, any>
  public readonly field?: string
  public readonly timestamp: string

  constructor(options: ApiErrorOptions) {
    const defaultMessage = ErrorMessages[options.code]?.en || "Unknown error"
    super(options.message || defaultMessage)

    this.name = "ApiError"
    this.code = options.code
    this.httpStatus = ErrorHttpStatus[options.code] || 500
    this.details = options.details
    this.field = options.field
    this.timestamp = new Date().toISOString()

    if (options.cause) {
      this.cause = options.cause
    }

    // Maintains proper stack trace
    Error.captureStackTrace?.(this, ApiError)
  }

  /**
   * Convert to JSON response format
   */
  toJSON(locale: "en" | "zh" = "en"): ApiErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        localizedMessage: ErrorMessages[this.code]?.[locale] || this.message,
        field: this.field,
        details: this.details,
        timestamp: this.timestamp,
      },
    }
  }

  /**
   * Create from unknown error
   */
  static from(error: unknown, defaultCode: ErrorCode = ErrorCodes.INTERNAL_ERROR): ApiError {
    if (error instanceof ApiError) {
      return error
    }

    if (error instanceof Error) {
      // Check for common error patterns
      const message = error.message.toLowerCase()

      if (message.includes("insufficient funds") || message.includes("insufficient balance")) {
        return new ApiError({
          code: ErrorCodes.PAYMENT_INSUFFICIENT_BALANCE,
          cause: error,
        })
      }

      if (message.includes("nonce") && (message.includes("expired") || message.includes("too low"))) {
        return new ApiError({
          code: ErrorCodes.PAYMENT_NONCE_EXPIRED,
          cause: error,
        })
      }

      if (message.includes("reverted") || message.includes("revert")) {
        return new ApiError({
          code: ErrorCodes.BLOCKCHAIN_TRANSACTION_REVERTED,
          message: error.message,
          cause: error,
        })
      }

      if (message.includes("timeout")) {
        return new ApiError({
          code: ErrorCodes.BLOCKCHAIN_TIMEOUT,
          cause: error,
        })
      }

      return new ApiError({
        code: defaultCode,
        message: error.message,
        cause: error,
      })
    }

    return new ApiError({
      code: defaultCode,
      message: String(error),
    })
  }
}

// ============================================
// Response Types
// ============================================

export interface ApiErrorResponse {
  success: false
  error: {
    code: ErrorCode
    message: string
    localizedMessage?: string
    field?: string
    details?: Record<string, any>
    timestamp: string
  }
}

export interface ApiSuccessResponse<T = any> {
  success: true
  data?: T
  message?: string
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse

// ============================================
// Helper Functions
// ============================================

/**
 * Create a validation error
 */
export function validationError(field: string, message?: string): ApiError {
  return new ApiError({
    code: ErrorCodes.VALIDATION_FAILED,
    message: message || `Validation failed for field: ${field}`,
    field,
  })
}

/**
 * Create a not found error
 */
export function notFoundError(resource: string, id?: string): ApiError {
  return new ApiError({
    code: ErrorCodes.RESOURCE_NOT_FOUND,
    message: id ? `${resource} with id '${id}' not found` : `${resource} not found`,
    details: id ? { resource, id } : { resource },
  })
}

/**
 * Create an unauthorized error
 */
export function unauthorizedError(message?: string): ApiError {
  return new ApiError({
    code: ErrorCodes.AUTH_REQUIRED,
    message,
  })
}

/**
 * Create a forbidden error
 */
export function forbiddenError(message?: string): ApiError {
  return new ApiError({
    code: ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS,
    message,
  })
}

/**
 * Create a rate limit error
 */
export function rateLimitError(retryAfter?: number): ApiError {
  return new ApiError({
    code: ErrorCodes.RATE_LIMIT_EXCEEDED,
    details: retryAfter ? { retryAfter } : undefined,
  })
}

// ============================================
// NextJS Response Helper
// ============================================

import { NextResponse } from "next/server"

/**
 * Create a NextResponse from an ApiError
 */
export function errorResponse(error: ApiError | unknown, locale: "en" | "zh" = "en"): NextResponse {
  const apiError = error instanceof ApiError ? error : ApiError.from(error)

  return NextResponse.json(apiError.toJSON(locale), {
    status: apiError.httpStatus,
  })
}

/**
 * Create a success NextResponse
 */
export function successResponse<T>(data?: T, message?: string): NextResponse {
  const response: ApiSuccessResponse<T> = {
    success: true,
    ...(data !== undefined && { data }),
    ...(message && { message }),
  }

  return NextResponse.json(response)
}

// ============================================
// Error Logging
// ============================================

export interface ErrorLogContext {
  userId?: string
  requestId?: string
  path?: string
  method?: string
  [key: string]: any
}

/**
 * Log an error with context
 */
export function logError(error: ApiError | Error, context?: ErrorLogContext): void {
  const isApiError = error instanceof ApiError

  const logEntry = {
    timestamp: new Date().toISOString(),
    level: "error",
    code: isApiError ? error.code : "UNKNOWN",
    message: error.message,
    stack: error.stack,
    ...(isApiError && {
      httpStatus: error.httpStatus,
      field: error.field,
      details: error.details,
    }),
    ...context,
  }

  // In production, this would send to a logging service
  console.error("[Error]", JSON.stringify(logEntry, null, 2))
}
