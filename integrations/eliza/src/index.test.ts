import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const { stateMock, orderMock } = vi.hoisted(() => ({ stateMock: vi.fn(), orderMock: vi.fn() }))

vi.mock("@everestan/protocolbanks-sdk", () => ({
  ProtocolBanks: class {
    agent = { state: stateMock, order: orderMock }
  },
}))

import protocolBanksPlugin, { protocolBanksPlugin as named } from "./index"

const plugin = protocolBanksPlugin
const action = (name: string) => plugin.actions!.find((candidate) => candidate.name === name)!
const provider = plugin.providers![0]

type Handler = (
  runtime: unknown,
  message: unknown,
  state: unknown,
  options: unknown,
  callback: unknown,
) => Promise<{ success: boolean; text?: string }>

const runAction = (name: string, content: Record<string, unknown>) =>
  (action(name).handler as unknown as Handler)({}, { content }, {}, {}, undefined)

beforeEach(() => {
  vi.clearAllMocks()
  process.env.PB_KEY = "pb_test"
})

afterAll(() => {
  delete process.env.PB_KEY
})

describe("protocol banks eliza plugin", () => {
  it("registers one provider and two actions", () => {
    expect(named).toBe(plugin)
    expect(plugin.name).toBe("protocol-banks")
    expect(plugin.providers?.map((entry) => entry.name)).toEqual(["PROTOCOL_BANKS_STATE"])
    expect(plugin.actions?.map((entry) => entry.name)).toEqual(["PROTOCOL_BANKS_STATE", "PROTOCOL_BANKS_ORDER"])
  })

  it("refuses an order without structured args (no prose parsing)", async () => {
    const result = await runAction("PROTOCOL_BANKS_ORDER", { text: "buy twenty dollars of btc" })

    expect(result.success).toBe(false)
    expect(result.text).toMatch(/structured arguments/i)
    expect(orderMock).not.toHaveBeenCalled()
  })

  it("places a structured order and reports the fill", async () => {
    orderMock.mockResolvedValue({
      ok: true,
      status: 200,
      fill: { coin: "BTC", side: "long", avgPx: 80_000, notional: 20 },
      remainingTodayUsd: 180,
    })

    const result = await runAction("PROTOCOL_BANKS_ORDER", { coin: "BTC", side: "long", sizeUsd: 20 })

    expect(orderMock).toHaveBeenCalledWith({ coin: "BTC", side: "long", sizeUsd: 20, reason: undefined })
    expect(result.success).toBe(true)
    expect(result.text).toMatch(/Filled BTC long/)
    expect(result.text).toMatch(/remaining today \$180/)
  })

  it("returns a policy refusal as text, not an exception", async () => {
    orderMock.mockResolvedValue({ ok: false, status: 403, error: 'this key may not perform "trade"' })

    const result = await runAction("PROTOCOL_BANKS_ORDER", { coin: "BTC", side: "long", sizeUsd: 5_000 })

    expect(result.success).toBe(false)
    expect(result.text).toMatch(/Refused \(403\)/)
    expect(result.text).toMatch(/may not perform/)
  })

  it("reads the account", async () => {
    stateMock.mockResolvedValue({
      status: 200,
      mode: "paper",
      account: { totalEquity: 500 },
      positions: [],
      policy: { allowedOps: ["read"] },
    })

    const result = await runAction("PROTOCOL_BANKS_STATE", {})

    expect(result.success).toBe(true)
    expect(result.text).toContain("mode=paper")
    expect(result.text).toContain("equity=$500")
  })

  it("injects the account into context via the provider", async () => {
    stateMock.mockResolvedValue({
      status: 200,
      mode: "paper",
      account: { totalEquity: 500 },
      positions: [{ symbol: "BTC" }],
      policy: { allowedOps: ["read"] },
    })

    const get = provider.get as unknown as (runtime: unknown, message: unknown, state: unknown) => Promise<{ text?: string }>
    const result = await get({}, {}, {})

    expect(result.text).toContain("mode=paper")
    expect(result.text).toContain("positions=1")
  })
})
