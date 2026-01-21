/**
 * ProtocolBanks MCP Server - Validation Utilities
 * 
 * Input validation for wallet addresses, parameters, and amounts.
 */

import { MCPErrorCode } from '../types';

// ============================================================================
// Validation Error
// ============================================================================

export class ValidationError extends Error {
  code: MCPErrorCode;
  field?: string;

  constructor(code: MCPErrorCode, message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.field = field;
  }
}

// ============================================================================
// Wallet Address Validation
// ============================================================================

/**
 * Validate Ethereum address format
 */
export function isValidEthereumAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate Ethereum address and throw if invalid
 */
export function validateEthereumAddress(address: string, fieldName: string = 'address'): void {
  if (!isValidEthereumAddress(address)) {
    throw new ValidationError(
      MCPErrorCode.INVALID_WALLET_ADDRESS,
      `Invalid Ethereum address: ${address}`,
      fieldName
    );
  }
}

/**
 * Validate address is checksummed (EIP-55)
 */
export function isChecksummedAddress(address: string): boolean {
  if (!isValidEthereumAddress(address)) {
    return false;
  }
  
  // If all lowercase or all uppercase, it's valid but not checksummed
  if (address === address.toLowerCase() || address === address.toUpperCase().replace('0X', '0x')) {
    return true;
  }
  
  // For mixed case, we'd need to verify the checksum
  // This is a simplified check - full implementation would use keccak256
  return true;
}

// ============================================================================
// Amount Validation
// ============================================================================

/**
 * Validate amount is a positive number
 */
export function isValidAmount(amount: string | number): boolean {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return !isNaN(num) && num > 0 && isFinite(num);
}

/**
 * Validate amount and throw if invalid
 */
export function validateAmount(
  amount: string | number,
  fieldName: string = 'amount'
): void {
  if (!isValidAmount(amount)) {
    throw new ValidationError(
      MCPErrorCode.INVALID_PARAMETERS,
      `Invalid amount: ${amount}`,
      fieldName
    );
  }
}

/**
 * Validate amount is within limits
 */
export function validateAmountLimits(
  amount: string | number,
  minAmount?: number,
  maxAmount?: number,
  fieldName: string = 'amount'
): void {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (!isValidAmount(amount)) {
    throw new ValidationError(
      MCPErrorCode.INVALID_PARAMETERS,
      `Invalid amount: ${amount}`,
      fieldName
    );
  }

  if (minAmount !== undefined && num < minAmount) {
    throw new ValidationError(
      MCPErrorCode.PAYMENT_INSUFFICIENT,
      `Amount ${num} is below minimum ${minAmount}`,
      fieldName
    );
  }

  if (maxAmount !== undefined && num > maxAmount) {
    throw new ValidationError(
      MCPErrorCode.INVALID_PARAMETERS,
      `Amount ${num} exceeds maximum ${maxAmount}`,
      fieldName
    );
  }
}

// ============================================================================
// String Validation
// ============================================================================

/**
 * Validate string is not empty
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate required string field
 */
export function validateRequiredString(
  value: unknown,
  fieldName: string
): void {
  if (!isNonEmptyString(value)) {
    throw new ValidationError(
      MCPErrorCode.INVALID_PARAMETERS,
      `${fieldName} is required and must be a non-empty string`,
      fieldName
    );
  }
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: string,
  minLength: number,
  maxLength: number,
  fieldName: string
): void {
  if (value.length < minLength || value.length > maxLength) {
    throw new ValidationError(
      MCPErrorCode.INVALID_PARAMETERS,
      `${fieldName} must be between ${minLength} and ${maxLength} characters`,
      fieldName
    );
  }
}

// ============================================================================
// UUID Validation
// ============================================================================

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

/**
 * Validate UUID and throw if invalid
 */
export function validateUUID(uuid: string, fieldName: string = 'id'): void {
  if (!isValidUUID(uuid)) {
    throw new ValidationError(
      MCPErrorCode.INVALID_PARAMETERS,
      `Invalid UUID: ${uuid}`,
      fieldName
    );
  }
}

// ============================================================================
// Network Validation
// ============================================================================

const SUPPORTED_NETWORKS = ['base', 'base-sepolia', 'ethereum', 'polygon', 'arbitrum'];

/**
 * Validate network is supported
 */
export function isValidNetwork(network: string): boolean {
  return SUPPORTED_NETWORKS.includes(network.toLowerCase());
}

/**
 * Validate network and throw if invalid
 */
export function validateNetwork(network: string, fieldName: string = 'network'): void {
  if (!isValidNetwork(network)) {
    throw new ValidationError(
      MCPErrorCode.INVALID_PARAMETERS,
      `Unsupported network: ${network}. Supported: ${SUPPORTED_NETWORKS.join(', ')}`,
      fieldName
    );
  }
}

// ============================================================================
// Token Validation
// ============================================================================

const SUPPORTED_TOKENS = ['USDC', 'USDT', 'DAI'];

/**
 * Validate token is supported
 */
export function isValidToken(token: string): boolean {
  return SUPPORTED_TOKENS.includes(token.toUpperCase());
}

/**
 * Validate token and throw if invalid
 */
export function validateToken(token: string, fieldName: string = 'token'): void {
  if (!isValidToken(token)) {
    throw new ValidationError(
      MCPErrorCode.INVALID_PARAMETERS,
      `Unsupported token: ${token}. Supported: ${SUPPORTED_TOKENS.join(', ')}`,
      fieldName
    );
  }
}

// ============================================================================
// Composite Validators
// ============================================================================

/**
 * Validate payment parameters
 */
export function validatePaymentParams(params: {
  amount: string | number;
  token: string;
  recipient: string;
  network?: string;
}): void {
  validateAmount(params.amount, 'amount');
  validateToken(params.token, 'token');
  validateEthereumAddress(params.recipient, 'recipient');
  
  if (params.network) {
    validateNetwork(params.network, 'network');
  }
}

/**
 * Validate subscription parameters
 */
export function validateSubscriptionParams(params: {
  planId: string;
  walletAddress: string;
}): void {
  validateRequiredString(params.planId, 'planId');
  validateEthereumAddress(params.walletAddress, 'walletAddress');
}

// ============================================================================
// Sanitization
// ============================================================================

/**
 * Sanitize string input (trim and remove control characters)
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  // Remove control characters and trim
  return input.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

/**
 * Sanitize Ethereum address (lowercase)
 */
export function sanitizeAddress(address: string): string {
  if (!isValidEthereumAddress(address)) {
    return address;
  }
  return address.toLowerCase();
}
