/**
 * Unit tests for the request-scoped RLS identity.
 */
import {
  runWithWallet,
  runAsSystem,
  currentRlsContext,
  currentWallet,
  runInsideScopedTx,
  insideScopedTx,
} from "@/lib/rls/context"

describe("rls context", () => {
  test("no context by default", () => {
    expect(currentRlsContext()).toBeUndefined()
    expect(currentWallet()).toBeUndefined()
    expect(insideScopedTx()).toBe(false)
  })

  test("runWithWallet exposes a lower-cased wallet", () => {
    runWithWallet("0xBf0D7119F553eB5f85C9806f0849f9c86a9B768C", () => {
      expect(currentWallet()).toBe("0xbf0d7119f553eb5f85c9806f0849f9c86a9b768c")
      expect(currentRlsContext()).toEqual({
        kind: "user",
        wallet: "0xbf0d7119f553eb5f85c9806f0849f9c86a9b768c",
      })
    })
  })

  test("runAsSystem has no wallet", () => {
    runAsSystem(() => {
      expect(currentRlsContext()).toEqual({ kind: "system" })
      expect(currentWallet()).toBeUndefined()
    })
  })

  test("context propagates across awaits", async () => {
    await runWithWallet("0xAbC", async () => {
      await new Promise((resolve) => setTimeout(resolve, 1))
      expect(currentWallet()).toBe("0xabc")
    })
  })

  test("scoped-transaction marker is scoped and propagates", async () => {
    expect(insideScopedTx()).toBe(false)
    await runInsideScopedTx(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1))
      expect(insideScopedTx()).toBe(true)
    })
    expect(insideScopedTx()).toBe(false)
  })
})
