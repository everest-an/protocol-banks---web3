import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto"

// Derive encryption key from wallet signature
export function deriveKeyFromSignature(signature: string): Buffer {
  return createHash("sha256").update(signature).digest()
}

// Encrypt sensitive vendor data (AES-256-GCM — authenticated encryption)
export function encryptVendorData(
  data: { name: string; wallet_address: string; email?: string; notes?: string },
  encryptionKey: Buffer,
): string {
  const iv = randomBytes(12) // 96-bit IV for GCM
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv)

  const jsonData = JSON.stringify(data)
  let encrypted = cipher.update(jsonData, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag()

  // Format: gcm:<iv>:<authTag>:<ciphertext>
  return `gcm:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`
}

// Decrypt vendor data (supports both GCM and legacy CBC formats)
export function decryptVendorData(
  encryptedData: string,
  encryptionKey: Buffer,
): { name: string; wallet_address: string; email?: string; notes?: string } | null {
  try {
    if (encryptedData.startsWith("gcm:")) {
      // New GCM format: gcm:<iv>:<authTag>:<ciphertext>
      const [, ivHex, authTagHex, ciphertext] = encryptedData.split(":")
      const iv = Buffer.from(ivHex, "hex")
      const authTag = Buffer.from(authTagHex, "hex")

      const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv)
      decipher.setAuthTag(authTag)
      let decrypted = decipher.update(ciphertext, "hex", "utf8")
      decrypted += decipher.final("utf8")
      return JSON.parse(decrypted)
    } else {
      // Legacy CBC format: <iv>:<ciphertext> — backward compatible
      const [ivHex, encrypted] = encryptedData.split(":")
      const iv = Buffer.from(ivHex, "hex")
      const decipher = createDecipheriv("aes-256-cbc", encryptionKey, iv)
      let decrypted = decipher.update(encrypted, "hex", "utf8")
      decrypted += decipher.final("utf8")
      return JSON.parse(decrypted)
    }
  } catch (error) {
    console.error("[Encryption] Decryption failed")
    return null
  }
}

// Generate deterministic integrity hash for vendor data
// NOTE: No longer includes Date.now() - hash is deterministic for verification
export function generateIntegrityHash(
  walletAddress: string,
  vendorData: { name: string; wallet_address: string },
): string {
  const data = `${walletAddress.toLowerCase()}:${vendorData.name}:${vendorData.wallet_address.toLowerCase()}`
  return createHash("sha256").update(data).digest("hex").substring(0, 32)
}

// ============================================
// Server-side session key encryption (AES-256-GCM)
// ============================================

function getSessionKeyEncryptionKey(): Buffer {
  const secret = process.env.SESSION_KEY_ENCRYPTION_SECRET
  if (!secret) {
    throw new Error("SESSION_KEY_ENCRYPTION_SECRET must be configured for session key encryption")
  }
  return createHash("sha256").update(secret).digest()
}

/**
 * Encrypt a session key private key for storage at rest.
 * Format: base64(iv[12] + authTag[16] + ciphertext)
 */
export function encryptSessionKey(privateKey: string): string {
  const key = getSessionKeyEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)

  let encrypted = cipher.update(privateKey, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag()

  // iv (12) + authTag (16) + ciphertext
  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, "hex")])
  return combined.toString("base64")
}

/**
 * Decrypt a session key private key from storage.
 * Returns null if decryption fails (key rotated, corrupted, etc.)
 */
export function decryptSessionKey(encryptedData: string): string | null {
  try {
    const key = getSessionKeyEncryptionKey()
    const combined = Buffer.from(encryptedData, "base64")

    const iv = combined.subarray(0, 12)
    const authTag = combined.subarray(12, 28)
    const ciphertext = combined.subarray(28)

    const decipher = createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(ciphertext.toString("hex"), "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  } catch (error) {
    console.error("[SessionKey] Decryption failed:", error)
    return null
  }
}

// Client-side encryption using Web Crypto API (for browser)
export async function clientEncrypt(data: string, password: string): Promise<string> {
  if (typeof window === "undefined") return data

  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)

  // Derive key from password
  const keyMaterial = await window.crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveKey",
  ])

  const salt = window.crypto.getRandomValues(new Uint8Array(16))
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  )

  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, dataBuffer)

  // Combine salt + iv + encrypted
  const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength)
  result.set(salt, 0)
  result.set(iv, salt.length)
  result.set(new Uint8Array(encrypted), salt.length + iv.length)

  // Convert to base64 properly
  let binary = ""
  for (let i = 0; i < result.length; i++) {
    binary += String.fromCharCode(result[i])
  }
  return btoa(binary)
}

// Client-side decryption
export async function clientDecrypt(encryptedData: string, password: string): Promise<string | null> {
  if (typeof window === "undefined") return null

  try {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    // Decode base64 properly
    const binary = atob(encryptedData)
    const data = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      data[i] = binary.charCodeAt(i)
    }

    const salt = data.slice(0, 16)
    const iv = data.slice(16, 28)
    const encrypted = data.slice(28)

    const keyMaterial = await window.crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
      "deriveKey",
    ])

    const key = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    )

    const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted)

    return decoder.decode(decrypted)
  } catch (error) {
    console.error("[v0] Client decryption failed:", error)
    return null
  }
}
