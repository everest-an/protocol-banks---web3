/**
 * SIWE (Sign-In with Ethereum) — EIP-4361
 *
 * Server-side utilities for generating nonces, building SIWE messages,
 * and verifying Ethereum signatures. Used by AI agents to authenticate
 * without passwords or browser sessions.
 *
 * Flow:
 *   1. AI requests nonce   → generateSiweNonce()
 *   2. AI builds message   → buildSiweMessage()
 *   3. AI signs locally    → (private key stays with AI)
 *   4. Server verifies     → verifySiweSignature()
 */

import { verifyMessage } from "viem"
import { prisma } from "@/lib/prisma"
import { generateRandomHex } from "@/lib/auth/crypto"

// ─── Nonce Management ──────────────────────────────────────────────

const NONCE_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Generate a random nonce and persist it in DB with a 5-minute TTL.
 * Each nonce is single-use to prevent replay attacks.
 */
export async function generateSiweNonce(): Promise<{
  nonce: string
  expiresAt: string
}> {
  const nonce = generateRandomHex(16) // 128-bit random hex
  const expiresAt = new Date(Date.now() + NONCE_EXPIRY_MS)

  await prisma.siweNonce.create({
    data: { nonce, expires_at: expiresAt },
  })

  // Best-effort cleanup of expired nonces (non-blocking)
  prisma.siweNonce
    .deleteMany({ where: { expires_at: { lt: new Date() } } })
    .catch(() => {})

  return { nonce, expiresAt: expiresAt.toISOString() }
}

/**
 * Mark a nonce as consumed. Returns true if valid, false if missing/expired/reused.
 */
export async function consumeNonce(nonce: string): Promise<boolean> {
  try {
    const record = await prisma.siweNonce.findUnique({ where: { nonce } })
    if (!record || record.used || record.expires_at < new Date()) {
      return false
    }
    await prisma.siweNonce.update({
      where: { nonce },
      data: { used: true },
    })
    return true
  } catch {
    return false
  }
}

// ─── SIWE Message (EIP-4361) ───────────────────────────────────────

export interface SiweMessageParams {
  domain: string
  address: string
  uri: string
  nonce: string
  chainId?: number
  statement?: string
  issuedAt?: string
  expirationTime?: string
  version?: string
}

/**
 * Build a human-readable SIWE message conforming to EIP-4361.
 *
 * @see https://eips.ethereum.org/EIPS/eip-4361
 */
export function buildSiweMessage(params: SiweMessageParams): string {
  const {
    domain,
    address,
    uri,
    nonce,
    chainId = 1,
    statement = "Sign in to Protocol Banks",
    issuedAt = new Date().toISOString(),
    expirationTime,
    version = "1",
  } = params

  const lines = [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    statement,
    "",
    `URI: ${uri}`,
    `Version: ${version}`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ]

  if (expirationTime) {
    lines.push(`Expiration Time: ${expirationTime}`)
  }

  return lines.join("\n")
}

// ─── Signature Verification ────────────────────────────────────────

/**
 * Parse a SIWE message string back into its components.
 * Returns null if the message doesn't follow EIP-4361 format.
 */
export function parseSiweMessage(message: string): SiweMessageParams | null {
  try {
    const lines = message.split("\n")
    if (lines.length < 10) return null

    // Line 0: "{domain} wants you to sign in with your Ethereum account:"
    const domainMatch = lines[0].match(
      /^(.+) wants you to sign in with your Ethereum account:$/
    )
    if (!domainMatch) return null
    const domain = domainMatch[1]

    // Line 1: address
    const address = lines[1].trim()
    if (!/^0x[a-fA-F0-9]{40}$/i.test(address)) return null

    // Line 3: statement (between two blank lines)
    const statement = lines[3]

    // Remaining lines are key-value pairs
    const kvLines = lines.slice(5)
    const kvMap: Record<string, string> = {}
    for (const line of kvLines) {
      const colonIdx = line.indexOf(": ")
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx)
        const value = line.slice(colonIdx + 2)
        kvMap[key] = value
      }
    }

    return {
      domain,
      address,
      uri: kvMap["URI"] || "",
      nonce: kvMap["Nonce"] || "",
      chainId: kvMap["Chain ID"] ? parseInt(kvMap["Chain ID"], 10) : 1,
      statement,
      issuedAt: kvMap["Issued At"],
      expirationTime: kvMap["Expiration Time"],
      version: kvMap["Version"] || "1",
    }
  } catch {
    return null
  }
}

/**
 * Verify a SIWE signature: recovers the signer address and validates
 * the message fields (nonce, expiration, domain).
 *
 * @returns The recovered wallet address, or null if invalid.
 */
export async function verifySiweSignature(
  message: string,
  signature: `0x${string}`,
  expectedDomain?: string
): Promise<string | null> {
  try {
    // 1. Parse message
    const parsed = parseSiweMessage(message)
    if (!parsed) return null

    // 2. Check domain if expected
    if (expectedDomain && parsed.domain !== expectedDomain) return null

    // 3. Check expiration
    if (parsed.expirationTime) {
      const expiry = new Date(parsed.expirationTime)
      if (expiry < new Date()) return null
    }

    // 4. Verify cryptographic signature using viem
    const isValid = await verifyMessage({
      address: parsed.address as `0x${string}`,
      message,
      signature,
    })

    if (!isValid) return null

    return parsed.address.toLowerCase()
  } catch {
    return null
  }
}
