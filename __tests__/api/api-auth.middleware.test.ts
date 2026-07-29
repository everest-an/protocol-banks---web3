/**
 * Security tests for lib/middleware/api-auth.ts
 *
 * Regression suite for the P0 impersonation bypass: previously any request
 * carrying a well-formed `x-wallet-address` header was treated as
 * authenticated, letting anyone act as any address. requireAuth must now
 * only accept verifiable credentials (SIWE JWT / session cookie).
 */

import type { NextRequest } from "next/server"

jest.mock("@/lib/logger/structured-logger", () => ({
  logger: {
    logSecurityEvent: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

// Session-cookie path: default to "no session" (unit tests have no request scope)
const mockVerifySession = jest.fn()
jest.mock("@/lib/auth/session", () => ({
  verifySession: (...args: unknown[]) => mockVerifySession(...args),
}))

const WALLET = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb2"
const OTHER_WALLET = "0x1111111111111111111111111111111111111111"

let signJwt: (address: string) => Promise<{ token: string; expiresAt: string }>
let requireAuth: typeof import("@/lib/middleware/api-auth").requireAuth

beforeAll(async () => {
  process.env.AI_JWT_SECRET = "test-jwt-secret"
  ;({ signJwt } = await import("@/lib/auth/jwt"))
  ;({ requireAuth } = await import("@/lib/middleware/api-auth"))
})

beforeEach(() => {
  mockVerifySession.mockResolvedValue(null)
  delete process.env.ALLOW_INSECURE_HEADER_AUTH
})

function makeRequest(headers: Record<string, string>): NextRequest {
  return new Request("http://localhost:3000/api/payments", {
    headers,
  }) as unknown as NextRequest
}

describe("requireAuth — impersonation bypass is closed", () => {
  it("rejects a request with only an x-wallet-address header (the old bypass)", async () => {
    const auth = await requireAuth(makeRequest({ "x-wallet-address": WALLET }))
    expect(auth.address).toBeNull()
    expect(auth.error?.status).toBe(401)
  })

  it("rejects the legacy x-user-address header alone", async () => {
    const auth = await requireAuth(makeRequest({ "x-user-address": WALLET }))
    expect(auth.address).toBeNull()
    expect(auth.error?.status).toBe(401)
  })

  it("rejects a request with no credentials at all", async () => {
    const auth = await requireAuth(makeRequest({}))
    expect(auth.address).toBeNull()
    expect(auth.error?.status).toBe(401)
  })

  it("rejects an invalid Bearer token even with a wallet header", async () => {
    const auth = await requireAuth(
      makeRequest({
        authorization: "Bearer not-a-real-token",
        "x-wallet-address": WALLET,
      })
    )
    expect(auth.address).toBeNull()
    expect(auth.error?.status).toBe(401)
  })
})

describe("requireAuth — valid credentials", () => {
  it("accepts a valid SIWE JWT", async () => {
    const { token } = await signJwt(WALLET)
    const auth = await requireAuth(makeRequest({ authorization: `Bearer ${token}` }))
    expect(auth.error).toBeNull()
    expect(auth.address?.toLowerCase()).toBe(WALLET.toLowerCase())
  })

  it("accepts a valid JWT with a matching x-wallet-address header", async () => {
    const { token } = await signJwt(WALLET)
    const auth = await requireAuth(
      makeRequest({
        authorization: `Bearer ${token}`,
        "x-wallet-address": WALLET.toLowerCase(),
      })
    )
    expect(auth.error).toBeNull()
    expect(auth.address?.toLowerCase()).toBe(WALLET.toLowerCase())
  })

  it("rejects (403) a valid JWT with a MISMATCHED x-wallet-address header", async () => {
    const { token } = await signJwt(WALLET)
    const auth = await requireAuth(
      makeRequest({
        authorization: `Bearer ${token}`,
        "x-wallet-address": OTHER_WALLET,
      })
    )
    expect(auth.address).toBeNull()
    expect(auth.error?.status).toBe(403)
  })

  it("accepts a session cookie identity (email/OAuth users)", async () => {
    mockVerifySession.mockResolvedValue({
      userId: "u1",
      email: "user@example.com",
      walletAddress: WALLET,
      expiresAt: new Date(Date.now() + 86400000),
    })
    const auth = await requireAuth(makeRequest({}))
    expect(auth.error).toBeNull()
    expect(auth.address?.toLowerCase()).toBe(WALLET.toLowerCase())
  })

  it("rejects (403) a session identity with a mismatched wallet header", async () => {
    mockVerifySession.mockResolvedValue({
      userId: "u1",
      email: "user@example.com",
      walletAddress: WALLET,
      expiresAt: new Date(Date.now() + 86400000),
    })
    const auth = await requireAuth(makeRequest({ "x-wallet-address": OTHER_WALLET }))
    expect(auth.address).toBeNull()
    expect(auth.error?.status).toBe(403)
  })
})

describe("requireAuth — development escape hatch", () => {
  it("trusts the raw header only when ALLOW_INSECURE_HEADER_AUTH=true", async () => {
    process.env.ALLOW_INSECURE_HEADER_AUTH = "true"
    const auth = await requireAuth(makeRequest({ "x-wallet-address": WALLET }))
    expect(auth.error).toBeNull()
    expect(auth.address).toBe(WALLET)
  })

  it("still rejects malformed addresses in insecure mode", async () => {
    process.env.ALLOW_INSECURE_HEADER_AUTH = "true"
    const auth = await requireAuth(makeRequest({ "x-wallet-address": "0xnot-valid" }))
    expect(auth.address).toBeNull()
    expect(auth.error?.status).toBe(401)
  })
})
