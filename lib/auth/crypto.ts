/**
 * Cryptographic utilities for Protocol Banks Auth
 *
 * Uses Web Crypto API for:
 * - AES-256-GCM encryption/decryption
 * - PBKDF2 key derivation
 * - Secure random generation
 * - Hashing
 */

// Get crypto object (browser or Node.js)
function getCrypto(): Crypto {
  if (typeof window !== "undefined" && window.crypto) {
    return window.crypto
  }
  // Node.js
  const { webcrypto } = require("crypto")
  return webcrypto as Crypto
}

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  const crypto = getCrypto()
  return crypto.getRandomValues(new Uint8Array(length))
}

/**
 * Generate a random hex string
 */
export function generateRandomHex(length: number): string {
  const bytes = generateRandomBytes(length)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Generate a secure token for magic links, sessions, etc.
 */
export function generateSecureToken(): string {
  return generateRandomHex(32) // 256 bits
}

/**
 * Hash data using SHA-256
 */
export async function sha256(data: string | Uint8Array): Promise<string> {
  const crypto = getCrypto()
  const encoder = new TextEncoder()
  const dataBytes = typeof data === "string" ? encoder.encode(data) : data

  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBytes)
  const hashArray = new Uint8Array(hashBuffer)

  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Derive encryption key from PIN using PBKDF2
 *
 * @param pin - User's PIN (6 digits)
 * @param salt - Random salt for key derivation
 * @param iterations - PBKDF2 iterations (default: 100,000)
 * @returns Derived CryptoKey for AES-256-GCM
 */
export async function deriveKeyFromPIN(pin: string, salt: Uint8Array, iterations = 100000): Promise<CryptoKey> {
  const crypto = getCrypto()
  const encoder = new TextEncoder()

  // Import PIN as key material
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, [
    "deriveBits",
    "deriveKey",
  ])

  // Derive AES-256 key
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // Not extractable
    ["encrypt", "decrypt"],
  )
}

/**
 * Encrypt data using AES-256-GCM
 *
 * @param data - Data to encrypt
 * @param key - AES-256 CryptoKey
 * @returns Object containing encrypted data and IV
 */
export async function encryptAES(
  data: Uint8Array,
  key: CryptoKey,
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const crypto = getCrypto()

  // Generate random IV (12 bytes for GCM)
  const iv = generateRandomBytes(12)

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data)

  return {
    ciphertext: new Uint8Array(ciphertext),
    iv,
  }
}

/**
 * Decrypt data using AES-256-GCM
 *
 * @param ciphertext - Encrypted data
 * @param key - AES-256 CryptoKey
 * @param iv - Initialization vector used for encryption
 * @returns Decrypted data
 */
export async function decryptAES(ciphertext: Uint8Array, key: CryptoKey, iv: Uint8Array): Promise<Uint8Array> {
  const crypto = getCrypto()

  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)

  return new Uint8Array(plaintext)
}

/**
 * Convert Uint8Array to base64 string
 */
export function toBase64(data: Uint8Array): string {
  if (typeof btoa !== "undefined") {
    return btoa(String.fromCharCode(...data))
  }
  return Buffer.from(data).toString("base64")
}

/**
 * Convert base64 string to Uint8Array
 */
export function fromBase64(base64: string): Uint8Array {
  if (typeof atob !== "undefined") {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  }
  return new Uint8Array(Buffer.from(base64, "base64"))
}

/**
 * Convert hex string to Uint8Array
 */
export function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substr(i, 2), 16)
  }
  return bytes
}

/**
 * Convert Uint8Array to hex string
 */
export function toHex(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Generate a 6-digit recovery code
 */
export function generateRecoveryCode(): string {
  const bytes = generateRandomBytes(4)
  const num = new DataView(bytes.buffer).getUint32(0)
  return (num % 1000000).toString().padStart(6, "0")
}

/**
 * Generate full recovery phrase (multiple codes)
 */
export function generateRecoveryPhrase(wordCount = 6): string[] {
  const codes: string[] = []
  for (let i = 0; i < wordCount; i++) {
    codes.push(generateRecoveryCode())
  }
  return codes
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
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
