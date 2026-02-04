/**
 * Validity Window Service
 * Manages time-based validity for authorizations
 */

// Default validity window: 1 hour
export const DEFAULT_VALIDITY_DURATION = 60 * 60

// Maximum validity window: 24 hours
export const MAX_VALIDITY_DURATION = 24 * 60 * 60

// Minimum validity window: 5 minutes
export const MIN_VALIDITY_DURATION = 5 * 60

/**
 * Get current Unix timestamp
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * Create validity window
 */
export function createValidityWindow(durationSeconds: number = DEFAULT_VALIDITY_DURATION): {
  validAfter: number
  validBefore: number
} {
  const now = getCurrentTimestamp()
  const duration = Math.min(Math.max(durationSeconds, MIN_VALIDITY_DURATION), MAX_VALIDITY_DURATION)
  
  return {
    validAfter: now - 60, // Allow 1 minute clock skew
    validBefore: now + duration,
  }
}

/**
 * Check if current time is within validity window
 */
export function isWithinValidityWindow(validAfter: number, validBefore: number): boolean {
  const now = getCurrentTimestamp()
  return now >= validAfter && now < validBefore
}

/**
 * Check if validity window has expired
 */
export function isExpired(validBefore: number): boolean {
  return getCurrentTimestamp() >= validBefore
}

/**
 * Check if validity window is not yet active
 */
export function isNotYetValid(validAfter: number): boolean {
  return getCurrentTimestamp() < validAfter
}

/**
 * Get remaining validity time in seconds
 */
export function getRemainingTime(validBefore: number): number {
  const remaining = validBefore - getCurrentTimestamp()
  return Math.max(0, remaining)
}

/**
 * Validate validity window parameters
 */
export function validateValidityWindow(validAfter: number, validBefore: number): {
  valid: boolean
  error?: string
} {
  if (validBefore <= validAfter) {
    return { valid: false, error: 'validBefore must be greater than validAfter' }
  }
  
  const duration = validBefore - validAfter
  if (duration > MAX_VALIDITY_DURATION) {
    return { valid: false, error: `Validity window exceeds maximum of ${MAX_VALIDITY_DURATION} seconds` }
  }
  
  if (duration < MIN_VALIDITY_DURATION) {
    return { valid: false, error: `Validity window is less than minimum of ${MIN_VALIDITY_DURATION} seconds` }
  }
  
  return { valid: true }
}

/**
 * Format remaining time as human-readable string
 */
export function formatRemainingTime(validBefore: number): string {
  const remaining = getRemainingTime(validBefore)
  
  if (remaining === 0) return 'Expired'
  
  const hours = Math.floor(remaining / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)
  const seconds = remaining % 60
  
  const parts = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)
  
  return parts.join(' ')
}
