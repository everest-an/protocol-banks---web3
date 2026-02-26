/**
 * JWT Utilities for AI Agent Authentication
 *
 * Lightweight JWT implementation using Web Crypto API (HMAC-SHA256).
 * No external dependencies — matches the pattern in lib/auth/crypto.ts.
 *
 * Token lifecycle:
 *   - Access token:  1 hour  (short-lived, used for API calls)
 *   - Refresh token: 30 days (long-lived, used to get new access tokens)
 */

import { generateRandomHex, sha256 } from "@/lib/auth/crypto"

// ─── Configuration ─────────────────────────────────────────────────

const ACCESS_TOKEN_EXPIRY_S = 60 * 60 // 1 hour
const REFRESH_TOKEN_EXPIRY_S = 30 * 24 * 60 * 60 // 30 days

function getJwtSecret(): string {
  const secret = process.env.AI_JWT_SECRET
  if (!secret) {
    throw new Error(
      "AI_JWT_SECRET environment variable is required for AI agent authentication"
    )
  }
  return secret
}

// ─── Base64url Encoding ────────────────────────────────────────────

function base64urlEncode(data: string | Uint8Array): string {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data
  const base64 = btoa(String.fromCharCode(...bytes))
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64urlDecode(str: string): string {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4)
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/")
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

// ─── HMAC-SHA256 Signing ───────────────────────────────────────────

async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(data)
  )
  return base64urlEncode(new Uint8Array(signature))
}

async function hmacVerify(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expected = await hmacSign(data, secret)
  // Timing-safe comparison
  if (expected.length !== signature.length) return false
  let result = 0
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return result === 0
}

// ─── JWT Types ─────────────────────────────────────────────────────

export interface JwtPayload {
  /** Subject — wallet address */
  sub: string
  /** Issued at — Unix timestamp */
  iat: number
  /** Expiration — Unix timestamp */
  exp: number
  /** Token type */
  type: "ai"
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Sign a JWT for an AI agent session.
 */
export async function signJwt(walletAddress: string): Promise<{
  token: string
  expiresAt: string
}> {
  const secret = getJwtSecret()
  const now = Math.floor(Date.now() / 1000)
  const exp = now + ACCESS_TOKEN_EXPIRY_S

  const header = base64urlEncode(
    JSON.stringify({ alg: "HS256", typ: "JWT" })
  )
  const payload = base64urlEncode(
    JSON.stringify({
      sub: walletAddress.toLowerCase(),
      iat: now,
      exp,
      type: "ai",
    } satisfies JwtPayload)
  )

  const signature = await hmacSign(`${header}.${payload}`, secret)
  const token = `${header}.${payload}.${signature}`
  const expiresAt = new Date(exp * 1000).toISOString()

  return { token, expiresAt }
}

/**
 * Verify and decode a JWT. Returns the payload if valid, null otherwise.
 */
export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    const [header, payload, signature] = parts
    const secret = getJwtSecret()

    // Verify signature
    const valid = await hmacVerify(`${header}.${payload}`, signature, secret)
    if (!valid) return null

    // Decode payload
    const decoded: JwtPayload = JSON.parse(base64urlDecode(payload))

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (decoded.exp < now) return null

    // Check required fields
    if (!decoded.sub || decoded.type !== "ai") return null

    return decoded
  } catch {
    return null
  }
}

/**
 * Generate a cryptographic refresh token (256-bit hex string).
 */
export function generateRefreshToken(): string {
  return generateRandomHex(32) // 256 bits
}

/**
 * Hash a token for secure DB storage (same pattern as session tokens).
 */
export async function hashToken(token: string): Promise<string> {
  return sha256(token)
}

/**
 * Get expiry timestamps for token creation.
 */
export function getTokenExpiries(): {
  accessExpiresAt: Date
  refreshExpiresAt: Date
} {
  return {
    accessExpiresAt: new Date(Date.now() + ACCESS_TOKEN_EXPIRY_S * 1000),
    refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_S * 1000),
  }
}
