import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

/**
 * Webhook signing secrets are shown once at creation. Storing only the SHA-256
 * hash makes the delivered signature unverifiable by the subscriber, so new
 * webhooks also store the secret encrypted with a server-side key.
 *
 * The key is derived from WEBHOOK_SECRET_ENCRYPTION_KEY when configured,
 * otherwise from an existing server secret. Legacy webhooks without
 * secret_encrypted still fall back to the old hash-derived signature.
 */
function encryptionKey(): Buffer | null {
  const secret =
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY ||
    process.env.PAYMENT_LINK_SECRET ||
    process.env.AI_JWT_SECRET
  return secret ? createHash("sha256").update(secret).digest() : null
}

export function encryptWebhookSecret(secret: string): string | null {
  const key = encryptionKey()
  if (!key) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  let encrypted = cipher.update(secret, "utf8", "hex")
  encrypted += cipher.final("hex")
  const tag = cipher.getAuthTag()
  return `gcm:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`
}

export function decryptWebhookSecret(value: string | null | undefined): string | null {
  if (!value) return null
  const key = encryptionKey()
  if (!key) return null
  try {
    const [format, ivHex, tagHex, ciphertext] = value.split(":")
    if (format !== "gcm" || !ivHex || !tagHex || !ciphertext) return null
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"))
    decipher.setAuthTag(Buffer.from(tagHex, "hex"))
    let decrypted = decipher.update(ciphertext, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  } catch {
    return null
  }
}
