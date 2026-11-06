import { hashTerms } from "@/lib/agent/commerce"

describe("agent commerce terms", () => {
  it("hashes the same object regardless of key order", () => {
    const a = hashTerms({ amount: 0.25, scope: "transcribe", terms: { deadline: "2026-01-01", refund: "full" } })
    const b = hashTerms({ terms: { refund: "full", deadline: "2026-01-01" }, scope: "transcribe", amount: 0.25 })
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })

  it("changes when the scope or amount changes", () => {
    const base = { amount: 0.25, scope: "transcribe" }
    expect(hashTerms(base)).not.toBe(hashTerms({ ...base, amount: 0.26 }))
    expect(hashTerms(base)).not.toBe(hashTerms({ ...base, scope: "translate" }))
  })
})
