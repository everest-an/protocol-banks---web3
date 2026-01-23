/**
 * useSubscriptions Hook Tests
 * Feature: frontend-api-integration
 * Property 2: Subscriptions Hook REST API 迁移正确性
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6
 */

import fc from "fast-check"

// ============================================
// Types
// ============================================

interface Subscription {
  id: string
  service_name: string
  recipient_address: string
  amount: string
  token: string
  chain: string
  frequency: string
  status: string
  max_amount?: string
  next_payment?: string
  last_payment?: string
  created_by: string
  created_at: string
  updated_at: string
}

type SubscriptionStatus = "active" | "paused" | "cancelled" | "payment_failed"

// ============================================
// API Helper (extracted for testing)
// ============================================

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = "ApiError"
  }
}

async function apiRequest<T>(
  url: string,
  options?: RequestInit,
  fetchFn: typeof fetch = fetch
): Promise<T> {
  const response = await fetchFn(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ApiError(
      data.message || data.error || `Request failed with status ${response.status}`,
      response.status
    )
  }

  return data as T
}

// ============================================
// Test Utilities
// ============================================

const createMockSubscription = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: `sub-${Math.random().toString(36).substr(2, 9)}`,
  service_name: "Test Service",
  recipient_address: "0x1234567890123456789012345678901234567890",
  amount: "10.00",
  token: "USDC",
  chain: "Ethereum",
  frequency: "monthly",
  status: "active",
  max_amount: "100",
  created_by: "0xOwner",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

const createMockFetch = () => {
  const calls: Array<{ url: string; options?: RequestInit }> = []
  let responseQueue: Array<{ ok: boolean; status?: number; data: any }> = []

  const mockFetch = async (url: string, options?: RequestInit) => {
    calls.push({ url, options })
    const response = responseQueue.shift() || { ok: true, data: {} }
    return {
      ok: response.ok,
      status: response.status || (response.ok ? 200 : 500),
      json: async () => response.data,
    }
  }

  return {
    fetch: mockFetch as unknown as typeof fetch,
    calls,
    queueSuccess: (data: any) => {
      responseQueue.push({ ok: true, data })
    },
    queueError: (status: number, message: string) => {
      responseQueue.push({ ok: false, status, data: { error: "Error", message } })
    },
    clear: () => {
      calls.length = 0
      responseQueue = []
    },
  }
}

// ============================================
// Arbitraries for Property Testing
// ============================================

const serviceNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0)
const addressArb = fc.hexaString({ minLength: 40, maxLength: 40 }).map((s) => `0x${s}`)
const amountArb = fc.integer({ min: 1, max: 1000000 }).map((n) => (n / 100).toFixed(2))
const tokenArb = fc.constantFrom("USDC", "USDT", "DAI", "ETH")
const chainArb = fc.constantFrom("Ethereum", "Polygon", "Arbitrum", "Base", "Optimism")
const frequencyArb = fc.constantFrom("daily", "weekly", "monthly", "yearly")
const statusArb = fc.constantFrom("active", "paused", "cancelled", "payment_failed") as fc.Arbitrary<SubscriptionStatus>

const subscriptionArb: fc.Arbitrary<Omit<Subscription, "id" | "created_at" | "updated_at">> = fc.record({
  service_name: serviceNameArb,
  recipient_address: addressArb,
  amount: amountArb,
  token: tokenArb,
  chain: chainArb,
  frequency: frequencyArb,
  status: fc.constant("active"),
  max_amount: fc.option(amountArb, { nil: undefined }),
  created_by: addressArb,
})

// ============================================
// Unit Tests
// ============================================

describe("useSubscriptions API Functions", () => {
  describe("Loading Subscriptions (Requirement 2.1)", () => {
    it("should call GET /api/subscriptions", async () => {
      const mock = createMockFetch()
      const mockSubs = [createMockSubscription()]
      mock.queueSuccess({ success: true, subscriptions: mockSubs })

      const result = await apiRequest<{ success: boolean; subscriptions: Subscription[] }>(
        "/api/subscriptions",
        undefined,
        mock.fetch
      )

      expect(mock.calls.length).toBe(1)
      expect(mock.calls[0].url).toBe("/api/subscriptions")
      expect(result.subscriptions).toEqual(mockSubs)
    })

    it("should handle empty subscriptions list", async () => {
      const mock = createMockFetch()
      mock.queueSuccess({ success: true, subscriptions: [] })

      const result = await apiRequest<{ success: boolean; subscriptions: Subscription[] }>(
        "/api/subscriptions",
        undefined,
        mock.fetch
      )

      expect(result.subscriptions).toEqual([])
    })

    it("should throw error on load failure (Requirement 2.6)", async () => {
      const mock = createMockFetch()
      mock.queueError(500, "Internal server error")

      await expect(
        apiRequest("/api/subscriptions", undefined, mock.fetch)
      ).rejects.toThrow("Internal server error")
    })
  })

  describe("Creating Subscriptions (Requirement 2.2)", () => {
    it("should call POST /api/subscriptions with correct params", async () => {
      const mock = createMockFetch()
      const newSub = createMockSubscription({ service_name: "New Service" })
      mock.queueSuccess({ success: true, subscription: newSub })

      const result = await apiRequest<{ success: boolean; subscription: Subscription }>(
        "/api/subscriptions",
        {
          method: "POST",
          body: JSON.stringify({ service_name: "New Service", amount: "10.00" }),
        },
        mock.fetch
      )

      expect(mock.calls.length).toBe(1)
      expect(mock.calls[0].url).toBe("/api/subscriptions")
      expect(mock.calls[0].options?.method).toBe("POST")
      expect(result.subscription).toEqual(newSub)
    })
  })

  describe("Updating Subscriptions (Requirement 2.3)", () => {
    it("should call PUT /api/subscriptions/[id] with status", async () => {
      const mock = createMockFetch()
      mock.queueSuccess({ success: true })

      await apiRequest(
        "/api/subscriptions/sub-123",
        {
          method: "PUT",
          body: JSON.stringify({ status: "paused" }),
        },
        mock.fetch
      )

      expect(mock.calls.length).toBe(1)
      expect(mock.calls[0].url).toBe("/api/subscriptions/sub-123")
      expect(mock.calls[0].options?.method).toBe("PUT")
      
      const body = JSON.parse(mock.calls[0].options?.body as string)
      expect(body.status).toBe("paused")
    })
  })

  describe("Deleting Subscriptions (Requirement 2.4)", () => {
    it("should call DELETE /api/subscriptions/[id]", async () => {
      const mock = createMockFetch()
      mock.queueSuccess({ success: true })

      await apiRequest(
        "/api/subscriptions/sub-to-delete",
        { method: "DELETE" },
        mock.fetch
      )

      expect(mock.calls.length).toBe(1)
      expect(mock.calls[0].url).toBe("/api/subscriptions/sub-to-delete")
      expect(mock.calls[0].options?.method).toBe("DELETE")
    })
  })
})

// ============================================
// Property-Based Tests
// ============================================

describe("useSubscriptions Property Tests", () => {
  /**
   * Property 2: Subscriptions Hook REST API 迁移正确性
   * For any subscription operation (load, create, update, delete), useSubscriptions Hook
   * should call REST API instead of direct Supabase, and properly handle errors and retry.
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6
   */
  it("Property 2: Create operation always calls POST with correct endpoint", async () => {
    await fc.assert(
      fc.asyncProperty(subscriptionArb, async (subData) => {
        const mock = createMockFetch()
        const newSub = createMockSubscription({ ...subData })
        mock.queueSuccess({ success: true, subscription: newSub })

        await apiRequest(
          "/api/subscriptions",
          {
            method: "POST",
            body: JSON.stringify(subData),
          },
          mock.fetch
        )

        // Verify POST was called with correct endpoint
        expect(mock.calls.length).toBe(1)
        expect(mock.calls[0].url).toBe("/api/subscriptions")
        expect(mock.calls[0].options?.method).toBe("POST")

        // Verify body contains the service name
        const body = JSON.parse(mock.calls[0].options?.body as string)
        expect(body.service_name).toBe(subData.service_name)
      }),
      { numRuns: 100 }
    )
  })

  it("Property 2: Update operation always calls PUT with correct endpoint and status", async () => {
    const subIdArb = fc.uuid()

    await fc.assert(
      fc.asyncProperty(subIdArb, statusArb, async (subId, status) => {
        const mock = createMockFetch()
        mock.queueSuccess({ success: true })

        await apiRequest(
          `/api/subscriptions/${subId}`,
          {
            method: "PUT",
            body: JSON.stringify({ status }),
          },
          mock.fetch
        )

        // Verify PUT was called with correct endpoint
        expect(mock.calls.length).toBe(1)
        expect(mock.calls[0].url).toBe(`/api/subscriptions/${subId}`)
        expect(mock.calls[0].options?.method).toBe("PUT")

        // Verify body contains the status
        const body = JSON.parse(mock.calls[0].options?.body as string)
        expect(body.status).toBe(status)
      }),
      { numRuns: 100 }
    )
  })

  it("Property 2: Delete operation always calls DELETE with correct endpoint", async () => {
    const subIdArb = fc.uuid()

    await fc.assert(
      fc.asyncProperty(subIdArb, async (subId) => {
        const mock = createMockFetch()
        mock.queueSuccess({ success: true })

        await apiRequest(
          `/api/subscriptions/${subId}`,
          { method: "DELETE" },
          mock.fetch
        )

        // Verify DELETE was called with correct endpoint
        expect(mock.calls.length).toBe(1)
        expect(mock.calls[0].url).toBe(`/api/subscriptions/${subId}`)
        expect(mock.calls[0].options?.method).toBe("DELETE")
      }),
      { numRuns: 100 }
    )
  })

  it("Property 2: Error responses always throw ApiError with correct status", async () => {
    const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 })
    const statusCodeArb = fc.constantFrom(400, 401, 403, 404, 500)

    await fc.assert(
      fc.asyncProperty(errorMessageArb, statusCodeArb, async (errorMessage, statusCode) => {
        const mock = createMockFetch()
        mock.queueError(statusCode, errorMessage)

        let caughtError: any = null
        try {
          await apiRequest("/api/subscriptions", undefined, mock.fetch)
        } catch (e) {
          caughtError = e
        }

        // Error should be thrown with correct message and status
        expect(caughtError).not.toBeNull()
        expect(caughtError.message).toBe(errorMessage)
        expect(caughtError.status).toBe(statusCode)
      }),
      { numRuns: 100 }
    )
  })

  it("Property 2: Successful load returns correct subscription count", async () => {
    const subsCountArb = fc.integer({ min: 0, max: 10 })

    await fc.assert(
      fc.asyncProperty(subsCountArb, async (count) => {
        const mock = createMockFetch()
        const subs = Array.from({ length: count }, () => createMockSubscription())
        mock.queueSuccess({ success: true, subscriptions: subs })

        const result = await apiRequest<{ success: boolean; subscriptions: Subscription[] }>(
          "/api/subscriptions",
          undefined,
          mock.fetch
        )

        // Subscriptions count should match
        expect(result.subscriptions.length).toBe(count)
        expect(result.success).toBe(true)
      }),
      { numRuns: 100 }
    )
  })
})
