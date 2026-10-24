/**
 * The analytics endpoint: a closed event whitelist, and a wallet that can only
 * come from the session — never from the request body.
 */
jest.mock("@/lib/middleware/api-auth", () => ({ requireAuth: jest.fn() }))
jest.mock("@/lib/analytics/events", () => {
  const actual = jest.requireActual("@/lib/analytics/events")
  return { ...actual, recordEvent: jest.fn() }
})

import { POST } from "@/app/api/events/route"
import { requireAuth } from "@/lib/middleware/api-auth"
import { recordEvent } from "@/lib/analytics/events"

const authMock = requireAuth as jest.Mock
const recordMock = recordEvent as jest.Mock

function req(body: unknown, extra: Record<string, string> = {}): Request {
  return new Request("https://protocolbanks.test/api/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}`,
      ...extra,
    },
    body: JSON.stringify(body),
  })
}

describe("POST /api/events", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    authMock.mockResolvedValue({ address: null })
  })

  it("rejects an event that is not on the whitelist", async () => {
    const res = await POST(req({ name: "made_up_event" }) as never)
    expect(res.status).toBe(400)
    expect(recordMock).not.toHaveBeenCalled()
  })

  it("records an anonymous event without a wallet", async () => {
    const res = await POST(req({ name: "landing_view", anonId: "abc", path: "/" }) as never)
    expect(res.status).toBe(200)
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "landing_view", wallet: null, anonId: "abc", path: "/" }),
    )
  })

  it("takes the wallet from the session, and ignores one supplied in the body", async () => {
    authMock.mockResolvedValue({ address: "0xAbC0000000000000000000000000000000000001" })
    await POST(
      req({ name: "cockpit_view", wallet: "0xdead000000000000000000000000000000000999" }, { authorization: "Bearer test" }) as never,
    )
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "cockpit_view", wallet: "0xAbC0000000000000000000000000000000000001" }),
    )
  })

  it("skips the auth path entirely for anonymous events", async () => {
    await POST(req({ name: "landing_view" }) as never)
    expect(authMock).not.toHaveBeenCalled()
  })

  it("rejects malformed JSON", async () => {
    const bad = new Request("https://protocolbanks.test/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.99" },
      body: "{not json",
    })
    const res = await POST(bad as never)
    expect(res.status).toBe(400)
  })
})
