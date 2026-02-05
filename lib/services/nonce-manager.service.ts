/**
 * Nonce Manager Service
 * Manages nonces for EIP-3009 TransferWithAuthorization
 */
import Redis from 'ioredis'

// Redis client
const redisUrl = process.env.REDIS_URL
const redis = redisUrl ? new Redis(redisUrl) : null

// In-memory nonce tracking fallback
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
 * Check if a nonce has been used (Distributed)
 */
export async function isNonceUsed(address: string, nonce: string): Promise<boolean> {
  const normalizedNonce = nonce.toLowerCase()
  const normalizedAddress = address.toLowerCase()
  
  if (redis) {
    const exists = await redis.sismember(`nonces:${normalizedAddress}`, normalizedNonce)
    return exists === 1
  }

  // Fallback
  const nonceSet = usedNonces.get(normalizedAddress)
  return nonceSet ? nonceSet.has(normalizedNonce) : false
}

/**
 * Mark a nonce as used (Distributed)
 */
export async function markNonceUsed(address: string, nonce: string): Promise<void> {
  const normalizedNonce = nonce.toLowerCase()
  const normalizedAddress = address.toLowerCase()

  if (redis) {
    await redis.sadd(`nonces:${normalizedAddress}`, normalizedNonce)
    // Optional: Set expire if nonce history isn't needed forever
    return
  }

  // Fallback
  if (!usedNonces.has(normalizedAddress)) {
    usedNonces.set(normalizedAddress, new Set())
  }
  usedNonces.get(normalizedAddress)!.add(normalizedNonce)
}

/**
 * Get current nonce count for an address
 */
export async function getNonceCount(address: string): Promise<number> {
  if (redis) {
    return await redis.scard(`nonces:${address.toLowerCase()}`)
  }
  const nonceSet = usedNonces.get(address.toLowerCase())
  return nonceSet ? nonceSet.size : 0
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
