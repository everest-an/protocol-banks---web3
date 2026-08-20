/**
 * Extended factor library for the experimental strategy leg.
 *
 * Ported from the AlphaGPT design (see ../AlphaGPT research repo), adapted
 * to our tensor layout [features, time]. The robust leg (momentum + funding)
 * stays the default; these factors power the optional factor-mining leg.
 *
 * All functions are pure and unit-tested. NaN inputs degrade to 0.
 */

import { clamp } from "./strategies"

type Series = number[]

function safeDiv(a: number, b: number): number {
  return Math.abs(b) < 1e-12 ? 0 : a / b
}

function mean(xs: Series): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function std(xs: Series): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1))
}

/** Logarithmic returns. */
export function factorRet(closes: Series): Series {
  const out = new Array(closes.length).fill(0)
  for (let i = 1; i < closes.length; i++) {
    out[i] = Math.log(closes[i] / Math.max(closes[i - 1], 1e-9))
  }
  return out
}

/** Liquidity / FDV health score: liquidity share of FDV, smoothed. */
export function factorLiqScore(liquidity: Series, fdv: Series): Series {
  return liquidity.map((l, i) => safeDiv(l, Math.max(fdv[i], 1e-9)))
}

/** Buy/sell pressure imbalance from candle geometry. */
export function factorPressure(opens: Series, highs: Series, lows: Series, closes: Series): Series {
  const out: Series = []
  for (let i = 0; i < closes.length; i++) {
    const range = Math.max(highs[i] - lows[i], 1e-9)
    const body = closes[i] - opens[i]
    out.push(clamp(safeDiv(body, range), -1, 1))
  }
  return out
}

/** Volume acceleration: rate of change of log volume. */
export function factorFomo(volumes: Series): Series {
  const out = new Array(volumes.length).fill(0)
  for (let i = 1; i < volumes.length; i++) {
    out[i] = Math.log(Math.max(volumes[i], 1e-9) / Math.max(volumes[i - 1], 1e-9))
  }
  return out
}

/** Price deviation from its rolling mean, normalized by rolling std (z-score). */
export function factorDev(closes: Series, window = 20): Series {
  const out = new Array(closes.length).fill(0)
  for (let i = window; i < closes.length; i++) {
    const w = closes.slice(i - window, i + 1)
    const m = mean(w)
    const s = std(w)
    out[i] = safeDiv(closes[i] - m, s)
  }
  return out
}

/** Log volume. */
export function factorLogVol(volumes: Series): Series {
  return volumes.map((v) => Math.log(Math.max(v, 1e-9)))
}

/** Volatility clustering: rolling std of returns. */
export function factorVolCluster(closes: Series, window = 20): Series {
  const rets = factorRet(closes)
  const out = new Array(closes.length).fill(0)
  for (let i = window; i < closes.length; i++) {
    out[i] = std(rets.slice(i - window, i + 1))
  }
  return out
}

/** Momentum reversal: short-window return minus long-window return. */
export function factorMomentumRev(closes: Series, short = 6, long = 24): Series {
  const out = new Array(closes.length).fill(0)
  for (let i = long; i < closes.length; i++) {
    const rShort = safeDiv(closes[i] - closes[i - short], closes[i - short])
    const rLong = safeDiv(closes[i] - closes[i - long], closes[i - long])
    out[i] = rShort - rLong
  }
  return out
}

/** Relative strength (RSI-like): mean gain / (mean gain + mean loss) mapped to [-1, 1]. */
export function factorRelStrength(closes: Series, window = 14): Series {
  const out = new Array(closes.length).fill(0)
  for (let i = window; i < closes.length; i++) {
    let gain = 0
    let loss = 0
    for (let j = i - window + 1; j <= i; j++) {
      const d = closes[j] - closes[j - 1]
      if (d >= 0) gain += d
      else loss -= d
    }
    out[i] = safeDiv(gain - loss, gain + loss)
  }
  return out
}

/** High-low range relative to close. */
export function factorHlRange(highs: Series, lows: Series, closes: Series): Series {
  return highs.map((h, i) => safeDiv(h - lows[i], Math.max(closes[i], 1e-9)))
}

/** Close position within the candle range, mapped to [-1, 1]. */
export function factorClosePos(opens: Series, highs: Series, lows: Series, closes: Series): Series {
  return closes.map((c, i) => {
    const range = Math.max(highs[i] - lows[i], 1e-9)
    return clamp(safeDiv(c - (opens[i] + lows[i]) / 2, range) * 2, -1, 1)
  })
}

/** Volume trend: log volume relative to its rolling mean. */
export function factorVolTrend(volumes: Series, window = 20): Series {
  const logVol = factorLogVol(volumes)
  const out = new Array(volumes.length).fill(0)
  for (let i = window; i < volumes.length; i++) {
    out[i] = logVol[i] - mean(logVol.slice(i - window, i + 1))
  }
  return out
}

/** Normalize a series to mean 0 / std 1, clipping outliers. */
export function normalizeSeries(xs: Series): Series {
  const m = mean(xs)
  const s = std(xs)
  if (s < 1e-9) return xs.map(() => 0)
  return xs.map((x) => clamp((x - m) / s, -5, 5))
}

export interface FactorBundle {
  name: string
  series: Series
}

/** Compute the full extended factor library for one token. */
export function computeFactorLibrary(raw: {
  open: Series
  high: Series
  low: Series
  close: Series
  volume: Series
  liquidity: Series
  fdv: Series
}): FactorBundle[] {
  const { open, high, low, close, volume, liquidity, fdv } = raw
  return [
    { name: "ret", series: normalizeSeries(factorRet(close)) },
    { name: "liq_score", series: normalizeSeries(factorLiqScore(liquidity, fdv)) },
    { name: "pressure", series: normalizeSeries(factorPressure(open, high, low, close)) },
    { name: "fomo", series: normalizeSeries(factorFomo(volume)) },
    { name: "dev", series: normalizeSeries(factorDev(close)) },
    { name: "log_vol", series: normalizeSeries(factorLogVol(volume)) },
    { name: "vol_cluster", series: normalizeSeries(factorVolCluster(close)) },
    { name: "momentum_rev", series: normalizeSeries(factorMomentumRev(close)) },
    { name: "rel_strength", series: normalizeSeries(factorRelStrength(close)) },
    { name: "hl_range", series: normalizeSeries(factorHlRange(high, low, close)) },
    { name: "close_pos", series: normalizeSeries(factorClosePos(open, high, low, close)) },
    { name: "vol_trend", series: normalizeSeries(factorVolTrend(volume)) },
  ]
}
