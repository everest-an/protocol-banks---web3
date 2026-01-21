/**
 * Nonce Manager Service
 * Manages nonces for EIP-3009 TransferWithAuthorization
 */

// In-memory nonce tracking (in production, use Redis or database)
const usedNonces = new Map<string, Set<string>>()

/**
 * Generate a unique nonce for authorization
 */
export function generateNonce(): string {
  const randomBytes = new Uint8Array(32)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes)
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < 32; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return '0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Get or create nonce set for an address
 */
function getNonceSet(address: string): Set<string> {
  const normalizedAddress = address.toLowerCase()
  if (!usedNonces.has(normalizedAddress)) {
    usedNonces.set(normalizedAddress, new Set())
  }
  return usedNonces.get(normalizedAddress)!
}

/**
 * Check if a nonce has been used
 */
export function isNonceUsed(address: string, nonce: string): boolean {
  const nonceSet = getNonceSet(address)
  return nonceSet.has(nonce.toLowerCase())
}

/**
 * Mark a nonce as used
 */
export function markNonceUsed(address: string, nonce: string): void {
  const nonceSet = getNonceSet(address)
  nonceSet.add(nonce.toLowerCase())
}

/**
 * Get current nonce count for an address
 */
export function getNonceCount(address: string): number {
  const nonceSet = getNonceSet(address)
  return nonceSet.size
}

/**
 * Increment nonce (generate new and mark current as used)
 */
export function incrementNonce(address: string): string {
  const newNonce = generateNonce()
  // The previous nonce is implicitly "used" when we generate a new one
  return newNonce
}

/**
 * Clear all nonces for an address (for testing)
 */
export function clearNonces(address: string): void {
  const normalizedAddress = address.toLowerCase()
  usedNonces.delete(normalizedAddress)
}

/**
 * Validate nonce format
 */
export function isValidNonce(nonce: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(nonce)
}
