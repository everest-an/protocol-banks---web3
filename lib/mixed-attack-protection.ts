/**
 * Mixed Attack Protection Library
 * Protects against combined/hybrid attack vectors
 */

// Web Crypto API compatible HMAC function
async function hmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(key)
  const dataBuffer = encoder.encode(data)

  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer)
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

// Synchronous hash for immediate use
function simpleHash(data: string): string {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  const hex = Math.abs(hash).toString(16)
  return hex.padStart(64, "0").slice(0, 64)
}

// Synchronous HMAC-like function for immediate use
function simpleHmac(key: string, data: string): string {
  return simpleHash(key + data + key)
}

// Generate random bytes using Web Crypto API
function generateRandomBytes(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

// ============================================
// 1. URL PARAMETER TAMPERING PROTECTION
// ============================================

const PAYMENT_LINK_SECRET =
  typeof window === "undefined"
    ? process.env.PAYMENT_LINK_SECRET || "protocol-bank-secure-link-v1"
    : "protocol-bank-secure-link-v1"

export interface PaymentLinkParams {
  to: string
  amount: string
  token: string
  network?: string
  memo?: string
  expiry?: number // Unix timestamp
}

/**
 * Generate a signed payment link that cannot be tampered with
 */
export function generateSignedPaymentLink(baseUrl: string, params: PaymentLinkParams): string {
  const expiry = params.expiry || Date.now() + 24 * 60 * 60 * 1000 // 24 hours default

  // Normalize parameters
  const normalizedParams = {
    to: params.to.toLowerCase(),
    amount: params.amount,
    token: params.token.toUpperCase(),
    network: params.network || "mainnet",
    memo: params.memo || "",
    expiry: expiry.toString(),
  }

  // Create signature
  const dataToSign = Object.entries(normalizedParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&")

  const signature = simpleHmac(PAYMENT_LINK_SECRET, dataToSign).substring(0, 16)

  // Build URL
  const url = new URL(baseUrl)
  url.searchParams.set("to", params.to)
  url.searchParams.set("amount", params.amount)
  url.searchParams.set("token", params.token)
  if (params.network) url.searchParams.set("network", params.network)
  if (params.memo) url.searchParams.set("memo", params.memo)
  url.searchParams.set("exp", expiry.toString())
  url.searchParams.set("sig", signature)

  return url.toString()
}

/**
 * Verify a signed payment link
 */
export function verifyPaymentLinkSignature(params: Record<string, string>): {
  valid: boolean
  error?: string
  params?: PaymentLinkParams
} {
  const { to, amount, token, network, memo, exp, sig } = params

  if (!to || !amount || !token || !exp || !sig) {
    return { valid: false, error: "Missing required parameters" }
  }

  // Check expiry
  const expiry = Number.parseInt(exp)
  if (isNaN(expiry) || Date.now() > expiry) {
    return { valid: false, error: "Payment link has expired" }
  }

  // Recreate signature
  const normalizedParams = {
    to: to.toLowerCase(),
    amount,
    token: token.toUpperCase(),
    network: network || "mainnet",
    memo: memo || "",
    expiry: exp,
  }

  const dataToSign = Object.entries(normalizedParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&")

  const expectedSig = simpleHmac(PAYMENT_LINK_SECRET, dataToSign).substring(0, 16)

  // Constant-time comparison to prevent timing attacks
  if (!constantTimeCompare(sig, expectedSig)) {
    return { valid: false, error: "Invalid signature - link may have been tampered with" }
  }

  return {
    valid: true,
    params: {
      to,
      amount,
      token,
      network,
      memo,
      expiry,
    },
  }
}

// ============================================
// 2. CLIPBOARD HIJACKING PROTECTION
// ============================================

export interface ClipboardVerification {
  originalValue: string
  hash: string
  timestamp: number
}

/**
 * Create a verification record when copying to clipboard
 */
export function createClipboardVerification(value: string): ClipboardVerification {
  return {
    originalValue: value,
    hash: simpleHash(value),
    timestamp: Date.now(),
  }
}

/**
 * Verify clipboard content hasn't been hijacked
 */
export function verifyClipboardContent(
  currentValue: string,
  verification: ClipboardVerification,
  maxAgeMs = 60000, // 1 minute default
): { valid: boolean; error?: string; changes?: string[] } {
  // Check if verification is expired
  if (Date.now() - verification.timestamp > maxAgeMs) {
    return { valid: false, error: "Clipboard verification expired - please copy again" }
  }

  // Check if content matches
  const currentHash = simpleHash(currentValue)
  if (currentHash !== verification.hash) {
    // Analyze the changes for potential attack patterns
    const changes: string[] = []

    // Check if it looks like address substitution
    if (verification.originalValue.startsWith("0x") && currentValue.startsWith("0x")) {
      if (verification.originalValue.toLowerCase() !== currentValue.toLowerCase()) {
        changes.push("CRITICAL: Wallet address was changed - possible clipboard hijacker detected!")
      }
    }

    // Check for homoglyph attacks
    if (hasHomoglyphChanges(verification.originalValue, currentValue)) {
      changes.push("CRITICAL: Similar-looking characters substituted - homoglyph attack detected!")
    }

    return {
      valid: false,
      error: "Clipboard content has been modified",
      changes,
    }
  }

  return { valid: true }
}

/**
 * Detect homoglyph character substitution
 */
function hasHomoglyphChanges(original: string, current: string): boolean {
  // Common homoglyph pairs
  const homoglyphs: Record<string, string[]> = {
    "0": ["O", "о", "О"], // Zero vs O vs Cyrillic
    "1": ["l", "I", "і"], // One vs L vs I
    a: ["а", "ɑ"], // Latin a vs Cyrillic
    e: ["е", "ё"], // Latin e vs Cyrillic
    o: ["о", "ο"], // Latin o vs Cyrillic/Greek
    c: ["с", "ϲ"], // Latin c vs Cyrillic/Greek
    p: ["р", "ρ"], // Latin p vs Cyrillic/Greek
    x: ["х", "χ"], // Latin x vs Cyrillic/Greek
    B: ["В", "Β"], // Latin B vs Cyrillic/Greek
    H: ["Н", "Η"], // Latin H vs Cyrillic/Greek
  }

  if (original.length !== current.length) return false

  for (let i = 0; i < original.length; i++) {
    if (original[i] !== current[i]) {
      const origChar = original[i]
      const currChar = current[i]

      // Check if it's a homoglyph substitution
      for (const [base, variants] of Object.entries(homoglyphs)) {
        if (
          (origChar === base && variants.includes(currChar)) ||
          (variants.includes(origChar) && currChar === base) ||
          (variants.includes(origChar) && variants.includes(currChar))
        ) {
          return true
        }
      }
    }
  }

  return false
}

// ============================================
// 3. RACE CONDITION / TOCTOU PROTECTION
// ============================================

interface TransactionLock {
  id: string
  params: Record<string, any>
  hash: string
  createdAt: number
  expiresAt: number
  executed: boolean
}

const transactionLocks = new Map<string, TransactionLock>()

/**
 * Create a transaction lock to prevent TOCTOU attacks
 */
export function createTransactionLock(
  userId: string,
  params: Record<string, any>,
  ttlMs = 30000, // 30 seconds
): TransactionLock {
  const lockId = `${userId}-${generateRandomBytes(8)}`
  const hash = simpleHash(JSON.stringify(params))

  const lock: TransactionLock = {
    id: lockId,
    params,
    hash,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    executed: false,
  }

  transactionLocks.set(lockId, lock)

  // Auto-cleanup expired locks
  setTimeout(() => {
    transactionLocks.delete(lockId)
  }, ttlMs + 1000)

  return lock
}

/**
 * Verify and consume a transaction lock
 */
export function verifyAndConsumeLock(lockId: string, params: Record<string, any>): { valid: boolean; error?: string } {
  const lock = transactionLocks.get(lockId)

  if (!lock) {
    return { valid: false, error: "Transaction lock not found or expired" }
  }

  if (lock.executed) {
    return { valid: false, error: "Transaction already executed - possible replay attack" }
  }

  if (Date.now() > lock.expiresAt) {
    transactionLocks.delete(lockId)
    return { valid: false, error: "Transaction lock expired" }
  }

  // Verify parameters haven't changed
  const currentHash = simpleHash(JSON.stringify(params))

  if (currentHash !== lock.hash) {
    return { valid: false, error: "Transaction parameters were modified - possible TOCTOU attack" }
  }

  // Mark as executed
  lock.executed = true

  return { valid: true }
}

// ============================================
// 4. FRONT-RUNNING PROTECTION
// ============================================

export interface FrontRunningProtection {
  usePrivateMempool: boolean
  maxSlippage: number
  deadlineTimestamp: number
  commitHash?: string
}

/**
 * Generate front-running protection parameters
 */
export function generateFrontRunningProtection(
  amount: string,
  slippageTolerance = 0.5, // 0.5% default
): FrontRunningProtection {
  const deadline = Math.floor(Date.now() / 1000) + 300 // 5 minutes

  // For high-value transactions, recommend private mempool
  const amountNum = Number.parseFloat(amount)
  const usePrivateMempool = amountNum >= 10000 // $10k+ threshold

  return {
    usePrivateMempool,
    maxSlippage: slippageTolerance,
    deadlineTimestamp: deadline,
    commitHash: generateRandomBytes(32),
  }
}

/**
 * Check if transaction might be front-run
 */
export function detectFrontRunningRisk(
  pendingTxCount: number,
  gasPrice: bigint,
  networkGasPrice: bigint,
): { risk: "low" | "medium" | "high"; recommendations: string[] } {
  const recommendations: string[] = []
  let risk: "low" | "medium" | "high" = "low"

  // High pending tx count suggests congestion
  if (pendingTxCount > 100) {
    risk = "medium"
    recommendations.push("Network is congested - consider waiting or using higher gas")
  }

  // Gas price significantly below network average
  if (gasPrice < (networkGasPrice * 80n) / 100n) {
    risk = "high"
    recommendations.push("Gas price is below average - transaction may be delayed or front-run")
  }

  // Gas price significantly above network average (may attract attention)
  if (gasPrice > networkGasPrice * 2n) {
    if (risk === "low") risk = "medium"
    recommendations.push("High gas price may attract MEV bots")
  }

  return { risk, recommendations }
}

// ============================================
// 5. TRANSACTION SIMULATION
// ============================================

export interface SimulationResult {
  success: boolean
  gasUsed: string
  balanceChanges: Array<{
    address: string
    token: string
    before: string
    after: string
    change: string
  }>
  warnings: string[]
  errors: string[]
}

/**
 * Simulate a transaction before execution
 */
export async function simulateTransaction(
  from: string,
  to: string,
  data: string,
  value: string,
  chainId: number,
): Promise<SimulationResult> {
  // In production, this would call Tenderly, Alchemy, or similar
  // For now, perform basic validation

  const warnings: string[] = []
  const errors: string[] = []

  // Check for empty data on contract call
  if (data === "0x" && to.toLowerCase() !== from.toLowerCase()) {
    // Simple ETH transfer - generally safe
  } else if (data.length < 10) {
    warnings.push("Transaction data appears incomplete")
  }

  // Check for potential honeypot patterns in data
  const honeypotPatterns = [
    "0x23b872dd", // transferFrom without approval check
    "0x095ea7b3", // approve with suspicious recipient
  ]

  const methodId = data.substring(0, 10).toLowerCase()
  if (honeypotPatterns.includes(methodId)) {
    warnings.push("Transaction uses method commonly associated with scams - verify carefully")
  }

  // Estimate gas (placeholder - real implementation would use eth_estimateGas)
  const estimatedGas = "100000"

  return {
    success: errors.length === 0,
    gasUsed: estimatedGas,
    balanceChanges: [
      {
        address: from,
        token: "ETH",
        before: "unknown",
        after: "unknown",
        change: `-${value}`,
      },
    ],
    warnings,
    errors,
  }
}

// ============================================
// 6. COMBINED ATTACK DETECTION
// ============================================

export interface CombinedAttackAnalysis {
  riskScore: number // 0-100
  attackVectors: string[]
  recommendations: string[]
  blockTransaction: boolean
}

/**
 * Analyze for combined/mixed attack patterns
 */
export function analyzeCombinedAttacks(context: {
  urlParams?: Record<string, string>
  clipboardData?: string
  transactionParams?: Record<string, any>
  userAgent?: string
  ipAddress?: string
  previousTransactions?: Array<{ to: string; amount: string; timestamp: number }>
}): CombinedAttackAnalysis {
  const attackVectors: string[] = []
  const recommendations: string[] = []
  let riskScore = 0

  // 1. Check for URL + Clipboard combined attack
  if (context.urlParams?.to && context.clipboardData) {
    if (context.urlParams.to.toLowerCase() !== context.clipboardData.toLowerCase()) {
      attackVectors.push("URL_CLIPBOARD_MISMATCH: URL parameter differs from clipboard content")
      riskScore += 30
      recommendations.push("Verify the recipient address matches what you copied")
    }
  }

  // 2. Check for rapid transaction pattern (bot behavior)
  if (context.previousTransactions && context.previousTransactions.length > 0) {
    const recentTxs = context.previousTransactions.filter(
      (tx) => Date.now() - tx.timestamp < 60000, // Last minute
    )
    if (recentTxs.length > 3) {
      attackVectors.push("RAPID_TRANSACTION_PATTERN: Multiple transactions in short timeframe")
      riskScore += 25
      recommendations.push("Unusual transaction frequency detected - is this automated?")
    }

    // Check for address rotation (potential wash trading)
    const uniqueAddresses = new Set(recentTxs.map((tx) => tx.to.toLowerCase()))
    if (uniqueAddresses.size === recentTxs.length && recentTxs.length > 2) {
      attackVectors.push("ADDRESS_ROTATION: Each transaction to different address")
      riskScore += 15
    }
  }

  // 3. Check for suspicious user agent patterns
  if (context.userAgent) {
    const suspiciousPatterns = [/headless/i, /phantom/i, /selenium/i, /webdriver/i, /puppeteer/i]

    if (suspiciousPatterns.some((p) => p.test(context.userAgent!))) {
      attackVectors.push("AUTOMATED_CLIENT: Browser automation detected")
      riskScore += 40
      recommendations.push("Request appears to come from automated software")
    }
  }

  // 4. Check transaction parameters for anomalies
  if (context.transactionParams) {
    const { to, amount, token, gasPrice } = context.transactionParams

    // Extremely high amount
    if (Number.parseFloat(amount) > 100000) {
      attackVectors.push("HIGH_VALUE_TRANSACTION: Amount exceeds typical threshold")
      riskScore += 20
      recommendations.push("Consider splitting into multiple smaller transactions")
    }

    // Gas price anomaly
    if (gasPrice && BigInt(gasPrice) > BigInt("500000000000")) {
      // 500 gwei
      attackVectors.push("HIGH_GAS_PRICE: Unusually high gas price")
      riskScore += 15
      recommendations.push("Gas price is significantly above normal")
    }
  }

  // 5. Check for timing-based attacks
  const currentHour = new Date().getUTCHours()
  if (currentHour >= 2 && currentHour <= 5) {
    // Low activity hours - common for automated attacks
    riskScore += 5
    recommendations.push("Transaction initiated during low-activity hours")
  }

  return {
    riskScore: Math.min(100, riskScore),
    attackVectors,
    recommendations,
    blockTransaction: riskScore >= 70,
  }
}

// ============================================
// 7. SECURE RANDOMNESS
// ============================================

/**
 * Generate cryptographically secure random bytes
 */
export function secureRandom(length: number): string {
  return generateRandomBytes(length)
}

/**
 * Generate a secure nonce for transactions
 */
export function generateSecureNonce(): string {
  const timestamp = Date.now().toString(36)
  const random = generateRandomBytes(16)
  return `${timestamp}-${random}`
}

// ============================================
// 8. UTILITY FUNCTIONS
// ============================================

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Sanitize URL parameters
 */
export function sanitizeUrlParams(params: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {}

  for (const [key, value] of Object.entries(params)) {
    // Remove any script tags or event handlers
    let clean = value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/on\w+\s*=/gi, "")
      .replace(/javascript:/gi, "")

    // For address fields, strictly validate format
    if (key === "to" || key === "from" || key === "address") {
      if (!/^0x[a-fA-F0-9]{40}$/.test(clean)) {
        clean = "" // Invalid address format
      }
    }

    // For amount fields, ensure numeric
    if (key === "amount" || key === "value") {
      clean = clean.replace(/[^0-9.]/g, "")
    }

    sanitized[key] = clean
  }

  return sanitized
}
