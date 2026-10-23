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
import { notificationService } from "@/lib/services/notification-service"
import { recordTradeClosed, recordTradeOpened } from "@/lib/trading/db-store"
import { DEFAULT_RISK } from "@/lib/trading/risk"
import type { TradingState, PendingTrade, Position } from "@/lib/trading/types"
import type { AssetCtx } from "@/lib/trading/hyperliquid"

// ── Mocks for the executor's dependencies ────────────────────────────

jest.mock("@/lib/trading/keys", () => ({
  getAgentWallet: jest.fn(),
  loadAgentKeyRecord: jest.fn(),
}))
jest.mock("@/lib/trading/db-store", () => ({
  persistStateToDb: jest.fn().mockResolvedValue(undefined),
  recordTradeOpened: jest.fn().mockResolvedValue(undefined),
  recordTradeClosed: jest.fn().mockResolvedValue(undefined),
}))
jest.mock("@/lib/trading/exchange", () => {
  // The real error classes: live-executor narrows pre-submit failures with
  // `instanceof PreSubmitError`, so the mock must keep the real hierarchy.
  const actual = jest.requireActual("@/lib/trading/exchange")
  return {
    placeMarketOrder: jest.fn(),
    coinToIndex: jest.fn(),
    getUserState: jest.fn(),
    getOrderStatus: jest.fn(),
    PreSubmitError: actual.PreSubmitError,
    MarketDataUnavailableError: actual.MarketDataUnavailableError,
  }
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const keys = require("@/lib/trading/keys") as {
  getAgentWallet: jest.Mock
  loadAgentKeyRecord: jest.Mock
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const exchange = require("@/lib/trading/exchange") as {
  placeMarketOrder: jest.Mock
  coinToIndex: jest.Mock
  getUserState: jest.Mock
  getOrderStatus: jest.Mock
  PreSubmitError: new (message: string) => Error
  MarketDataUnavailableError: new (coin: string, cause: unknown) => Error
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
    expect(r).toMatchObject({ ok: true, avgPx: 60123.5, totalSz: 0.001, oid: 42 })
    // Every submission carries a client order id (exact UNCERTAIN resolution).
    expect(r.ok && r.cloid).toMatch(/^0x[0-9a-f]{32}$/)
    // ...and it is forwarded to the venue with the order.
    expect(exchange.placeMarketOrder.mock.calls[0][0]).toMatchObject({ cloid: r.ok ? r.cloid : undefined })
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

/**
 * Regression (2026-10-15): a Hyperliquid market-data outage was reported as
 * `Unknown market "ZEC"` and classified as an UNCERTAIN submission, so the
 * owner got seven "it may or may not have reached the exchange" alerts for
 * orders that were never submitted. Nothing had reached the venue: the honest
 * answer is preSubmit, and the engine must not queue verification for it.
 */
describe("LiveOrderExecutor — pre-submit failures never look like submissions", () => {
  let executor: LiveOrderExecutor

  beforeEach(() => {
    jest.clearAllMocks()
    keys.getAgentWallet.mockReturnValue({ fake: "wallet" })
    keys.loadAgentKeyRecord.mockReturnValue({ approved: true })
    exchange.coinToIndex.mockResolvedValue(3)
    executor = new LiveOrderExecutor({ walletAddress: WALLET, vaultAddress: WALLET })
  })

  it("reports a market-data outage as preSubmit, not as 'may have reached the exchange'", async () => {
    exchange.coinToIndex.mockRejectedValue(new exchange.MarketDataUnavailableError("ZEC", new Error("fetch failed")))
    const r = await executor.placeOrder({ coin: "ZEC", isBuy: false, sizeUsd: 12 })

    expect(r.ok).toBe(false)
    expect("preSubmit" in r && r.preSubmit).toBe(true)
    expect(r.reason).toMatch(/Market data unavailable/)
    expect(r.reason).toMatch(/no order was submitted/)
    // Nothing was submitted, so the order path must not even be entered.
    expect(exchange.placeMarketOrder).not.toHaveBeenCalled()
  })

  it("reports a market missing from the universe as preSubmit, not as an exchange rejection", async () => {
    exchange.coinToIndex.mockResolvedValue(null)
    const r = await executor.placeOrder({ coin: "NOPE", isBuy: false, sizeUsd: 12 })

    expect(r.ok).toBe(false)
    expect("preSubmit" in r && r.preSubmit).toBe(true)
    expect(r.reason).toMatch(/Unknown market "NOPE"/)
  })

  it("keeps a pre-submit failure thrown inside the order path as preSubmit", async () => {
    exchange.placeMarketOrder.mockRejectedValue(
      new exchange.PreSubmitError("order value $9 is below Hyperliquid's $10 minimum"),
    )
    const r = await executor.placeOrder({ coin: "BTC", isBuy: true, sizeUsd: 9 })

    expect(r.ok).toBe(false)
    expect("preSubmit" in r && r.preSubmit).toBe(true)
    expect(r.reason).toMatch(/\$10 minimum/)
  })

  it("still treats a genuine round-trip failure as UNCERTAIN", async () => {
    exchange.placeMarketOrder.mockRejectedValue(new Error("The operation was aborted due to timeout"))
    const r = await executor.placeOrder({ coin: "BTC", isBuy: true, sizeUsd: 60 })

    expect(r.ok).toBe(false)
    expect("uncertainty" in r && r.uncertainty).toBe(true)
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
    expect(recordTradeOpened).toHaveBeenCalledWith(
      WALLET,
      expect.objectContaining({ symbol: "BTC", side: "long", mode: "live", entryPrice: 60123.5, oid: 42 }),
    )
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

  it("an UNCERTAIN entry queues verification instead of halting (reconciliation resolves it)", async () => {
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
    // No halt: the next tick's venue reconciliation adopts the position if the
    // order actually landed, or releases it if it never did.
    expect(store.get().agent.status).toBe("running")
    expect(store.get().verifying).toHaveLength(1)
    expect(store.get().verifying?.[0]).toMatchObject({ coin: "BTC", kind: "entry" })
    expect(executor.placeOrder).toHaveBeenCalledTimes(1) // no retry
    expect(store.get().activity.some((a) => a.text.includes("UNCERTAIN"))).toBe(true)
  })

  it("refuses to place a live order when free funds are gone (venue untouched)", async () => {
    // Regression (mainnet, 2026-10-07): the funds check used to run AFTER
    // placeOrder(), so a filled order whose margin no longer fit the ledger
    // was dropped (never recorded) and the next tick re-entered the same
    // symbol — six duplicate XRP shorts with real money. An order that
    // reaches the venue must always be recordable, so the check must run
    // BEFORE any order is placed.
    const executor = fakeExecutor({ ok: true, avgPx: 60123.5, totalSz: 0.001, oid: 42 })
    const store = stubStore({ ...seedState({ demoHistory: false }), pendingTrade: PENDING, approvalMode: "manual" })
    store.mutate((s) => {
      s.cash = 3 // below allocated (seed equity ~$500 -> $37.50 margin) + fee + $1
    })
    const agent = new TradingAgent(store, { ...DEFAULT_RISK, approvalMode: "manual" }, WALLET, {
      mode: "live",
      executor,
    })

    const result = await agent.approvePendingTrade()
    expect(result.ok).toBe(false)
    expect(executor.placeOrder).not.toHaveBeenCalled() // the venue was never touched
    expect(store.get().positions).toHaveLength(0)
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
    expect(recordTradeClosed).toHaveBeenCalledWith(
      WALLET,
      expect.objectContaining({ symbol: "BTC", side: "long", exitPrice: 61500, pnl: expect.any(Number) }),
    )
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

  it("an UNCERTAIN close queues verification instead of halting and never fabricates a fill", async () => {
    const executor = fakeExecutor({ ok: false, rejected: false, uncertainty: true, reason: "timeout" })
    const store = liveStoreWith(positionWith(2.5))
    const agent = new TradingAgent(store, DEFAULT_RISK, WALLET, { mode: "live", executor })

    const traded = await (agent as unknown as ExitAccess).applyExits(new Map(), false)

    expect(traded).toBe(false)
    expect(store.get().positions).toHaveLength(1) // may still be open on the exchange
    expect(store.get().cash).toBe(70) // book untouched
    expect(store.get().agent.status).toBe("running") // no halt — reconciliation confirms
    expect(store.get().verifying?.[0]).toMatchObject({ kind: "exit" })
    expect(store.get().activity.some((a) => a.text.includes("UNCERTAIN"))).toBe(true)
  })

  it("reconciliation adopts an untracked venue position and anchors equity to the account value", async () => {
    exchange.getUserState.mockResolvedValue({
      marginSummary: { accountValue: "18.5" },
      assetPositions: [{ position: { coin: "XRP", szi: "-14", entryPx: "1.42" } }],
    })
    const executor = fakeExecutor({ ok: true, avgPx: 1, totalSz: 1, oid: null })
    const store = stubStore(seedState({ demoHistory: false }))
    const agent = new TradingAgent(store, DEFAULT_RISK, WALLET, { mode: "live", executor })

    await (agent as unknown as { reconcileWithVenue: () => Promise<void> }).reconcileWithVenue()

    const st = store.get()
    const pos = st.positions.find((p) => p.symbol === "XRP")
    expect(pos).toBeDefined()
    expect(pos?.side).toBe("short")
    expect(pos?.size).toBeCloseTo(14)
    expect(st.account.totalEquity).toBeCloseTo(18.5)
    // cash holds everything that is not margin or unrealized PnL
    const committed = st.positions.reduce((a, p) => a + p.allocated + p.pnl, 0)
    expect(st.cash + committed).toBeCloseTo(18.5)
    expect(st.activity.some((a) => a.text.includes("adopted XRP"))).toBe(true)
  })

  it("reconciliation drops a book position the venue no longer holds", async () => {
    exchange.getUserState.mockResolvedValue({
      marginSummary: { accountValue: "80" },
      assetPositions: [],
    })
    const executor = fakeExecutor({ ok: true, avgPx: 1, totalSz: 1, oid: null })
    const store = liveStoreWith(positionWith(2.5))
    const agent = new TradingAgent(store, DEFAULT_RISK, WALLET, { mode: "live", executor })

    await (agent as unknown as { reconcileWithVenue: () => Promise<void> }).reconcileWithVenue()

    const st = store.get()
    expect(st.positions).toHaveLength(0)
    expect(st.account.totalEquity).toBeCloseTo(80)
  })

  it("resolves an UNCERTAIN order exactly via its cloid (unknownOid releases it immediately)", async () => {
    const cloid = "0x" + "ab".repeat(16)
    const executor = fakeExecutor({ ok: false, rejected: false, uncertainty: true, reason: "timeout", cloid })
    const store = stubStore({ ...seedState({ demoHistory: false }), pendingTrade: PENDING, approvalMode: "manual" })
    const agent = new TradingAgent(store, { ...DEFAULT_RISK, approvalMode: "manual" }, WALLET, {
      mode: "live",
      executor,
    })
    await agent.approvePendingTrade()
    expect(store.get().verifying?.[0]?.cloid).toBe(cloid)

    exchange.getUserState.mockResolvedValue({ marginSummary: { accountValue: "70" }, assetPositions: [] })
    exchange.getOrderStatus.mockResolvedValue({ status: "unknownOid" })
    await (agent as unknown as { reconcileWithVenue: () => Promise<void> }).reconcileWithVenue()

    expect(store.get().verifying).toHaveLength(0)
    expect(store.get().activity.some((a) => a.text.includes("never reached the exchange"))).toBe(true)
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

// ── Pre-submit failures & alert hygiene ──────────────────────────────

/** Let the fire-and-forget notification promises settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("TradingAgent — pre-submit failures and alert throttling", () => {
  it("a pre-submit failure queues no verification and alerts nobody", async () => {
    const guard = jest.spyOn(notificationService, "notifyTradeGuard").mockImplementation(async () => {})
    const executor = fakeExecutor({
      ok: false,
      rejected: false,
      uncertainty: false,
      preSubmit: true,
      reason: 'Market data unavailable for "BTC" (fetch failed) — no order was submitted.',
    })
    const store = stubStore({ ...seedState({ demoHistory: false }), pendingTrade: PENDING, approvalMode: "manual" })
    const agent = new TradingAgent(store, { ...DEFAULT_RISK, approvalMode: "manual" }, WALLET, {
      mode: "live",
      executor,
    })

    const result = await agent.approvePendingTrade()
    await flush()

    expect(result.ok).toBe(false)
    // Nothing was submitted → nothing is uncertain → nothing to verify.
    expect(store.get().verifying ?? []).toHaveLength(0)
    expect(store.get().positions).toHaveLength(0)
    expect(store.get().agent.status).toBe("running")
    expect(store.get().activity.some((a) => a.text.includes("Order not placed"))).toBe(true)
    // ...and the owner is not woken up for it.
    expect(guard).not.toHaveBeenCalled()
    guard.mockRestore()
  })

  it("notifies the owner once for repeated identical UNCERTAIN notices", async () => {
    const guard = jest.spyOn(notificationService, "notifyTradeGuard").mockImplementation(async () => {})
    const executor = fakeExecutor({ ok: false, rejected: false, uncertainty: true, reason: "timeout" })
    const store = stubStore({ ...seedState({ demoHistory: false }), pendingTrade: PENDING, approvalMode: "manual" })
    const agent = new TradingAgent(store, { ...DEFAULT_RISK, approvalMode: "manual" }, WALLET, {
      mode: "live",
      executor,
    })

    await agent.approvePendingTrade()
    await flush()
    const afterFirst = guard.mock.calls.length

    // The same failure repeats on the next attempt (as it did every tick on
    // 2026-10-15): still logged, but the push must not fire again.
    store.mutate((s) => {
      s.pendingTrade = { ...PENDING }
    })
    await agent.approvePendingTrade()
    await flush()

    expect(afterFirst).toBe(1)
    expect(guard).toHaveBeenCalledTimes(1)
    // Still fully audible in the activity feed (one guard entry per attempt) —
    // only the Telegram push is throttled.
    const guardEntries = store
      .get()
      .activity.filter((a) => a.type === "guard" && a.text.startsWith("Order status UNCERTAIN"))
    expect(guardEntries).toHaveLength(2)
    guard.mockRestore()
  })
})
