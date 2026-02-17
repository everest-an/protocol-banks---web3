import { GET, POST } from "@/app/api/acquiring/merchants/route"
import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/auth/session"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    authUser: {
      findUnique: jest.fn(),
    },
    merchant: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    merchantApiKey: {
      create: jest.fn(),
    },
  },
}))

jest.mock("@/lib/auth/session", () => ({
  verifySession: jest.fn(),
}))

describe("/api/acquiring/merchants", () => {
  const prismaMock = prisma as unknown as {
    authUser: { findUnique: jest.Mock }
    merchant: { create: jest.Mock; findMany: jest.Mock }
    merchantApiKey: { create: jest.Mock }
  }

  const verifySessionMock = verifySession as jest.Mock

  beforeEach(() => {
    verifySessionMock.mockResolvedValue({ userId: "user_1" })
    prismaMock.authUser.findUnique.mockResolvedValue({ id: "user_1" })
    prismaMock.merchant.create.mockResolvedValue({
      id: "m_1",
      user_id: "user_1",
      name: "Test Merchant",
      wallet_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
      status: "active",
    })
    prismaMock.merchantApiKey.create.mockResolvedValue({ id: "k_1" })
    prismaMock.merchant.findMany.mockResolvedValue([{ id: "m_1", name: "Test Merchant" }])
  })

  it("POST returns 401 when session is missing", async () => {
    verifySessionMock.mockResolvedValueOnce(null)

    const request = new Request("http://localhost/api/acquiring/merchants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Merchant", wallet_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2" }),
    })

    const response = await POST(request as any)
    expect(response.status).toBe(401)
  })

  it("POST creates merchant and API key", async () => {
    const request = new Request("http://localhost/api/acquiring/merchants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Test Merchant",
        wallet_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2",
      }),
    })

    const response = await POST(request as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prismaMock.merchant.create).toHaveBeenCalled()
    expect(prismaMock.merchantApiKey.create).toHaveBeenCalled()
    expect(body.api_key).toEqual(
      expect.objectContaining({
        key_id: expect.stringMatching(/^pk_/),
        key_secret: expect.stringMatching(/^sk_/),
      }),
    )
  })

  it("GET returns merchant list for authenticated user", async () => {
    const request = new Request("http://localhost/api/acquiring/merchants", {
      method: "GET",
    })

    const response = await GET(request as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(Array.isArray(body.merchants)).toBe(true)
    expect(prismaMock.merchant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id: "user_1" },
      }),
    )
  })
})
