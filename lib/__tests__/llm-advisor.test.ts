/**
 * Unit tests for the BYO-LLM advisor's pure pieces: the readiness gate, the
 * prompt (must stay PII-free) and the JSON answer parser.
 */
import { buildPrompt, parseProposal, readinessGate, type AdvisorSignalInput } from "@/lib/trading/llm-advisor"

const baseSignal: AdvisorSignalInput = {
  coin: "BTC",
  side: "long",
  score: 0.7,
  momentumZ: 1.6,
  funding: -0.0002,
  volumeUsd: 1_200_000_000,
  markPx: 86277,
}

describe("llm advisor", () => {
  describe("readinessGate", () => {
    it("opens for a strong momentum z-score", () => {
      expect(readinessGate({ ...baseSignal, momentumZ: 1.25, score: 0.1 })).toBe(true)
      expect(readinessGate({ ...baseSignal, momentumZ: -1.4, score: 0.1 })).toBe(true)
    })

    it("opens for a strong composite score", () => {
      expect(readinessGate({ ...baseSignal, momentumZ: 0.4, score: 0.5 })).toBe(true)
    })

    it("stays closed for marginal signals (token-cost control)", () => {
      expect(readinessGate({ ...baseSignal, momentumZ: 1.0, score: 0.3 })).toBe(false)
      expect(readinessGate({ ...baseSignal, momentumZ: -0.2, score: -0.4 })).toBe(false)
    })
  })

  describe("buildPrompt", () => {
    it("carries the market context but never wallet addresses or PII", () => {
      const prompt = buildPrompt({
        signal: baseSignal,
        equityUsd: 520.4,
        openPositions: ["ETH"],
      })
      expect(prompt).toContain("BTC")
      expect(prompt).toContain("long")
      expect(prompt).not.toMatch(/0x[a-fA-F0-9]{6,}/)
      expect(prompt.toLowerCase()).not.toContain("wallet")
    })
  })

  describe("parseProposal", () => {
    it("accepts a clean JSON answer", () => {
      const p = parseProposal('{"action":"skip","sizeFactor":0,"reason":"crowded"}')
      expect(p).toEqual({ action: "skip", sizeFactor: 0, reason: "crowded" })
    })

    it("extracts JSON embedded in prose", () => {
      const p = parseProposal('Sure! Here is my review: {"action":"proceed","sizeFactor":1,"reason":"ok"} — done.')
      expect(p?.action).toBe("proceed")
    })

    it("never lets the model grow size beyond 1", () => {
      const p = parseProposal('{"action":"proceed","sizeFactor":8,"reason":"yolo"}')
      expect(p?.sizeFactor).toBe(1)
    })

    it("clamps negative size to 0", () => {
      const p = parseProposal('{"action":"proceed","sizeFactor":-3,"reason":"?"}')
      expect(p?.sizeFactor).toBe(0)
    })

    it("rejects garbage, unknown actions and empty output", () => {
      expect(parseProposal("no json here")).toBeNull()
      expect(parseProposal('{"action":"double" }')).toBeNull()
      expect(parseProposal("")).toBeNull()
      expect(parseProposal("{broken")).toBeNull()
    })
  })
})
