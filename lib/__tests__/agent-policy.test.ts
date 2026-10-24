/**
 * The policy is the contract a partner's key signs up to. These tests pin the
 * clamp and the decisions, because everything downstream trusts them.
 */
import { evaluatePolicy, LEGACY_POLICY, resolveAgentPolicy, STRICT_POLICY } from "@/lib/agent/policy"

describe("agent policy", () => {
  it("treats a missing policy as the legacy one (capped, all ops)", () => {
    const r = resolveAgentPolicy(null)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.policy).toEqual(LEGACY_POLICY)
  })

  it("starts a fresh object as read-only", () => {
    const r = resolveAgentPolicy({})
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.policy.allowedOps).toEqual(["read"])
    expect(r.policy).toEqual(STRICT_POLICY)
  })

  it("clamps the caps instead of trusting them", () => {
    const r = resolveAgentPolicy({ maxNotionalUsd: 0, dailyCapUsd: 9_999_999 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.policy.maxNotionalUsd).toBe(1)
    expect(r.policy.dailyCapUsd).toBe(100_000)
    expect(r.clamped.length).toBe(2)
  })

  it("rejects unknown operations and wrong shapes", () => {
    expect(resolveAgentPolicy({ allowedOps: ["read", "withdraw"] }).ok).toBe(false)
    expect(resolveAgentPolicy({ allowedOps: "read" }).ok).toBe(false)
    expect(resolveAgentPolicy([]).ok).toBe(false)
    expect(resolveAgentPolicy("policy").ok).toBe(false)
  })

  it("normalizes the coin allowlist", () => {
    const r = resolveAgentPolicy({ allowedCoins: ["btc", " BTC ", "eth", ""] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.policy.allowedCoins).toEqual(["BTC", "ETH"])
  })

  describe("evaluatePolicy", () => {
    const policy = { allowedOps: ["read", "trade"] as const, maxNotionalUsd: 100, dailyCapUsd: 250, allowedCoins: ["BTC"] }

    it("allows an op inside every limit", () => {
      expect(evaluatePolicy({ ...policy, allowedOps: [...policy.allowedOps] }, { op: "trade", notionalUsd: 50, coin: "BTC" }, 0).ok).toBe(true)
    })

    it("refuses an operation the key does not have", () => {
      const r = evaluatePolicy({ ...policy, allowedOps: [...policy.allowedOps] }, { op: "pay", notionalUsd: 10 }, 0)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/may not perform "pay"/)
    })

    it("refuses a per-call overshoot", () => {
      const r = evaluatePolicy({ ...policy, allowedOps: [...policy.allowedOps] }, { op: "trade", notionalUsd: 101 }, 0)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/per-call cap/)
    })

    it("refuses when today's spend would pass the daily cap", () => {
      const r = evaluatePolicy({ ...policy, allowedOps: [...policy.allowedOps] }, { op: "trade", notionalUsd: 50 }, 220)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/daily cap/)
    })

    it("refuses a coin outside the allowlist", () => {
      const r = evaluatePolicy({ ...policy, allowedOps: [...policy.allowedOps] }, { op: "trade", notionalUsd: 10, coin: "ETH" }, 0)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/allowlist/)
    })

    it("refuses a non-positive notional", () => {
      expect(evaluatePolicy({ ...policy, allowedOps: [...policy.allowedOps] }, { op: "trade", notionalUsd: -1 }, 0).ok).toBe(false)
    })
  })
})
