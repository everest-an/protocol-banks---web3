/**
 * Creating an API key from Settings: the agent policy is resolved and clamped
 * server-side, and a key created without one starts read-only — never with the
 * legacy all-ops defaults.
 */
const mockCreate = jest.fn()

jest.mock("@/lib/middleware/api-auth", () => ({
  withAuth:
    (handler: (request: Request, address: string) => Promise<Response>) =>
    (request: Request) =>
      handler(request, "0x1111111111111111111111111111111111111111"),
}))

jest.mock("@/lib/services/api-key-service", () => ({
  APIKeyService: jest.fn().mockImplementation(() => ({ create: mockCreate })),
}))

import { POST } from "@/app/api/settings/api-keys/route"

function req(body: unknown) {
  return new Request("https://protocolbanks.test/api/settings/api-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/settings/api-keys", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreate.mockImplementation(async ({ name, policy }: { name: string; policy: unknown }) => ({
      key: {
        id: "key-1",
        name,
        key_prefix: "pb_12345678",
        permissions: ["read", "write"],
        policy,
        rate_limit_per_minute: 60,
        rate_limit_per_day: 10000,
        expires_at: undefined,
        created_at: new Date().toISOString(),
      },
      secret: "pb_" + "a".repeat(64),
    }))
  })

  it("gives a key created without a policy the strict read-only defaults", async () => {
    const res = await POST(req({ name: "no policy" }) as never)
    expect(res.status).toBe(201)

    const { policy } = mockCreate.mock.calls[0][0] as { policy: Record<string, unknown> }
    expect(policy).toEqual({ allowedOps: ["read"], maxNotionalUsd: 50, dailyCapUsd: 200, allowedCoins: [] })
  })

  it("clamps an explicit policy and upper-cases the coin allowlist", async () => {
    const res = await POST(
      req({
        name: "trade",
        permissions: ["read", "write"],
        policy: {
          allowedOps: ["read", "trade"],
          maxNotionalUsd: 25_000,
          dailyCapUsd: 300,
          allowedCoins: ["btc", " eth "],
        },
      }) as never,
    )
    expect(res.status).toBe(201)

    const { policy } = mockCreate.mock.calls[0][0] as { policy: Record<string, unknown> }
    expect(policy).toEqual({
      allowedOps: ["read", "trade"],
      maxNotionalUsd: 10_000,
      dailyCapUsd: 300,
      allowedCoins: ["BTC", "ETH"],
    })
  })

  it("refuses an unknown operation and creates nothing", async () => {
    const res = await POST(req({ name: "bad", policy: { allowedOps: ["withdraw"] } }) as never)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.details.join(" ")).toMatch(/withdraw/)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
