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

import { roundPriceToVenue, floorSizeToVenue, aggressivePrice } from "@/lib/trading/exchange"

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
