import { decryptWebhookSecret, encryptWebhookSecret } from "@/lib/services/webhook-secret"

describe("webhook secret encryption", () => {
  const original = process.env.PAYMENT_LINK_SECRET
  const originalKey = process.env.WEBHOOK_SECRET_ENCRYPTION_KEY

  beforeEach(() => {
    process.env.PAYMENT_LINK_SECRET = "test-webhook-encryption-secret"
    delete process.env.WEBHOOK_SECRET_ENCRYPTION_KEY
  })

  afterAll(() => {
    if (original === undefined) delete process.env.PAYMENT_LINK_SECRET
    else process.env.PAYMENT_LINK_SECRET = original
    if (originalKey === undefined) delete process.env.WEBHOOK_SECRET_ENCRYPTION_KEY
    else process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = originalKey
  })

  it("round-trips the secret shown at creation", () => {
    const secret = "whsec_" + "ab".repeat(32)
    const encrypted = encryptWebhookSecret(secret)
    expect(encrypted).toMatch(/^gcm:/)
    expect(decryptWebhookSecret(encrypted)).toBe(secret)
  })

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptWebhookSecret("whsec_secret")!
    const parts = encrypted.split(":")
    const ciphertext = parts[3]
    parts[3] = (ciphertext[0] === "0" ? "1" : "0") + ciphertext.slice(1)
    expect(decryptWebhookSecret(parts.join(":"))).toBeNull()
  })

  it("returns null when no server key is configured", () => {
    delete process.env.PAYMENT_LINK_SECRET
    process.env.WEBHOOK_SECRET_ENCRYPTION_KEY = ""
    expect(encryptWebhookSecret("whsec_secret")).toBeNull()
    expect(decryptWebhookSecret("gcm:aa:bb:cc")).toBeNull()
  })
})
