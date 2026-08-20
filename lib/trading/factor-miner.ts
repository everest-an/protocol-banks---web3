/**
 * Factor miner — experimental strategy leg (V1).
 *
 * Generates candidate factor formulas (postfix token sequences) over the
 * extended factor library, evaluates them with a vectorized backtest, and
 * keeps the best one. Port of the AlphaGPT "mine formulas → score by
 * backtest" loop, adapted to our data layout and scoring conventions.
 *
 * OFF BY DEFAULT: the robust leg (momentum + funding) remains the only
 * production signal. The miner is a research tool until it passes a
 * paper-trading validation period.
 */

import { clamp } from "./strategies"
import type { FactorBundle } from "./factors"

// ---------------------------------------------------------------------------
// Formula language
// ---------------------------------------------------------------------------

export type Op = "add" | "sub" | "mul" | "div" | "neg" | "abs" | "sign" | "gate" | "delay1" | "max3"

export const OPS: Op[] = ["add", "sub", "mul", "div", "neg", "abs", "sign", "gate", "delay1", "max3"]

const OP_ARITY: Record<Op, number> = {
  add: 2,
  sub: 2,
  mul: 2,
  div: 2,
  neg: 1,
  abs: 1,
  sign: 1,
  gate: 3, // gate(cond, a, b) = cond > 0 ? a : b
  delay1: 1,
  max3: 1,
}

export type Token = number // >= 0: factor index, negative: operator (-1 - opIndex)

export function opIndex(op: Op): number {
  return OPS.indexOf(op)
}

export function isOpToken(t: Token): boolean {
  return t < 0
}

function delay1(xs: number[]): number[] {
  const out = new Array(xs.length).fill(0)
  for (let i = 1; i < xs.length; i++) out[i] = xs[i - 1]
  return out
}

function max3(xs: number[]): number[] {
  const out = new Array(xs.length).fill(0)
  for (let i = 0; i < xs.length; i++) {
    let m = xs[i]
    if (i >= 1) m = Math.max(m, xs[i - 1])
    if (i >= 2) m = Math.max(m, xs[i - 2])
    out[i] = m
  }
  return out
}

function pointwise(a: number[], b: number[], fn: (x: number, y: number) => number): number[] {
  const n = Math.min(a.length, b.length)
  const out = new Array(n)
  for (let i = 0; i < n; i++) out[i] = fn(a[i], b[i])
  return out
}

/**
 * Evaluate a postfix token sequence against the factor library.
 * Returns the resulting signal series, or null if the sequence is invalid.
 */
export function evaluateFormula(tokens: Token[], library: FactorBundle[]): number[] | null {
  const stack: number[][] = []
  for (const t of tokens) {
    if (!isOpToken(t)) {
      if (t >= library.length) return null
      stack.push(library[t].series.slice())
      continue
    }
    const op = OPS[-t - 1]
    if (!op) return null
    const arity = OP_ARITY[op]
    if (stack.length < arity) return null

    switch (op) {
      case "add": {
        const b = stack.pop()!
        const a = stack.pop()!
        stack.push(pointwise(a, b, (x, y) => x + y))
        break
      }
      case "sub": {
        const b = stack.pop()!
        const a = stack.pop()!
        stack.push(pointwise(a, b, (x, y) => x - y))
        break
      }
      case "mul": {
        const b = stack.pop()!
        const a = stack.pop()!
        stack.push(pointwise(a, b, (x, y) => x * y))
        break
      }
      case "div": {
        const b = stack.pop()!
        const a = stack.pop()!
        stack.push(pointwise(a, b, (x, y) => (Math.abs(y) < 1e-9 ? 0 : x / y)))
        break
      }
      case "neg": {
        const a = stack.pop()!
        stack.push(a.map((x) => -x))
        break
      }
      case "abs": {
        const a = stack.pop()!
        stack.push(a.map((x) => Math.abs(x)))
        break
      }
      case "sign": {
        const a = stack.pop()!
        stack.push(a.map((x) => Math.sign(x)))
        break
      }
      case "gate": {
        const c = stack.pop()!
        const b = stack.pop()!
        const a = stack.pop()!
        stack.push(pointwise(a, b, (x, y) => (c[Math.min(a.indexOf(x), c.length - 1)] > 0 ? x : y)))
        break
      }
      case "delay1": {
        const a = stack.pop()!
        stack.push(delay1(a))
        break
      }
      case "max3": {
        const a = stack.pop()!
        stack.push(max3(a))
        break
      }
      default:
        return null
    }
  }
  if (stack.length !== 1) return null
  return stack[0]
}

// ---------------------------------------------------------------------------
// Backtest scoring
// ---------------------------------------------------------------------------

export interface BacktestConfig {
  costRate: number // per-side turnover cost
  minBars: number
}

const DEFAULT_BT: BacktestConfig = { costRate: 0.0005, minBars: 30 }

/**
 * Score a signal series against forward returns.
 * Returns a score (higher = better) or -Infinity if the signal is unusable.
 */
export function scoreSignal(
  signal: number[],
  forwardReturns: number[],
  cfg: BacktestConfig = DEFAULT_BT,
): number {
  const n = Math.min(signal.length, forwardReturns.length)
  if (n < cfg.minBars) return -Infinity

  const pos = signal.map((s, i) => (i >= n ? 0 : Math.sign(Math.tanh(s))))
  let pnlSum = 0
  let pnlSqSum = 0
  let turnoverSum = 0
  let count = 0

  for (let i = 1; i < n; i++) {
    const pnl = pos[i] * forwardReturns[i - 1] - Math.abs(pos[i] - pos[i - 1]) * cfg.costRate
    pnlSum += pnl
    pnlSqSum += pnl * pnl
    turnoverSum += Math.abs(pos[i] - pos[i - 1])
    count++
  }

  if (count < cfg.minBars) return -Infinity
  const mu = pnlSum / count
  const std = Math.sqrt(Math.max(pnlSqSum / count - mu * mu, 0)) + 1e-9

  let score = mu / std
  if (mu < 0) score = -2
  const avgTurnover = turnoverSum / count
  if (avgTurnover > 0.5) score -= 1
  if (pos.every((p) => p === 0)) score = -2
  return clamp(score, -3, 5)
}

// ---------------------------------------------------------------------------
// Miner
// ---------------------------------------------------------------------------

export interface MinerConfig {
  maxLength: number
  rounds: number
  candidatesPerRound: number
  seed?: number
}

const DEFAULT_MINER: MinerConfig = { maxLength: 8, rounds: 200, candidatesPerRound: 256 }

/** Deterministic PRNG (mulberry32) so mining runs are reproducible. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface MinerResult {
  bestTokens: Token[]
  bestScore: number
  validFormulas: number
}

/**
 * Random formula search: generate candidate postfix sequences, evaluate,
 * score, keep the best. Deterministic given a seed.
 */
export function mineFormula(
  library: FactorBundle[],
  forwardReturns: number[],
  cfg: MinerConfig = DEFAULT_MINER,
): MinerResult {
  const rand = mulberry32(cfg.seed ?? 42)
  const nFactors = library.length
  const nOps = OPS.length

  let bestTokens: Token[] = []
  let bestScore = -Infinity
  let validFormulas = 0

  const randomToken = (): Token => (rand() < 0.6 ? Math.floor(rand() * nFactors) : -1 - Math.floor(rand() * nOps))

  for (let round = 0; round < cfg.rounds; round++) {
    for (let c = 0; c < cfg.candidatesPerRound; c++) {
      const len = 2 + Math.floor(rand() * (cfg.maxLength - 1))
      const tokens: Token[] = []
      let slots = 1 // postfix slots needed
      for (let i = 0; i < len; i++) {
        const remaining = len - i
        if (slots >= remaining) {
          tokens.push(Math.floor(rand() * nFactors)) // force factor
          slots--
        } else {
          const t = randomToken()
          tokens.push(t)
          slots += isOpToken(t) ? OP_ARITY[OPS[-t - 1]] - 1 : -1
        }
        if (slots <= 0 && i < len - 1) break
      }

      const signal = evaluateFormula(tokens, library)
      if (!signal) continue
      const score = scoreSignal(signal, forwardReturns)
      if (!Number.isFinite(score)) continue
      validFormulas++
      if (score > bestScore) {
        bestScore = score
        bestTokens = tokens
      }
    }
  }

  return { bestTokens, bestScore: Number.isFinite(bestScore) ? bestScore : -Infinity, validFormulas }
}

/** Human-readable rendering of a token sequence. */
export function formatFormula(tokens: Token[], library: FactorBundle[]): string {
  const names: string[] = []
  const render = (t: Token): string => {
    if (!isOpToken(t)) return library[t]?.name ?? `f${t}`
    const op = OPS[-t - 1]
    const args: string[] = []
    for (let i = 0; i < OP_ARITY[op]; i++) args.push(names.pop() ?? "?")
    return `${op}(${[...args].reverse().join(",")})`
  }
  for (const t of tokens) {
    if (!isOpToken(t)) {
      names.push(render(t))
    } else {
      const rendered = render(t)
      names.push(rendered)
    }
  }
  return names[names.length - 1] ?? "(empty)"
}
