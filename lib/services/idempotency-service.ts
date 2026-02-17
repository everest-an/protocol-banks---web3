/**
 * Idempotency Service
 *
 * Prevents duplicate payment processing by tracking request keys.
 * Clients provide an Idempotency-Key header; if the same key is seen again
 * within 24h, the original response is returned instead of re-processing.
 */

import { getClient } from "@/lib/prisma"
import { createHash } from "crypto"

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface IdempotencyResult {
  isDuplicate: boolean
  existingResponse?: {
    statusCode: number
    body: unknown
  }
  keyId?: string
}

/**
 * Check if a request with this idempotency key has already been processed.
 * If not, create a "processing" record to claim the key.
 */
export async function checkIdempotency(
  key: string,
  userAddress: string,
  requestPath: string,
  requestBody: unknown
): Promise<IdempotencyResult> {
  const prisma = getClient()
  const requestHash = hashRequest(requestBody)

  // Look up existing key
  const existing = await prisma.idempotencyKey.findUnique({
    where: { key },
  })

  if (existing) {
    // Key exists - check if it's for the same request
    if (existing.request_hash !== requestHash) {
      throw new Error(
        "Idempotency key reused with different request body. " +
          "Each unique request must use a unique idempotency key."
      )
    }

    if (existing.status === "completed" && existing.response_body) {
      return {
        isDuplicate: true,
        existingResponse: {
          statusCode: existing.response_code ?? 200,
          body: existing.response_body,
        },
      }
    }

    if (existing.status === "processing") {
      // Another request is still processing - conflict
      throw new Error(
        "A request with this idempotency key is currently being processed. " +
          "Please retry after a short delay."
      )
    }

    // Status is "failed" - allow retry
    await prisma.idempotencyKey.update({
      where: { key },
      data: { status: "processing" },
    })

    return { isDuplicate: false, keyId: existing.id }
  }

  // Create new idempotency record
  const record = await prisma.idempotencyKey.create({
    data: {
      key,
      user_address: userAddress,
      request_path: requestPath,
      request_hash: requestHash,
      status: "processing",
      expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
    },
  })

  return { isDuplicate: false, keyId: record.id }
}

/**
 * Mark an idempotency key as completed with the response
 */
export async function completeIdempotency(
  key: string,
  responseCode: number,
  responseBody: unknown
): Promise<void> {
  const prisma = getClient()
  await prisma.idempotencyKey.update({
    where: { key },
    data: {
      status: "completed",
      response_code: responseCode,
      response_body: responseBody as object,
      completed_at: new Date(),
    },
  })
}

/**
 * Mark an idempotency key as failed (allows retry)
 */
export async function failIdempotency(key: string): Promise<void> {
  const prisma = getClient()
  await prisma.idempotencyKey.update({
    where: { key },
    data: {
      status: "failed",
    },
  })
}

/**
 * Clean up expired idempotency keys (run periodically via cron)
 */
export async function cleanExpiredKeys(): Promise<number> {
  const prisma = getClient()
  const result = await prisma.idempotencyKey.deleteMany({
    where: {
      expires_at: { lt: new Date() },
    },
  })
  return result.count
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hashRequest(body: unknown): string {
  const normalized = JSON.stringify(body ?? {}, Object.keys(body as object ?? {}).sort())
  return createHash("sha256").update(normalized).digest("hex")
}
