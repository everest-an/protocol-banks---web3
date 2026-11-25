import { generateRecoveryCode } from "@/lib/auth/recovery-code"

describe("generateRecoveryCode", () => {
  it("returns four 4-character segments in the documented format", () => {
    const code = generateRecoveryCode()
    expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/)
  })

  it("does not repeat across a large sample", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const code = generateRecoveryCode()
      expect(seen.has(code)).toBe(false)
      seen.add(code)
    }
  })

  it("produces segments from the full base36 alphabet over time", () => {
    const chars = new Set<string>()
    for (let i = 0; i < 200; i++) {
      for (const segment of generateRecoveryCode().split("-")) {
        for (const ch of segment) chars.add(ch)
      }
    }
    // A CSPRNG should touch most of 0-9/A-Z; this is a smoke test, not a
    // statistical proof. It catches an accidentally hard-coded alphabet.
    expect(chars.size).toBeGreaterThan(20)
  })
})
