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
import { getStore, getStoreForWallet, promoteToLiveLedger, type TradingStore } from "./store"
import { persistStateToDb } from "./db-store"
import { notificationService } from "@/lib/services/notification-service"
import type { LiveOrderExecutor } from "./live-executor"
import { adviseOnSignal } from "./llm-advisor"
import type { TradingState, Position, ActivityItem, AgentStatus, PendingTrade, VerifyingOrder } from "./types"

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
  private ownerAddress: string | null
  private ticking: Promise<void> | null = null
  /** "paper" simulates fills; "live" places real orders via the executor. */
  private mode: "paper" | "live"
  /** Real-order bridge — required for live mode, ignored in paper mode. */
  private executor: LiveOrderExecutor | null

  constructor(
    store: TradingStore = getStore(),
    risk: RiskConfig = DEFAULT_RISK,
    ownerAddress: string | null = null,
    options?: { mode?: "paper" | "live"; executor?: LiveOrderExecutor },
  ) {
    this.store = store
    this.risk = risk
    // Live mode passes the account owner so trade events can trigger
    // push notifications. Paper mode has no owner — no notifications.
    this.ownerAddress = ownerAddress ? ownerAddress.toLowerCase() : null
    this.mode = options?.mode ?? "paper"
    this.executor = options?.executor ?? null
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

  /**
   * Live-only: bring the ledger in line with the exchange.
   *  - adopts positions that exist on the venue but not in the book (this is
   *    how an UNCERTAIN entry self-heals),
   *  - drops book positions the venue no longer holds,
   *  - anchors cash/equity to the venue account value (equity === account
   *    value), so reported balances can never drift for more than one tick,
   *  - resolves `verifying` items (confirmed / released after 5 minutes).
   * Network failures are ignored — the next tick retries.
   */
  private async reconcileWithVenue(): Promise<void> {
    if (this.mode !== "live" || !this.ownerAddress) return
    try {
      const { getUserState } = await import("./exchange")
      const state = await getUserState(this.ownerAddress)
      const venueValue = Number(state?.marginSummary?.accountValue ?? Number.NaN)
      if (!Number.isFinite(venueValue)) return

      const venue = new Map<string, { size: number; entry: number; side: "long" | "short" }>()
      for (const p of state?.assetPositions ?? []) {
        const szi = Number(p.position.szi)
        if (!szi || !Number.isFinite(szi)) continue
        venue.set(p.position.coin, {
          size: Math.abs(szi),
          entry: Number(p.position.entryPx ?? 0) || 0,
          side: szi > 0 ? "long" : "short",
        })
      }

      const notes: string[] = []
      this.store.mutate((s) => {
        const known = new Map(s.positions.map((p) => [p.symbol, p]))
        for (const [coin, vp] of venue) {
          const k = known.get(coin)
          if (!k) {
            const notional = positionNotional(venueValue, this.risk)
            s.positions.push({
              symbol: coin,
              side: vp.side,
              size: vp.size,
              entry: vp.entry || 0,
              mark: vp.entry || 0,
              allocated: Number((notional / this.risk.leverage).toFixed(2)),
              pnl: 0,
              pnlPct: 0,
              leverage: this.risk.leverage,
              reason: "adopted from the exchange (reconciliation)",
              openedAt: new Date().toISOString(),
            })
            notes.push(`Reconciled: adopted ${coin} ${vp.side} ${vp.size} from the exchange (untracked position - likely an UNCERTAIN order that filled).`)
          } else {
            if (Math.abs(k.size - vp.size) > 1e-9) k.size = vp.size
            if (vp.entry > 0) k.entry = vp.entry
            k.side = vp.side
          }
        }
        s.positions = s.positions.filter((p) => venue.has(p.symbol))

        // Resolve verifying items against what the venue actually shows.
        const stillVerifying: VerifyingOrder[] = []
        for (const v of s.verifying ?? []) {
          const onVenue = venue.has(v.coin)
          if (v.kind === "entry" && onVenue) {
            notes.push(`Verified: the UNCERTAIN ${v.coin} entry filled - position adopted, trading continues.`)
          } else if (v.kind === "exit" && !onVenue) {
            notes.push(`Verified: the UNCERTAIN ${v.coin} exit executed - position closed on the exchange.`)
          } else if (Date.now() - new Date(v.at).getTime() > 5 * 60_000) {
            notes.push(`Verified: the UNCERTAIN ${v.coin} ${v.kind} never reached the exchange (5 min, unchanged) - released.`)
          } else {
            stillVerifying.push(v)
          }
        }
        s.verifying = stillVerifying

        // Anchor to the venue: cash holds everything that is not margin or
        // unrealized PnL, so equityOf(s) === accountValue exactly.
        const commited = s.positions.reduce((a, p) => a + p.allocated + p.pnl, 0)
        s.cash = Number((venueValue - commited).toFixed(2))
        s.account.totalEquity = Number(venueValue.toFixed(2))
        s.account.tradingWallet = Number(venueValue.toFixed(2))
        s.account.maxLoss = Number(venueValue.toFixed(2))
      })
      for (const n of notes) this.log("info", n)
    } catch {
      /* venue unreachable - next tick retries */
    }
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

    // 1.5 Reconcile with the venue BEFORE anything else (live only). This is
    // the structural net: the position book is corrected toward the exchange
    // (adopt untracked positions, drop vanished ones) and cash/equity are
    // anchored to the account value, so no accounting drift can survive a
    // tick, and an UNCERTAIN order resolves itself here.
    await this.reconcileWithVenue()

    // 2. Market data (offline-safe, cached by the client)
    const ctxByCoin = new Map<string, AssetCtx>()
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

    // 7. Write-through to the database (per-user persistence, fire-and-forget)
    if (this.ownerAddress) {
      void persistStateToDb(this.ownerAddress, this.state()).catch(() => {})
    }
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

  /**
   * Replace the in-memory/file state with a previously persisted state
   * (e.g. loaded from the database after a serverless restart).
   */
  hydrateState(state: TradingState): void {
    this.store.replace(state)
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
      pendingTrade: s.pendingTrade ?? null,
      approvalMode: s.approvalMode ?? this.risk.approvalMode,
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

  /**
   * Fire-and-forget push notifications for trade events (live mode only).
   * Never throws into the trading loop — notification failures are logged
   * and ignored.
   */
  private notifyOwner(kind: "opened" | "closed" | "guard", detail: { symbol?: string; side?: string; price?: number; pnl?: number; reason?: string; message?: string }): void {
    if (!this.ownerAddress) return
    void (async () => {
      try {
        if (kind === "opened" && detail.symbol && detail.side) {
          await notificationService.notifyTradeOpened(this.ownerAddress!, detail.symbol, detail.side, detail.price ?? 0, detail.reason ?? "")
        } else if (kind === "closed" && detail.symbol && detail.side) {
          await notificationService.notifyTradeClosed(this.ownerAddress!, detail.symbol, detail.side, detail.pnl ?? 0, detail.reason ?? "")
        } else if (kind === "guard") {
          await notificationService.notifyTradeGuard(this.ownerAddress!, detail.message ?? "Risk guardrail triggered")
        }
      } catch (e) {
        console.error("[trading-agent] notification failed:", e)
      }
    })()
  }

  private noteGuard(text: string): void {
    // Don't spam identical guards: scan a window, not just the last entry — a
    // [scan] line lands between ticks, so the old activity[0] check never
    // matched and the funds guard notified the owner every minute.
    const recent = this.state().activity.slice(0, 10)
    if (recent.some((a) => a.type === "guard" && a.text === text)) return
    this.log("guard", text)
    this.notifyOwner("guard", { message: text })
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
        const pnl = await this.closePosition(p)
        if (pnl !== null) {
          traded = true
          this.log(
            "close",
            `Closed ${p.symbol} ${p.side} ${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)} (${reason})`,
            Number(pnl.toFixed(2)),
          )
          this.notifyOwner("closed", { symbol: p.symbol, side: p.side, pnl, reason })
        }
      }
    }
    return traded
  }

  /**
   * Close a position. Paper: simulated exit at the current mark.
   * Live: reduceOnly IOC order; realized PnL settles at the exchange fill.
   * An UNCERTAIN live close halts the agent and leaves the book untouched —
   * the position may still be open on the exchange, so we never fabricate a fill.
   */
  private async closePosition(p: Position): Promise<number | null> {
    if (this.mode === "live") {
      if (!this.executor) return null
      const result = await this.executor.placeOrder({
        coin: p.symbol,
        isBuy: p.side === "short", // closing a short buys; closing a long sells
        sizeUsd: p.size * p.mark,
        reduceOnly: true,
      })

      if (!result.ok) {
        if (!result.rejected) {
          // Same policy as entries: never halt, never retry — the venue
          // reconciliation confirms within a tick. The position stays in the
          // book until the exchange shows it gone.
          this.store.mutate((s) => {
            s.verifying = [
              ...(s.verifying ?? []).filter((v) => !(v.coin === p.symbol && v.kind === "exit")),
              { coin: p.symbol, side: p.side, kind: "exit", at: new Date().toISOString() },
            ]
          })
          const note = `Close order status UNCERTAIN for ${p.symbol} ${p.side}: ${result.reason} Verification pending — reconciliation confirms within a tick.`
          this.log("guard", note)
          this.notifyOwner("guard", { message: note })
        } else {
          this.log("guard", `Close rejected for ${p.symbol}: ${result.reason}`)
        }
        return null
      }

      let pnl: number | null = null
      this.store.mutate((s) => {
        const idx = s.positions.findIndex((x) => x.symbol === p.symbol && x.side === p.side)
        if (idx === -1) return
        const pos = s.positions[idx]
        const exitNotional = result.avgPx * result.totalSz
        const entryNotional = pos.entry * pos.size
        const gross = pos.side === "long" ? exitNotional - entryNotional : entryNotional - exitNotional
        const exitFee = exitNotional * this.risk.feeRate
        const entryFee = entryNotional * this.risk.feeRate
        // Two DIFFERENT numbers: the wallet gets the allocated margin back
        // plus the net result of the trade; the REPORTED PnL must not include
        // the margin. The old code returned `allocated + gross - exitFee` as
        // the PnL, so every close read "≈ +$10" regardless of the outcome
        // (2026-10-07: "Closed UNI short +$10.53 (stop-loss)" on a fill the
        // venue showed as -$0.23).
        const proceeds = Number((pos.allocated + gross - exitFee).toFixed(2))
        pnl = Number((gross - exitFee - entryFee).toFixed(2))
        s.cash = Number((s.cash + proceeds).toFixed(2))
        s.positions.splice(idx, 1)
        this.refreshAccount(s)
      })
      return pnl
    }

    // Paper: simulated exit at the current mark
    let pnl: number | null = null
    this.store.mutate((s) => {
      const idx = s.positions.findIndex((x) => x.symbol === p.symbol && x.side === p.side)
      if (idx === -1) return
      const pos = s.positions[idx]
      const exitFee = pos.size * pos.mark * this.risk.feeRate
      const entryFee = pos.size * pos.entry * this.risk.feeRate
      const proceeds = Number((pos.allocated + pos.pnl - exitFee).toFixed(2))
      pnl = Number((pos.pnl - exitFee - entryFee).toFixed(2))
      s.cash = Number((s.cash + proceeds).toFixed(2))
      s.positions.splice(idx, 1)
      this.refreshAccount(s)
    })
    return pnl
  }

  private async scanAndEnter(ctxByCoin: Map<string, AssetCtx>): Promise<boolean> {
    if ((this.state().verifying ?? []).length) {
      this.noteGuard("Waiting for a prior UNCERTAIN order to be verified - no new entries this tick.")
      return false
    }
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
    // The advisor gets at most one consult per tick: it reviews the best
    // eligible signal only, which bounds tick latency and token spend.
    let advisorConsulted = false
    for (const sig of eligible) {
      const st = this.state()
      if (st.positions.length >= this.risk.maxPositions) break

      const risk = dailyRisk(st.todayStartEquity, this.equityOf(st), this.risk)
      if (risk.stopNewEntries) {
        this.noteGuard(`Risk engine: daily loss at ${(risk.todayLossPct * 100).toFixed(1)}% — no new entries today.`)
        break
      }

      // Manual approval mode: hold the best signal for the user instead of
      // placing anything. Exits still run automatically — only entries gate.
      const approvalMode = st.approvalMode ?? this.risk.approvalMode
      if (approvalMode === "manual") {
        if (!st.pendingTrade) {
          const pending: PendingTrade = {
            symbol: sig.coin,
            side: sig.side,
            score: sig.score,
            reason: sig.reason,
            markPx: sig.markPx,
            createdAt: new Date().toISOString(),
          }
          this.store.mutate((x) => {
            x.pendingTrade = pending
          })
          this.log(
            "info",
            `Approval needed: ${sig.coin} ${sig.side} — ${sig.reason}. Approve or reject it in the cockpit.`,
          )
          this.notifyOwner("guard", {
            message: `Approval needed: ${sig.coin} ${sig.side} — open the cockpit to approve or reject.`,
          })
        }
        break
      }

      // BYO-LLM second opinion (optional): the user's model may veto this
      // entry. A null result (gate closed, no channel configured, or every
      // channel down) leaves the deterministic signal untouched — the model
      // can never block trading by being unavailable, and the risk caps above
      // still rule every position regardless of the answer.
      const proposal = !advisorConsulted
        ? await adviseOnSignal(this.ownerAddress, {
            signal: {
              coin: sig.coin,
              side: sig.side,
              score: sig.score,
              momentumZ: sig.momentumZ,
              funding: sig.funding,
              volumeUsd: sig.volumeUsd,
              markPx: sig.markPx,
            },
            equityUsd: this.equityOf(st),
            openPositions: st.positions.map((p) => p.symbol),
          }).catch(() => null)
        : null
      advisorConsulted = true
      if (proposal?.action === "skip") {
        this.log(
          "info",
          `AI advisor skipped ${sig.coin} ${sig.side}: ${proposal.reason || "no reason given"}`,
        )
        continue
      }

      const result = await this.executeEntry(sig)
      if (result.note) this.noteGuard(result.note)
      if (!result.ok) break
      traded = true
    }

    return traded
  }

  /**
   * Execute an entry for a signal with full risk validation.
   * Shared by the automatic path and manual approval.
   *
   * Paper mode: simulated fill at the slipped mark price.
   * Live mode: real IOC order via the agent wallet; the engine records the
   * exchange's actual fill price/size. An UNCERTAIN order (timeout, reset,
   * unparseable response) halts the agent instead of retrying — a retry could
   * open a duplicate position with real money.
   */
  private async executeEntry(sig: Signal): Promise<{ ok: boolean; note?: string; uncertain?: boolean }> {
    const st = this.state()
    if (st.positions.some((p) => p.symbol === sig.coin)) return { ok: false }
    if (st.positions.length >= this.risk.maxPositions) return { ok: false }

    const risk = dailyRisk(st.todayStartEquity, this.equityOf(st), this.risk)
    if (risk.stopNewEntries) {
      return {
        ok: false,
        note: `Risk engine: daily loss at ${(risk.todayLossPct * 100).toFixed(1)}% — no new entries today.`,
      }
    }

    const equity = st.account.tradingWallet
    const notional = positionNotional(equity, this.risk)
    const allocated = notional / this.risk.leverage

    // ── Funds check BEFORE any order reaches the venue ──────────────────
    // On 2026-10-07 the live path ran this check AFTER placeOrder(): a filled
    // order whose margin no longer fit the ledger was dropped (never
    // recorded), and the next tick re-entered the same symbol — six duplicate
    // XRP shorts with real money. An order that exists on the venue must
    // always exist in the ledger, so the check runs first. The estimate is
    // exact for paper mode (fee = notional * feeRate) and within the $1
    // buffer for live fills at slightly different prices.
    const feeEstimate = notional * this.risk.feeRate
    if (st.cash < allocated + feeEstimate + 1) {
      return { ok: false, note: `Insufficient free funds ($${st.cash.toFixed(2)}) — skipping new entries.` }
    }

    // ── Deterministic fill price/size: paper marks vs live exchange fill ──
    let entryPrice: number
    let size: number

    if (this.mode === "live") {
      if (!this.executor) {
        return { ok: false, note: "Live mode is not configured with an order executor — nothing placed." }
      }
      if (!this.executor.isReady()) {
        return { ok: false, note: "No approved agent wallet for this account — approve one before trading live." }
      }

      const result = await this.executor.placeOrder({
        coin: sig.coin,
        isBuy: sig.side === "long",
        sizeUsd: notional,
      })

      if (!result.ok) {
        if (result.rejected) {
          return { ok: false, note: `Order rejected by exchange: ${result.reason}` }
        }
        // UNCERTAIN — the order may or may not be live on the exchange.
        // Do NOT halt and do NOT retry: record a verifying item and let the
        // per-tick venue reconciliation resolve it (adopts the position if
        // the order landed, releases it otherwise). No new entries are placed
        // while any verification is pending; exits keep running.
        this.store.mutate((s) => {
          s.verifying = [
            ...(s.verifying ?? []).filter((v) => !(v.coin === sig.coin && v.kind === "entry")),
            { coin: sig.coin, side: sig.side, kind: "entry", at: new Date().toISOString() },
          ]
        })
        const note = `Order status UNCERTAIN for ${sig.coin} ${sig.side}: ${result.reason} Verification pending — the next tick reconciles with the exchange automatically.`
        this.log("guard", note)
        this.notifyOwner("guard", { message: note })
        return { ok: false, note, uncertain: true }
      }

      entryPrice = result.avgPx
      size = result.totalSz
    } else {
      entryPrice = slippedPrice(sig.markPx, sig.side, this.risk)
      size = notional / entryPrice
    }

    const fee = (entryPrice * size) * this.risk.feeRate

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

    const fillLabel = this.mode === "live" ? "LIVE" : ""
    this.log(
      "open",
      `Opened ${sig.coin} ${sig.side} at $${entryPrice.toFixed(2)}${fillLabel ? ` ${fillLabel}` : ""} (${sig.reason})`,
    )
    this.notifyOwner("opened", { symbol: sig.coin, side: sig.side, price: entryPrice, reason: sig.reason })
    return { ok: true }
  }

  /**
   * Approve the pending trade (manual approval mode). Re-prices at the current
   * market and re-validates every risk limit before placing anything.
   */
  async approvePendingTrade(): Promise<{ ok: boolean; note: string }> {
    const pending = this.state().pendingTrade
    if (!pending) return { ok: false, note: "No pending trade to approve." }

    // Refresh the mark price so the fill uses the current market, not the
    // price from when the signal fired.
    let markPx = pending.markPx
    try {
      const { universe: meta, ctxs } = await this.client.metaAndAssetCtxs()
      const i = meta.findIndex((u) => u.name === pending.symbol)
      if (i >= 0 && ctxs[i]) markPx = parseFloat(ctxs[i].markPx) || markPx
    } catch {
      /* market data unavailable — fall back to the signal-time price */
    }

    const sig: Signal = {
      coin: pending.symbol,
      side: pending.side,
      score: pending.score,
      momentumZ: 0,
      funding: 0,
      volumeUsd: 0,
      markPx,
      reason: pending.reason,
    }

    this.store.mutate((x) => {
      x.pendingTrade = null
    })

    const result = await this.executeEntry(sig)
    if (result.ok) {
      this.log("info", `Approved: opened ${pending.symbol} ${pending.side} at $${markPx.toFixed(2)} (manual approval).`)
      return { ok: true, note: `Opened ${pending.symbol} ${pending.side}.` }
    }
    this.log("guard", `Approval not executed: ${result.note ?? "position limits reached"}. Nothing was placed.`)
    return { ok: false, note: result.note ?? "Position limits reached — nothing was placed." }
  }

  /** Reject the pending trade (manual approval mode). */
  rejectPendingTrade(): { ok: boolean; note: string } {
    const pending = this.state().pendingTrade
    if (!pending) return { ok: false, note: "No pending trade to reject." }
    this.store.mutate((x) => {
      x.pendingTrade = null
    })
    this.log("info", `Rejected: discarded the ${pending.symbol} ${pending.side} trade (manual approval).`)
    return { ok: true, note: `Discarded ${pending.symbol}.` }
  }

  /** Whether this agent places real orders (live) or simulates fills (paper). */
  isLive(): boolean {
    return this.mode === "live"
  }

  /**
   * Switch between automatic and manual (approval-gated) entries.
   * Leaving manual mode discards any waiting trade.
   */
  setApprovalMode(mode: "auto" | "manual"): { ok: boolean; note: string } {
    this.store.mutate((s) => {
      s.approvalMode = mode
      if (mode === "auto") s.pendingTrade = null
    })
    const note =
      mode === "manual"
        ? "Manual approval ON — the agent will hold new entries for your approval."
        : "Automatic mode ON — the agent places entries itself. Exits were always automatic."
    this.log("info", note)
    return { ok: true, note }
  }
}

let singleton: TradingAgent | null = null

export function getAgent(): TradingAgent {
  if (!singleton) singleton = new TradingAgent()
  return singleton
}

/** Per-wallet agent instances — paper state is isolated per connected user. */
const walletAgents = new Map<string, TradingAgent>()

export function getAgentForWallet(walletAddress: string | null | undefined): TradingAgent {
  if (!walletAddress) return getAgent() // guests share the demo account
  const key = walletAddress.toLowerCase()
  let agent = walletAgents.get(key)
  if (!agent) {
    agent = new TradingAgent(getStoreForWallet(key))
    walletAgents.set(key, agent)
  }
  return agent
}

/**
 * Resolve the agent for a wallet, promoting it to LIVE when the account has
 * an approved agent wallet on file.
 *
 * Promotion rules:
 * - Requires TradingAccount.status === "live" AND agent_approved (set by the
 *   approveAgent flow in keys.ts). Otherwise the paper agent is returned.
 * - The first promotion converts the state to a clean LIVE ledger: the demo
 *   history curve is dropped (it is simulated data and must never back a live
 *   account) and the budget is taken from the account row.
 * - DB unreachable → falls back to the paper agent so the engine never breaks.
 */
export async function resolveAgentForWallet(
  walletAddress: string | null | undefined,
): Promise<TradingAgent> {
  if (!walletAddress) return getAgent()
  const key = walletAddress.toLowerCase()

  // Already promoted?
  const existing = walletAgents.get(key)
  if (existing?.isLive()) return existing

  try {
    const { prisma } = await import("@/lib/prisma")
    const row = await prisma.tradingAccount.findUnique({
      where: { wallet_address: key },
      select: { status: true, agent_approved: true, hyperliquid_address: true, budget_usd: true, state_json: true },
    })

    if (row && row.status === "live" && row.agent_approved) {
      // Serverless runtimes have no persistent disk: hydrate the agent-key
      // record from the TradingAccount row (written by markApproved) so the
      // live executor can actually load and sign with the key in production.
      const { hydrateAgentKeyFromDb } = await import("./keys")
      await hydrateAgentKeyFromDb(key)
      const { LiveOrderExecutor, resolveVaultAddress } = await import("./live-executor")
      const executor = new LiveOrderExecutor({
        walletAddress: key,
        // `vaultAddress` on the wire means "acting for a vault/subaccount"; a
        // normal account sends nothing, so the user's own main account is not
        // forwarded here (see resolveVaultAddress).
        vaultAddress: resolveVaultAddress(row.hyperliquid_address, key),
      })
      const store = getStoreForWallet(key)
      const agent = new TradingAgent(store, DEFAULT_RISK, key, { mode: "live", executor })

      // ── Promotion is one-way, decided by the DURABLE ledger ─────────────
      // In a cold serverless instance the in-memory store is still a fresh
      // seed (mode "paper") and the caller hydrates it from the DB only
      // AFTER this function returns. Deciding from the store re-ran the
      // promotion on every fresh instance — and `promoteToLiveLedger` resets
      // positions to [] — which on 2026-10-07 wiped a recorded XRP position
      // mid-flight and the agent re-entered the same symbol (duplicate real
      // exposure). The DB row is the durable truth: once it carries a live
      // ledger, never promote again.
      const dbState = row.state_json as { mode?: string } | null
      if (dbState?.mode !== "live") {
        const budget = row.budget_usd && row.budget_usd > 0 ? row.budget_usd : store.get().account.budget
        store.mutate((s) => {
          Object.assign(s, promoteToLiveLedger(s, budget))
        })
        // Persist immediately so subsequent DB hydration loads the LIVE ledger
        // instead of overwriting it with the last paper state.
        void persistStateToDb(key, store.get()).catch(() => {})
      }

      walletAgents.set(key, agent)
      return agent
    }
  } catch {
    /* DB unavailable or account not live — stay on the paper agent */
  }

  return getAgentForWallet(key)
}
