/**
 * The boundary between a customer's strategy wishes and the risk the platform
 * will actually accept. A customer may choose a preset and tune a whitelisted
 * subset of RiskConfig; everything else is clamped, unknown fields are refused
 * outright, and the invariants below are re-established after clamping so a
 * combination of individually-legal values cannot produce an illegal profile.
 */
import { DEFAULT_RISK, type RiskConfig } from "./risk"

export type StrategyPreset = "balanced" | "momentum" | "funding" | "conservative" | "aggressive"

export interface StrategyProfile {
  preset?: StrategyPreset
  overrides?: Record<string, unknown>
}

interface Bound {
  min: number
  max: number
  integer?: boolean
}

const BOUNDS: Partial<Record<keyof RiskConfig, Bound>> = {
  maxPositions: { min: 1, max: 5, integer: true },
  positionPct: { min: 0.05, max: 0.25 },
  entryThreshold: { min: 0.3, max: 0.8 },
  exitFadeThreshold: { min: 0.1, max: 0.6 },
  takeProfitPct: { min: 0.01, max: 0.05 },
  stopLossPct: { min: 0.01, max: 0.05 },
  dailyLossStopPct: { min: 0.02, max: 0.1 },
  dailyLossKillPct: { min: 0.04, max: 0.15 },
  leverage: { min: 1, max: 3, integer: true },
  minNotionalUsd: { min: 10, max: 500 },
  minVolumeUsd: { min: 1_000_000, max: 500_000_000 },
  slippageRate: { min: 0.001, max: 0.05 },
}

const PLATFORM_ONLY: Array<keyof RiskConfig> = ["feeRate"]

export const PRESETS: Record<StrategyPreset, RiskConfig> = {
  balanced: { ...DEFAULT_RISK },
  momentum: {
    ...DEFAULT_RISK,
    entryThreshold: 0.35,
    exitFadeThreshold: 0.25,
    takeProfitPct: 0.03,
    stopLossPct: 0.02,
  },
  funding: {
    ...DEFAULT_RISK,
    entryThreshold: 0.5,
    takeProfitPct: 0.02,
    stopLossPct: 0.025,
  },
  conservative: {
    ...DEFAULT_RISK,
    entryThreshold: 0.6,
    positionPct: 0.1,
    maxPositions: 2,
    leverage: 1,
    dailyLossStopPct: 0.03,
    dailyLossKillPct: 0.06,
  },
  aggressive: {
    ...DEFAULT_RISK,
    entryThreshold: 0.35,
    exitFadeThreshold: 0.25,
    positionPct: 0.15,
    maxPositions: 4,
    leverage: 3,
    takeProfitPct: 0.04,
    stopLossPct: 0.03,
  },
}

export interface Clamp {
  field: keyof RiskConfig
  requested: unknown
  applied: number | string
  reason: string
}

export type ResolvedProfile =
  | { ok: true; preset: StrategyPreset; config: RiskConfig; clamped: Clamp[] }
  | { ok: false; errors: string[] }

const clampNumber = (v: number, b: Bound): number => {
  const bounded = Math.min(b.max, Math.max(b.min, v))
  return b.integer ? Math.round(bounded) : bounded
}

export function resolveStrategyProfile(input: unknown): ResolvedProfile {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["profile must be an object"] }
  }
  const obj = (input ?? {}) as Record<string, unknown>

  const presetName = typeof obj.preset === "string" ? (obj.preset as StrategyPreset) : "balanced"
  if (!Object.prototype.hasOwnProperty.call(PRESETS, presetName)) {
    return { ok: false, errors: [`unknown preset "${String(obj.preset)}"`] }
  }

  const overrides = obj.overrides
  if (overrides !== undefined && (overrides === null || typeof overrides !== "object" || Array.isArray(overrides))) {
    return { ok: false, errors: ["overrides must be an object"] }
  }

  const config: RiskConfig = { ...PRESETS[presetName] }
  const clamped: Clamp[] = []
  const errors: string[] = []

  for (const [key, value] of Object.entries((overrides ?? {}) as Record<string, unknown>)) {
    const field = key as keyof RiskConfig
    if (PLATFORM_ONLY.includes(field)) {
      errors.push(`"${key}" is platform-controlled and cannot be set`)
      continue
    }
    if (field === "approvalMode") {
      if (value !== "auto" && value !== "manual") errors.push('approvalMode must be "auto" or "manual"')
      else config.approvalMode = value
      continue
    }
    const bound = BOUNDS[field]
    if (!bound) {
      errors.push(`unknown field "${key}"`)
      continue
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push(`"${key}" must be a finite number`)
      continue
    }
    const applied = clampNumber(value, bound)
    if (applied !== value) {
      clamped.push({ field, requested: value, applied, reason: `outside ${bound.min}..${bound.max}` })
    }
    config[field] = applied as never
  }

  if (errors.length) return { ok: false, errors }

  // Invariants that survive clamping: individually legal values can still
  // combine into a profile that enters and exits on the same candle, or whose
  // single stop trips the daily breaker.
  if (config.exitFadeThreshold >= config.entryThreshold - 0.05) {
    const applied = Number(Math.max(0.1, config.entryThreshold - 0.1).toFixed(3))
    clamped.push({
      field: "exitFadeThreshold",
      requested: config.exitFadeThreshold,
      applied,
      reason: "must stay clearly below the entry threshold",
    })
    config.exitFadeThreshold = applied
  }

  if (config.stopLossPct >= config.dailyLossStopPct) {
    const applied = Number(Math.min(config.stopLossPct, config.dailyLossStopPct - 0.005).toFixed(4))
    clamped.push({
      field: "stopLossPct",
      requested: config.stopLossPct,
      applied,
      reason: "a single stop must not trip the daily breaker",
    })
    config.stopLossPct = applied
  }

  if (config.dailyLossKillPct <= config.dailyLossStopPct) {
    const applied = Number(Math.min(0.15, config.dailyLossStopPct + 0.02).toFixed(4))
    clamped.push({
      field: "dailyLossKillPct",
      requested: config.dailyLossKillPct,
      applied,
      reason: "the kill level must sit above the stop level",
    })
    config.dailyLossKillPct = applied
  }

  const maxDeployed = config.positionPct * config.maxPositions
  if (maxDeployed > 0.6) {
    const applied = Number((0.6 / config.maxPositions).toFixed(4))
    clamped.push({
      field: "positionPct",
      requested: config.positionPct,
      applied,
      reason: "total deployment across positions cannot exceed 60% of equity",
    })
    config.positionPct = applied
  }

  return { ok: true, preset: presetName, config, clamped }
}
