import { createPrivateKey, randomUUID, sign } from "crypto"

const DEFAULT_URL = "https://facilitator.payai.network"

export interface PayAIConfig {
  url: string
  keyId?: string
  keySecret?: string
}

export function payaiConfig(): PayAIConfig {
  return {
    url: (process.env.PAYAI_FACILITATOR_URL || DEFAULT_URL).replace(/\/+$/, ""),
    keyId: process.env.PAYAI_API_KEY_ID,
    keySecret: process.env.PAYAI_API_KEY_SECRET,
  }
}

function base64Url(value: Buffer | string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export function buildPayAIJwt(
  keyId: string,
  keySecret: string,
  options: { now?: number; jti?: string } = {},
): string {
  const now = options.now ?? Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: "EdDSA", typ: "JWT", kid: keyId }))
  const payload = base64Url(
    JSON.stringify({
      sub: keyId,
      iss: "payai-merchant",
      iat: now,
      exp: now + 120,
      jti: options.jti ?? randomUUID(),
    }),
  )
  const message = `${header}.${payload}`
  const normalized = keySecret.trim().replace(/^payai_sk_/, "")
  const key = createPrivateKey({ key: Buffer.from(normalized, "base64"), format: "der", type: "pkcs8" })
  return `${message}.${base64Url(sign(null, Buffer.from(message), key))}`
}

let cached: { token: string; expiresAt: number } | null = null

async function authHeader(): Promise<string | null> {
  const { keyId, keySecret } = payaiConfig()
  if (!keyId || !keySecret) return null
  const now = Date.now()
  if (cached && cached.expiresAt > now + 30_000) return `Bearer ${cached.token}`
  const token = buildPayAIJwt(keyId, keySecret)
  cached = { token, expiresAt: now + 120_000 }
  return `Bearer ${token}`
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set("content-type", "application/json")
  const auth = await authHeader()
  if (auth) headers.set("authorization", auth)
  const response = await fetch(`${payaiConfig().url}${path}`, { ...init, headers })
  const text = await response.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!response.ok) {
    throw new Error(`PayAI ${path} failed (${response.status}): ${String(body).slice(0, 300)}`)
  }
  return body as T
}

export function getPayAISupported() {
  return request<Record<string, unknown>>("/supported", { method: "GET" })
}

export function getPayAIPricing() {
  return request<Record<string, unknown>>("/pricing", { method: "GET" })
}

export function verifyPayAIPayment(paymentPayload: unknown, paymentRequirements: unknown) {
  return request<Record<string, unknown>>("/verify", {
    method: "POST",
    body: JSON.stringify({ x402Version: 2, paymentPayload, paymentRequirements }),
  })
}

export function settlePayAIPayment(paymentPayload: unknown, paymentRequirements: unknown) {
  return request<Record<string, unknown>>("/settle", {
    method: "POST",
    body: JSON.stringify({ x402Version: 2, paymentPayload, paymentRequirements }),
  })
}
