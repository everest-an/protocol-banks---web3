/**
 * The strategy boundary: a customer may tune a whitelisted subset of the risk
 * config, and every path either clamps or refuses. These tests are the
 * contract the Telegram entry point will rely on.
 */
import { resolveStrategyProfile, PRESETS } from "@/lib/trading/strategy-profile"
import { DEFAULT_RISK } from "@/lib/trading/risk"

describe("strategy profile", () => {
  it("defaults to the balanced preset identical to today's config", () => {
    const r = resolveStrategyProfile({})
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.preset).toBe("balanced")
    expect(r.config).toEqual(DEFAULT_RISK)
    expect(r.clamped).toHaveLength(0)
  })

  it("every preset resolves without a single clamp", () => {
    for (const preset of Object.keys(PRESETS)) {
      const r = resolveStrategyProfile({ preset })
      expect(r.ok).toBe(true)
      if (!r.ok) continue
      expect(r.clamped).toEqual([])
      expect(Math.abs(r.config.exitFadeThreshold)).toBeLessThan(r.config.entryThreshold)
      expect(r.config.stopLossPct).toBeLessThan(r.config.dailyLossStopPct)
      expect(r.config.dailyLossStopPct).toBeLessThan(r.config.dailyLossKillPct)
      expect(r.config.positionPct * r.config.maxPositions).toBeLessThanOrEqual(0.6)
    }
  })

  it("clamps an absurd leverage instead of accepting it", () => {
    const r = resolveStrategyProfile({ overrides: { leverage: 100 } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.config.leverage).toBe(3)
    expect(r.clamped).toContainEqual(expect.objectContaining({ field: "leverage", requested: 100, applied: 3 }))
  })

  it("refuses to remove a stop by setting it to zero", () => {
    const r = resolveStrategyProfile({ overrides: { stopLossPct: 0 } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.config.stopLossPct).toBeGreaterThanOrEqual(0.01)
  })

  it("rejects unknown fields and platform-controlled fees", () => {
    const unknown = resolveStrategyProfile({ overrides: { secretSauce: 1 } })
    expect(unknown.ok).toBe(false)
    if (!unknown.ok) expect(unknown.errors[0]).toMatch(/unknown field/)

    const fee = resolveStrategyProfile({ overrides: { feeRate: 0 } })
    expect(fee.ok).toBe(false)
    if (!fee.ok) expect(fee.errors[0]).toMatch(/platform-controlled/)
  })

  it("rejects a non-numeric or non-finite value", () => {
    expect(resolveStrategyProfile({ overrides: { entryThreshold: "0.3" } }).ok).toBe(false)
    expect(resolveStrategyProfile({ overrides: { entryThreshold: NaN } }).ok).toBe(false)
  })

  it("keeps the entry/exit pair coherent when both are pushed together", () => {
    const r = resolveStrategyProfile({ overrides: { entryThreshold: 0.32, exitFadeThreshold: 0.6 } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.config.exitFadeThreshold).toBeLessThan(r.config.entryThreshold)
    expect(r.clamped.some((c) => c.field === "exitFadeThreshold")).toBe(true)
  })

  it("stops a single stop from tripping the daily breaker", () => {
    const r = resolveStrategyProfile({ overrides: { stopLossPct: 0.05, dailyLossStopPct: 0.02 } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.config.stopLossPct).toBeLessThan(r.config.dailyLossStopPct)
  })

  it("caps total deployment at 60% of equity", () => {
    const r = resolveStrategyProfile({ overrides: { positionPct: 0.25, maxPositions: 5 } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.config.positionPct * r.config.maxPositions).toBeLessThanOrEqual(0.6)
    expect(r.clamped.some((c) => c.field === "positionPct")).toBe(true)
  })

  it("accepts approvalMode as an enum and rejects anything else", () => {
    const ok = resolveStrategyProfile({ overrides: { approvalMode: "manual" } })
    expect(ok.ok && ok.config.approvalMode).toBe("manual")
    expect(resolveStrategyProfile({ overrides: { approvalMode: "yolo" } }).ok).toBe(false)
  })

  it("never lets a floor for liquid markets or minimum size drop below the platform's", () => {
    const r = resolveStrategyProfile({ overrides: { minVolumeUsd: 0, minNotionalUsd: 1 } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.config.minVolumeUsd).toBeGreaterThanOrEqual(1_000_000)
    expect(r.config.minNotionalUsd).toBeGreaterThanOrEqual(10)
  })

  it("rejects garbage input shapes", () => {
    expect(resolveStrategyProfile("aggressive").ok).toBe(false)
    expect(resolveStrategyProfile([]).ok).toBe(false)
    expect(resolveStrategyProfile({ preset: "degen" }).ok).toBe(false)
    expect(resolveStrategyProfile({ overrides: [] }).ok).toBe(false)
  })
})
