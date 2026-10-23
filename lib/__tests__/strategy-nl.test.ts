/**
 * The interpreter only proposes; resolveStrategyProfile still decides. These
 * tests pin the parser and the "never trust the model output" path.
 */
import { interpretStrategyRequest, parseStrategyIntent } from "@/lib/trading/strategy-nl"
import { resolveStrategyProfile } from "@/lib/trading/strategy-profile"

describe("strategy interpreter", () => {
  it("parses a clean proposal", () => {
    const p = parseStrategyIntent('{"preset":"conservative","overrides":{"leverage":1},"note":"fewer trades"}')
    expect(p).toEqual({ preset: "conservative", overrides: { leverage: 1 }, note: "fewer trades" })
  })

  it("extracts JSON from prose", () => {
    const p = parseStrategyIntent('Sure — {"preset":"momentum","overrides":{}} — done.')
    expect(p?.preset).toBe("momentum")
  })

  it("rejects unknown presets, arrays and garbage", () => {
    expect(parseStrategyIntent('{"preset":"degen"}')).toBeNull()
    expect(parseStrategyIntent("[1,2,3]")).toBeNull()
    expect(parseStrategyIntent("no json")).toBeNull()
    expect(parseStrategyIntent('{"preset":"momentum","overrides":[]}')).toBeNull()
  })

  it("keeps only scalar override values", () => {
    const p = parseStrategyIntent('{"preset":"balanced","overrides":{"leverage":2,"note":{"x":1},"s":"kept"}}')
    expect(p?.overrides).toEqual({ leverage: 2, s: "kept" })
  })

  it("still goes through the clamps — the model cannot raise risk past the bounds", () => {
    const p = parseStrategyIntent('{"preset":"aggressive","overrides":{"leverage":50,"maxPositions":99}}')
    const resolved = resolveStrategyProfile(p)
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.config.leverage).toBe(3)
    expect(resolved.config.maxPositions).toBe(5)
    expect(resolved.clamped.length).toBeGreaterThan(0)
  })

  it("answers 'unavailable' when the model fails, instead of inventing a config", async () => {
    const r = await interpretStrategyRequest("make it safer", async () => null)
    expect(r.ok).toBe(false)
  })

  it("passes the request through the completer and parses the answer", async () => {
    let seen = ""
    const r = await interpretStrategyRequest("trade less, one position at a time", async (_sys, user) => {
      seen = user
      return { raw: '{"preset":"conservative","overrides":{"maxPositions":1},"note":"one at a time"}' }
    })
    expect(seen).toContain("trade less")
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.intent.overrides).toEqual({ maxPositions: 1 })
  })
})
