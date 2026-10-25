/**
 * The agent invoice endpoint: address and amount validation, the key's policy,
 * and no money movement. Prisma is mocked; the logic is not.
 */
jest.mock("@/lib/middleware/api-key-auth", () => ({ withAPIKeyAuth: (handler: unknown) => handler }))
jest.mock("@/lib/prisma", () => ({ prisma: { invoice: { create: jest.fn() } } }))
jest.mock("@/lib/analytics/events", () => ({ recordEvent: jest.fn() }))

import { POST } from "@/app/api/v1/agent/invoice/route"
import { prisma } from "@/lib/prisma"

const WALLET = "0x1111111111111111111111111111111111111111"
const TO = "0x2222222222222222222222222222222222222222"
const createMock = (prisma.invoice as unknown as { create: jest.Mock }).create

function req(body: unknown, owner: string | null = WALLET) {
  const request = new Request("https://protocolbanks.test/api/v1/agent/invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as Request & { ownerAddress?: string }
  if (owner) request.ownerAddress = owner
  return request
}

describe("POST /api/v1/agent/invoice", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    createMock.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data)
  })

  it("rejects a bad address and a bad amount", async () => {
    expect((await POST(req({ to: "nope", amount: 10 }) as never)).status).toBe(400)
    expect((await POST(req({ to: TO, amount: -1 }) as never)).status).toBe(400)
    expect(createMock).not.toHaveBeenCalled()
  })

  it("refuses an amount above the key's per-call cap", async () => {
    const res = await POST(req({ to: TO, amount: 5_000 }) as never)
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.error).toMatch(/per-call cap/)
    expect(createMock).not.toHaveBeenCalled()
  })

  it("creates a pending invoice with the policy-checked amount", async () => {
    const res = await POST(req({ to: TO, amount: 25, description: "agent work" }) as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.invoice.invoiceId).toMatch(/^INV-/)
    expect(body.invoice).toMatchObject({ to: TO, amount: 25, token: "USDC", chain: "Ethereum", status: "pending" })
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recipient_address: TO, amount: 25, token: "USDC", status: "pending" }),
      }),
    )
  })

  it("defaults a TRON recipient to the TRON chain", async () => {
    const tron = "T123456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    const res = await POST(req({ to: tron, amount: 10 }) as never)
    const body = await res.json()
    expect(body.invoice.chain).toBe("TRON")
  })
})
