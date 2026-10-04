/**
 * Unit tests for the Rain card issuing client. Fetch is mocked — no network,
 * no credentials. Locks the request shaping (URL, Api-Key header, body) and the
 * refusal to fabricate anything when the key is missing.
 */
import { isRainConfigured, rainCardService } from "@/lib/services/rain-card.service"

const originalFetch = global.fetch
const originalKey = process.env.RAIN_API_KEY
const originalUrl = process.env.RAIN_API_URL

interface Call {
  url: string
  init: RequestInit
}

function mockFetch(response: { ok?: boolean; status?: number; body?: unknown; text?: string } = {}) {
  const calls: Call[] = []
  global.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    const text = response.text ?? JSON.stringify(response.body ?? {})
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      text: async () => text,
    } as Response
  }) as unknown as typeof fetch
  return calls
}

function headersOf(call: Call): Record<string, string> {
  return (call.init.headers ?? {}) as Record<string, string>
}

beforeEach(() => {
  process.env.RAIN_API_KEY = "test-key"
  process.env.RAIN_API_URL = "https://api-dev.example/v1/issuing"
})

afterEach(() => {
  global.fetch = originalFetch
  if (originalKey === undefined) delete process.env.RAIN_API_KEY
  else process.env.RAIN_API_KEY = originalKey
  if (originalUrl === undefined) delete process.env.RAIN_API_URL
  else process.env.RAIN_API_URL = originalUrl
})

describe("rain card service", () => {
  test("reports configured only when the key is present", () => {
    expect(isRainConfigured()).toBe(true)
    delete process.env.RAIN_API_KEY
    expect(isRainConfigured()).toBe(false)
  })

  test("refuses to operate without a key", async () => {
    delete process.env.RAIN_API_KEY
    const calls = mockFetch()
    await expect(rainCardService.listCards("user-1")).rejects.toThrow(/not configured/i)
    expect(calls).toHaveLength(0)
  })

  test("submits a KYC application and returns the userId", async () => {
    const calls = mockFetch({ body: { id: "user-42", applicationStatus: "approved" } })
    const result = await rainCardService.createUserApplication({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      walletAddress: "0x1111111111111111111111111111111111111111",
      birthDate: "1990-01-01",
      nationalId: "123456789",
      countryOfIssue: "US",
      address: { line1: "1 Test St", city: "SF", region: "CA", postalCode: "94105", countryCode: "US" },
      ipAddress: "127.0.0.1",
      phoneCountryCode: "1",
      phoneNumber: "5551234567",
      annualSalary: "75000",
      accountPurpose: "personal",
      expectedMonthlyVolume: "2000",
      isTermsOfServiceAccepted: true,
    })

    expect(result).toEqual({ userId: "user-42", applicationStatus: "approved" })
    expect(calls[0].url).toBe("https://api-dev.example/v1/issuing/applications/user")
    expect(calls[0].init.method).toBe("POST")
    expect(headersOf(calls[0])["Api-Key"]).toBe("test-key")
  })

  test("issues a virtual card with the documented body", async () => {
    const calls = mockFetch({ body: { id: "card-1", type: "virtual", status: "active", last4: "4242" } })
    const card = await rainCardService.issueCard("user-42", {
      displayName: "Ada",
      limit: { frequency: "allTime", amount: 1000 },
    })

    expect(card.last4).toBe("4242")
    expect(calls[0].url).toBe("https://api-dev.example/v1/issuing/users/user-42/cards")
    const body = JSON.parse(String(calls[0].init.body))
    expect(body).toEqual({
      type: "virtual",
      status: "active",
      displayName: "Ada",
      limit: { frequency: "allTime", amount: 1000 },
    })
  })

  test("reads deposit contracts from either response shape", async () => {
    const calls = mockFetch({ body: { data: [{ chainId: 8453, depositAddress: "0xabc" }] } })
    const contracts = await rainCardService.getUserContracts("user-42")
    expect(contracts).toEqual([{ chainId: 8453, depositAddress: "0xabc" }])
    expect(calls[0].url).toBe("https://api-dev.example/v1/issuing/users/user-42/contracts")
  })

  test("relays encrypted secrets with the browser SessionId header", async () => {
    const calls = mockFetch({ body: { encryptedPan: "enc-pan", encryptedCvc: "enc-cvc" } })
    const secrets = await rainCardService.getCardSecrets("card-1", "session-9")

    expect(secrets.encryptedPan).toBe("enc-pan")
    expect(headersOf(calls[0]).SessionId).toBe("session-9")
    expect(calls[0].url).toBe("https://api-dev.example/v1/issuing/cards/card-1/secrets")
  })

  test("surfaces upstream errors with the status and path", async () => {
    mockFetch({ ok: false, status: 401, text: '{"error":"Unauthenticated"}' })
    await expect(rainCardService.getUserBalances("user-42")).rejects.toThrow(
      /Rain API error \[401\].*balances/,
    )
  })
})
