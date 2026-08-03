/**
 * POST /api/webhooks/[id]/test
 *
 * The settings page has had a "Test" button since webhooks shipped and
 * use-webhooks.ts has always called this path, but the route did not exist —
 * every click returned 404. There were even tests asserting the call was made;
 * none checked that anything answered it.
 *
 * The property that makes this endpoint worth having is that it signs the test
 * delivery exactly as webhook-trigger-service signs real ones. If the two
 * diverge, a receiver passes the test and then rejects every real event.
 */

import { POST as testWebhook } from "@/app/api/webhooks/[id]/test/route"
import { verifyJwt } from "@/lib/auth/jwt"
import { WebhookService, generateWebhookSignature } from "@/lib/services/webhook-service"
import { NextRequest } from "next/server"

jest.mock("@/lib/auth/jwt", () => ({ verifyJwt: jest.fn() }))
jest.mock("@/lib/auth/session", () => ({ verifySession: jest.fn().mockResolvedValue(null) }))

// jest.mock is hoisted above const declarations, so the factory cannot close
// over a mock defined here. Hang it off the module object and read it lazily.
jest.mock("@/lib/services/webhook-service", () => {
  const actual = jest.requireActual("@/lib/services/webhook-service")
  const getById = jest.fn()
  return {
    ...actual,
    __getByIdMock: getById,
    WebhookService: jest.fn().mockImplementation(() => ({ getById })),
  }
})

const getByIdMock = (
  jest.requireMock("@/lib/services/webhook-service") as { __getByIdMock: jest.Mock }
).__getByIdMock

const OWNER = "0x1234567890123456789012345678901234567890"

const WEBHOOK = {
  id: "wh_1",
  owner_address: OWNER,
  url: "https://example.test/hook",
  secret_hash: "a".repeat(64),
  timeout_ms: 5000,
  is_active: true,
}

describe("POST /api/webhooks/[id]/test", () => {
  const verifyJwtMock = verifyJwt as jest.Mock
  let fetchMock: jest.Mock

  function req() {
    return new NextRequest(
      new Request("http://localhost/api/webhooks/wh_1/test", {
        method: "POST",
        headers: { authorization: "Bearer test-token" },
      })
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()
    verifyJwtMock.mockResolvedValue({ sub: OWNER })
    getByIdMock.mockResolvedValue(WEBHOOK)

    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, statusText: "OK" })
    global.fetch = fetchMock as any
  })

  it("delivers to the webhook URL and reports success", async () => {
    const res = await testWebhook(req())
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.status_code).toBe(200)
    expect(typeof body.response_time_ms).toBe("number")

    expect(fetchMock).toHaveBeenCalledWith(WEBHOOK.url, expect.objectContaining({ method: "POST" }))
  })

  it("signs the payload exactly as real deliveries are signed", async () => {
    await testWebhook(req())

    const [, init] = fetchMock.mock.calls[0]
    const timestamp = init.headers["X-Webhook-Timestamp"]
    const signature = init.headers["X-Webhook-Signature"]

    expect(timestamp).toMatch(/^\d+$/)

    // webhook-trigger-service signs `${timestamp}.${payload}` keyed by
    // secret_hash. Recomputing it here means a change to either side that
    // breaks compatibility turns this red.
    const expected = generateWebhookSignature(`${timestamp}.${init.body}`, WEBHOOK.secret_hash)
    expect(signature).toBe(expected)
  })

  it("sends a payload that identifies itself as a test", async () => {
    await testWebhook(req())

    const [, init] = fetchMock.mock.calls[0]
    const payload = JSON.parse(init.body)

    // A receiver must be able to tell this apart from a real payment event.
    expect(payload.event).toBe("webhook.test")
    expect(init.headers["X-Webhook-Event"]).toBe("webhook.test")
    expect(JSON.stringify(payload)).toMatch(/No payment was made/i)
  })

  it("reports a non-2xx response as a failed delivery, not a server error", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, statusText: "Internal Server Error" })

    const res = await testWebhook(req())

    // The caller's endpoint being broken is a normal test outcome.
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.status_code).toBe(500)
    expect(body.error).toMatch(/500/)
  })

  it("reports an unreachable endpoint without throwing", async () => {
    fetchMock.mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND example.test"))

    const res = await testWebhook(req())
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/ENOTFOUND/)
  })

  it("reports a timeout using the webhook's configured timeout", async () => {
    const abort = new Error("aborted")
    abort.name = "AbortError"
    fetchMock.mockRejectedValueOnce(abort)

    const res = await testWebhook(req())
    const body = await res.json()

    expect(body.success).toBe(false)
    expect(body.error).toMatch(/within 5s/)
  })

  it("does not follow redirects", async () => {
    await testWebhook(req())
    const [, init] = fetchMock.mock.calls[0]

    // Following a redirect would deliver a signed payload somewhere other than
    // the URL the user registered.
    expect(init.redirect).toBe("manual")
  })

  it("returns 404 for a webhook the caller does not own", async () => {
    // getById filters by owner, so another user's webhook is simply not found —
    // this endpoint cannot be used to probe arbitrary URLs.
    getByIdMock.mockResolvedValueOnce(null)

    const res = await testWebhook(req())
    expect(res.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects an unauthenticated caller", async () => {
    const res = await testWebhook(
      new NextRequest(
        new Request("http://localhost/api/webhooks/wh_1/test", { method: "POST" })
      )
    )

    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
