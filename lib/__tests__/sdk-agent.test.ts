/**
 * The SDK's Agent module: auth header, paths, and the rule that a refusal is
 * returned (status + envelope), never thrown — a model must see it.
 */
import { ProtocolBanks } from "@everestan/protocolbanks-sdk"

const fetchMock = jest.fn()
const originalFetch = global.fetch

function reply(status: number, body: unknown) {
  return Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response)
}

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
})

afterAll(() => {
  global.fetch = originalFetch
})

describe("@everestan/protocolbanks-sdk — agent", () => {
  it("state: GET, bearer auth, and the status is carried on the body", async () => {
    fetchMock.mockReturnValueOnce(
      reply(200, {
        ok: true,
        mode: "paper",
        policy: {
          allowedOps: ["read"],
          maxNotionalUsd: 50,
          dailyCapUsd: 200,
          allowedCoins: [],
          spentTodayUsd: 0,
        },
      }),
    )

    const pb = new ProtocolBanks({ apiKey: "pb_test", baseUrl: "https://api.test" })
    const state = await pb.agent.state()

    expect(state.mode).toBe("paper")
    expect(state.policy?.spentTodayUsd).toBe(0)
    expect(state.status).toBe(200)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }]
    expect(url).toBe("https://api.test/api/v1/agent/state")
    expect(init.method).toBe("GET")
    expect(init.headers.Authorization).toBe("Bearer pb_test")
    expect(init.headers["Content-Type"]).toBeUndefined()
  })

  it("order: posts the body and returns a 403 refusal instead of throwing", async () => {
    fetchMock.mockReturnValueOnce(
      reply(403, { ok: false, error: "order of $5000.00 exceeds this key's per-call cap of $100" }),
    )

    const pb = new ProtocolBanks({ apiKey: "pb_test", baseUrl: "https://api.test" })
    const result = await pb.agent.order({ coin: "BTC", side: "long", sizeUsd: 5000 })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(403)
    expect(result.error).toMatch(/per-call cap/)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.test/api/v1/agent/orders")
    expect(init.method).toBe("POST")
    expect(init.body).toBe(JSON.stringify({ coin: "BTC", side: "long", sizeUsd: 5000 }))
  })

  it("pay, swap and invoice hit their endpoints", async () => {
    fetchMock
      .mockReturnValueOnce(reply(200, { ok: true, intent: { kind: "evm-transfer", remainingTodayUsd: 75 } }))
      .mockReturnValueOnce(reply(409, { ok: false, error: "no route for this pair right now" }))
      .mockReturnValueOnce(reply(200, { ok: true, invoice: { invoiceId: "INV-1", paymentLink: "https://x/pay" } }))

    const pb = new ProtocolBanks({ apiKey: "pb_test", baseUrl: "https://api.test" })

    const pay = await pb.agent.pay({ to: "0x" + "1".repeat(40), amountUsd: 25 })
    expect(pay.intent?.remainingTodayUsd).toBe(75)

    const swap = await pb.agent.swap({
      from: { symbol: "USDC", blockchain: "base" },
      to: { symbol: "ETH", blockchain: "base" },
      amount: "25",
      amountUsd: 25,
    })
    expect(swap.status).toBe(409)

    const invoice = await pb.agent.invoice({ to: "0x" + "1".repeat(40), amount: 25 })
    expect(invoice.invoice?.paymentLink).toBe("https://x/pay")

    const urls = fetchMock.mock.calls.map((call) => (call as [string])[0])
    expect(urls).toEqual([
      "https://api.test/api/v1/agent/pay",
      "https://api.test/api/v1/agent/swap",
      "https://api.test/api/v1/agent/invoice",
    ])
  })

  it("invoiceStatus reads the invoice with id and signature", async () => {
    fetchMock.mockReturnValueOnce(reply(200, { success: true, invoice: { invoice_id: "INV-1", status: "paid" } }))

    const pb = new ProtocolBanks({ apiKey: "pb_test", baseUrl: "https://api.test" })
    const result = await pb.agent.invoiceStatus("INV-1", "abc123")

    expect(result.ok).toBe(true)
    expect(result.invoice?.status).toBe("paid")
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe("https://api.test/api/invoice?id=INV-1&sig=abc123")
  })

  it("defaults the base URL to the production domain", async () => {
    fetchMock.mockReturnValueOnce(reply(200, { ok: true, mode: "paper" }))

    const pb = new ProtocolBanks({ apiKey: "pb_test" })
    await pb.agent.state()

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe("https://protocolbanks.com/api/v1/agent/state")
  })
})
