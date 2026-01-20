/**
 * ProtocolBanks SDK - Input Validation
 * 
 * 地址验证、金额验证、同形字符检测
 * Supports: Ethereum, Solana, Bitcoin addresses
 */

import type { ChainId, TokenSymbol, HomoglyphDetails } from '../types';
import { ErrorCodes } from '../types';
import { ProtocolBanksError } from './errors';
import { MAX_AMOUNT, MIN_AMOUNT, MAX_EXPIRY_HOURS, MAX_BATCH_SIZE } from '../config/chains';

// ============================================================================
// Homoglyph Detection
// ============================================================================

/**
 * Cyrillic characters that look like Latin characters
 * These are commonly used in homoglyph attacks
 */
const CYRILLIC_HOMOGLYPHS: Record<string, string> = {
  'а': 'a',  // Cyrillic а -> Latin a
  'е': 'e',  // Cyrillic е -> Latin e
  'о': 'o',  // Cyrillic о -> Latin o
  'р': 'p',  // Cyrillic р -> Latin p
  'с': 'c',  // Cyrillic с -> Latin c
  'х': 'x',  // Cyrillic х -> Latin x
  'у': 'y',  // Cyrillic у -> Latin y
  'А': 'A',  // Cyrillic А -> Latin A
  'В': 'B',  // Cyrillic В -> Latin B
  'Е': 'E',  // Cyrillic Е -> Latin E
  'К': 'K',  // Cyrillic К -> Latin K
  'М': 'M',  // Cyrillic М -> Latin M
  'Н': 'H',  // Cyrillic Н -> Latin H
  'О': 'O',  // Cyrillic О -> Latin O
  'Р': 'P',  // Cyrillic Р -> Latin P
  'С': 'C',  // Cyrillic С -> Latin C
  'Т': 'T',  // Cyrillic Т -> Latin T
  'Х': 'X',  // Cyrillic Х -> Latin X
};

/**
 * Greek characters that look like Latin characters
 */
const GREEK_HOMOGLYPHS: Record<string, string> = {
  'Α': 'A',  // Greek Alpha -> Latin A
  'Β': 'B',  // Greek Beta -> Latin B
  'Ε': 'E',  // Greek Epsilon -> Latin E
  'Ζ': 'Z',  // Greek Zeta -> Latin Z
  'Η': 'H',  // Greek Eta -> Latin H
  'Ι': 'I',  // Greek Iota -> Latin I
  'Κ': 'K',  // Greek Kappa -> Latin K
  'Μ': 'M',  // Greek Mu -> Latin M
  'Ν': 'N',  // Greek Nu -> Latin N
  'Ο': 'O',  // Greek Omicron -> Latin O
  'Ρ': 'P',  // Greek Rho -> Latin P
  'Τ': 'T',  // Greek Tau -> Latin T
  'Υ': 'Y',  // Greek Upsilon -> Latin Y
  'Χ': 'X',  // Greek Chi -> Latin X
  'ο': 'o',  // Greek omicron -> Latin o
};

/** All homoglyphs combined */
const ALL_HOMOGLYPHS: Record<string, string> = {
  ...CYRILLIC_HOMOGLYPHS,
  ...GREEK_HOMOGLYPHS,
};

/**
 * Detect homoglyph characters in a string
 */
export function detectHomoglyphs(input: string): HomoglyphDetails | null {
  const detectedCharacters: HomoglyphDetails['detectedCharacters'] = [];
  
  for (let i = 0; i < input.length; i++) {
    const char = input[i]!;
    const expected = ALL_HOMOGLYPHS[char];
    
    if (expected) {
      detectedCharacters.push({
        position: i,
        character: char,
        unicodePoint: `U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`,
        expectedCharacter: expected,
      });
    }
  }
  
  if (detectedCharacters.length === 0) {
    return null;
  }
  
  return {
    originalAddress: input,
    detectedCharacters,
  };
}

/**
 * Check if string contains homoglyphs
 */
export function containsHomoglyphs(input: string): boolean {
  return detectHomoglyphs(input) !== null;
}

/**
 * Normalize string by replacing homoglyphs with Latin equivalents
 */
export function normalizeHomoglyphs(input: string): string {
  let result = '';
  for (const char of input) {
    result += ALL_HOMOGLYPHS[char] ?? char;
  }
  return result;
}

// ============================================================================
// Address Validation
// ============================================================================

/** EVM address pattern (0x + 40 hex chars) */
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/** Solana address pattern (Base58, 32-44 chars) */
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Bitcoin address patterns */
const BITCOIN_PATTERNS = {
  // Legacy (P2PKH) - starts with 1
  legacy: /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/,
  // SegWit (P2SH) - starts with 3
  segwit: /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/,
  // Native SegWit (Bech32) - starts with bc1
  bech32: /^bc1[a-z0-9]{39,59}$/,
  // Taproot (Bech32m) - starts with bc1p
  taproot: /^bc1p[a-z0-9]{58}$/,
};

/**
 * Validate EVM address (Ethereum, Polygon, etc.)
 */
export function isValidEVMAddress(address: string): boolean {
  // Check for homoglyphs first
  if (containsHomoglyphs(address)) {
    return false;
  }
  
  return EVM_ADDRESS_PATTERN.test(address);
}

/**
 * Validate Solana address
 */
export function isValidSolanaAddress(address: string): boolean {
  // Check for homoglyphs first
  if (containsHomoglyphs(address)) {
    return false;
  }
  
  return SOLANA_ADDRESS_PATTERN.test(address);
}

/**
 * Validate Bitcoin address
 */
export function isValidBitcoinAddress(address: string): boolean {
  // Check for homoglyphs first
  if (containsHomoglyphs(address)) {
    return false;
  }
  
  return (
    BITCOIN_PATTERNS.legacy.test(address) ||
    BITCOIN_PATTERNS.segwit.test(address) ||
    BITCOIN_PATTERNS.bech32.test(address) ||
    BITCOIN_PATTERNS.taproot.test(address)
  );
}

/**
 * Validate address for a specific chain
 */
export function isValidAddress(address: string, chainId?: ChainId): boolean {
  // Check for homoglyphs first
  if (containsHomoglyphs(address)) {
    return false;
  }
  
  if (chainId === 'solana') {
    return isValidSolanaAddress(address);
  }
  
  if (chainId === 'bitcoin') {
    return isValidBitcoinAddress(address);
  }
  
  // Default to EVM validation
  return isValidEVMAddress(address);
}

/**
 * Validate address and throw error if invalid
 */
export function validateAddress(address: string, chainId?: ChainId): void {
  // Check for homoglyphs
  const homoglyphDetails = detectHomoglyphs(address);
  if (homoglyphDetails) {
    throw new ProtocolBanksError({
      code: ErrorCodes.LINK_HOMOGLYPH_DETECTED,
      category: 'LINK',
      message: 'Potential homoglyph attack detected in address',
      details: homoglyphDetails,
      retryable: false,
    });
  }
  
  // Validate format
  if (!isValidAddress(address, chainId)) {
    const chainName = chainId === 'solana' ? 'Solana' : 
                      chainId === 'bitcoin' ? 'Bitcoin' : 'EVM';
    throw new ProtocolBanksError({
      code: ErrorCodes.LINK_INVALID_ADDRESS,
      category: 'LINK',
      message: `Invalid ${chainName} address format`,
      details: { address, chainId },
      retryable: false,
    });
  }
}

/**
 * Get address type
 */
export function getAddressType(address: string): 'evm' | 'solana' | 'bitcoin' | 'unknown' {
  if (isValidEVMAddress(address)) return 'evm';
  if (isValidSolanaAddress(address)) return 'solana';
  if (isValidBitcoinAddress(address)) return 'bitcoin';
  return 'unknown';
}

// ============================================================================
// Amount Validation
// ============================================================================

/**
 * Validate payment amount
 */
export function isValidAmount(amount: string): boolean {
  const num = parseFloat(amount);
  
  if (isNaN(num)) return false;
  if (num <= 0) return false;
  if (num < parseFloat(MIN_AMOUNT)) return false;
  if (num > parseFloat(MAX_AMOUNT)) return false;
  
  // Check for reasonable decimal places (max 18)
  const parts = amount.split('.');
  if (parts[1] && parts[1].length > 18) return false;
  
  return true;
}

/**
 * Validate amount and throw error if invalid
 */
export function validateAmount(amount: string): void {
  const num = parseFloat(amount);
  
  if (isNaN(num)) {
    throw new ProtocolBanksError({
      code: ErrorCodes.LINK_INVALID_AMOUNT,
      category: 'LINK',
      message: 'Amount must be a valid number',
      details: { amount },
      retryable: false,
    });
  }
  
  if (num <= 0) {
    throw new ProtocolBanksError({
      code: ErrorCodes.LINK_INVALID_AMOUNT,
      category: 'LINK',
      message: 'Amount must be greater than 0',
      details: { amount },
      retryable: false,
    });
  }
  
  if (num < parseFloat(MIN_AMOUNT)) {
    throw new ProtocolBanksError({
      code: ErrorCodes.LINK_INVALID_AMOUNT,
      category: 'LINK',
      message: `Amount must be at least ${MIN_AMOUNT}`,
      details: { amount, minAmount: MIN_AMOUNT },
      retryable: false,
    });
  }
  
  if (num > parseFloat(MAX_AMOUNT)) {
    throw new ProtocolBanksError({
      code: ErrorCodes.LINK_INVALID_AMOUNT,
      category: 'LINK',
      message: `Amount must not exceed ${MAX_AMOUNT}`,
      details: { amount, maxAmount: MAX_AMOUNT },
      retryable: false,
    });
  }
}

// ============================================================================
// Token Validation
// ============================================================================

/** Supported tokens */
const SUPPORTED_TOKENS: TokenSymbol[] = ['USDC', 'USDT', 'DAI', 'ETH', 'MATIC', 'BNB', 'SOL', 'BTC'];

/**
 * Validate token symbol
 */
export function isValidToken(token: string): token is TokenSymbol {
  return SUPPORTED_TOKENS.includes(token.toUpperCase() as TokenSymbol);
}

/**
 * Validate token and throw error if invalid
 */
export function validateToken(token: string): void {
  if (!isValidToken(token)) {
    throw new ProtocolBanksError({
      code: ErrorCodes.LINK_INVALID_TOKEN,
      category: 'LINK',
      message: `Unsupported token: ${token}`,
      details: { token, supportedTokens: SUPPORTED_TOKENS },
      retryable: false,
    });
  }
}

// ============================================================================
// Chain Validation
// ============================================================================

/** Supported chain IDs */
const SUPPORTED_CHAIN_IDS: ChainId[] = [1, 137, 8453, 42161, 10, 56, 'solana', 'bitcoin'];

/**
 * Validate chain ID
 */
export function isValidChainId(chainId: unknown): chainId is ChainId {
  return SUPPORTED_CHAIN_IDS.includes(chainId as ChainId);
}

/**
 * Validate chain and throw error if invalid
 */
export function validateChainId(chainId: unknown): void {
  if (!isValidChainId(chainId)) {
    throw new ProtocolBanksError({
      code: ErrorCodes.LINK_INVALID_CHAIN,
      category: 'LINK',
      message: `Unsupported chain: ${String(chainId)}`,
      details: { chainId, supportedChains: SUPPORTED_CHAIN_IDS },
      retryable: false,
    });
  }
}

// ============================================================================
// Expiry Validation
// ============================================================================

/**
 * Validate expiry hours
 */
export function isValidExpiryHours(hours: number): boolean {
  return Number.isInteger(hours) && hours >= 1 && hours <= MAX_EXPIRY_HOURS;
}

/**
 * Validate expiry and throw error if invalid
 */
export function validateExpiryHours(hours: number): void {
  if (!isValidExpiryHours(hours)) {
    throw new ProtocolBanksError({
      code: ErrorCodes.LINK_INVALID_EXPIRY,
      category: 'LINK',
      message: `Expiry hours must be between 1 and ${MAX_EXPIRY_HOURS}`,
      details: { hours, maxHours: MAX_EXPIRY_HOURS },
      retryable: false,
    });
  }
}

/**
 * Check if timestamp is expired
 */
export function isExpired(expiryTimestamp: number): boolean {
  return Date.now() > expiryTimestamp;
}

// ============================================================================
// Batch Validation
// ============================================================================

/**
 * Validate batch size
 */
export function isValidBatchSize(size: number): boolean {
  return Number.isInteger(size) && size >= 1 && size <= MAX_BATCH_SIZE;
}

/**
 * Validate batch size and throw error if invalid
 */
export function validateBatchSize(size: number): void {
  if (!isValidBatchSize(size)) {
    throw new ProtocolBanksError({
      code: ErrorCodes.BATCH_SIZE_EXCEEDED,
      category: 'BATCH',
      message: `Batch size must be between 1 and ${MAX_BATCH_SIZE}`,
      details: { size, maxSize: MAX_BATCH_SIZE },
      retryable: false,
    });
  }
}

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Validate URL is HTTPS
 */
export function isHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate URL and throw error if not HTTPS
 */
export function validateHttpsUrl(url: string, fieldName: string = 'URL'): void {
  if (!isHttpsUrl(url)) {
    throw new ProtocolBanksError({
      code: ErrorCodes.VALID_INVALID_FORMAT,
      category: 'VALID',
      message: `${fieldName} must be a valid HTTPS URL`,
      details: { url, fieldName },
      retryable: false,
    });
  }
}

// ============================================================================
// API Key Validation
// ============================================================================

/** API key patterns */
const API_KEY_PATTERN = /^pk_(live|test|sandbox)_[a-zA-Z0-9]{24,}$/;
const API_SECRET_PATTERN = /^sk_(live|test|sandbox)_[a-zA-Z0-9]{32,}$/;

/**
 * Validate API key format
 */
export function isValidApiKey(apiKey: string): boolean {
  return API_KEY_PATTERN.test(apiKey);
}

/**
 * Validate API secret format
 */
export function isValidApiSecret(apiSecret: string): boolean {
  return API_SECRET_PATTERN.test(apiSecret);
}

/**
 * Validate API credentials
 */
export function validateApiCredentials(apiKey: string, apiSecret: string): void {
  if (!isValidApiKey(apiKey)) {
    throw new ProtocolBanksError({
      code: ErrorCodes.AUTH_INVALID_API_KEY,
      category: 'AUTH',
      message: 'Invalid API key format',
      retryable: false,
    });
  }
  
  if (!isValidApiSecret(apiSecret)) {
    throw new ProtocolBanksError({
      code: ErrorCodes.AUTH_INVALID_SECRET,
      category: 'AUTH',
      message: 'Invalid API secret format',
      retryable: false,
    });
  }
}

// ============================================================================
// Memo Validation
// ============================================================================

/** Maximum memo length */
const MAX_MEMO_LENGTH = 256;

/**
 * Validate memo
 */
export function isValidMemo(memo: string): boolean {
  return memo.length <= MAX_MEMO_LENGTH;
}

/**
 * Validate memo and throw error if invalid
 */
export function validateMemo(memo: string): void {
  if (!isValidMemo(memo)) {
    throw new ProtocolBanksError({
      code: ErrorCodes.VALID_OUT_OF_RANGE,
      category: 'VALID',
      message: `Memo must not exceed ${MAX_MEMO_LENGTH} characters`,
      details: { length: memo.length, maxLength: MAX_MEMO_LENGTH },
      retryable: false,
    });
  }
}
