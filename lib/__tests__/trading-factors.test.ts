/**
 * Unit tests for the experimental factor library and miner.
 */

import {
  factorRet,
  factorDev,
  factorRelStrength,
  factorClosePos,
  factorHlRange,
  factorLogVol,
  computeFactorLibrary,
} from "@/lib/trading/factors"
import {
  evaluateFormula,
  scoreSignal,
  mineFormula,
  formatFormula,
  opIndex,
} from "@/lib/trading/factor-miner"

function synthSeries(n: number, drift = 0.001, noise = 0.01, seed = 7): number[] {
  // deterministic pseudo-random walk
  let x = 100
  let s = seed
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const r = (s / 0x7fffffff - 0.5) * 2
    x = x * (1 + drift + r * noise)
    out.push(x)
  }
  return out
}

function synthRaw(n: number, seed = 7) {
  const close = synthSeries(n, 0.001, 0.01, seed)
  const open = close.map((c, i) => c * (1 + (i % 3 - 1) * 0.001))
  const high = close.map((c) => c * 1.005)
  const low = close.map((c) => c * 0.995)
  const volume = synthSeries(n, 0.0005, 0.2, seed + 1).map(Math.abs)
  const liquidity = volume.map((v) => v * 10)
  const fdv = volume.map((v) => v * 100)
  return { open, high, low, close, volume, liquidity, fdv }
}

describe("factor library", () => {
  it("computes all 12 factors with sane shapes", () => {
    const raw = synthRaw(200)
    const lib = computeFactorLibrary(raw)
    expect(lib).toHaveLength(12)
    for (const f of lib) {
      expect(f.series).toHaveLength(200)
      for (const v of f.series) {
        expect(Number.isFinite(v)).toBe(true)
        expect(Math.abs(v)).toBeLessThanOrEqual(5.01) // clipped normalization
      }
    }
  })

  it("factorRet is zero first, log returns after", () => {
    const closes = [100, 110, 99]
    const rets = factorRet(closes)
    expect(rets[0]).toBe(0)
    expect(rets[1]).toBeCloseTo(Math.log(110 / 100), 5)
    expect(rets[2]).toBeCloseTo(Math.log(99 / 110), 5)
  })

  it("factorDev z-scores against rolling window", () => {
    const closes = synthSeries(60, 0.001, 0.01)
    const dev = factorDev(closes, 20)
    // warmup region is zero; afterwards values are bounded z-scores
    expect(dev.slice(0, 20).every((v) => v === 0)).toBe(true)
    expect(dev.slice(20).every((v) => Number.isFinite(v))).toBe(true)
  })

  it("factorRelStrength stays within [-1, 1]", () => {
    const closes = synthSeries(100, 0.002, 0.005)
    const rs = factorRelStrength(closes, 14)
    for (const v of rs) expect(Math.abs(v)).toBeLessThanOrEqual(1 + 1e-9)
  })

  it("factorClosePos stays within [-1, 1]", () => {
    const raw = synthRaw(50)
    const cp = factorClosePos(raw.open, raw.high, raw.low, raw.close)
    for (const v of cp) expect(Math.abs(v)).toBeLessThanOrEqual(1 + 1e-9)
  })

  it("factorHlRange is non-negative", () => {
    const raw = synthRaw(50)
    const r = factorHlRange(raw.high, raw.low, raw.close)
    for (const v of r) expect(v).toBeGreaterThanOrEqual(0)
  })

  it("factorLogVol handles zero volumes", () => {
    const vols = [0, 1, 2, 0, 5]
    const lv = factorLogVol(vols)
    for (const v of lv) expect(Number.isFinite(v)).toBe(true)
  })
})

describe("formula language", () => {
  it("evaluates a simple factor passthrough", () => {
    const lib = [{ name: "ret", series: [0.1, -0.2, 0.3] }]
    const sig = evaluateFormula([0], lib)
    expect(sig).toEqual([0.1, -0.2, 0.3])
  })

  it("evaluates add of two factors", () => {
    const lib = [
      { name: "a", series: [1, 2, 3] },
      { name: "b", series: [10, 20, 30] },
    ]
    const sig = evaluateFormula([0, 1, -1 - opIndex("add")], lib)
    expect(sig).toEqual([11, 22, 33])
  })

  it("rejects invalid token sequences", () => {
    const lib = [{ name: "a", series: [1] }]
    expect(evaluateFormula([-1 - opIndex("add")], lib)).toBeNull() // operator with empty stack
    expect(evaluateFormula([0, 1], lib)).toBeNull() // dangling stack
    expect(evaluateFormula([5], lib)).toBeNull() // unknown factor index
  })

  it("formats formulas readably", () => {
    const lib = [
      { name: "ret", series: [] },
      { name: "dev", series: [] },
    ]
    const tokens = [0, 1, -1 - opIndex("add")]
    expect(formatFormula(tokens, lib)).toBe("add(ret,dev)")
  })
})

describe("signal scoring", () => {
  it("rewards a signal that predicts forward returns", () => {
    // Strongly autocorrelated returns so a momentum signal has predictive
    // power without excessive turnover (the scorer penalizes churn)
    const n = 300
    const rets: number[] = []
    let prev = 0
    let s = 1234
    for (let i = 0; i < n; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      const noise = (s / 0x7fffffff - 0.5) * 0.002
      prev = 0.9 * prev + noise
      rets.push(prev)
    }
    const signal = rets.map((r) => Math.sign(r))
    const score = scoreSignal(signal, rets)
    expect(score).toBeGreaterThan(0)
  })

  it("rejects constant signals", () => {
    const forward = synthSeries(100)
    const flat = new Array(100).fill(0)
    expect(scoreSignal(flat, forward)).toBe(-2)
  })

  it("rejects short series", () => {
    const forward = synthSeries(10)
    const signal = synthSeries(10)
    expect(scoreSignal(signal, forward)).toBe(-Infinity)
  })
})

describe("miner", () => {
  it("finds a formula and is deterministic given a seed", () => {
    const raw = synthRaw(300)
    const lib = computeFactorLibrary(raw)
    const closes = raw.close
    const forward = closes.map((c, i) => (i + 1 < closes.length ? (closes[i + 1] - c) / c : 0))

    const r1 = mineFormula(lib, forward, { maxLength: 8, rounds: 50, candidatesPerRound: 64, seed: 42 })
    const r2 = mineFormula(lib, forward, { maxLength: 8, rounds: 50, candidatesPerRound: 64, seed: 42 })

    expect(r1.validFormulas).toBeGreaterThan(0)
    expect(r1.bestTokens).toEqual(r2.bestTokens)
    expect(r1.bestScore).toBeCloseTo(r2.bestScore, 6)

    // The best formula must evaluate cleanly and render without unknowns
    const sig = evaluateFormula(r1.bestTokens, lib)
    expect(sig).not.toBeNull()
    const readable = formatFormula(r1.bestTokens, lib)
    expect(readable.length).toBeGreaterThanOrEqual(3)
    expect(readable).not.toContain("?")
  })
})
