/**
 * The AI trading agent — scan, signal, risk, execute (paper), report.
 *
 * One tick:
 *   daily rollover → fetch market data → mark-to-market open positions
 *   → apply exits (TP/SL/signal fade/daily kill) → compute signals on the
 *   top-by-volume universe → open new positions within risk limits
 *   → record equity + activity → persist.
 *
 * Fills are SIMULATED at real mark prices with fees + slippage applied.
 * No real funds are ever at risk in paper mode.
 */

import { HyperliquidClient, type AssetCtx } from "./hyperliquid"
import { combineSignal, momentumZ, describeSignal, type Signal } from "./strategies"
import {
  dailyRisk,
  positionNotional,
  slippedPrice,
  passesUniverseFilters,
  DEFAULT_RISK,
  type RiskConfig,
} from "./risk"
import { getStore, type TradingStore } from "./store"
import type { TradingState, Position, ActivityItem, AgentStatus } from "./types"

const TICK_INTERVAL_MS = 15_000
const SIGNAL_UNIVERSE_SIZE = 12
const CANDLE_INTERVAL = "1h" as const
const CANDLE_LOOKBACK_DAYS = 5
const EQUITY_POINT_MIN_GAP_MS = 2 * 60_000
const DATA_ERROR_NOTICE_GAP_MS = 5 * 60_000

export class TradingAgent {
  private client = new HyperliquidClient()
  private store: TradingStore
  private risk: RiskConfig
  private ticking: Promise<void> | null = null

  constructor(store: TradingStore = getStore(), risk: RiskConfig = DEFAULT_RISK) {
    this.store = store
    this.risk = risk
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Kick a tick if the agent is running and the last one is stale.
   *
   * Never blocks the caller for long: if the tick is slow (slow upstream
   * market data), the current state is returned after a short grace period
   * instead of queueing requests behind the running tick.
   */
  async maybeTick(): Promise<TradingState> {
    const s = this.store.get()
    if (s.agent.status !== "running") return s
    if (Date.now() - s.lastTickAt < TICK_INTERVAL_MS) return s
    if (!this.ticking) {
      this.ticking = this.tick()
        .catch((e) => {
          console.error("[trading-agent] tick failed:", e)
        })
        .finally(() => {
          this.ticking = null
        })
    }
    // Wait up to 8s for fresh data, then fall back to the current state.
    await Promise.race([this.ticking, new Promise((resolve) => setTimeout(resolve, 8_000))])
    return this.store.get()
  }

  async tick(): Promise<void> {
    // 1. Daily rollover — reset the daily loss watermark
    const today = new Date().toISOString().slice(0, 10)
    this.store.mutate((s) => {
      if (s.todayDate !== today) {
        s.todayDate = today
        s.todayStartEquity = this.equityOf(s)
        s.equity.push({ t: today, v: Number(s.todayStartEquity.toFixed(2)) })
      }
    })

    // 2. Market data (offline-safe, cached by the client)
    let ctxByCoin = new Map<string, AssetCtx>()
    try {
      const { universe: meta, ctxs } = await this.client.metaAndAssetCtxs()
      meta.forEach((u, i) => {
        const ctx = ctxs[i]
        if (ctx) ctxByCoin.set(u.name, ctx)
      })
    } catch {
      this.noteDataError()
      return
    }

    // 3. Mark-to-market open positions
    this.markPositions(ctxByCoin)

    // 4. Exits: TP / SL / signal fade / daily kill
    const risk = dailyRisk(this.state().todayStartEquity, this.equityOf(this.state()), this.risk)
    let traded = await this.applyExits(ctxByCoin, risk.killAll)

    // 5. Entries
    if (!risk.stopNewEntries && !risk.killAll) {
      traded = (await this.scanAndEnter(ctxByCoin)) || traded
    } else if (risk.stopNewEntries) {
      this.noteGuard(`Risk engine: daily loss at ${(risk.todayLossPct * 100).toFixed(1)}% — no new entries today.`)
    }

    // 6. Persist + throttle equity points
    const now = Date.now()
    this.store.mutate((s) => {
      if (traded || now - s.lastPointAt > EQUITY_POINT_MIN_GAP_MS) {
        const eq = Number(this.equityOf(s).toFixed(2))
        if (s.equity[s.equity.length - 1]?.v !== eq) {
          s.equity.push({ t: new Date(now).toISOString().slice(0, 10), v: eq })
        }
        s.lastPointAt = now
      }
      s.agent.lastScanAt = new Date(now).toISOString()
      s.lastTickAt = now
      this.refreshAccount(s)
    })
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  pause(): void {
    this.setStatus("paused")
    this.log("info", "AI paused — no new trades will be opened. Existing positions are still managed.")
  }

  resume(): void {
    this.setStatus("running")
    this.log("info", "AI resumed — scanning markets again.")
  }

  stop(): void {
    this.setStatus("stopped")
    this.log("info", "Emergency stop engaged — trading halted.")
  }

  reset(): void {
    this.store.reset()
  }

  toOverview() {
    const s = this.state()
    return {
      mode: s.mode,
      agent: {
        status: s.agent.status,
        strategy: s.agent.strategy,
        lastScanAt: s.agent.lastScanAt,
        marketsScanned: s.agent.marketsScanned,
        confidenceHighSignals: s.agent.confidenceHighSignals,
      },
      account: { ...s.account },
      equity: s.equity,
      positions: s.positions.map((p) => ({
        symbol: p.symbol,
        side: p.side,
        size: p.size,
        entry: p.entry,
        mark: p.mark,
        pnl: p.pnl,
        pnlPct: p.pnlPct,
        leverage: p.leverage,
        reason: p.reason,
      })),
      activity: s.activity,
    }
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private state(): TradingState {
    return this.store.get()
  }

  private setStatus(status: AgentStatus): void {
    this.store.mutate((s) => {
      s.agent.status = status
    })
  }

  private equityOf(s: TradingState): number {
    return s.account.mainWallet + s.account.tradingWallet
  }

  private refreshAccount(s: TradingState): void {
    let tradingWallet = s.cash
    for (const p of s.positions) tradingWallet += p.allocated + p.pnl
    s.account.tradingWallet = Number(tradingWallet.toFixed(2))
    s.account.totalEquity = Number((s.account.mainWallet + s.account.tradingWallet).toFixed(2))
    s.account.maxLoss = s.account.tradingWallet
    const todayPnl = s.account.totalEquity - s.todayStartEquity
    s.account.todayPnl = Number(todayPnl.toFixed(2))
    s.account.todayPnlPct = s.todayStartEquity > 0 ? Number(((todayPnl / s.todayStartEquity) * 100).toFixed(2)) : 0
    s.account.allTimePnl = Number((s.account.totalEquity - s.initialEquity).toFixed(2))
  }

  private log(type: ActivityItem["type"], text: string, pnl: number | null = null): void {
    this.store.mutate((s) => {
      s.activity.unshift({ time: new Date().toISOString(), type, text, pnl })
      if (s.activity.length > 200) s.activity.length = 200
    })
  }

  private noteGuard(text: string): void {
    const last = this.state().activity[0]
    if (last?.type === "guard" && last.text === text) return // don't spam identical guards
    this.log("guard", text)
  }

  private noteDataError(): void {
    const now = Date.now()
    if (now - this.state().lastDataErrorAt > DATA_ERROR_NOTICE_GAP_MS) {
      this.store.mutate((s) => {
        s.lastDataErrorAt = now
      })
      this.log("error", "Market data temporarily unavailable — will retry on the next scan.")
    }
  }

  private markPositions(ctxByCoin: Map<string, AssetCtx>): void {
    this.store.mutate((s) => {
      for (const p of s.positions) {
        const ctx = ctxByCoin.get(p.symbol)
        if (!ctx) continue
        const mark = parseFloat(ctx.markPx)
        if (!Number.isFinite(mark) || mark <= 0) continue
        p.mark = mark
        const dir = p.side === "long" ? 1 : -1
        p.pnl = Number((p.size * (mark - p.entry) * dir).toFixed(2))
        p.pnlPct = p.allocated > 0 ? Number(((p.pnl / p.allocated) * 100).toFixed(2)) : 0
      }
      this.refreshAccount(s)
    })
  }

  private async applyExits(ctxByCoin: Map<string, AssetCtx>, killAll: boolean): Promise<boolean> {
    let traded = false
    const open = [...this.state().positions]
    for (const p of open) {
      let reason: string | null = null

      if (killAll) {
        reason = "daily loss circuit breaker"
      } else if (p.pnlPct >= this.risk.takeProfitPct * 100) {
        reason = `take-profit +${this.risk.takeProfitPct * 100}% hit`
      } else if (p.pnlPct <= -this.risk.stopLossPct * 100) {
        reason = `stop-loss -${this.risk.stopLossPct * 100}% hit`
      } else {
        // Signal fade: exit when the combined signal turns against the position
        const candles = await this.client
          .candles(p.symbol, CANDLE_INTERVAL, CANDLE_LOOKBACK_DAYS)
          .catch(() => [])
        const closes = candles.map((c) => c.c)
        const z = momentumZ(closes)
        const ctx = ctxByCoin.get(p.symbol)
        const funding = ctx ? parseFloat(ctx.funding) || 0 : 0
        const { score } = combineSignal(z, funding)
        const against = p.side === "long" ? score <= -this.risk.exitFadeThreshold : score >= this.risk.exitFadeThreshold
        if (against) {
          reason = `signal faded (score=${score.toFixed(2)})`
        }
      }

      if (reason) {
        const realized = this.closePosition(p)
        if (realized !== null) {
          traded = true
          this.log(
            "close",
            `Closed ${p.symbol} ${p.side} ${realized >= 0 ? "+" : "-"}$${Math.abs(realized).toFixed(2)} (${reason})`,
            Number(realized.toFixed(2)),
          )
        }
      }
    }
    return traded
  }

  /** Close a position at its current mark. Returns realized pnl or null if not found. */
  private closePosition(p: Position): number | null {
    let realized: number | null = null
    this.store.mutate((s) => {
      const idx = s.positions.findIndex((x) => x.symbol === p.symbol && x.side === p.side)
      if (idx === -1) return
      const pos = s.positions[idx]
      const exitFee = pos.size * pos.mark * this.risk.feeRate
      realized = Number((pos.allocated + pos.pnl - exitFee).toFixed(2))
      s.cash = Number((s.cash + realized).toFixed(2))
      s.positions.splice(idx, 1)
      this.refreshAccount(s)
    })
    return realized
  }

  private async scanAndEnter(ctxByCoin: Map<string, AssetCtx>): Promise<boolean> {
    let traded = false

    // Rank top-by-volume universe
    const ranked = [...ctxByCoin.entries()]
      .map(([coin, ctx]) => ({ coin, ctx, volumeUsd: parseFloat(ctx.dayNtlVlm) || 0 }))
      .sort((a, b) => b.volumeUsd - a.volumeUsd)
      .slice(0, SIGNAL_UNIVERSE_SIZE)

    // Compute signals in parallel (candle cache keeps this cheap after warm-up)
    const signals = (
      await Promise.all(
        ranked.map(async ({ coin, ctx, volumeUsd }) => {
          if (!passesUniverseFilters(volumeUsd, parseFloat(ctx.markPx), this.risk)) return null
          const candles = await this.client
            .candles(coin, CANDLE_INTERVAL, CANDLE_LOOKBACK_DAYS)
            .catch(() => [])
          if (candles.length < 20) return null
          const z = momentumZ(candles.map((c) => c.c))
          const funding = parseFloat(ctx.funding) || 0
          const markPx = parseFloat(ctx.markPx)
          const { score, side } = combineSignal(z, funding)
          if (Math.abs(score) < this.risk.entryThreshold) return null
          const sig: Signal = {
            coin,
            side,
            score,
            momentumZ: z,
            funding,
            volumeUsd,
            markPx,
            reason: describeSignal({ momentumZ: z, funding, side }),
          }
          return sig
        }),
      )
    ).filter((x): x is Signal => x !== null)

    signals.sort((a, b) => Math.abs(b.score) - Math.abs(a.score))

    const eligible = signals.filter((sig) => !this.state().positions.some((p) => p.symbol === sig.coin))

    this.store.mutate((st) => {
      st.agent.marketsScanned = ranked.length
      st.agent.confidenceHighSignals = eligible.length
    })

    if (signals.length > 0) {
      this.log(
        "scan",
        `Scanned ${ranked.length} markets · ${eligible.length} signal${eligible.length === 1 ? "" : "s"} above threshold`,
      )
    }

    // Open entries within limits
    for (const sig of eligible) {
      const st = this.state()
      if (st.positions.length >= this.risk.maxPositions) break

      const risk = dailyRisk(st.todayStartEquity, this.equityOf(st), this.risk)
      if (risk.stopNewEntries) {
        this.noteGuard(`Risk engine: daily loss at ${(risk.todayLossPct * 100).toFixed(1)}% — no new entries today.`)
        break
      }

      const equity = st.account.tradingWallet
      const notional = positionNotional(equity, this.risk)
      const entryPrice = slippedPrice(sig.markPx, sig.side, this.risk)
      const size = notional / entryPrice
      const allocated = notional / this.risk.leverage
      const fee = notional * this.risk.feeRate

      if (st.cash < allocated + fee + 1) {
        this.noteGuard(`Insufficient free funds ($${st.cash.toFixed(2)}) — skipping new entries.`)
        break
      }

      this.store.mutate((x) => {
        x.cash = Number((x.cash - allocated - fee).toFixed(2))
        x.positions.push({
          symbol: sig.coin,
          side: sig.side,
          size: Number(size.toFixed(6)),
          entry: Number(entryPrice.toFixed(6)),
          mark: Number(sig.markPx.toFixed(6)),
          allocated: Number(allocated.toFixed(2)),
          pnl: 0,
          pnlPct: 0,
          leverage: this.risk.leverage,
          reason: sig.reason,
          openedAt: new Date().toISOString(),
        })
        this.refreshAccount(x)
      })

      this.log("open", `Opened ${sig.coin} ${sig.side} at $${entryPrice.toFixed(2)} (${sig.reason})`)
      traded = true
    }

    return traded
  }
}

let singleton: TradingAgent | null = null

export function getAgent(): TradingAgent {
  if (!singleton) singleton = new TradingAgent()
  return singleton
}
