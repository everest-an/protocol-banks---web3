/**
 * Paper state seeding + manual approval mode tests.
 *
 * - seedState(): demo-history curve (fresh accounts) and clean reset variant
 * - TradingAgent manual approval: pending trade hold, reject, approve guards
 */

import { seedState, PAPER_BUDGET } from "@/lib/trading/store"
import { TradingAgent } from "@/lib/trading/agent"
import { DEFAULT_RISK, type RiskConfig } from "@/lib/trading/risk"
import type { TradingState, PendingTrade } from "@/lib/trading/types"

// ── seedState ────────────────────────────────────────────────────────

describe("seedState — demo history", () => {
  it("seeds 31 daily equity points (30 days + today)", () => {
    const s = seedState()
    expect(s.equity).toHaveLength(31)
  })

  it("is deterministic across calls", () => {
    expect(JSON.stringify(seedState().equity)).toBe(JSON.stringify(seedState().equity))
  })

  it("keeps account figures consistent with the curve endpoint", () => {
    const s = seedState()
    const last = s.equity[s.equity.length - 1].v
    expect(s.account.totalEquity).toBe(last)
    expect(s.cash).toBe(last)
    expect(s.account.allTimePnl).toBe(Number((last - PAPER_BUDGET).toFixed(2)))
    // today starts at the current equity → zero intraday PnL
    expect(s.account.todayPnl).toBe(0)
    expect(s.todayStartEquity).toBe(last)
  })

  it("labels the history as simulated in the activity feed", () => {
    const s = seedState()
    expect(s.activity[0].text.toLowerCase()).toContain("simulated demo history")
    expect(s.activity[0].text.toLowerCase()).toContain("not real trading results")
  })

  it("does not leave a pending trade on fresh accounts", () => {
    expect(seedState().pendingTrade ?? null).toBeNull()
  })
})

describe("seedState — clean reset", () => {
  it("resets to a flat $500 with a single equity point", () => {
    const s = seedState({ demoHistory: false })
    expect(s.equity).toHaveLength(1)
    expect(s.equity[0].v).toBe(PAPER_BUDGET)
    expect(s.account.totalEquity).toBe(PAPER_BUDGET)
    expect(s.account.allTimePnl).toBe(0)
    expect(s.cash).toBe(PAPER_BUDGET)
  })

  it("carries a reset notice instead of demo history", () => {
    const s = seedState({ demoHistory: false })
    expect(s.activity).toHaveLength(1)
    expect(s.activity[0].text.toLowerCase()).toContain("reset")
  })
})

// ── Manual approval mode ─────────────────────────────────────────────

function stubStore(initial: TradingState) {
  let state = initial
  return {
    get: () => state,
    mutate: (fn: (s: TradingState) => void) => {
      fn(state)
      return state
    },
    replace: (s: TradingState) => {
      state = s
    },
    reset: () => {
      state = seedState()
      return state
    },
    // TradingStore's save() is a no-op in the stub
    save: () => {},
  } as unknown as import("@/lib/trading/store").TradingStore
}

const MANUAL_RISK: RiskConfig = { ...DEFAULT_RISK, approvalMode: "manual" }

describe("TradingAgent — manual approval mode", () => {
  it("rejectPendingTrade clears the pending trade and logs it", () => {
    const pending: PendingTrade = {
      symbol: "BTC",
      side: "long",
      score: 0.9,
      reason: "momentum z=1.6, funding +0.001%/h, long bias",
      markPx: 60000,
      createdAt: new Date().toISOString(),
    }
    const state = { ...seedState(), pendingTrade: pending }
    const store = stubStore(state)
    const agent = new TradingAgent(store, MANUAL_RISK, null)

    const result = agent.rejectPendingTrade()
    expect(result.ok).toBe(true)
    expect(store.get().pendingTrade ?? null).toBeNull()
    expect(store.get().activity.some((a) => a.text.includes("Rejected"))).toBe(true)
  })

  it("rejectPendingTrade is a no-op when nothing is pending", () => {
    const store = stubStore(seedState())
    const agent = new TradingAgent(store, MANUAL_RISK, null)
    const result = agent.rejectPendingTrade()
    expect(result.ok).toBe(false)
    expect(result.note).toMatch(/no pending trade/i)
  })

  it("approvePendingTrade is a no-op when nothing is pending", async () => {
    const store = stubStore(seedState())
    const agent = new TradingAgent(store, MANUAL_RISK, null)
    const result = await agent.approvePendingTrade()
    expect(result.ok).toBe(false)
    expect(result.note).toMatch(/no pending trade/i)
  })

  it("exposes pendingTrade in toOverview", () => {
    const pending: PendingTrade = {
      symbol: "ETH",
      side: "short",
      score: -0.8,
      reason: "momentum z=-1.5, short bias",
      markPx: 3000,
      createdAt: new Date().toISOString(),
    }
    const store = stubStore({ ...seedState(), pendingTrade: pending })
    const agent = new TradingAgent(store, MANUAL_RISK, null)
    expect(agent.toOverview().pendingTrade).toEqual(pending)
  })

  it("setApprovalMode('manual') persists the mode and logs it", () => {
    const store = stubStore(seedState())
    const agent = new TradingAgent(store, DEFAULT_RISK, null)
    const result = agent.setApprovalMode("manual")
    expect(result.ok).toBe(true)
    expect(store.get().approvalMode).toBe("manual")
    expect(store.get().activity.some((a) => a.text.includes("Manual approval"))).toBe(true)
  })

  it("setApprovalMode('auto') clears any waiting trade", () => {
    const pending: PendingTrade = {
      symbol: "SOL",
      side: "long",
      score: 0.7,
      reason: "momentum z=1.2, long bias",
      markPx: 150,
      createdAt: new Date().toISOString(),
    }
    const store = stubStore({ ...seedState(), pendingTrade: pending, approvalMode: "manual" })
    const agent = new TradingAgent(store, MANUAL_RISK, null)
    const result = agent.setApprovalMode("auto")
    expect(result.ok).toBe(true)
    expect(store.get().approvalMode).toBe("auto")
    expect(store.get().pendingTrade ?? null).toBeNull()
  })
})
