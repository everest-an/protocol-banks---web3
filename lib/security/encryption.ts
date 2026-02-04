import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto"

// Derive encryption key from wallet signature
export function deriveKeyFromSignature(signature: string): Buffer {
  return createHash("sha256").update(signature).digest()
}

// Encrypt sensitive vendor data
export function encryptVendorData(
  data: { name: string; wallet_address: string; email?: string; notes?: string },
  encryptionKey: Buffer,
): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv("aes-256-cbc", encryptionKey, iv)

  const jsonData = JSON.stringify(data)
  let encrypted = cipher.update(jsonData, "utf8", "hex")
  encrypted += cipher.final("hex")

  // Return IV + encrypted data
  return iv.toString("hex") + ":" + encrypted
}

// Decrypt vendor data
export function decryptVendorData(
  encryptedData: string,
  encryptionKey: Buffer,
): { name: string; wallet_address: string; email?: string; notes?: string } | null {
  try {
    const [ivHex, encrypted] = encryptedData.split(":")
    const iv = Buffer.from(ivHex, "hex")

    const decipher = createDecipheriv("aes-256-cbc", encryptionKey, iv)
    let decrypted = decipher.update(encrypted, "hex", "utf8")
    decrypted += decipher.final("utf8")

    return JSON.parse(decrypted)
  } catch (error) {
    console.error("[v0] Decryption failed:", error)
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
