/**
 * Live execution tests.
 *
 * 1. LiveOrderExecutor response translation (filled / rejected / uncertain).
 * 2. The agent's live path: real fills recorded from the executor, uncertain
 *    orders halting the agent instead of retrying.
 */

import { seedState, type TradingStore } from "@/lib/trading/store"
import { TradingAgent } from "@/lib/trading/agent"
import { LiveOrderExecutor, resolveVaultAddress, type OrderResult } from "@/lib/trading/live-executor"
import { DEFAULT_RISK } from "@/lib/trading/risk"
import type { TradingState, PendingTrade, Position } from "@/lib/trading/types"
import type { AssetCtx } from "@/lib/trading/hyperliquid"

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

/**
 * `vaultAddress` on the Hyperliquid wire means "acting on behalf of a vault or
 * subaccount" (docs), and the reference implementations omit it for a normal
 * account. The schema's `hyperliquid_address` is the user's own main account,
 * so forwarding it verbatim used to claim a vault that does not exist.
 */
describe("resolveVaultAddress", () => {
  const WALLET_LOWER = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"

  it("returns null when no address is configured", () => {
    expect(resolveVaultAddress(null, WALLET_LOWER)).toBeNull()
    expect(resolveVaultAddress(undefined, WALLET_LOWER)).toBeNull()
    expect(resolveVaultAddress("", WALLET_LOWER)).toBeNull()
  })

  it("returns null when the address is the user's own account", () => {
    expect(resolveVaultAddress(WALLET_LOWER, WALLET_LOWER)).toBeNull()
    expect(resolveVaultAddress(WALLET_LOWER.toUpperCase(), WALLET_LOWER)).toBeNull()
  })

  it("passes through a genuinely different vault/subaccount address", () => {
    const vault = "0x9999999999999999999999999999999999999999"
    expect(resolveVaultAddress(vault, WALLET_LOWER)).toBe(vault)
  })
})

// ── Exit path ────────────────────────────────────────────────────────

/**
 * Take-profit, stop-loss, circuit-breaker and the uncertain-close halt.
 *
 * Only the entry side had coverage; these branches had run neither in a test
 * nor in a live session. They are deterministic because the TP/SL/killAll
 * decisions read the position's own `pnlPct` — no market data is fetched on
 * those paths (only the signal-fade branch needs candles).
 */
type ExitAccess = { applyExits(ctx: Map<string, AssetCtx>, killAll: boolean): Promise<boolean> }

/** A position whose PnL percentage is already recorded, as the exit logic reads it. */
function positionWith(pnlPct: number, side: "long" | "short" = "long"): Position {
  const entry = 60000
  // A long gains when price rises; a short gains when it falls.
  const mark = side === "long" ? entry * (1 + pnlPct / 100) : entry * (1 - pnlPct / 100)
  const size = 0.001
  return {
    symbol: "BTC",
    side,
    size,
    entry,
    mark,
    allocated: 30, // margin posted at open
    pnl: (side === "long" ? mark - entry : entry - mark) * size,
    pnlPct,
    leverage: 2,
    reason: "test fixture",
    openedAt: new Date().toISOString(),
  }
}

function liveStoreWith(position: Position): TradingStore {
  return stubStore({ ...seedState({ demoHistory: false }), mode: "live", cash: 70, positions: [position] })
}

describe("TradingAgent — live exits (take-profit, stop-loss, halt)", () => {
  it("take-profit closes a long with a reduceOnly sell and books the fill", async () => {
    const executor = fakeExecutor({ ok: true, avgPx: 61500, totalSz: 0.001, oid: 7 })
    const store = liveStoreWith(positionWith(2.5))
    const agent = new TradingAgent(store, DEFAULT_RISK, WALLET, { mode: "live", executor })

    const traded = await (agent as unknown as ExitAccess).applyExits(new Map(), false)

    expect(traded).toBe(true)
    // Closing a long sells it, at the mark notional, reduce-only.
    const call = executor.placeOrder.mock.calls[0][0] as {
      coin: string
      isBuy: boolean
      sizeUsd: number
      reduceOnly?: boolean
    }
    expect(call.coin).toBe("BTC")
    expect(call.isBuy).toBe(false)
    expect(call.reduceOnly).toBe(true)
    expect(call.sizeUsd).toBeCloseTo(61.5, 6) // 0.001 BTC at 61500
    expect(store.get().positions).toHaveLength(0)
    // 30 margin returned + 1.50 gross - 0.0246 exit fee
    expect(store.get().cash).toBeCloseTo(101.48, 2)
    expect(store.get().activity.some((a) => a.text.includes("take-profit"))).toBe(true)
  })

  it("stop-loss closes a short by buying it back", async () => {
    const executor = fakeExecutor({ ok: true, avgPx: 61500, totalSz: 0.001, oid: 8 })
    const store = liveStoreWith(positionWith(-2.5, "short"))
    const agent = new TradingAgent(store, DEFAULT_RISK, WALLET, { mode: "live", executor })

    await (agent as unknown as ExitAccess).applyExits(new Map(), false)

    const call = executor.placeOrder.mock.calls[0][0] as {
      coin: string
      isBuy: boolean
      sizeUsd: number
      reduceOnly?: boolean
    }
    expect(call.coin).toBe("BTC")
    expect(call.isBuy).toBe(true) // closing a short buys
    expect(call.reduceOnly).toBe(true)
    expect(call.sizeUsd).toBeCloseTo(61.5, 6) // 0.001 BTC at 61500 (price rose, short lost)
    expect(store.get().positions).toHaveLength(0)
    // 30 margin + (-1.50) gross - 0.0246 exit fee = 28.48 realized, on top of the 70 cash
    expect(store.get().cash).toBeCloseTo(98.48, 2)
    expect(store.get().activity.some((a) => a.text.includes("stop-loss"))).toBe(true)
  })

  it("an UNCERTAIN close halts the agent and never fabricates a fill", async () => {
    const executor = fakeExecutor({ ok: false, rejected: false, uncertainty: true, reason: "timeout" })
    const store = liveStoreWith(positionWith(2.5))
    const agent = new TradingAgent(store, DEFAULT_RISK, WALLET, { mode: "live", executor })

    const traded = await (agent as unknown as ExitAccess).applyExits(new Map(), false)

    expect(traded).toBe(false)
    expect(store.get().positions).toHaveLength(1) // may still be open on the exchange
    expect(store.get().cash).toBe(70) // book untouched
    expect(store.get().agent.status).toBe("stopped")
    expect(store.get().activity.some((a) => a.text.includes("UNCERTAIN"))).toBe(true)
  })

  it("a rejected close keeps the agent running and the position open", async () => {
    const executor = fakeExecutor({ ok: false, rejected: true, reason: "reduce-only rejected" })
    const store = liveStoreWith(positionWith(2.5))
    const agent = new TradingAgent(store, DEFAULT_RISK, WALLET, { mode: "live", executor })

    await (agent as unknown as ExitAccess).applyExits(new Map(), false)

    expect(store.get().positions).toHaveLength(1)
    expect(store.get().agent.status).not.toBe("stopped")
    expect(store.get().activity.some((a) => a.text.includes("Close rejected"))).toBe(true)
  })

  it("the daily circuit breaker exits even a flat position", async () => {
    const executor = fakeExecutor({ ok: true, avgPx: 60000, totalSz: 0.001, oid: 9 })
    const store = liveStoreWith(positionWith(0))
    const agent = new TradingAgent(store, DEFAULT_RISK, WALLET, { mode: "live", executor })

    const traded = await (agent as unknown as ExitAccess).applyExits(new Map(), true)

    expect(traded).toBe(true)
    expect(store.get().positions).toHaveLength(0)
    expect(store.get().activity.some((a) => a.text.includes("circuit breaker"))).toBe(true)
  })
})
