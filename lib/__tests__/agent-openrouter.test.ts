import { callPriceUsd, normalizeMaxTokens, normalizeMessages, normalizeModel, OpenRouterError } from "../agent/openrouter"

describe("paid model gateway validation", () => {
  it("defaults the call price to one cent", () => {
    const previous = process.env.AGENT_LLM_PRICE_USD
    delete process.env.AGENT_LLM_PRICE_USD
    expect(callPriceUsd()).toBe(0.01)
    process.env.AGENT_LLM_PRICE_USD = "0.02"
    expect(callPriceUsd()).toBe(0.02)
    if (previous === undefined) delete process.env.AGENT_LLM_PRICE_USD
    else process.env.AGENT_LLM_PRICE_USD = previous
  })

  it("accepts a bounded chat message list", () => {
    expect(normalizeMessages([{ role: "user", content: "hello" }])).toEqual([{ role: "user", content: "hello" }])
    expect(() => normalizeMessages([])).toThrow(OpenRouterError)
    expect(() => normalizeMessages([{ role: "tool", content: "x" }])).toThrow(OpenRouterError)
    expect(() => normalizeMessages([{ role: "user", content: " " }])).toThrow(OpenRouterError)
  })

  it("accepts OpenRouter free-model ids and rejects injection-shaped model strings", () => {
    expect(normalizeModel("liquid/lfm-3-1.7b:free")).toBe("liquid/lfm-3-1.7b:free")
    expect(() => normalizeModel("../../etc/passwd")).toThrow(OpenRouterError)
  })

  it("bounds max_tokens", () => {
    expect(normalizeMaxTokens(20)).toBe(20)
    expect(() => normalizeMaxTokens(0)).toThrow(OpenRouterError)
    expect(() => normalizeMaxTokens(2001)).toThrow(OpenRouterError)
  })
})
