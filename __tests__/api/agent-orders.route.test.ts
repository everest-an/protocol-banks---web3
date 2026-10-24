/**
 * The partner order endpoint: the risk envelope is the agent's, and the route
 * only validates the request, meters the fee and reports the guard's refusal.
 */
jest.mock("@/lib/middleware/api-key-auth", () => ({ withAPIKeyAuth: (handler: unknown) => handler }))
jest.mock("@/lib/trading/agent", () => ({ resolveAgentForWallet: jest.fn() }))
jest.mock("@/lib/analytics/events", () => ({ recordEvent: jest.fn() }))

import { POST } from "@/app/api/v1/agent/orders/route"
import { resolveAgentForWallet } from "@/lib/trading/agent"
import { recordEvent } from "@/lib/analytics/events"

const WALLET = "0x1111111111111111111111111111111111111111"
const resolveMock = resolveAgentForWallet as jest.Mock
const eventMock = recordEvent as jest.Mock

function req(body: unknown, owner: string | null = WALLET) {
  const request = new Request("https://protocolbanks.test/api/v1/agent/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as Request & { ownerAddress?: string }
  if (owner) request.ownerAddress = owner
  return request
}

function fakeAgent(result: unknown) {
  return { executeManualOrder: jest.fn().mockResolvedValue(result), isLive: () => true }
}

describe("POST /api/v1/agent/orders", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resolveMock.mockResolvedValue(fakeAgent({ ok: true, avgPx: 100, size: 1.5, notional: 150 }))
  })

  it("refuses a key with no owner address", async () => {
    const res = await POST(req({ coin: "BTC", side: "long", sizeUsd: 50 }, null) as never)
    expect(res.status).toBe(403)
    expect(resolveMock).not.toHaveBeenCalled()
  })

  it("validates the request body", async () => {
    expect((await POST(req({ coin: "", side: "long", sizeUsd: 50 }) as never)).status).toBe(400)
    expect((await POST(req({ coin: "BTC", side: "sideways", sizeUsd: 50 }) as never)).status).toBe(400)
    expect((await POST(req({ coin: "BTC", side: "long", sizeUsd: -5 }) as never)).status).toBe(400)
  })

  it("returns the fill, meters the fee, and lets the agent clamp the size", async () => {
    const agent = fakeAgent({ ok: true, avgPx: 100, size: 1.5, notional: 150 })
    resolveMock.mockResolvedValue(agent)

    const res = await POST(req({ coin: "btc", side: "long", sizeUsd: 5_000 }) as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.fill).toMatchObject({ coin: "BTC", side: "long", avgPx: 100 })
    expect(body.fee).toBeCloseTo(0.12, 4)
    expect(agent.executeManualOrder).toHaveBeenCalledWith(expect.objectContaining({ coin: "BTC", sizeUsd: 5000 }))
    expect(eventMock).toHaveBeenCalledWith(expect.objectContaining({ name: "partner_order", wallet: WALLET }))
  })

  it("surfaces a risk-guard refusal as 409 without metering it", async () => {
    resolveMock.mockResolvedValue(fakeAgent({ ok: false, reason: "max positions reached (3)" }))
    const res = await POST(req({ coin: "BTC", side: "short", sizeUsd: 50 }) as never)
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toMatch(/max positions/)
    expect(eventMock).not.toHaveBeenCalled()
  })
})
