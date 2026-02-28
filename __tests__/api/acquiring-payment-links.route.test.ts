import { DELETE, GET, PATCH, POST } from "@/app/api/acquiring/payment-links/route"
import { prisma } from "@/lib/prisma"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    paymentLink: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

// Mock the logger so security events don't error in tests
jest.mock("@/lib/logger/structured-logger", () => ({
  logger: {
    logSecurityEvent: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

const WALLET = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2"

function makeRequest(method: string, url: string, body?: Record<string, unknown>, authenticated = true) {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (authenticated) headers["x-wallet-address"] = WALLET
  return new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe("/api/acquiring/payment-links", () => {
  const prismaMock = prisma as unknown as {
    paymentLink: {
      create: jest.Mock
      findUnique: jest.Mock
      findMany: jest.Mock
      count: jest.Mock
      update: jest.Mock
      delete: jest.Mock
    }
  }

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
    process.env.PAYMENT_LINK_SECRET = "test-secret"

    prismaMock.paymentLink.create.mockResolvedValue({
      id: "pl_1",
      link_id: "PL-TEST",
      recipient_address: WALLET,
      status: "active",
    })
    prismaMock.paymentLink.findUnique.mockResolvedValue({ link_id: "PL-TEST" })
    prismaMock.paymentLink.findMany.mockResolvedValue([{ link_id: "PL-TEST" }])
    prismaMock.paymentLink.count.mockResolvedValue(1)
    prismaMock.paymentLink.update.mockResolvedValue({ link_id: "PL-TEST", status: "paused" })
    prismaMock.paymentLink.delete.mockResolvedValue({ link_id: "PL-TEST" })
  })

  it("POST returns 401 when unauthenticated", async () => {
    const request = makeRequest(
      "POST",
      "http://localhost/api/acquiring/payment-links",
      { recipientAddress: WALLET, amountType: "fixed", amount: "10" },
      false // no auth header
    )

    const response = await POST(request as any)
    expect(response.status).toBe(401)
  })

  it("POST creates payment link", async () => {
    const request = makeRequest("POST", "http://localhost/api/acquiring/payment-links", {
      recipientAddress: WALLET,
      amountType: "fixed",
      amount: "10",
      token: "USDC",
      title: "Pay me",
    })

    const response = await POST(request as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.shortUrl).toContain("/p/")
    expect(prismaMock.paymentLink.create).toHaveBeenCalled()
  })

  it("GET returns single link by linkId", async () => {
    const request = makeRequest("GET", "http://localhost/api/acquiring/payment-links?linkId=PL-TEST")

    const response = await GET(request as any)
    expect(response.status).toBe(200)
    expect(prismaMock.paymentLink.findUnique).toHaveBeenCalledWith({ where: { link_id: "PL-TEST" } })
  })

  it("PATCH updates link", async () => {
    const request = makeRequest("PATCH", "http://localhost/api/acquiring/payment-links", {
      linkId: "PL-TEST",
      status: "paused",
    })

    const response = await PATCH(request as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prismaMock.paymentLink.update).toHaveBeenCalled()
  })

  it("DELETE removes link", async () => {
    const request = makeRequest("DELETE", "http://localhost/api/acquiring/payment-links?linkId=PL-TEST")

    const response = await DELETE(request as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prismaMock.paymentLink.delete).toHaveBeenCalledWith({ where: { link_id: "PL-TEST" } })
  })
})
