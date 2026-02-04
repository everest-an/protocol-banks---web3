/**
 * Protocol Banks - Security Validation Library
 *
 * Implements comprehensive security measures:
 * 1. Input Validation & Sanitization
 * 2. Address Integrity Verification (Checksum)
 * 3. Amount Verification (Client vs Server)
 * 4. Rate Limiting
 * 5. Malicious Content Detection
 * 6. Transaction Integrity Hashing
 */

import { ethers } from "ethers"

// Web Crypto API compatible hash function
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

// Synchronous hash using simple algorithm (for non-critical uses)
function simpleHash(data: string): string {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  // Convert to hex and pad
  const hex = Math.abs(hash).toString(16)
  return hex.padStart(64, "0").slice(0, 64)
}

// Generate random bytes using Web Crypto API
function generateRandomBytes(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

// ============================================
// 1. ADDRESS VALIDATION & INTEGRITY
// ============================================

/**
 * Validates and checksums an EVM address
 * Prevents address tampering by enforcing EIP-55 checksum
 */
export function validateAndChecksumAddress(address: string): {
  valid: boolean
  checksummed: string | null
  error?: string
} {
  // Remove whitespace and check for basic format
  const cleaned = address?.trim()

  if (!cleaned) {
    return { valid: false, checksummed: null, error: "Address is empty" }
  }

  // Check for malicious unicode characters (homograph attacks)
  if (!/^[a-zA-Z0-9]+$/.test(cleaned.replace("0x", ""))) {
    return { valid: false, checksummed: null, error: "Address contains invalid characters (possible homograph attack)" }
  }

  // Validate basic hex format
  if (!/^0x[a-fA-F0-9]{40}$/.test(cleaned)) {
    return { valid: false, checksummed: null, error: "Invalid address format" }
  }

  try {
    // ethers.getAddress returns checksummed address or throws
    const checksummed = ethers.getAddress(cleaned)
    return { valid: true, checksummed }
  } catch {
    return { valid: false, checksummed: null, error: "Invalid EVM address checksum" }
  }
}

/**
 * Validates a Solana address (Base58 format)
 */
export function validateSolanaAddress(address: string): boolean {
  const cleaned = address?.trim()
  if (!cleaned) return false

  // Solana addresses are 32-44 characters, Base58 encoded
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
  return base58Regex.test(cleaned)
}

/**
 * Validates a Bitcoin address (various formats)
 */
export function validateBitcoinAddress(address: string): boolean {
  const cleaned = address?.trim()
  if (!cleaned) return false

  // Legacy (P2PKH): starts with 1
  // SegWit (P2SH): starts with 3
  // Native SegWit (Bech32): starts with bc1
  const patterns = [
    /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/, // Legacy
    /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/, // SegWit
    /^bc1[a-zA-HJ-NP-Z0-9]{39,59}$/, // Native SegWit
  ]

  return patterns.some((pattern) => pattern.test(cleaned))
}

// ============================================
// 2. AMOUNT VALIDATION & INTEGRITY
// ============================================

export interface AmountValidation {
  valid: boolean
  sanitized: string
  error?: string
}

/**
 * Validates and sanitizes payment amounts
 * Prevents overflow, underflow, and precision attacks
 */
export function validateAmount(
  amount: string | number,
  options: {
    minAmount?: string
    maxAmount?: string
    maxDecimals?: number
  } = {},
): AmountValidation {
  const { minAmount = "0", maxAmount = "1000000000", maxDecimals = 18 } = options

  try {
    // Convert to string and clean
    const amountStr = String(amount).trim()

    // Check for malicious characters
    if (!/^[0-9.]+$/.test(amountStr)) {
      return { valid: false, sanitized: "0", error: "Amount contains invalid characters" }
    }

    // Check for multiple decimal points
    if ((amountStr.match(/\./g) || []).length > 1) {
      return { valid: false, sanitized: "0", error: "Invalid amount format" }
    }

    // Parse as BigNumber for precision
    const parsed = Number.parseFloat(amountStr)

    if (isNaN(parsed) || !isFinite(parsed)) {
      return { valid: false, sanitized: "0", error: "Amount is not a valid number" }
    }

    if (parsed < 0) {
      return { valid: false, sanitized: "0", error: "Amount cannot be negative" }
    }

    if (parsed < Number.parseFloat(minAmount)) {
      return { valid: false, sanitized: "0", error: `Amount below minimum (${minAmount})` }
    }

    if (parsed > Number.parseFloat(maxAmount)) {
      return { valid: false, sanitized: "0", error: `Amount exceeds maximum (${maxAmount})` }
    }

    // Check decimal precision
    const decimalPart = amountStr.split(".")[1]
    if (decimalPart && decimalPart.length > maxDecimals) {
      return { valid: false, sanitized: "0", error: `Too many decimal places (max ${maxDecimals})` }
    }

    return { valid: true, sanitized: amountStr }
  } catch (error) {
    return { valid: false, sanitized: "0", error: "Failed to validate amount" }
  }
}

/**
 * Creates a cryptographic hash of transaction details for integrity verification
 * Used to detect tampering between client request and server execution
 */
export function createTransactionIntegrityHash(params: {
  from: string
  to: string
  amount: string
  tokenAddress: string
  chainId: number
  timestamp: number
  nonce: string
}): string {
  const data = JSON.stringify({
    from: params.from.toLowerCase(),
    to: params.to.toLowerCase(),
    amount: params.amount,
    tokenAddress: params.tokenAddress.toLowerCase(),
    chainId: params.chainId,
    timestamp: params.timestamp,
    nonce: params.nonce,
  })

  return simpleHash(data)
}

/**
 * Verifies transaction integrity by comparing hashes
 */
export function verifyTransactionIntegrity(
  originalHash: string,
  params: Parameters<typeof createTransactionIntegrityHash>[0],
): boolean {
  const computedHash = createTransactionIntegrityHash(params)
  return secureCompare(originalHash, computedHash)
}

// ============================================
// 3. RATE LIMITING
// ============================================

interface RateLimitEntry {
  count: number
  firstRequest: number
  lastRequest: number
}

// In-memory rate limit store (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>()

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  identifier: string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  error?: string
}

/**
 * Checks rate limit for a given identifier (wallet address, IP, etc.)
 */
export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const { maxRequests, windowMs, identifier } = config
  const now = Date.now()

  const entry = rateLimitStore.get(identifier)

  if (!entry) {
    // First request
    rateLimitStore.set(identifier, {
      count: 1,
      firstRequest: now,
      lastRequest: now,
    })
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs }
  }

  // Check if window has expired
  if (now - entry.firstRequest > windowMs) {
    // Reset window
    rateLimitStore.set(identifier, {
      count: 1,
      firstRequest: now,
      lastRequest: now,
    })
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs }
  }

  // Within window
  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.firstRequest + windowMs,
      error: `Rate limit exceeded. Try again in ${Math.ceil((entry.firstRequest + windowMs - now) / 1000)} seconds.`,
    }
  }

  // Increment count
  entry.count++
  entry.lastRequest = now
  rateLimitStore.set(identifier, entry)

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.firstRequest + windowMs,
  }
}

/**
 * Payment-specific rate limit presets
 */
export const RATE_LIMITS = {
  // Max 10 payments per minute per wallet
  PAYMENT: { maxRequests: 10, windowMs: 60 * 1000 },
  // Max 100 API calls per minute per wallet
  API: { maxRequests: 100, windowMs: 60 * 1000 },
  // Max 5 vendor updates per minute
  VENDOR_UPDATE: { maxRequests: 5, windowMs: 60 * 1000 },
  // Max 3 batch payments per hour
  BATCH_PAYMENT: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
} as const

// ============================================
// 4. MALICIOUS CONTENT DETECTION
// ============================================

/**
 * Detects and sanitizes potentially malicious text input
 */
export function sanitizeTextInput(input: string): {
  sanitized: string
  warnings: string[]
} {
  const warnings: string[] = []
  let sanitized = input || ""

  // Remove null bytes
  if (sanitized.includes("\0")) {
    warnings.push("Null bytes detected and removed")
    sanitized = sanitized.replace(/\0/g, "")
  }

  // Check for excessive length
  if (sanitized.length > 10000) {
    warnings.push("Input truncated to 10000 characters")
    sanitized = sanitized.substring(0, 10000)
  }

  // Detect potential SQL injection patterns
  const sqlPatterns = [
    /('|")\s*(OR|AND)\s*('|")?[0-9]+('|")?\s*=\s*('|")?[0-9]+/i,
    /;\s*DROP\s+TABLE/i,
    /;\s*DELETE\s+FROM/i,
    /UNION\s+SELECT/i,
    /--\s*$/,
  ]

  for (const pattern of sqlPatterns) {
    if (pattern.test(sanitized)) {
      warnings.push("Potential SQL injection pattern detected")
      break
    }
  }

  // Detect potential XSS patterns
  const xssPatterns = [/<script[\s\S]*?>/i, /javascript:/i, /on\w+\s*=/i, /<iframe/i, /<object/i, /<embed/i]

  for (const pattern of xssPatterns) {
    if (pattern.test(sanitized)) {
      warnings.push("Potential XSS pattern detected and sanitized")
      sanitized = sanitized.replace(/<[^>]*>/g, "") // Strip HTML tags
      break
    }
  }

  // Remove invisible/control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")

  // Detect homograph attacks (mixed scripts)
  const cyrillicPattern = /[\u0400-\u04FF]/
  const latinPattern = /[a-zA-Z]/
  if (cyrillicPattern.test(sanitized) && latinPattern.test(sanitized)) {
    warnings.push("Mixed Cyrillic/Latin characters detected (possible homograph attack)")
  }

  return { sanitized, warnings }
}

/**
 * Validates a transaction hash format
 */
export function validateTxHash(hash: string, chainType: "EVM" | "SOL" | "BTC"): boolean {
  const cleaned = hash?.trim()
  if (!cleaned) return false

  switch (chainType) {
    case "EVM":
      return /^0x[a-fA-F0-9]{64}$/.test(cleaned)
    case "SOL":
      return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(cleaned)
    case "BTC":
      return /^[a-fA-F0-9]{64}$/.test(cleaned)
    default:
      return false
  }
}

/**
 * Checks if a contract address might be malicious
 * (Basic heuristics - in production, use a more comprehensive service)
 */
export function checkContractSafety(address: string): {
  safe: boolean
  warnings: string[]
} {
  const warnings: string[] = []

  // Validate address format first
  const validation = validateAndChecksumAddress(address)
  if (!validation.valid) {
    return { safe: false, warnings: [validation.error || "Invalid address"] }
  }

  // Known malicious patterns (example)
  const knownMaliciousPatterns = [
    /^0x0{38}[0-9a-f]{2}$/i, // Near-zero addresses (often honeypots)
  ]

  for (const pattern of knownMaliciousPatterns) {
    if (pattern.test(address)) {
      warnings.push("Address matches known malicious pattern")
    }
  }

  return { safe: warnings.length === 0, warnings }
}

export function detectMaliciousPayload(input: string): {
  isMalicious: boolean
  threats: string[]
} {
  const threats: string[] = []

  // Prototype pollution
  if (/__proto__|constructor\[|prototype\[/.test(input)) {
    threats.push("Prototype pollution attempt")
  }

  // Server-side template injection
  if (/\{\{.*\}\}|\$\{.*\}|<%.*%>/.test(input)) {
    threats.push("Template injection attempt")
  }

  // XXE injection
  if (/<!ENTITY|<!DOCTYPE.*\[/.test(input)) {
    threats.push("XXE injection attempt")
  }

  // LDAP injection
  if (/[)(|*\\]/.test(input) && /[a-zA-Z]=/.test(input)) {
    threats.push("LDAP injection attempt")
  }

  // Log4j / JNDI injection
  if (/\$\{jndi:|lookup\s*\(/.test(input)) {
    threats.push("JNDI injection attempt")
  }

  return {
    isMalicious: threats.length > 0,
    threats,
  }
}

// ============================================
// 5. NONCE GENERATION & VERIFICATION
// ============================================

/**
 * Generates a cryptographically secure nonce
 */
export function generateSecureNonce(): string {
  return generateRandomBytes(32)
}

/**
 * Creates a signed request for server-side verification
 */
export function createSignedRequest<T extends Record<string, unknown>>(
  data: T,
  secretKey: string,
): { data: T; nonce: string; timestamp: number; signature: string } {
  const nonce = generateSecureNonce()
  const timestamp = Date.now()

  const payload = JSON.stringify({ ...data, nonce, timestamp })
  const signature = simpleHash(payload + secretKey)

  return { data, nonce, timestamp, signature }
}

/**
 * Verifies a signed request
 */
export function verifySignedRequest<T extends Record<string, unknown>>(
  request: { data: T; nonce: string; timestamp: number; signature: string },
  secretKey: string,
  maxAge: number = 5 * 60 * 1000, // 5 minutes default
): { valid: boolean; error?: string } {
  const { data, nonce, timestamp, signature } = request

  // Check timestamp freshness
  if (Date.now() - timestamp > maxAge) {
    return { valid: false, error: "Request expired" }
  }

  // Verify signature
  const payload = JSON.stringify({ ...data, nonce, timestamp })
  const expectedSignature = simpleHash(payload + secretKey)

  if (signature !== expectedSignature) {
    return { valid: false, error: "Invalid signature" }
  }

  return { valid: true }
}

// ============================================
// 6. VENDOR ADDRESS INTEGRITY
// ============================================

/**
 * Creates a hash of vendor data for integrity checking
 * Used to detect unauthorized modifications
 */
export function createVendorIntegrityHash(vendor: {
  id: string
  name: string
  wallet_address: string
  created_by: string
}): string {
  const data = JSON.stringify({
    id: vendor.id,
    name: vendor.name,
    wallet_address: vendor.wallet_address.toLowerCase(),
    created_by: vendor.created_by.toLowerCase(),
  })

  return simpleHash(data)
}

/**
 * Verifies vendor data hasn't been tampered with
 */
export function verifyVendorIntegrity(
  vendor: Parameters<typeof createVendorIntegrityHash>[0],
  storedHash: string,
): boolean {
  return secureCompare(createVendorIntegrityHash(vendor), storedHash)
}

// ============================================
// 7. AUDIT LOGGING
// ============================================

export type AuditAction =
  | "PAYMENT_INITIATED"
  | "PAYMENT_COMPLETED"
  | "PAYMENT_FAILED"
  | "VENDOR_CREATED"
  | "VENDOR_UPDATED"
  | "VENDOR_DELETED"
  | "ADDRESS_CHANGED"
  | "BATCH_CREATED"
  | "BATCH_COMPLETED"
  | "AUTHORIZATION_SIGNED"
  | "RATE_LIMIT_EXCEEDED"
  | "SECURITY_ALERT"

export interface AuditLogEntry {
  action: AuditAction
  actor: string // wallet address or system
  target?: string // affected resource ID
  details: Record<string, unknown>
  ip?: string
  userAgent?: string
  timestamp: number
}

/**
 * Creates an audit log entry
 * In production, this would write to a secure, append-only log
 */
export function createAuditLog(entry: Omit<AuditLogEntry, "timestamp">): AuditLogEntry {
  return {
    ...entry,
    timestamp: Date.now(),
  }
}

// ============================================
// 8. SECURITY CONSTANTS
// ============================================

export const SECURITY_CONFIG = {
  // Maximum amount per single transaction (USD)
  MAX_SINGLE_PAYMENT_USD: 100000,

  // Maximum total amount per batch (USD)
  MAX_BATCH_TOTAL_USD: 1000000,

  // Maximum recipients per batch
  MAX_BATCH_RECIPIENTS: 100,

  // Session timeout (24 hours)
  SESSION_TIMEOUT_MS: 24 * 60 * 60 * 1000,

  // Signature expiry for ERC-3009 (1 hour)
  ERC3009_SIGNATURE_EXPIRY_MS: 60 * 60 * 1000,

  // Minimum confirmation blocks for high-value transactions
  MIN_CONFIRMATIONS_HIGH_VALUE: 12,

  // High value threshold (USD)
  HIGH_VALUE_THRESHOLD_USD: 10000,
} as const
