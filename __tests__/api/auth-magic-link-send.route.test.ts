import { POST } from "@/app/api/auth/magic-link/send/route"
import { prisma } from "@/lib/prisma"
import { generateSecureToken, sha256 } from "@/lib/auth/crypto"
import { Resend } from "resend"

jest.mock("@/lib/prisma", () => ({
  prisma: {
    magicLink: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

jest.mock("@/lib/auth/crypto", () => ({
  generateSecureToken: jest.fn(),
  sha256: jest.fn(),
}))

jest.mock("resend", () => ({
  Resend: jest.fn(),
}))

describe("POST /api/auth/magic-link/send", () => {
  const prismaMock = prisma as unknown as {
    magicLink: {
      findMany: jest.Mock
      create: jest.Mock
    }
  }

  const generateSecureTokenMock = generateSecureToken as jest.Mock
  const sha256Mock = sha256 as jest.Mock
  const ResendMock = Resend as unknown as jest.Mock

  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-resend-key"
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"

    prismaMock.magicLink.findMany.mockResolvedValue([])
    prismaMock.magicLink.create.mockResolvedValue({ id: "ml_1" })
    generateSecureTokenMock.mockReturnValue("token_123")
    sha256Mock.mockResolvedValue("hashed_token_123")

    ResendMock.mockImplementation(() => ({
      emails: {
        send: jest.fn().mockResolvedValue({
          data: { id: "email_1" },
          error: null,
        }),
      },
    }))
  })

  it("returns 400 when email is missing", async () => {
    const request = new Request("http://localhost/api/auth/magic-link/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    })

    const response = await POST(request as any)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe("Email is required")
  })

  it("returns 429 when cooldown is active", async () => {
    prismaMock.magicLink.findMany.mockResolvedValue([{ id: "recent_link" }])

    const request = new Request("http://localhost/api/auth/magic-link/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    })

    const response = await POST(request as any)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error).toContain("Please wait")
    expect(prismaMock.magicLink.create).not.toHaveBeenCalled()
  })

  it("sends magic link successfully", async () => {
    const request = new Request("http://localhost/api/auth/magic-link/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "1.2.3.4",
        "user-agent": "jest-test",
      },
      body: JSON.stringify({ email: "user@example.com" }),
    })

    const response = await POST(request as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(prismaMock.magicLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "user@example.com",
          token_hash: "hashed_token_123",
        }),
      }),
    )

    expect(ResendMock).toHaveBeenCalledWith("test-resend-key")
  })
})
