/**
 * Plan ceilings and the per-order fee. The key's policy can only be tighter;
 * a plan never raises what a key was granted.
 */
import { PLANS, clampPolicyToPlan, planAllowsMoreKeys, planFeeBps, planFromSubscription } from "@/lib/billing/plans"
import type { AgentPolicy } from "@/lib/agent/policy"

const policy: AgentPolicy = {
  allowedOps: ["read", "trade"],
  maxNotionalUsd: 10_000,
  dailyCapUsd: 100_000,
  allowedCoins: ["BTC"],
}

describe("billing plans", () => {
  it("sandbox is the smallest plan and carries the per-order fee", () => {
    expect(PLANS.sandbox.maxKeys).toBe(1)
    expect(PLANS.sandbox.maxNotionalUsd).toBe(50)
    expect(PLANS.sandbox.dailyCapUsd).toBe(200)
    expect(planFeeBps("sandbox")).toBe(8)
  })

  it("paid plans replace the per-order fee", () => {
    expect(planFeeBps("builder")).toBe(0)
    expect(planFeeBps("growth")).toBe(0)
    expect(planFeeBps("scale")).toBe(0)
  })

  it("clamps a policy to the plan without touching ops or coins", () => {
    const clamped = clampPolicyToPlan(policy, "sandbox")

    expect(clamped.maxNotionalUsd).toBe(50)
    expect(clamped.dailyCapUsd).toBe(200)
    expect(clamped.allowedOps).toEqual(["read", "trade"])
    expect(clamped.allowedCoins).toEqual(["BTC"])
  })

  it("keeps a policy that is already tighter than the plan", () => {
    const clamped = clampPolicyToPlan({ ...policy, maxNotionalUsd: 20, dailyCapUsd: 100 }, "growth")

    expect(clamped.maxNotionalUsd).toBe(20)
    expect(clamped.dailyCapUsd).toBe(100)
  })

  it("counts only active or trialing subscriptions", () => {
    expect(planFromSubscription("active", "growth")).toBe("growth")
    expect(planFromSubscription("trialing", "builder")).toBe("builder")
    expect(planFromSubscription("canceled", "growth")).toBe("sandbox")
    expect(planFromSubscription("active", "sandbox")).toBe("sandbox")
    expect(planFromSubscription("active", undefined)).toBe("sandbox")
    expect(planFromSubscription("active", "enterprise")).toBe("sandbox")
  })

  it("enforces the key count per plan", () => {
    expect(planAllowsMoreKeys("sandbox", 0)).toBe(true)
    expect(planAllowsMoreKeys("sandbox", 1)).toBe(false)
    expect(planAllowsMoreKeys("builder", 2)).toBe(true)
    expect(planAllowsMoreKeys("builder", 3)).toBe(false)
  })
})
