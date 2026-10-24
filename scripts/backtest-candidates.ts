/**
 * Candidate strategies, evaluated with the same cost model as the shipped one
 * (backtest.ts): taker fee both sides, slippage both sides, hourly funding, and
 * the same position sizing / max positions / daily breakers.
 *
 * The acceptance bar is deliberately strict: a candidate has to be positive in
 * BOTH time windows (not just the full sample) before it is worth shipping.
 *
 * Run: npx tsx scripts/backtest-candidates.ts
 *   BT_STRATEGY=trend BT_DAYS=60 BT_OFFSET_DAYS=0
 */
import fs from "node:fs"
import { HyperliquidClient, type Candle } from "../lib/trading/hyperliquid"
import { DEFAULT_RISK, dailyRisk, positionNotional, slippedPrice, type RiskConfig } from "../lib/trading/risk"

const STRATEGY = (process.env.BT_STRATEGY || "trend") as "trend" | "long-trend" | "carry"
const DAYS = Number(process.env.BT_DAYS || 60)
const OFFSET = Number(process.env.BT_OFFSET_DAYS || 0)
const COINS = (process.env.BT_COINS || "BTC,ETH,SOL,XRP,DOGE,ARB,AVAX,LINK,SUI,HYPE,NEAR,LTC").split(",")
const START_EQUITY = Number(process.env.BT_EQUITY || 1000)
const RISK: RiskConfig = process.env.BT_RISK_JSON ? { ...DEFAULT_RISK, ...JSON.parse(process.env.BT_RISK_JSON) } : DEFAULT_RISK
const HOUR = 3_600_000
const INFO_URL = "https://api.hyperliquid.xyz/info"

const FAST = Number(process.env.BT_FAST || 50)
const SLOW = Number(process.env.BT_SLOW || 200)
const ATR_MULT = Number(process.env.BT_ATR_MULT || 3)
const CARRY_ENTER = Number(process.env.BT_CARRY_ENTER || 0.00003)
const CARRY_EXIT = Number(process.env.BT_CARRY_EXIT || 0.00001)
const CARRY_MAX_HOURS = Number(process.env.BT_CARRY_MAX_HOURS || 168)

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

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const out: number[] = []
  let prev = values[0] ?? 0
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k)
    out.push(prev)
  }
  return out
}

function atr(candles: Candle[], period: number): number[] {
  const out: number[] = []
  let prev = 0
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const tr = i === 0 ? c.h - c.l : Math.max(c.h - c.l, Math.abs(c.h - candles[i - 1].c), Math.abs(c.l - candles[i - 1].c))
    prev = i === 0 ? tr : (prev * (period - 1) + tr) / period
    out.push(prev)
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
  best: number
}

interface Trade {
  symbol: string
  side: "long" | "short"
  pnl: number
  reason: string
  hours: number
}

async function fetchCandles(client: HyperliquidClient, coin: string, days: number): Promise<Candle[]> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candles = await client.candles(coin, "1h", days).catch(() => [])
    if (candles.length >= 250) return candles
    await new Promise((r) => setTimeout(r, 700 * (attempt + 1)))
  }
  return []
}

async function main() {
  const client = new HyperliquidClient()
  const lookback = DAYS + OFFSET
  const candlesByCoin = new Map<string, Candle[]>()
  const fundingByCoin = new Map<string, Map<number, number>>()
  const emaFast = new Map<string, number[]>()
  const emaSlow = new Map<string, number[]>()
  const atrArr = new Map<string, number[]>()

  for (const coin of COINS) {
    const all = await fetchCandles(client, coin, lookback)
    const cut = all.length - OFFSET * 24
    const candles = cut > 0 ? all.slice(0, cut) : []
    if (candles.length < SLOW + 50) {
      throw new Error(`${coin}: only ${candles.length} candles after retries - aborting so the universe stays comparable`)
    }
    candlesByCoin.set(coin, candles)
    const funding = await fundingHistory(coin, candles[0].t)
    fundingByCoin.set(coin, new Map(funding.map((f) => [Math.floor(f.t / HOUR) * HOUR, f.rate])))
    const closes = candles.map((c) => c.c)
    emaFast.set(coin, ema(closes, FAST))
    emaSlow.set(coin, ema(closes, SLOW))
    atrArr.set(coin, atr(candles, 24))
    console.log(`  ${coin}: ${candles.length} candles, ${funding.length} funding points`)
  }
  if (!candlesByCoin.size) throw new Error("no data")

  const barIndex = new Map<string, Map<number, number>>()
  for (const [coin, candles] of candlesByCoin) barIndex.set(coin, new Map(candles.map((c, i) => [c.t, i])))
  const timeline = [...new Set([...candlesByCoin.values()].flatMap((cs) => cs.map((c) => c.t)))].sort((a, b) => a - b)

  let cash = START_EQUITY
  const positions: Position[] = []
  const trades: Trade[] = []
  let feesPaid = 0
  let dayKey = Math.floor(timeline[0] / 86_400_000)
  let dayStartEquity = START_EQUITY
  const curve: number[] = []

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
    trades.push({
      symbol: p.symbol,
      side: p.side,
      pnl: Number((gross - exitFee - p.entryFee + p.funding).toFixed(4)),
      reason,
      hours: Math.round((t - p.openedAt) / HOUR),
    })
  }

  for (const t of timeline) {
    const bars = new Map<string, Candle>()
    for (const [coin, byT] of barIndex) {
      const i = byT.get(t)
      if (i !== undefined) bars.set(coin, candlesByCoin.get(coin)![i])
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

    for (const p of [...positions]) {
      const bar = bars.get(p.symbol)
      const idx = barIndex.get(p.symbol)?.get(t)
      if (!bar || idx === undefined) continue
      const dir = p.side === "long" ? 1 : -1
      const a = atrArr.get(p.symbol)![idx]
      const fast = emaFast.get(p.symbol)![idx]
      const slow = emaSlow.get(p.symbol)![idx]
      const exitSide = dir === 1 ? "short" : "long"

      if (STRATEGY === "carry") {
        const rate = fundingByCoin.get(p.symbol)?.get(t) ?? 0
        const earning = dir === 1 ? rate < -CARRY_EXIT : rate > CARRY_EXIT
        const tooOld = t - p.openedAt > CARRY_MAX_HOURS * HOUR
        const stopPrice = p.entry * (1 - dir * 0.08)
        const stopHit = dir === 1 ? bar.l <= stopPrice : bar.h >= stopPrice
        if (stopHit) closePosition(p, slippedPrice(stopPrice, exitSide, RISK), "safety stop", t)
        else if (!earning || tooOld) closePosition(p, slippedPrice(bar.c, exitSide, RISK), tooOld ? "max hold" : "funding normalized", t)
        continue
      }

      // trend / long-trend: ATR trailing stop, then the EMA cross against us
      p.best = dir === 1 ? Math.max(p.best, bar.c) : Math.min(p.best, bar.c)
      const trail = dir === 1 ? p.best - ATR_MULT * a : p.best + ATR_MULT * a
      const trailHit = dir === 1 ? bar.l <= trail : bar.h >= trail
      const crossed = dir === 1 ? fast < slow : fast > slow
      if (trailHit) closePosition(p, slippedPrice(trail, exitSide, RISK), "trailing stop", t)
      else if (crossed) closePosition(p, slippedPrice(bar.c, exitSide, RISK), "trend flipped", t)
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
      const candidates: Array<{ coin: string; side: "long" | "short" }> = []
      for (const coin of bars.keys()) {
        if (positions.some((p) => p.symbol === coin)) continue
        const idx = barIndex.get(coin)!.get(t)!
        if (idx < SLOW + 1) continue
        const fast = emaFast.get(coin)![idx]
        const slow = emaSlow.get(coin)![idx]
        const prevFast = emaFast.get(coin)![idx - 1]
        const prevSlow = emaSlow.get(coin)![idx - 1]
        const c = candlesByCoin.get(coin)![idx].c

        if (STRATEGY === "carry") {
          const rate = fundingByCoin.get(coin)?.get(t) ?? 0
          if (rate > CARRY_ENTER) candidates.push({ coin, side: "short" })
          else if (rate < -CARRY_ENTER) candidates.push({ coin, side: "long" })
          continue
        }

        const crossedUp = prevFast <= prevSlow && fast > slow
        const crossedDown = prevFast >= prevSlow && fast < slow
        const aboveSlow = c > slow
        const belowSlow = c < slow
        if (crossedUp && aboveSlow) candidates.push({ coin, side: "long" })
        else if (STRATEGY !== "long-trend" && crossedDown && belowSlow) candidates.push({ coin, side: "short" })
      }

      // rank by trend strength: distance of price from the slow EMA in ATRs
      candidates.sort((a, b) => {
        const ia = barIndex.get(a.coin)!.get(t)!
        const ib = barIndex.get(b.coin)!.get(t)!
        const sa = Math.abs(candlesByCoin.get(a.coin)![ia].c - emaSlow.get(a.coin)![ia]) / (atrArr.get(a.coin)![ia] || 1)
        const sb = Math.abs(candlesByCoin.get(b.coin)![ib].c - emaSlow.get(b.coin)![ib]) / (atrArr.get(b.coin)![ib] || 1)
        return sb - sa
      })

      for (const cand of candidates) {
        if (positions.length >= RISK.maxPositions) break
        const bar = bars.get(cand.coin)
        if (!bar) continue
        const fill = slippedPrice(bar.c, cand.side, RISK)
        const notional = positionNotional(equityOf(closePrices), RISK)
        const allocated = notional / RISK.leverage
        const entryFee = notional * RISK.feeRate
        if (cash < allocated + entryFee + 1) break
        cash -= allocated + entryFee
        feesPaid += entryFee
        positions.push({
          symbol: cand.coin,
          side: cand.side,
          size: notional / fill,
          entry: fill,
          allocated,
          entryFee,
          openedAt: t,
          funding: 0,
          best: fill,
        })
      }
    }

    curve.push(equityOf(closePrices))
  }

  for (const p of [...positions]) {
    const candles = candlesByCoin.get(p.symbol)!
    closePosition(p, candles[candles.length - 1].c, "still open at end", candles[candles.length - 1].t)
  }

  const finalEquity = cash
  let peak = curve[0] ?? START_EQUITY
  let maxDD = 0
  for (const e of curve) {
    peak = Math.max(peak, e)
    maxDD = Math.max(maxDD, (peak - e) / peak)
  }
  const rets: number[] = []
  for (let i = 1; i < curve.length; i++) if (curve[i - 1] > 0) rets.push(curve[i] / curve[i - 1] - 1)
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1)
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1))
  const sharpe = sd > 0 ? (mean / sd) * Math.sqrt(24 * 365) : 0
  const wins = trades.filter((x) => x.pnl > 0)
  const losses = trades.filter((x) => x.pnl <= 0)
  const grossWin = wins.reduce((a, x) => a + x.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((a, x) => a + x.pnl, 0))

  const btc = candlesByCoin.get("BTC")
  const result = {
    strategy: STRATEGY,
    window: OFFSET === 0 ? `last ${DAYS}d` : `${OFFSET}-${OFFSET + DAYS}d ago`,
    coins: candlesByCoin.size,
    returnPct: Number((((finalEquity - START_EQUITY) / START_EQUITY) * 100).toFixed(2)),
    maxDrawdownPct: Number((maxDD * 100).toFixed(2)),
    sharpeAnnualized: Number(sharpe.toFixed(2)),
    trades: trades.length,
    winRatePct: trades.length ? Number(((wins.length / trades.length) * 100).toFixed(1)) : 0,
    profitFactor: grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : null,
    expectancyPerTrade: Number((trades.length ? trades.reduce((a, x) => a + x.pnl, 0) / trades.length : 0).toFixed(3)),
    feesPaid: Number(feesPaid.toFixed(2)),
    avgHoldHours: trades.length ? Number((trades.reduce((a, x) => a + x.hours, 0) / trades.length).toFixed(1)) : 0,
    btcReturnPct: btc ? Number((((btc[btc.length - 1].c - btc[0].c) / btc[0].c) * 100).toFixed(2)) : null,
  }

  console.log(`RESULT ${JSON.stringify(result)}`)
  fs.mkdirSync("docs/trading", { recursive: true })
  fs.writeFileSync(`docs/trading/candidate-${STRATEGY}-${OFFSET}-${DAYS}d.json`, JSON.stringify({ ranAt: new Date().toISOString(), risk: RISK, result, trades }, null, 2))
}

main().catch((e) => {
  console.error("FAILED", e instanceof Error ? e.stack : e)
  process.exit(1)
})
