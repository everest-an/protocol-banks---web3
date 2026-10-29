/**
 * API plans. One key's effective limits are the tighter of its own policy and
 * the account's plan, so a plan can never raise what a key was granted — it only
 * sets the ceiling the account may ask for.
 *
 * Paid plans replace the per-order fee (8 bps) with the monthly price.
 */
import type { AgentPolicy } from "@/lib/agent/policy"

export type PlanId = "sandbox" | "builder" | "growth" | "scale"

export interface Plan {
  id: PlanId
  name: string
  monthlyUsd: number
  /** Env var holding the Stripe price id (subscription mode). */
  priceEnv: string
  maxKeys: number
  maxNotionalUsd: number
  dailyCapUsd: number
  /** 0 on paid plans: the price replaces the per-order fee. */
  feeBps: number
}

export const PLANS: Record<PlanId, Plan> = {
  sandbox: {
    id: "sandbox",
    name: "Sandbox",
    monthlyUsd: 0,
    priceEnv: "",
    maxKeys: 1,
    maxNotionalUsd: 50,
    dailyCapUsd: 200,
    feeBps: 8,
  },
  builder: {
    id: "builder",
    name: "Builder",
    monthlyUsd: 199,
    priceEnv: "STRIPE_PRICE_BUILDER",
    maxKeys: 3,
    maxNotionalUsd: 500,
    dailyCapUsd: 5_000,
    feeBps: 0,
  },
  growth: {
    id: "growth",
    name: "Growth",
    monthlyUsd: 999,
    priceEnv: "STRIPE_PRICE_GROWTH",
    maxKeys: 10,
    maxNotionalUsd: 2_500,
    dailyCapUsd: 50_000,
    feeBps: 0,
  },
  scale: {
    id: "scale",
    name: "Scale",
    monthlyUsd: 4_999,
    priceEnv: "STRIPE_PRICE_SCALE",
    maxKeys: 100,
    maxNotionalUsd: 10_000,
    dailyCapUsd: 100_000,
    feeBps: 0,
  },
}

export const PAID_PLANS: PlanId[] = ["builder", "growth", "scale"]

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && value in PLANS
}

/** A subscription counts only while it is active or trialing. */
export function planFromSubscription(status: string | undefined, metadataPlan: unknown): PlanId {
  if (status !== "active" && status !== "trialing") return "sandbox"
  return isPlanId(metadataPlan) && metadataPlan !== "sandbox" ? metadataPlan : "sandbox"
}

/** The key's policy, capped by the plan. Ops and coins are untouched. */
export function clampPolicyToPlan(policy: AgentPolicy, plan: PlanId): AgentPolicy {
  const limits = PLANS[plan]
  return {
    ...policy,
    maxNotionalUsd: Math.min(policy.maxNotionalUsd, limits.maxNotionalUsd),
    dailyCapUsd: Math.min(policy.dailyCapUsd, limits.dailyCapUsd),
  }
}

export function planFeeBps(plan: PlanId): number {
  return PLANS[plan].feeBps
}

export function planAllowsMoreKeys(plan: PlanId, currentKeys: number): boolean {
  return currentKeys < PLANS[plan].maxKeys
}
