/**
 * Trading signals — pure, deterministic functions over price/funding data.
 *
 * v1 is deliberately "boring math that works":
 *   1. Momentum: rolling return vs realized volatility (z-score)
 *   2. Funding carry: sign/magnitude of Hyperliquid's hourly funding rate
 *
 * Everything here is unit-testable without network access.
 */

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Momentum z-score over a window of closes.
 * Uses a risk-adjusted return: mean(returns) * sqrt(n) / std(returns).
 * Missing/short series yields 0 (no opinion).
 */
export function momentumZ(closes: number[], lookback = 24): number {
  if (closes.length < lookback + 2) return 0
  const window = closes.slice(-lookback - 1)
  const rets: number[] = []
  for (let i = 1; i < window.length; i++) {
    if (window[i - 1] <= 0) return 0
    rets.push(window[i] / window[i - 1] - 1)
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1)
  const std = Math.sqrt(variance)
  if (std < 1e-9) return 0
  return clamp((mean * Math.sqrt(rets.length)) / std, -3, 3)
}

/**
 * Funding score in [-1, 1].
 *   funding = -0.002%/h (shorts pay longs) -> +1 (long incentive)
 *   funding = +0.002%/h (longs pay shorts) -> -1 (short incentive)
 * Typical Hyperliquid funding is ~±0.0001%/h, with outliers far beyond,
 * so this band is deliberately wide.
 */
export function fundingScore(fundingPerHour: number): number {
  return clamp(-fundingPerHour / 0.00002, -1, 1)
}

export interface Signal {
  coin: string
  side: "long" | "short"
  score: number // combined, in [-1, 1]
  momentumZ: number
  funding: number // funding per hour
  volumeUsd: number // 24h notional volume
  markPx: number
  reason: string
}

/**
 * Combine momentum + funding into one score and pick a side.
 * 60% momentum, 40% funding — momentum leads, funding tilts the odds.
 */
export function combineSignal(momentumZScore: number, funding: number): { score: number; side: "long" | "short" } {
  const f = fundingScore(funding)
  const raw = 0.6 * (momentumZScore / 2) + 0.4 * f // both terms normalized to [-1, 1]
  const score = clamp(raw, -1, 1)
  return { score, side: score >= 0 ? "long" : "short" }
}

export function describeSignal(sig: { momentumZ: number; funding: number; side: "long" | "short" }): string {
  const parts: string[] = []
  parts.push(`momentum z=${sig.momentumZ.toFixed(2)}`)
  parts.push(`funding ${sig.funding >= 0 ? "+" : ""}${(sig.funding * 100).toFixed(3)}%/h`)
  parts.push(sig.side === "long" ? "long bias" : "short bias")
  return parts.join(", ")
}
