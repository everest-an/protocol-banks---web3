/**
 * First promotion from paper to live.
 *
 * This runs exactly once per account, at the moment real orders start going
 * out, so the two things that matter are: (1) paper artefacts must not leak
 * into the live ledger, and (2) an explicit safety choice must not be silently
 * reverted while the user is not looking.
 */

import { seedState, promoteToLiveLedger } from "@/lib/trading/store"
import type { PendingTrade, Position, TradingState } from "@/lib/trading/types"

const POSITION: Position = {
  symbol: "BTC",
  side: "long",
  size: 0.0002,
  entry: 60000,
  mark: 60500,
  allocated: 11,
  pnl: 0.1,
  pnlPct: 0.9,
  leverage: 1,
  reason: "paper momentum",
  openedAt: "2026-09-01T00:00:00.000Z",
}

const PENDING: PendingTrade = {
  symbol: "ETH",
  side: "long",
  score: 1.2,
  reason: "paper signal",
  markPx: 3000,
  createdAt: "2026-09-01T00:00:00.000Z",
}

/** A paper account mid-flight: positions open, a trade pending, manual mode on. */
function livePatchedPaperState(): TradingState {
  const s = seedState({ demoHistory: false })
  return {
    ...s,
    approvalMode: "manual",
    positions: [POSITION],
    pendingTrade: PENDING,
  }
}

describe("promoteToLiveLedger", () => {
  it("flags the ledger as live", () => {
    const next = promoteToLiveLedger(seedState({ demoHistory: false }), 50)
    expect(next.mode).toBe("live")
  })

  it("preserves an explicit manual-approval choice", () => {
    // The help page recommends manual approval for a first real-money run; the
    // promotion used to reset it to "auto" because it rebuilt from seedState.
    const next = promoteToLiveLedger(livePatchedPaperState(), 50)
    expect(next.approvalMode).toBe("manual")
  })

  it("defaults to auto when the paper account never chose a mode", () => {
    const s = seedState({ demoHistory: false })
    const next = promoteToLiveLedger({ ...s, approvalMode: undefined }, 50)
    expect(next.approvalMode).toBe("auto")
  })

  it("applies the live budget everywhere the dashboard reads it", () => {
    const next = promoteToLiveLedger(livePatchedPaperState(), 50)
    expect(next.account.budget).toBe(50)
    expect(next.account.maxLoss).toBe(50) // worst case = the funded budget
    expect(next.account.tradingWallet).toBe(50)
    expect(next.account.totalEquity).toBe(50)
    expect(next.initialEquity).toBe(50)
    expect(next.todayStartEquity).toBe(50)
    expect(next.cash).toBe(50)
  })

  it("drops paper positions and any pending trade", () => {
    const next = promoteToLiveLedger(livePatchedPaperState(), 50)
    expect(next.positions).toEqual([])
    expect(next.pendingTrade).toBeNull()
  })

  it("starts a fresh equity curve at the budget", () => {
    const next = promoteToLiveLedger(livePatchedPaperState(), 50)
    expect(next.equity).toHaveLength(1)
    expect(next.equity[0].v).toBe(50)
    expect(next.equity[0].t).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("leaves exactly the activation note in the activity feed", () => {
    const next = promoteToLiveLedger(livePatchedPaperState(), 50)
    expect(next.activity).toHaveLength(1)
    expect(next.activity[0].text).toContain("Live account activated")
    expect(next.activity[0].text).toContain("$50.00")
    expect(next.activity[0].text).toContain("never withdraw")
  })

  it("does not mutate the state it is given", () => {
    const before = livePatchedPaperState()
    const snapshot = JSON.stringify(before)
    promoteToLiveLedger(before, 50)
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})
