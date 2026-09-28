/**
 * Live execution tests.
 *
 * 1. LiveOrderExecutor response translation (filled / rejected / uncertain).
 * 2. The agent's live path: real fills recorded from the executor, uncertain
 *    orders halting the agent instead of retrying.
 */

import { seedState, type TradingStore } from "@/lib/trading/store"
import { TradingAgent } from "@/lib/trading/agent"
import { LiveOrderExecutor, type OrderResult } from "@/lib/trading/live-executor"
import { DEFAULT_RISK } from "@/lib/trading/risk"
import type { TradingState, PendingTrade } from "@/lib/trading/types"

// ── Mocks for the executor's dependencies ────────────────────────────

jest.mock("@/lib/trading/keys", () => ({
  getAgentWallet: jest.fn(),
  loadAgentKeyRecord: jest.fn(),
}))
jest.mock("@/lib/trading/exchange", () => ({
  placeMarketOrder: jest.fn(),
  coinToIndex: jest.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const keys = require("@/lib/trading/keys") as {
  getAgentWallet: jest.Mock
  loadAgentKeyRecord: jest.Mock
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const exchange = require("@/lib/trading/exchange") as {
  placeMarketOrder: jest.Mock
  coinToIndex: jest.Mock
}

const WALLET = "0x1111111111111111111111111111111111111111"

describe("LiveOrderExecutor — response translation", () => {
  let executor: LiveOrderExecutor

  beforeEach(() => {
    jest.clearAllMocks()
    keys.getAgentWallet.mockReturnValue({ fake: "wallet" })
    keys.loadAgentKeyRecord.mockReturnValue({ approved: true })
    exchange.coinToIndex.mockResolvedValue(3)
    executor = new LiveOrderExecutor({ walletAddress: WALLET, vaultAddress: WALLET })
  })

  it("reports isReady only when an approved agent key exists", () => {
    expect(executor.isReady()).toBe(true)
    keys.loadAgentKeyRecord.mockReturnValue({ approved: false })
    expect(executor.isReady()).toBe(false)
  })

  it("maps a filled order to ok with the exchange price and size", async () => {
    exchange.placeMarketOrder.mockResolvedValue({
      status: "ok",
      response: { data: { statuses: [{ filled: { avgPx: "60123.5", totalSz: "0.001", oid: 42 } }] } },
    })
    const r = await executor.placeOrder({ coin: "BTC", isBuy: true, sizeUsd: 60 })
    expect(r).toEqual({ ok: true, avgPx: 60123.5, totalSz: 0.001, oid: 42 })
  })

  it("maps an exchange error status to a definitive rejection", async () => {
    exchange.placeMarketOrder.mockResolvedValue({
      status: "ok",
      response: { data: { statuses: [{ error: "Insufficient margin to place order." }] } },
    })
    const r = await executor.placeOrder({ coin: "BTC", isBuy: true, sizeUsd: 60 })
    expect(r.ok).toBe(false)
    expect(r.rejected).toBe(true)
    expect(r.reason).toMatch(/insufficient margin/i)
  })

  it("treats a timeout as UNCERTAIN (never a rejection)", async () => {
    exchange.placeMarketOrder.mockRejectedValue(new Error("The operation was aborted due to timeout"))
    const r = await executor.placeOrder({ coin: "BTC", isBuy: true, sizeUsd: 60 })
    expect(r.ok).toBe(false)
    expect(r.rejected).toBe(false)
    expect("uncertainty" in r && r.uncertainty).toBe(true)
  })

  it("treats an HTTP exchange error response as a rejection (the request landed)", async () => {
    exchange.placeMarketOrder.mockRejectedValue(
      new Error('Hyperliquid exchange error 422: {"status":"err"}'),
    )
    const r = await executor.placeOrder({ coin: "BTC", isBuy: true, sizeUsd: 60 })
    expect(r.ok).toBe(false)
    expect(r.rejected).toBe(true)
  })

  it("treats an unrecognised response body as UNCERTAIN", async () => {
    exchange.placeMarketOrder.mockResolvedValue({ something: "else" })
    const r = await executor.placeOrder({ coin: "BTC", isBuy: true, sizeUsd: 60 })
    expect(r.ok).toBe(false)
    expect(r.rejected).toBe(false)
    expect("uncertainty" in r && r.uncertainty).toBe(true)
  })

  it("treats an unexpected resting order as UNCERTAIN", async () => {
    exchange.placeMarketOrder.mockResolvedValue({
      status: "ok",
      response: { data: { statuses: [{ resting: { oid: 7 } }] } },
    })
    const r = await executor.placeOrder({ coin: "BTC", isBuy: true, sizeUsd: 60 })
    expect(r.ok).toBe(false)
    expect("uncertainty" in r && r.uncertainty).toBe(true)
  })

  it("rejects when no agent key is on file", async () => {
    keys.getAgentWallet.mockReturnValue(null)
    const r = await executor.placeOrder({ coin: "BTC", isBuy: true, sizeUsd: 60 })
    expect(r.ok).toBe(false)
    expect(r.rejected).toBe(true)
  })
})

// ── Agent live path via the public approve flow ──────────────────────

function stubStore(initial: TradingState): TradingStore {
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
    save: () => {},
  } as unknown as TradingStore
}

const PENDING: PendingTrade = {
  symbol: "BTC",
  side: "long",
  score: 0.9,
  reason: "momentum z=1.6, long bias",
  markPx: 60000,
  createdAt: new Date().toISOString(),
}

function fakeExecutor(result: OrderResult) {
  return {
    isReady: () => true,
    placeOrder: jest.fn().mockResolvedValue(result),
  } as unknown as LiveOrderExecutor & { placeOrder: jest.Mock }
}

describe("TradingAgent — live execution", () => {
  it("records a live fill at the exchange price on approval", async () => {
    const executor = fakeExecutor({ ok: true, avgPx: 60123.5, totalSz: 0.001, oid: 42 })
    const store = stubStore({ ...seedState({ demoHistory: false }), pendingTrade: PENDING, approvalMode: "manual" })
    const agent = new TradingAgent(store, { ...DEFAULT_RISK, approvalMode: "manual" }, WALLET, {
      mode: "live",
      executor,
    })

    const result = await agent.approvePendingTrade()
    expect(result.ok).toBe(true)
    expect(executor.placeOrder).toHaveBeenCalledTimes(1)

    const pos = store.get().positions[0]
    expect(pos.symbol).toBe("BTC")
    expect(pos.entry).toBeCloseTo(60123.5)
    expect(pos.size).toBeCloseTo(0.001)
    expect(store.get().activity.some((a) => a.text.includes("LIVE"))).toBe(true)
  })

  it("records no position when the exchange rejects the order", async () => {
    const executor = fakeExecutor({ ok: false, rejected: true, reason: "Insufficient margin" })
    const store = stubStore({ ...seedState({ demoHistory: false }), pendingTrade: PENDING, approvalMode: "manual" })
    const agent = new TradingAgent(store, { ...DEFAULT_RISK, approvalMode: "manual" }, WALLET, {
      mode: "live",
      executor,
    })

    const result = await agent.approvePendingTrade()
    expect(result.ok).toBe(false)
    expect(store.get().positions).toHaveLength(0)
  })

  it("halts the agent on an UNCERTAIN order instead of retrying", async () => {
    const executor = fakeExecutor({
      ok: false,
      rejected: false,
      uncertainty: true,
      reason: "timeout",
    })
    const store = stubStore({ ...seedState({ demoHistory: false }), pendingTrade: PENDING, approvalMode: "manual" })
    const agent = new TradingAgent(store, { ...DEFAULT_RISK, approvalMode: "manual" }, WALLET, {
      mode: "live",
      executor,
    })

    const result = await agent.approvePendingTrade()
    expect(result.ok).toBe(false)
    expect(store.get().positions).toHaveLength(0) // never fabricate a position
    expect(store.get().agent.status).toBe("stopped") // safety halt
    expect(executor.placeOrder).toHaveBeenCalledTimes(1) // no retry
    expect(store.get().activity.some((a) => a.text.includes("UNCERTAIN"))).toBe(true)
  })

  it("reports live mode in toOverview", () => {
    const executor = fakeExecutor({ ok: true, avgPx: 1, totalSz: 1, oid: null })
    const store = stubStore(seedState({ demoHistory: false }))
    const agent = new TradingAgent(store, DEFAULT_RISK, WALLET, { mode: "live", executor })
    expect(agent.isLive()).toBe(true)
  })
})
