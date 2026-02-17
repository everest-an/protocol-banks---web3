import { DELETE, GET, PATCH, POST } from "@/app/api/acquiring/payment-links/route"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedAddress } from "@/lib/api-auth"

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

jest.mock("@/lib/api-auth", () => ({
  getAuthenticatedAddress: jest.fn(),
}))

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

  const getAuthenticatedAddressMock = getAuthenticatedAddress as jest.Mock

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
    process.env.PAYMENT_LINK_SECRET = "test-secret"
    getAuthenticatedAddressMock.mockResolvedValue("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2")

    prismaMock.paymentLink.create.mockResolvedValue({
      id: "pl_1",
      link_id: "PL-TEST",
      recipient_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
      status: "active",
    })
    prismaMock.paymentLink.findUnique.mockResolvedValue({ link_id: "PL-TEST" })
    prismaMock.paymentLink.findMany.mockResolvedValue([{ link_id: "PL-TEST" }])
    prismaMock.paymentLink.count.mockResolvedValue(1)
    prismaMock.paymentLink.update.mockResolvedValue({ link_id: "PL-TEST", status: "paused" })
    prismaMock.paymentLink.delete.mockResolvedValue({ link_id: "PL-TEST" })
  })

  it("POST returns 401 when unauthenticated", async () => {
    getAuthenticatedAddressMock.mockResolvedValueOnce(null)

    const request = new Request("http://localhost/api/acquiring/payment-links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipientAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2", amountType: "fixed", amount: "10" }),
    })

    const response = await POST(request as any)
    expect(response.status).toBe(401)
  })

  it("POST creates payment link", async () => {
    const request = new Request("http://localhost/api/acquiring/payment-links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipientAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
        amountType: "fixed",
        amount: "10",
        token: "USDC",
        title: "Pay me",
      }),
    })

    const response = await POST(request as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.shortUrl).toContain("/p/")
    expect(prismaMock.paymentLink.create).toHaveBeenCalled()
  })

  it("GET returns single link by linkId", async () => {
    const request = new Request("http://localhost/api/acquiring/payment-links?linkId=PL-TEST", {
      method: "GET",
    })

    const response = await GET(request as any)
    expect(response.status).toBe(200)
    expect(prismaMock.paymentLink.findUnique).toHaveBeenCalledWith({ where: { link_id: "PL-TEST" } })
  })

  it("PATCH updates link", async () => {
    const request = new Request("http://localhost/api/acquiring/payment-links", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ linkId: "PL-TEST", status: "paused" }),
    })

    const response = await PATCH(request as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prismaMock.paymentLink.update).toHaveBeenCalled()
  })

  it("DELETE removes link", async () => {
    const request = new Request("http://localhost/api/acquiring/payment-links?linkId=PL-TEST", {
      method: "DELETE",
    })

    const response = await DELETE(request as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prismaMock.paymentLink.delete).toHaveBeenCalledWith({ where: { link_id: "PL-TEST" } })
  })
})
