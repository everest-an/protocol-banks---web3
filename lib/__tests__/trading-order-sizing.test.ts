/**
 * Order sizing rules — the venue constraints that made the first live order
 * unmatchable.
 *
 * The original implementation sent `p: "1e15"` (buy) / `"1"` (sell) and
 * `s: sizeUsd`, i.e. an extreme price and a size denominated in dollars. Both
 * are rejected by Hyperliquid: prices must sit inside the allowed band (the SDK
 * sends an aggressive *limit* price derived from the mid), and `s` is the size
 * in coins. These tests pin the corrected maths.
 */

import { Wallet } from "ethers"
import {
  roundPriceToVenue,
  floorSizeToVenue,
  aggressivePrice,
  placeMarketOrder,
} from "@/lib/trading/exchange"

describe("roundPriceToVenue (≤5 significant figures, ≤ 6 - szDecimals decimals)", () => {
  it("keeps 5 significant figures when the decimal clamp allows it", () => {
    expect(roundPriceToVenue(6012.3456789, 5)).toBe(6012.3)
  })

  it("applies the decimal clamp for coarse assets", () => {
    // szDecimals = 4 → at most 2 decimals
    expect(roundPriceToVenue(0.123456789, 4)).toBe(0.12)
  })

  it("does not add spurious decimals", () => {
    expect(roundPriceToVenue(123.456, 0)).toBe(123.46)
    expect(roundPriceToVenue(63000, 5)).toBe(63000)
  })

  it("never exceeds 5 significant figures after the clamp", () => {
    const p = roundPriceToVenue(9.99999, 5)
    expect(String(p).replace(/[^0-9]/g, "").replace(/^0+/, "").length).toBeLessThanOrEqual(5)
  })

  it("rejects non-positive / non-finite prices", () => {
    expect(() => roundPriceToVenue(0, 5)).toThrow()
    expect(() => roundPriceToVenue(-1, 5)).toThrow()
    expect(() => roundPriceToVenue(Number.NaN, 5)).toThrow()
  })
})

describe("floorSizeToVenue", () => {
  it("floors to the asset's size decimals (never rounds up)", () => {
    expect(floorSizeToVenue(0.001234567, 5)).toBe(0.00123)
    expect(floorSizeToVenue(1.999999, 2)).toBe(1.99)
    expect(floorSizeToVenue(11, 0)).toBe(11)
  })

  it("converts a dollar notional into a valid coin size", () => {
    // $11 of BTC at 60k with szDecimals=5 → 0.00018 BTC (~$10.80, over the $10 min)
    const size = floorSizeToVenue(11 / 60000, 5)
    expect(size).toBe(0.00018)
    expect(size * 60000).toBeGreaterThanOrEqual(10)
  })
})

describe("aggressivePrice (IOC market orders are aggressive limit orders)", () => {
  it("lifts the price for buys and cuts it for sells", () => {
    const mid = 60000
    const buy = aggressivePrice(mid, true, 0.05, 5)
    const sell = aggressivePrice(mid, false, 0.05, 5)
    expect(buy).toBeGreaterThan(mid)
    expect(sell).toBeLessThan(mid)
    expect(buy).toBe(63000)
    expect(sell).toBe(57000)
  })

  it("stays far inside any plausible price band", () => {
    const mid = 60000
    const buy = aggressivePrice(mid, true, 0.05, 5)
    // the old implementation used 1e15 — 10 orders of magnitude out
    expect(buy / mid).toBeLessThan(1.1)
  })

  it("returns a venue-clean price for coarse assets", () => {
    const px = aggressivePrice(0.1234, true, 0.05, 4)
    expect(px).toBe(0.13)
    expect(String(px).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2)
  })
})

/**
 * The helpers above are only half the story: what actually reaches the venue is
 * the assembled action. These tests capture the request body so a regression in
 * assembly (like re-introducing the dollar-denominated size) fails here instead
 * of at the venue with real money on the line.
 */
describe("placeMarketOrder assembles the exact wire action", () => {
  const wallet = Wallet.createRandom()
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  type Call = { url: string; body: Record<string, unknown> }

  function mockVenue(): Call[] {
    const calls: Call[] = []
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
      calls.push({ url, body })
      const payload = url.includes("/info")
        ? [
            { universe: [{ name: "BTC", szDecimals: 5 }] },
            [{ midPx: "60000", markPx: "60010" }],
          ]
        : { status: "ok", response: { data: { statuses: [{ resting: { oid: 1 } }] } } }
      return { ok: true, json: async () => payload } as unknown as Response
    }) as unknown as typeof fetch
    return calls
  }

  function exchangeCall(calls: Call[]): Record<string, unknown> {
    const call = calls.find((c) => c.url.includes("/exchange"))
    expect(call).toBeDefined()
    return call.body
  }

  it("sends an aggressive IOC limit price and a coin-denominated size", async () => {
    const calls = mockVenue()
    await placeMarketOrder({
      agentWallet: wallet,
      vaultAddress: null,
      coin: "BTC",
      isBuy: true,
      sizeUsd: 11,
    })

    const body = exchangeCall(calls)
    const action = body.action as { orders: Record<string, unknown>[]; grouping: string }

    // A normal account omits the vault, and the digest must agree with it.
    expect(body.vaultAddress).toBeNull()
    expect(action.grouping).toBe("na")
    expect(action.orders).toHaveLength(1)
    expect(action.orders[0]).toEqual({
      a: 0, // universe index
      b: true,
      p: "63000", // mid 60000 + 5% slippage, venue-clean
      s: "0.00018", // $11 / 60000 floored to szDecimals=5 (NOT "11")
      r: false,
      t: { limit: { tif: "Ioc" } },
    })
  })

  it("cuts the price and floors the size for a reduce-only close", async () => {
    const calls = mockVenue()
    await placeMarketOrder({
      agentWallet: wallet,
      vaultAddress: null,
      coin: "BTC",
      isBuy: false,
      sizeUsd: 11,
      sizeCoins: 0.000187, // exact position size, must floor rather than round up
      reduceOnly: true,
    })

    const action = exchangeCall(calls).action as { orders: Record<string, unknown>[] }
    expect(action.orders[0].b).toBe(false)
    expect(action.orders[0].p).toBe("57000") // mid − 5%
    expect(action.orders[0].s).toBe("0.00018")
    expect(action.orders[0].r).toBe(true)
  })

  it("refuses a notional below the venue minimum before signing anything", async () => {
    const calls = mockVenue()
    await expect(
      placeMarketOrder({ agentWallet: wallet, vaultAddress: null, coin: "BTC", isBuy: true, sizeUsd: 9 }),
    ).rejects.toThrow(/\$10 minimum/)
    expect(calls.some((c) => c.url.includes("/exchange"))).toBe(false)
  })

  it("refuses an unknown market", async () => {
    mockVenue()
    await expect(
      placeMarketOrder({ agentWallet: wallet, vaultAddress: null, coin: "NOPE", isBuy: true, sizeUsd: 11 }),
    ).rejects.toThrow(/Unknown market/)
  })
})
