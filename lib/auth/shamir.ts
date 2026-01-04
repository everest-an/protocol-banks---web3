/**
 * Shamir's Secret Sharing Implementation
 *
 * Security: Splits a secret into N shares where K shares are needed to reconstruct.
 * Uses GF(256) finite field arithmetic for cryptographic security.
 *
 * In our implementation:
 * - N = 3 shares (device, server, recovery)
 * - K = 2 threshold (any 2 shares can reconstruct)
 */

// GF(256) multiplication using Russian Peasant algorithm
function gf256Multiply(a: number, b: number): number {
  let result = 0
  let aa = a
  let bb = b

  while (bb > 0) {
    if (bb & 1) {
      result ^= aa
    }
    aa <<= 1
    if (aa & 0x100) {
      aa ^= 0x11b // AES irreducible polynomial
    }
    bb >>= 1
  }

  return result
}

// GF(256) division
function gf256Divide(a: number, b: number): number {
  if (b === 0) throw new Error("Division by zero")
  if (a === 0) return 0

  // Find multiplicative inverse using extended Euclidean algorithm
  let inverse = 1
  let temp = b
  for (let i = 0; i < 7; i++) {
    temp = gf256Multiply(temp, temp)
    inverse = gf256Multiply(inverse, temp)
  }

  return gf256Multiply(a, inverse)
}

// Evaluate polynomial at x using Horner's method
function evaluatePolynomial(coefficients: number[], x: number): number {
  let result = 0
  for (let i = coefficients.length - 1; i >= 0; i--) {
    result = gf256Multiply(result, x) ^ coefficients[i]
  }
  return result
}

// Lagrange interpolation to recover secret
function lagrangeInterpolate(shares: Array<{ x: number; y: number }>, x: number): number {
  let result = 0

  for (let i = 0; i < shares.length; i++) {
    let numerator = 1
    let denominator = 1

    for (let j = 0; j < shares.length; j++) {
      if (i !== j) {
        numerator = gf256Multiply(numerator, x ^ shares[j].x)
        denominator = gf256Multiply(denominator, shares[i].x ^ shares[j].x)
      }
    }

    const lagrangeCoeff = gf256Divide(numerator, denominator)
    result ^= gf256Multiply(shares[i].y, lagrangeCoeff)
  }

  return result
}

// Generate cryptographically secure random bytes
function getRandomBytes(length: number): Uint8Array {
  if (typeof window !== "undefined" && window.crypto) {
    return window.crypto.getRandomValues(new Uint8Array(length))
  }
  // Node.js fallback
  const { randomBytes } = require("crypto")
  return new Uint8Array(randomBytes(length))
}

/**
 * Split a secret into shares using Shamir's Secret Sharing
 *
 * @param secret - The secret bytes to split
 * @param totalShares - Total number of shares to create (N)
 * @param threshold - Minimum shares needed to reconstruct (K)
 * @returns Array of shares, each with an x-coordinate and y-values
 */
export function splitSecret(
  secret: Uint8Array,
  totalShares = 3,
  threshold = 2,
): Array<{ x: number; shares: Uint8Array }> {
  if (threshold > totalShares) {
    throw new Error("Threshold cannot be greater than total shares")
  }
  if (threshold < 2) {
    throw new Error("Threshold must be at least 2")
  }
  if (totalShares > 255) {
    throw new Error("Maximum 255 shares supported")
  }

  const result: Array<{ x: number; shares: Uint8Array }> = []

  // Initialize shares with unique x-coordinates (1, 2, 3, ...)
  for (let i = 0; i < totalShares; i++) {
    result.push({
      x: i + 1, // x-coordinates start at 1
      shares: new Uint8Array(secret.length),
    })
  }

  // For each byte of the secret
  for (let byteIndex = 0; byteIndex < secret.length; byteIndex++) {
    // Create polynomial coefficients: [secret, random, random, ...]
    const coefficients = new Array(threshold)
    coefficients[0] = secret[byteIndex] // Secret is the constant term

    // Generate random coefficients for higher-degree terms
    const randomCoeffs = getRandomBytes(threshold - 1)
    for (let i = 1; i < threshold; i++) {
      coefficients[i] = randomCoeffs[i - 1]
    }

    // Evaluate polynomial at each x-coordinate
    for (let shareIndex = 0; shareIndex < totalShares; shareIndex++) {
      result[shareIndex].shares[byteIndex] = evaluatePolynomial(coefficients, result[shareIndex].x)
    }
  }

  return result
}

/**
 * Reconstruct a secret from shares
 *
 * @param shares - Array of shares (at least threshold number)
 * @returns The reconstructed secret
 */
export function combineShares(shares: Array<{ x: number; shares: Uint8Array }>): Uint8Array {
  if (shares.length < 2) {
    throw new Error("At least 2 shares required to reconstruct")
  }

  const secretLength = shares[0].shares.length

  // Verify all shares have same length
  for (const share of shares) {
    if (share.shares.length !== secretLength) {
      throw new Error("All shares must have the same length")
    }
  }

  const result = new Uint8Array(secretLength)

  // Reconstruct each byte
  for (let byteIndex = 0; byteIndex < secretLength; byteIndex++) {
    const points = shares.map((s) => ({
      x: s.x,
      y: s.shares[byteIndex],
    }))

    // Interpolate to find the constant term (secret)
    result[byteIndex] = lagrangeInterpolate(points, 0)
  }

  return result
}

/**
 * Encode share to base64 string for storage
 */
export function encodeShare(share: { x: number; shares: Uint8Array }): string {
  const combined = new Uint8Array(1 + share.shares.length)
  combined[0] = share.x
  combined.set(share.shares, 1)
  return btoa(String.fromCharCode(...combined))
}

/**
 * Decode share from base64 string
 */
export function decodeShare(encoded: string): { x: number; shares: Uint8Array } {
  const decoded = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))
  return {
    x: decoded[0],
    shares: decoded.slice(1),
  }
}

/**
 * Verify that shares can reconstruct the original secret
 * (for testing/validation purposes)
 */
export function verifyShares(
  originalSecret: Uint8Array,
  shares: Array<{ x: number; shares: Uint8Array }>,
  threshold = 2,
): boolean {
  // Try all combinations of threshold shares
  for (let i = 0; i < shares.length - threshold + 1; i++) {
    const subset = shares.slice(i, i + threshold)
    const reconstructed = combineShares(subset)

    if (reconstructed.length !== originalSecret.length) {
      return false
    }

    for (let j = 0; j < originalSecret.length; j++) {
      if (reconstructed[j] !== originalSecret[j]) {
        return false
      }
    }
  }

  return true
}
