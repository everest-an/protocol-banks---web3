// ============================================
// 1. CSRF TOKEN MANAGEMENT
// ============================================

let cachedCSRFToken: string | null = null

/**
 * Fetches a CSRF token from the server
 */
export async function getCSRFToken(): Promise<string> {
  if (cachedCSRFToken) {
    return cachedCSRFToken
  }

  try {
    const response = await fetch("/api/csrf")
    const data = await response.json()
    cachedCSRFToken = data.csrfToken
    return cachedCSRFToken!
  } catch (error) {
    console.error("[Security] Failed to fetch CSRF token:", error)
    throw new Error("Security initialization failed")
  }
}

/**
 * Makes a secure fetch request with CSRF token
 */
export async function secureFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const csrfToken = await getCSRFToken()

  const headers = new Headers(options.headers)
  headers.set("x-csrf-token", csrfToken)

  return fetch(url, {
    ...options,
    headers,
    credentials: "same-origin",
  })
}

// ============================================
// 2. SAFE LOCALSTORAGE OPERATIONS
// ============================================

/**
 * Safely reads from localStorage with validation
 */
export function safeLocalStorageGet<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") {
    return defaultValue
  }

  try {
    const item = localStorage.getItem(key)
    if (!item) {
      return defaultValue
    }

    const parsed = JSON.parse(item)

    // Validate the parsed data structure matches expected type
    if (typeof parsed !== typeof defaultValue) {
      console.warn(`[Security] localStorage type mismatch for key: ${key}`)
      return defaultValue
    }

    return parsed as T
  } catch (error) {
    console.error(`[Security] Failed to parse localStorage key: ${key}`, error)
    // Clear potentially corrupted data
    localStorage.removeItem(key)
    return defaultValue
  }
}

/**
 * Safely writes to localStorage
 */
export function safeLocalStorageSet(key: string, value: unknown): boolean {
  if (typeof window === "undefined") {
    return false
  }

  try {
    const serialized = JSON.stringify(value)

    // Check for excessively large data (potential attack)
    if (serialized.length > 1024 * 100) {
      // 100KB limit
      console.warn(`[Security] Attempted to store oversized data in localStorage: ${key}`)
      return false
    }

    localStorage.setItem(key, serialized)
    return true
  } catch (error) {
    console.error(`[Security] Failed to set localStorage key: ${key}`, error)
    return false
  }
}

/**
 * Safely removes from localStorage
 */
export function safeLocalStorageRemove(key: string): boolean {
  if (typeof window === "undefined") {
    return false
  }

  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.error(`[Security] Failed to remove localStorage key: ${key}`, error)
    return false
  }
}

// ============================================
// 3. CLIENT-SIDE INPUT VALIDATION
// ============================================

/**
 * Validates an Ethereum address on the client side
 */
export function isValidEVMAddress(address: string): boolean {
  if (!address) return false

  // Basic format check
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return false
  }

  // Check for suspicious patterns (all zeros, all ones, etc.)
  const withoutPrefix = address.slice(2).toLowerCase()
  if (/^(0{40}|f{40}|dead.{36}|0{38}01)$/.test(withoutPrefix)) {
    console.warn("[Security] Suspicious address detected:", address)
    return false
  }

  return true
}

/**
 * Validates payment amount on the client side
 */
export function isValidPaymentAmount(amount: string | number): {
  valid: boolean
  error?: string
} {
  const numAmount = typeof amount === "string" ? Number.parseFloat(amount) : amount

  if (isNaN(numAmount) || !isFinite(numAmount)) {
    return { valid: false, error: "Invalid number format" }
  }

  if (numAmount <= 0) {
    return { valid: false, error: "Amount must be positive" }
  }

  if (numAmount > 100000000) {
    // $100M limit
    return { valid: false, error: "Amount exceeds maximum limit" }
  }

  // Check for precision attacks (too many decimals)
  const decimalStr = String(amount).split(".")[1]
  if (decimalStr && decimalStr.length > 18) {
    return { valid: false, error: "Too many decimal places" }
  }

  return { valid: true }
}

// ============================================
// 4. PAYMENT CONFIRMATION
// ============================================

/**
 * Creates a human-readable confirmation message for payments
 * Prevents blind signing attacks
 */
export function createPaymentConfirmation(params: {
  to: string
  amount: string
  token: string
  chainId: number
}): string {
  const chainNames: Record<number, string> = {
    1: "Ethereum Mainnet",
    11155111: "Sepolia Testnet",
    8453: "Base",
  }

  const chainName = chainNames[params.chainId] || `Chain ${params.chainId}`

  return `You are about to send:

Amount: ${params.amount} ${params.token}
To: ${params.to}
Network: ${chainName}

Please verify this information is correct before signing.`
}

// ============================================
// 5. TRANSACTION VERIFICATION
// ============================================

/**
 * Compares client-side parameters with what will be signed
 * Detects man-in-the-middle attacks
 */
export function verifyTransactionParameters(
  displayedParams: {
    to: string
    amount: string
    token: string
  },
  actualParams: {
    to: string
    value: string
    data?: string
  },
): {
  match: boolean
  discrepancies: string[]
} {
  const discrepancies: string[] = []

  // Compare addresses (case-insensitive)
  if (displayedParams.to.toLowerCase() !== actualParams.to.toLowerCase()) {
    discrepancies.push(`Address mismatch: displayed=${displayedParams.to}, actual=${actualParams.to}`)
  }

  // Note: Amount comparison would need to account for decimals
  // This is a simplified check

  return {
    match: discrepancies.length === 0,
    discrepancies,
  }
}

// ============================================
// 6. SUSPICIOUS ACTIVITY DETECTION
// ============================================

interface ActivityRecord {
  timestamp: number
  action: string
}

const activityHistory: ActivityRecord[] = []
const ACTIVITY_WINDOW_MS = 60 * 1000 // 1 minute

/**
 * Tracks user activity and detects suspicious patterns
 */
export function trackActivity(action: string): {
  suspicious: boolean
  reason?: string
} {
  const now = Date.now()

  // Add current activity
  activityHistory.push({ timestamp: now, action })

  // Clean old entries
  while (activityHistory.length > 0 && activityHistory[0].timestamp < now - ACTIVITY_WINDOW_MS) {
    activityHistory.shift()
  }

  // Check for suspicious patterns
  const recentPayments = activityHistory.filter(
    (a) => a.action === "PAYMENT" && a.timestamp > now - 10000, // Last 10 seconds
  )

  if (recentPayments.length > 5) {
    return {
      suspicious: true,
      reason: "Too many payment attempts in short period",
    }
  }

  const recentAddressChanges = activityHistory.filter(
    (a) => a.action === "ADDRESS_CHANGE" && a.timestamp > now - 60000, // Last minute
  )

  if (recentAddressChanges.length > 3) {
    return {
      suspicious: true,
      reason: "Multiple address changes detected",
    }
  }

  return { suspicious: false }
}
