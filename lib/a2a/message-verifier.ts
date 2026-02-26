/**
 * A2A Message Verifier
 *
 * Signature verification (EIP-191) and replay protection
 * for all incoming A2A messages.
 */

import { verifyMessage } from 'viem'
import { prisma } from '@/lib/prisma'
import { extractAddressFromDid } from './types'
import { logger } from '@/lib/logger/structured-logger'

const DEFAULT_REPLAY_WINDOW_S = parseInt(
  process.env.A2A_REPLAY_WINDOW_SECONDS || '300',
  10
)

// ─── Signature Verification ─────────────────────────────────────────

/**
 * Verify the EIP-191 signature of an A2A message.
 *
 * The signature is computed over the canonicalized payload
 * (JSON with sorted keys, excluding the signature field itself).
 *
 * @returns The recovered address (lowercase) or null if invalid.
 */
export async function verifyA2ASignature(
  params: Record<string, unknown>,
  fromDid: string
): Promise<string | null> {
  const expectedAddress = extractAddressFromDid(fromDid)
  if (!expectedAddress) return null

  const signature = params.signature as string
  if (!signature) return null

  try {
    // Build the message that was signed (params without signature)
    const signable = canonicalizePayload(params)

    const isValid = await verifyMessage({
      address: expectedAddress as `0x${string}`,
      message: signable,
      signature: signature as `0x${string}`,
    })

    return isValid ? expectedAddress : null
  } catch (error) {
    logger.error('A2A signature verification failed', error as Error, {
      component: 'a2a-verifier',
    })
    return null
  }
}

// ─── Replay Protection ──────────────────────────────────────────────

/**
 * Check nonce uniqueness and timestamp freshness.
 *
 * - Nonce must be unique (stored in A2AMessage table with unique constraint)
 * - Timestamp must be within the replay window (default 5 minutes)
 *
 * @returns An error message if protection check fails, null if OK.
 */
export function checkTimestamp(
  timestamp: string,
  windowSeconds: number = DEFAULT_REPLAY_WINDOW_S
): string | null {
  const messageTime = new Date(timestamp).getTime()
  if (isNaN(messageTime)) return 'Invalid timestamp format'

  const now = Date.now()
  const diff = Math.abs(now - messageTime)

  if (diff > windowSeconds * 1000) {
    return `Timestamp outside ${windowSeconds}s replay window`
  }

  return null
}

/**
 * Check if a nonce has already been used.
 * Uses the A2AMessage table's unique constraint on nonce.
 */
export async function isNonceUsed(nonce: string): Promise<boolean> {
  const existing = await prisma.a2AMessage.findUnique({
    where: { nonce },
    select: { id: true },
  })
  return existing !== null
}

// ─── Canonical Serialization ────────────────────────────────────────

/**
 * Create a deterministic JSON string for signing.
 * Excludes the `signature` field and sorts keys alphabetically.
 */
export function canonicalizePayload(params: Record<string, unknown>): string {
  const filtered = Object.entries(params)
    .filter(([key]) => key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))

  return JSON.stringify(Object.fromEntries(filtered))
}
