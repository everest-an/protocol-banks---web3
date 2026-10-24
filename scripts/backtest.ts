/**
 * Walk-forward evaluation of the strategy the agent actually ships, on raw
 * Hyperliquid hourly data. No parameter fitting: the question is whether the
 * shipped settings survive costs on data they were not tuned on.
 *
 * Faithful to lib/trading:
 *  - signals: momentumZ(24) + funding, 60/40 mix (strategies.ts)
 *  - entries: |score| >= entryThreshold, ranked by |score|, max maxPositions
 *  - exits: TP/SL act on PnL vs ALLOCATED MARGIN (pnlPct), so 2.5% at 2x is a
 *    1.25% price move; plus signal fade and the daily breakers
 *  - costs: taker fee on both sides, slippage on both sides, hourly funding
 *
 * Run: npx tsx scripts/backtest.ts
 */
import fs from "node:fs"
import { HyperliquidClient, type Candle } from "../lib/trading/hyperliquid"
import { momentumZ, combineSignal } from "../lib/trading/strategies"
import { DEFAULT_RISK, dailyRisk, positionNotional, slippedPrice, type RiskConfig } from "../lib/trading/risk"

const DAYS = Number(process.env.BT_DAYS || 120)
const COINS = (process.env.BT_COINS || "BTC,ETH,SOL,XRP,DOGE,ARB,AVAX,LINK,SUI,HYPE,NEAR,LTC").split(",")
const START_EQUITY = Number(process.env.BT_EQUITY || 1000)
const RISK: RiskConfig = process.env.BT_RISK_JSON ? { ...DEFAULT_RISK, ...JSON.parse(process.env.BT_RISK_JSON) } : DEFAULT_RISK
const HOUR = 3_600_000
const INFO_URL = "https://api.hyperliquid.xyz/info"
const Z_WINDOW = 30
/** Both bands inside one hourly bar: pessimistic assumes the stop filled first
 *  (the default), optimistic assumes the target did. The truth needs 1m data;
 *  running both bounds shows whether the conclusion depends on that choice. */
const OPTIMISTIC = process.env.BT_OPTIMISTIC === "1"
const QUIET = process.env.BT_QUIET === "1"
const SIDE = process.env.BT_SIDE === "long" || process.env.BT_SIDE === "short" ? process.env.BT_SIDE : null

interface FundingPoint {
  t: number
  rate: number
}

async function fundingHistory(coin: string, startTime: number): Promise<FundingPoint[]> {
  const out: FundingPoint[] = []
  let cursor = startTime
  for (let page = 0; page < 20; page++) {
    try {
      const res = await fetch(INFO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "fundingHistory", coin, startTime: cursor }),
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) break
      const rows = (await res.json()) as Array<{ time: number; fundingRate: string }>
      if (!rows.length) break
      for (const r of rows) out.push({ t: Number(r.time), rate: parseFloat(r.fundingRate) || 0 })
      if (rows.length < 500) break
      cursor = Number(rows[rows.length - 1].time) + 1
    } catch {
      break
    }
  }
  return out
}

interface Position {
  symbol: string
  side: "long" | "short"
  size: number
  entry: number
  allocated: number
  entryFee: number
  openedAt: number
  funding: number
}

interface Trade {
  symbol: string
  side: "long" | "short"
  entry: number
  exit: number
  pnl: number
  margin: number
  reason: string
  hours: number
}

async function main() {
  const client = new HyperliquidClient()
  const candlesByCoin = new Map<string, Candle[]>()
  const fundingByCoin = new Map<string, Map<number, number>>()

  console.log(`loading ${DAYS}d of 1h candles for ${COINS.length} coins...`)
  for (const coin of COINS) {
    const candles = await client.candles(coin, "1h", DAYS).catch(() => [])
    if (candles.length < 200) {
      console.log(`  ${coin}: ${candles.length} candles - skipped`)
      continue
    }
    candlesByCoin.set(coin, candles)
    const funding = await fundingHistory(coin, candles[0].t)
    fundingByCoin.set(coin, new Map(funding.map((f) => [Math.floor(f.t / HOUR) * HOUR, f.rate])))
    console.log(`  ${coin}: ${candles.length} candles, ${funding.length} funding points`)
  }
  if (!candlesByCoin.size) throw new Error("no data")

  const barIndex = new Map<string, Map<number, number>>()
  for (const [coin, candles] of candlesByCoin) {
    barIndex.set(coin, new Map(candles.map((c, i) => [c.t, i])))
  }

  const timeline = [...new Set([...candlesByCoin.values()].flatMap((cs) => cs.map((c) => c.t)))].sort((a, b) => a - b)

  let cash = START_EQUITY
  const positions: Position[] = []
  const trades: Trade[] = []
  let feesPaid = 0
  let fundingNet = 0
  let dayKey = Math.floor(timeline[0] / 86_400_000)
  let dayStartEquity = START_EQUITY
  const curve: Array<{ t: number; equity: number }> = []

  const equityOf = (prices: Map<string, number>): number => {
    let eq = cash
    for (const p of positions) {
      const mark = prices.get(p.symbol) ?? p.entry
      const dir = p.side === "long" ? 1 : -1
      eq += p.allocated + p.size * (mark - p.entry) * dir + p.funding
    }
    return eq
  }

  const closePosition = (p: Position, fill: number, reason: string, t: number): void => {
    const at = positions.indexOf(p)
    if (at < 0) return
    positions.splice(at, 1)
    const dir = p.side === "long" ? 1 : -1
    const gross = p.size * (fill - p.entry) * dir
    const exitFee = p.size * fill * RISK.feeRate
    cash += p.allocated + gross - exitFee + p.funding
    feesPaid += exitFee
    fundingNet += p.funding
    trades.push({
      symbol: p.symbol,
      side: p.side,
      entry: p.entry,
      exit: fill,
      pnl: Number((gross - exitFee - p.entryFee + p.funding).toFixed(4)),
      margin: p.allocated,
      reason,
      hours: Math.round((t - p.openedAt) / HOUR),
    })
  }

  for (const t of timeline) {
    const bars = new Map<string, Candle>()
    for (const [coin, byT] of barIndex) {
      const i = byT.get(t)
      if (i === undefined) continue
      bars.set(coin, candlesByCoin.get(coin)![i])
    }
    const closePrices = new Map<string, number>()
    for (const [coin, bar] of bars) closePrices.set(coin, bar.c)

    const k = Math.floor(t / 86_400_000)
    if (k !== dayKey) {
      dayKey = k
      dayStartEquity = equityOf(closePrices)
    }

    for (const p of positions) {
      const rate = fundingByCoin.get(p.symbol)?.get(t) ?? 0
      const dir = p.side === "long" ? 1 : -1
      p.funding += -dir * rate * (p.size * p.entry)
    }

    const tpMove = RISK.takeProfitPct / RISK.leverage
    const slMove = RISK.stopLossPct / RISK.leverage
    for (const p of [...positions]) {
      const bar = bars.get(p.symbol)
      if (!bar) continue
      const dir = p.side === "long" ? 1 : -1
      const tpPrice = p.entry * (1 + dir * tpMove)
      const slPrice = p.entry * (1 - dir * slMove)
      const hitSL = dir === 1 ? bar.l <= slPrice : bar.h >= slPrice
      const hitTP = dir === 1 ? bar.h >= tpPrice : bar.l <= tpPrice
      const exitSide = dir === 1 ? "short" : "long"
      if (OPTIMISTIC && hitTP) {
        closePosition(p, slippedPrice(tpPrice, exitSide, RISK), "take-profit", t)
        continue
      }
      if (hitSL) {
        closePosition(p, slippedPrice(slPrice, exitSide, RISK), "stop-loss", t)
        continue
      }
      if (!OPTIMISTIC && hitTP) {
        closePosition(p, slippedPrice(tpPrice, exitSide, RISK), "take-profit", t)
        continue
      }
      const candles = candlesByCoin.get(p.symbol)!
      const idx = barIndex.get(p.symbol)!.get(t)!
      if (idx < Z_WINDOW - 1) continue
      const window = candles.slice(idx - Z_WINDOW + 1, idx + 1).map((c) => c.c)
      const funding = fundingByCoin.get(p.symbol)?.get(t) ?? 0
      const { score } = combineSignal(momentumZ(window), funding)
      const against = p.side === "long" ? score <= -RISK.exitFadeThreshold : score >= RISK.exitFadeThreshold
      if (against) closePosition(p, slippedPrice(bar.c, exitSide, RISK), "signal faded", t)
    }

    const equityNow = equityOf(closePrices)
    const risk = dailyRisk(dayStartEquity, equityNow, RISK)
    if (risk.killAll) {
      for (const p of [...positions]) {
        const bar = bars.get(p.symbol)
        if (!bar) continue
        closePosition(p, slippedPrice(bar.c, p.side === "long" ? "short" : "long", RISK), "daily kill", t)
      }
    }

    if (!risk.killAll && !risk.stopNewEntries && positions.length < RISK.maxPositions) {
      const candidates: Array<{ coin: string; side: "long" | "short"; score: number }> = []
      for (const coin of bars.keys()) {
        const candles = candlesByCoin.get(coin)!
        const idx = barIndex.get(coin)!.get(t)!
        if (idx < Z_WINDOW - 1) continue
        const window = candles.slice(idx - Z_WINDOW + 1, idx + 1).map((c) => c.c)
        const funding = fundingByCoin.get(coin)?.get(t) ?? 0
        const { score, side } = combineSignal(momentumZ(window), funding)
        if (Math.abs(score) < RISK.entryThreshold) continue
        if (SIDE && side !== SIDE) continue
        if (positions.some((p) => p.symbol === coin)) continue
        candidates.push({ coin, side, score })
      }
      candidates.sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
      for (const c of candidates) {
        if (positions.length >= RISK.maxPositions) break
        const bar = bars.get(c.coin)
        if (!bar) continue
        const fill = slippedPrice(bar.c, c.side, RISK)
        const notional = positionNotional(equityOf(closePrices), RISK)
        const allocated = notional / RISK.leverage
        const entryFee = notional * RISK.feeRate
        if (cash < allocated + entryFee + 1) break
        cash -= allocated + entryFee
        feesPaid += entryFee
        positions.push({
          symbol: c.coin,
          side: c.side,
          size: notional / fill,
          entry: fill,
          allocated,
          entryFee,
          openedAt: t,
          funding: 0,
        })
      }
    }

    curve.push({ t, equity: equityOf(closePrices) })
  }

  for (const p of [...positions]) {
    const candles = candlesByCoin.get(p.symbol)!
    closePosition(p, candles[candles.length - 1].c, "still open at end", candles[candles.length - 1].t)
  }

  const finalEquity = cash
  const eqs = curve.map((c) => c.equity)
  let peak = eqs[0] ?? START_EQUITY
  let maxDD = 0
  for (const e of eqs) {
    peak = Math.max(peak, e)
    maxDD = Math.max(maxDD, (peak - e) / peak)
  }
  const rets: number[] = []
  for (let i = 1; i < eqs.length; i++) if (eqs[i - 1] > 0) rets.push(eqs[i] / eqs[i - 1] - 1)
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1)
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1))
  const sharpe = sd > 0 ? (mean / sd) * Math.sqrt(24 * 365) : 0

  const wins = trades.filter((x) => x.pnl > 0)
  const losses = trades.filter((x) => x.pnl <= 0)
  const grossWin = wins.reduce((a, x) => a + x.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((a, x) => a + x.pnl, 0))
  const byReason = new Map<string, { n: number; pnl: number }>()
  for (const x of trades) {
    const e = byReason.get(x.reason) ?? { n: 0, pnl: 0 }
    e.n++
    e.pnl += x.pnl
    byReason.set(x.reason, e)
  }

  const btc = candlesByCoin.get("BTC")
  const benchmark = btc?.length
    ? {
        symbol: "BTC",
        returnPct: Number((((btc[btc.length - 1].c - btc[0].c) / btc[0].c) * 100).toFixed(2)),
      }
    : null

  const result = {
    days: DAYS,
    coins: [...candlesByCoin.keys()],
    benchmark,
    finalEquity: Number(finalEquity.toFixed(2)),
    totalReturnPct: Number((((finalEquity - START_EQUITY) / START_EQUITY) * 100).toFixed(2)),
    maxDrawdownPct: Number((maxDD * 100).toFixed(2)),
    sharpeAnnualized: Number(sharpe.toFixed(2)),
    trades: trades.length,
    winRatePct: trades.length ? Number(((wins.length / trades.length) * 100).toFixed(1)) : 0,
    avgWin: Number((wins.length ? grossWin / wins.length : 0).toFixed(2)),
    avgLoss: Number((losses.length ? -grossLoss / losses.length : 0).toFixed(2)),
    profitFactor: grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : null,
    expectancyPerTrade: Number((trades.length ? trades.reduce((a, x) => a + x.pnl, 0) / trades.length : 0).toFixed(3)),
    feesPaid: Number(feesPaid.toFixed(2)),
    fundingNet: Number(fundingNet.toFixed(2)),
    avgHoldHours: trades.length ? Number((trades.reduce((a, x) => a + x.hours, 0) / trades.length).toFixed(1)) : 0,
    byReason: Object.fromEntries([...byReason].map(([r, v]) => [r, { n: v.n, pnl: Number(v.pnl.toFixed(2)) }])),
  }

  console.log("\n=== result ===")
  if (QUIET) {
    console.log(
      `RESULT ${JSON.stringify({
        ret: result.totalReturnPct,
        dd: result.maxDrawdownPct,
        sharpe: result.sharpeAnnualized,
        trades: result.trades,
        win: result.winRatePct,
        pf: result.profitFactor,
        exp: result.expectancyPerTrade,
        fees: result.feesPaid,
        btc: benchmark?.returnPct ?? null,
        risk: { entry: RISK.entryThreshold, tp: RISK.takeProfitPct, sl: RISK.stopLossPct },
        optimistic: OPTIMISTIC,
      })}`,
    )
  } else {
    console.log(JSON.stringify(result, null, 2))
  }
  fs.mkdirSync("docs/trading", { recursive: true })
  const out = process.env.BT_OUT || `docs/trading/backtest-${DAYS}d.json`
  fs.writeFileSync(out, JSON.stringify({ ranAt: new Date().toISOString(), risk: RISK, startEquity: START_EQUITY, result, trades }, null, 2))
  console.log(`saved ${out}`)
}

main().catch((e) => {
  console.error("FAILED", e instanceof Error ? e.stack : e)
  process.exit(1)
})
