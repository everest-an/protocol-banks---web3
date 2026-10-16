/**
 * Unit tests for the BYO-LLM advisor's pure pieces: the readiness gate, the
 * prompt (must stay PII-free) and the JSON answer parser.
 */
import {
  adviseOnSignal,
  buildPrompt,
  parseProposal,
  readinessGate,
  resetChannelHealth,
  type AdvisorSignalInput,
} from "@/lib/trading/llm-advisor"

// The advisor reads the user's BYO key from the database when one is stored.
// These tests exercise the platform channels only, so the keys module is
// stubbed out and no per-user channel can exist.
jest.mock("@/lib/trading/keys", () => ({
  hasKeySecret: () => false,
  openSecret: jest.fn(),
}))

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

  /**
   * 2026-10-15: the platform OpenRouter key ran out of credits and 402'd every
   * call, so each consultation paid a dead round-trip before reaching the
   * working channel. Channel order is now configurable and an auth/billing
   * refusal parks the channel for a cooldown.
   */
  describe("platform channel order and health", () => {
    const WALLET = "0x1111111111111111111111111111111111111111"
    const request = { signal: baseSignal, equityUsd: 100, openPositions: [] as string[] }
    const saved = {
      openrouter: process.env.OPENROUTER_API_KEY,
      deepseek: process.env.DEEPSEEK_API_KEY,
      order: process.env.LLM_PLATFORM_ORDER,
    }

    /** A channel answer carrying a usable proposal. */
    const ok = (content = '{"action":"skip","sizeFactor":0,"reason":"marginal"}') => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content } }] }),
    })
    const outOfCredits = () => ({ ok: false, status: 402, json: async () => ({}) })

    function mockFetch(handler: (url: string) => unknown) {
      const calls: string[] = []
      global.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input)
        calls.push(url)
        return handler(url)
      }) as unknown as typeof fetch
      return calls
    }

    beforeEach(() => {
      resetChannelHealth()
      process.env.OPENROUTER_API_KEY = "or-key"
      process.env.DEEPSEEK_API_KEY = "ds-key"
      delete process.env.LLM_PLATFORM_ORDER
    })

    afterEach(() => {
      resetChannelHealth()
      if (saved.openrouter) process.env.OPENROUTER_API_KEY = saved.openrouter
      else delete process.env.OPENROUTER_API_KEY
      if (saved.deepseek) process.env.DEEPSEEK_API_KEY = saved.deepseek
      else delete process.env.DEEPSEEK_API_KEY
      if (saved.order) process.env.LLM_PLATFORM_ORDER = saved.order
      else delete process.env.LLM_PLATFORM_ORDER
      jest.useRealTimers()
      jest.restoreAllMocks()
    })

    it("tries the channels in LLM_PLATFORM_ORDER order", async () => {
      process.env.LLM_PLATFORM_ORDER = "deepseek,openrouter"
      const calls = mockFetch(() => ok())

      const proposal = await adviseOnSignal(WALLET, request)

      expect(proposal?.action).toBe("skip")
      expect(calls).toHaveLength(1)
      expect(calls[0]).toContain("api.deepseek.com")
    })

    it("falls back to the next channel when one is out of credits", async () => {
      process.env.LLM_PLATFORM_ORDER = "openrouter,deepseek"
      const calls = mockFetch((url) => (url.includes("openrouter.ai") ? outOfCredits() : ok()))

      const proposal = await adviseOnSignal(WALLET, request)

      expect(proposal?.action).toBe("skip")
      expect(calls.map((u) => (u.includes("openrouter.ai") ? "or" : "ds"))).toEqual(["or", "ds"])
    })

    it("skips a channel that refused on billing grounds for the next consultations", async () => {
      process.env.LLM_PLATFORM_ORDER = "openrouter,deepseek"
      const calls = mockFetch((url) => (url.includes("openrouter.ai") ? outOfCredits() : ok()))

      await adviseOnSignal(WALLET, request) // pays for the 402 once
      const firstRound = calls.length
      await adviseOnSignal(WALLET, request) // must go straight to DeepSeek

      expect(firstRound).toBe(2)
      expect(calls.slice(firstRound)).toHaveLength(1)
      expect(calls[calls.length - 1]).toContain("api.deepseek.com")
    })

    it("tries the parked channel again after the cooldown", async () => {
      jest.useFakeTimers()
      process.env.LLM_PLATFORM_ORDER = "openrouter,deepseek"
      const calls = mockFetch((url) => (url.includes("openrouter.ai") ? outOfCredits() : ok()))

      await adviseOnSignal(WALLET, request)
      jest.setSystemTime(Date.now() + 11 * 60_000) // past the 10-minute cooldown
      await adviseOnSignal(WALLET, request)

      // OpenRouter is attempted again (and 402s again), then DeepSeek answers.
      expect(calls.filter((u) => u.includes("openrouter.ai"))).toHaveLength(2)
    })

    it("keeps a channel in rotation after a transient per-request failure", async () => {
      process.env.LLM_PLATFORM_ORDER = "openrouter,deepseek"
      const calls = mockFetch((url) => {
        if (url.includes("openrouter.ai")) throw new Error("The operation was aborted due to timeout")
        return ok()
      })

      await adviseOnSignal(WALLET, request)
      await adviseOnSignal(WALLET, request)

      // A timeout says nothing about the account: both consultations try it.
      expect(calls.filter((u) => u.includes("openrouter.ai"))).toHaveLength(2)
    })
  })
})
