/**
 * Risk engine — parameterized guardrails for the paper trading agent.
 *
 * Layers:
 *   1. Universe filters (volume, price sanity)
 *   2. Position sizing (fraction of equity, min notional)
 *   3. Per-trade exits (take profit / stop loss / signal fade)
 *   4. Daily circuit breakers (stop new entries, kill all)
 *   5. Cost model (fees + slippage applied to every paper fill)
 */

export interface RiskConfig {
  maxPositions: number
  positionPct: number // fraction of trading wallet equity per position
  minNotionalUsd: number
  minVolumeUsd: number // 24h volume filter
  entryThreshold: number // |score| required to enter
  exitFadeThreshold: number // |score| below which an open position is closed (opposite sign)
  takeProfitPct: number
  stopLossPct: number
  dailyLossStopPct: number // stop new entries for the day
  dailyLossKillPct: number // close everything
  feeRate: number // taker fee
  slippageRate: number
  leverage: number
}

export const DEFAULT_RISK: RiskConfig = {
  maxPositions: 3,
  positionPct: 0.15,
  minNotionalUsd: 20,
  minVolumeUsd: 1_000_000,
  entryThreshold: 0.45,
  exitFadeThreshold: 0.3,
  takeProfitPct: 0.025,
  stopLossPct: 0.025,
  dailyLossStopPct: 0.05,
  dailyLossKillPct: 0.08,
  feeRate: 0.0004,
  slippageRate: 0.0005,
  leverage: 2,
}

export interface RiskSnapshot {
  todayLossPct: number
  stopNewEntries: boolean
  killAll: boolean
}

export function dailyRisk(todayStartEquity: number, currentEquity: number, cfg: RiskConfig): RiskSnapshot {
  const todayLossPct = todayStartEquity > 0 ? (todayStartEquity - currentEquity) / todayStartEquity : 0
  return {
    todayLossPct,
    stopNewEntries: todayLossPct >= cfg.dailyLossStopPct,
    killAll: todayLossPct >= cfg.dailyLossKillPct,
  }
}

/** USD notional to allocate for a new position. */
export function positionNotional(equityUsd: number, cfg: RiskConfig): number {
  return Math.max(cfg.minNotionalUsd, equityUsd * cfg.positionPct)
}

/** Mark price adjusted for slippage, in the direction the fill would hurt us. */
export function slippedPrice(markPx: number, side: "long" | "short", cfg: RiskConfig): number {
  return side === "long" ? markPx * (1 + cfg.slippageRate) : markPx * (1 - cfg.slippageRate)
}

/** Round-trip cost in USD for a given notional (fee on entry + fee on exit). */
export function roundTripCostUsd(notional: number, cfg: RiskConfig): number {
  return notional * cfg.feeRate * 2
}

export function passesUniverseFilters(volumeUsd: number, markPx: number, cfg: RiskConfig): boolean {
  return volumeUsd >= cfg.minVolumeUsd && markPx > 0 && Number.isFinite(markPx)
}
