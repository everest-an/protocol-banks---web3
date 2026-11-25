import { createHash } from "crypto"
import { prisma } from "@/lib/prisma"

/**
 * Hash-chained audit log for agent decisions.
 *
 * The existing AuditLog table is a plain table. This helper stores the chain
 * metadata (seq, prevHash, hash) inside the `details` JSON column so no schema
 * migration is required. The chain is per actor (wallet/agent), not global.
 *
 * Concurrency note: the read-last + insert sequence is not atomic. For the
 * pilot this is acceptable; before production, move the chain head into a
 * dedicated row and update it in a transaction (or use a serializable
 * isolation level). A fork is detectable by verifyAuditChain.
 */

export interface AuditEventInput {
  actor: string
  action: string
  targetType?: string
  targetId?: string
  details?: Record<string, unknown>
}

export interface StoredAuditEvent {
  action: string
  actor: string
  targetType?: string
  targetId?: string
  seq: number
  at: string
  prevHash: string
  details: Record<string, unknown>
  hash: string
}

export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

export function hashAuditEvent(input: {
  actor: string
  action: string
  targetType?: string
  targetId?: string
  seq: number
  at: string
  prevHash: string
  details: Record<string, unknown>
}): string {
  return createHash("sha256")
    .update(
      canonicalize({
        actor: input.actor,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        seq: input.seq,
        at: input.at,
        prevHash: input.prevHash,
        details: input.details,
      }),
    )
    .digest("hex")
}

export function verifyAuditChain(events: StoredAuditEvent[]): {
  valid: boolean
  firstInvalid?: number
  reason?: string
} {
  let prevHash = "genesis"
  let expectedSeq = 1

  for (const event of events) {
    if (event.seq !== expectedSeq) {
      return { valid: false, firstInvalid: event.seq, reason: `expected seq ${expectedSeq}` }
    }
    if (event.prevHash !== prevHash) {
      return { valid: false, firstInvalid: event.seq, reason: "prevHash mismatch" }
    }
    const expected = hashAuditEvent({
      actor: event.actor,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      seq: event.seq,
      at: event.at,
      prevHash: event.prevHash,
      details: event.details,
    })
    if (expected !== event.hash) {
      return { valid: false, firstInvalid: event.seq, reason: "hash mismatch" }
    }
    prevHash = event.hash
    expectedSeq += 1
  }

  return { valid: true }
}

export async function appendAuditEvent(input: AuditEventInput): Promise<StoredAuditEvent> {
  const last = await prisma.auditLog.findFirst({
    where: { actor: input.actor },
    orderBy: { created_at: "desc" },
    select: { details: true },
  })

  const lastDetails = (last?.details ?? {}) as Record<string, unknown>
  const prevHash = typeof lastDetails.hash === "string" ? lastDetails.hash : "genesis"
  const seq = (typeof lastDetails.seq === "number" ? lastDetails.seq : 0) + 1
  const at = new Date().toISOString()
  const details = { ...(input.details ?? {}), seq, at, prevHash }
  const hash = hashAuditEvent({
    actor: input.actor,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    seq,
    at,
    prevHash,
    details,
  })

  await prisma.auditLog.create({
    data: {
      action: input.action,
      actor: input.actor,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      details: { ...details, hash },
    },
  })

  return {
    action: input.action,
    actor: input.actor,
    targetType: input.targetType,
    targetId: input.targetId,
    seq,
    at,
    prevHash,
    details,
    hash,
  }
}

export async function getAuditChain(actor: string, limit = 100): Promise<StoredAuditEvent[]> {
  const rows = await prisma.auditLog.findMany({
    where: { actor },
    orderBy: { created_at: "asc" },
    take: Math.min(Math.max(limit, 1), 500),
  })

  return rows.map((row) => {
    const details = (row.details ?? {}) as Record<string, unknown>
    return {
      action: row.action,
      actor: row.actor,
      targetType: row.target_type ?? undefined,
      targetId: row.target_id ?? undefined,
      seq: Number(details.seq ?? 0),
      at: String(details.at ?? row.created_at.toISOString()),
      prevHash: String(details.prevHash ?? "genesis"),
      details,
      hash: String(details.hash ?? ""),
    }
  })
}

export async function verifyActorAuditChain(actor: string, limit = 100) {
  const events = await getAuditChain(actor, limit)
  return verifyAuditChain(events)
}
