/**
 * ProtocolBanks MCP Server - Error Handling
 * 
 * Structured error responses and error codes.
 */

import { MCPErrorCode, type MCPError, type ToolResponse } from '../types';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base MCP Error class
 */
export class MCPBaseError extends Error {
  code: MCPErrorCode;
  details?: Record<string, unknown>;

  constructor(code: MCPErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.details = details;
  }

  toJSON(): MCPError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * Payment Required Error (402)
 */
export class PaymentRequiredError extends MCPBaseError {
  constructor(message: string = 'Payment Required', details?: Record<string, unknown>) {
    super('PAYMENT_REQUIRED', message, details);
    this.name = 'PaymentRequiredError';
  }
}

/**
 * Payment Invalid Error
 */
export class PaymentInvalidError extends MCPBaseError {
  constructor(message: string = 'Payment Invalid', details?: Record<string, unknown>) {
    super('PAYMENT_INVALID', message, details);
    this.name = 'PaymentInvalidError';
  }
}

/**
 * Payment Expired Error
 */
export class PaymentExpiredError extends MCPBaseError {
  constructor(message: string = 'Payment Expired', details?: Record<string, unknown>) {
    super('PAYMENT_EXPIRED', message, details);
    this.name = 'PaymentExpiredError';
  }
}

/**
 * Payment Insufficient Error
 */
export class PaymentInsufficientError extends MCPBaseError {
  constructor(message: string = 'Payment Insufficient', details?: Record<string, unknown>) {
    super('PAYMENT_INSUFFICIENT', message, details);
    this.name = 'PaymentInsufficientError';
  }
}

/**
 * Subscription Not Found Error
 */
export class SubscriptionNotFoundError extends MCPBaseError {
  constructor(subscriptionId?: string) {
    super(
      'SUBSCRIPTION_NOT_FOUND',
      subscriptionId ? `Subscription '${subscriptionId}' not found` : 'Subscription not found'
    );
    this.name = 'SubscriptionNotFoundError';
  }
}

/**
 * Plan Not Found Error
 */
export class PlanNotFoundError extends MCPBaseError {
  constructor(planId?: string) {
    super(
      'PLAN_NOT_FOUND',
      planId ? `Plan '${planId}' not found` : 'Plan not found'
    );
    this.name = 'PlanNotFoundError';
  }
}

/**
 * Invalid Wallet Address Error
 */
export class InvalidWalletAddressError extends MCPBaseError {
  constructor(address?: string) {
    super(
      'INVALID_WALLET_ADDRESS',
      address ? `Invalid wallet address: ${address}` : 'Invalid wallet address'
    );
    this.name = 'InvalidWalletAddressError';
  }
}

/**
 * Invalid Parameters Error
 */
export class InvalidParametersError extends MCPBaseError {
  constructor(message: string = 'Invalid parameters', details?: Record<string, unknown>) {
    super('INVALID_PARAMETERS', message, details);
    this.name = 'InvalidParametersError';
  }
}

/**
 * Rate Limited Error
 */
export class RateLimitedError extends MCPBaseError {
  constructor(retryAfter?: number) {
    super('RATE_LIMITED', 'Rate limit exceeded', retryAfter ? { retryAfter } : undefined);
    this.name = 'RateLimitedError';
  }
}

/**
 * Database Error
 */
export class DatabaseError extends MCPBaseError {
  constructor(message: string = 'Database error', details?: Record<string, unknown>) {
    super('DATABASE_ERROR', message, details);
    this.name = 'DatabaseError';
  }
}

/**
 * Internal Error
 */
export class InternalError extends MCPBaseError {
  constructor(message: string = 'Internal server error', details?: Record<string, unknown>) {
    super('INTERNAL_ERROR', message, details);
    this.name = 'InternalError';
  }
}

// ============================================================================
// Error Response Helpers
// ============================================================================

/**
 * Create an error response for MCP tools
 */
export function createErrorResponse(error: MCPBaseError | Error | unknown): ToolResponse {
  if (error instanceof MCPBaseError) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: true,
          code: error.code,
          message: error.message,
          details: error.details,
        }, null, 2),
      }],
      isError: true,
    };
  }

  if (error instanceof Error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: true,
          code: 'INTERNAL_ERROR',
          message: error.message,
        }, null, 2),
      }],
      isError: true,
    };
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: true,
        code: 'INTERNAL_ERROR',
        message: 'Unknown error occurred',
      }, null, 2),
    }],
    isError: true,
  };
}

/**
 * Check if an error is an MCP error
 */
export function isMCPError(error: unknown): error is MCPBaseError {
  return error instanceof MCPBaseError;
}

/**
 * Get error code from any error
 */
export function getErrorCode(error: unknown): MCPErrorCode {
  if (error instanceof MCPBaseError) {
    return error.code;
  }
  return 'INTERNAL_ERROR';
}

/**
 * Get error message from any error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

// ============================================================================
// Error Code Descriptions
// ============================================================================

export const ERROR_DESCRIPTIONS: Record<MCPErrorCode, string> = {
  PAYMENT_REQUIRED: 'Payment is required to access this resource',
  PAYMENT_INVALID: 'The payment signature or authorization is invalid',
  PAYMENT_EXPIRED: 'The payment authorization has expired',
  PAYMENT_INSUFFICIENT: 'The payment amount is insufficient',
  SUBSCRIPTION_NOT_FOUND: 'The requested subscription was not found',
  SUBSCRIPTION_EXPIRED: 'The subscription has expired',
  PLAN_NOT_FOUND: 'The requested subscription plan was not found',
  INVALID_WALLET_ADDRESS: 'The provided wallet address is invalid',
  INVALID_PARAMETERS: 'One or more parameters are invalid',
  INTERNAL_ERROR: 'An internal server error occurred',
  RATE_LIMITED: 'Too many requests, please try again later',
  DATABASE_ERROR: 'A database error occurred',
};

/**
 * Get description for an error code
 */
export function getErrorDescription(code: MCPErrorCode): string {
  return ERROR_DESCRIPTIONS[code] || 'An unknown error occurred';
}
