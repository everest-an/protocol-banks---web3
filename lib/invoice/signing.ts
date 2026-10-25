import crypto from "node:crypto"

export function generateInvoiceId(): string {
  return `INV-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`
}

/** Payment-link signature. Returns null when no secret is configured — the same
 *  situation the legacy invoice route degrades into with a per-instance secret. */
export function signInvoice(data: string): string | null {
  const secret = process.env.PAYMENT_LINK_SECRET
  if (!secret) return null
  return crypto.createHmac("sha256", secret).update(data).digest("hex").slice(0, 16)
}
