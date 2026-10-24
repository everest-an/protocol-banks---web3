/**
 * One policy object governs everything an agent credential may do: which
 * operations, how much per call, how much per day, and which coins. It lives on
 * the API key and is enforced on the server — the agent cannot widen it.
 */
export type AgentOp = "read" | "pay" | "swap" | "trade"

export interface AgentPolicy {
  allowedOps: AgentOp[]
  maxNotionalUsd: number
  dailyCapUsd: number
  /** Empty means every market the platform supports. */
  allowedCoins: string[]
}

const OPS: AgentOp[] = ["read", "pay", "swap", "trade"]

/** Keys created before policies existed keep working, under a hard cap. */
export const LEGACY_POLICY: AgentPolicy = {
  allowedOps: ["read", "pay", "swap", "trade"],
  maxNotionalUsd: 100,
  dailyCapUsd: 500,
  allowedCoins: [],
}

/** What a new credential starts with: read-only until scopes are granted. */
export const STRICT_POLICY: AgentPolicy = {
  allowedOps: ["read"],
  maxNotionalUsd: 50,
  dailyCapUsd: 200,
  allowedCoins: [],
}

export interface PolicyClamp {
  field: keyof AgentPolicy
  requested: unknown
  applied: string | number | string[]
  reason: string
}

export type ResolvedPolicy =
  | { ok: true; policy: AgentPolicy; clamped: PolicyClamp[] }
  | { ok: false; errors: string[] }

const num = (v: unknown, min: number, max: number): number | null => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null
  return Math.min(max, Math.max(min, v))
}

export function resolveAgentPolicy(input: unknown): ResolvedPolicy {
  if (input === null || input === undefined) return { ok: true, policy: { ...LEGACY_POLICY }, clamped: [] }
  if (typeof input !== "object" || Array.isArray(input)) return { ok: false, errors: ["policy must be an object"] }

  const raw = input as Record<string, unknown>
  const errors: string[] = []
  const clamped: PolicyClamp[] = []
  const policy: AgentPolicy = { ...STRICT_POLICY }

  if (raw.allowedOps !== undefined) {
    if (!Array.isArray(raw.allowedOps)) {
      errors.push("allowedOps must be an array")
    } else {
      const unknown = raw.allowedOps.filter((o) => typeof o !== "string" || !OPS.includes(o as AgentOp))
      if (unknown.length) errors.push(`unknown operations: ${unknown.join(", ")}`)
      else policy.allowedOps = [...new Set(raw.allowedOps as AgentOp[])]
    }
  }

  if (raw.maxNotionalUsd !== undefined) {
    const v = num(raw.maxNotionalUsd, 1, 10_000)
    if (v === null) errors.push("maxNotionalUsd must be a number")
    else {
      if (v !== raw.maxNotionalUsd) {
        clamped.push({ field: "maxNotionalUsd", requested: raw.maxNotionalUsd, applied: v, reason: "clamped to 1..10000" })
      }
      policy.maxNotionalUsd = v
    }
  }

  if (raw.dailyCapUsd !== undefined) {
    const v = num(raw.dailyCapUsd, 1, 100_000)
    if (v === null) errors.push("dailyCapUsd must be a number")
    else {
      if (v !== raw.dailyCapUsd) {
        clamped.push({ field: "dailyCapUsd", requested: raw.dailyCapUsd, applied: v, reason: "clamped to 1..100000" })
      }
      policy.dailyCapUsd = v
    }
  }

  if (raw.allowedCoins !== undefined) {
    if (!Array.isArray(raw.allowedCoins)) errors.push("allowedCoins must be an array")
    else {
      policy.allowedCoins = [
        ...new Set(
          raw.allowedCoins
            .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
            .map((c) => c.trim().toUpperCase()),
        ),
      ].slice(0, 50)
    }
  }

  if (errors.length) return { ok: false, errors }
  return { ok: true, policy, clamped }
}

export interface PolicyCheck {
  op: AgentOp
  notionalUsd?: number
  coin?: string
}

/** Pure decision: the caller supplies today's spend, this decides and explains. */
export function evaluatePolicy(
  policy: AgentPolicy,
  check: PolicyCheck,
  spentTodayUsd: number,
): { ok: true } | { ok: false; reason: string } {
  if (!policy.allowedOps.includes(check.op)) {
    return { ok: false, reason: `this key may not perform "${check.op}"` }
  }
  if (check.notionalUsd !== undefined) {
    if (!Number.isFinite(check.notionalUsd) || check.notionalUsd <= 0) {
      return { ok: false, reason: "notionalUsd must be a positive number" }
    }
    if (check.notionalUsd > policy.maxNotionalUsd) {
      return {
        ok: false,
        reason: `order of $${check.notionalUsd.toFixed(2)} exceeds this key's per-call cap of $${policy.maxNotionalUsd}`,
      }
    }
    if (spentTodayUsd + check.notionalUsd > policy.dailyCapUsd) {
      return {
        ok: false,
        reason: `daily cap reached: $${spentTodayUsd.toFixed(2)} spent, $${policy.dailyCapUsd} allowed`,
      }
    }
  }
  if (check.coin && policy.allowedCoins.length && !policy.allowedCoins.includes(check.coin.toUpperCase())) {
    return { ok: false, reason: `${check.coin} is not on this key's allowlist` }
  }
  return { ok: true }
}
