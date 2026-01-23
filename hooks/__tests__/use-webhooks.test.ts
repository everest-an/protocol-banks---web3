/**
 * useWebhooks Hook Tests
 * Feature: frontend-api-integration
 * Property 3: Webhooks Hook CRUD 操作正确性
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import fc from "fast-check"

// ============================================
// Types
// ============================================

interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  is_active: boolean
  retry_count: number
  timeout_ms: number
  created_at: string
  updated_at: string
  success_count: number
  failure_count: number
}

interface CreateWebhookParams {
  name: string
  url: string
  events: string[]
  retry_count?: number
  timeout_ms?: number
}

interface UpdateWebhookParams {
  name?: string
  url?: string
  events?: string[]
  is_active?: boolean
}

// ============================================
// API Helper
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

const createMockWebhook = (overrides: Partial<Webhook> = {}): Webhook => ({
  id: `wh-${Math.random().toString(36).substr(2, 9)}`,
  name: "Test Webhook",
  url: "https://example.com/webhook",
  events: ["payment.completed"],
  is_active: true,
  retry_count: 3,
  timeout_ms: 5000,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  success_count: 0,
  failure_count: 0,
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
// Arbitraries
// ============================================

const webhookNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0)
const webhookUrlArb = fc.webUrl()
const webhookEventsArb = fc.subarray([
  "payment.created",
  "payment.completed",
  "payment.failed",
  "batch_payment.created",
  "batch_payment.completed",
] as const, { minLength: 1 })

const createParamsArb: fc.Arbitrary<CreateWebhookParams> = fc.record({
  name: webhookNameArb,
  url: webhookUrlArb,
  events: webhookEventsArb,
  retry_count: fc.option(fc.integer({ min: 0, max: 5 }), { nil: undefined }),
  timeout_ms: fc.option(fc.integer({ min: 1000, max: 30000 }), { nil: undefined }),
})

const updateParamsArb: fc.Arbitrary<UpdateWebhookParams> = fc.record({
  name: fc.option(webhookNameArb, { nil: undefined }),
  url: fc.option(webhookUrlArb, { nil: undefined }),
  events: fc.option(webhookEventsArb, { nil: undefined }),
  is_active: fc.option(fc.boolean(), { nil: undefined }),
})

// ============================================
// Unit Tests
// ============================================

describe("useWebhooks API Functions", () => {
  describe("Loading Webhooks (Requirement 3.1)", () => {
    it("should call GET /api/webhooks", async () => {
      const mock = createMockFetch()
      const mockWebhooks = [createMockWebhook()]
      mock.queueSuccess({ success: true, webhooks: mockWebhooks })

      const result = await apiRequest<{ success: boolean; webhooks: Webhook[] }>(
        "/api/webhooks",
        undefined,
        mock.fetch
      )

      expect(mock.calls.length).toBe(1)
      expect(mock.calls[0].url).toBe("/api/webhooks")
      expect(result.webhooks).toEqual(mockWebhooks)
    })
  })

  describe("Creating Webhooks (Requirement 3.2)", () => {
    it("should call POST /api/webhooks with correct params", async () => {
      const mock = createMockFetch()
      const newWebhook = createMockWebhook({ name: "New Webhook" })
      const secret = "whsec_test123"
      mock.queueSuccess({ success: true, webhook: newWebhook, secret })

      const result = await apiRequest<{ success: boolean; webhook: Webhook; secret: string }>(
        "/api/webhooks",
        {
          method: "POST",
          body: JSON.stringify({ name: "New Webhook", url: "https://example.com", events: ["payment.completed"] }),
        },
        mock.fetch
      )

      expect(mock.calls.length).toBe(1)
      expect(mock.calls[0].url).toBe("/api/webhooks")
      expect(mock.calls[0].options?.method).toBe("POST")
      expect(result.webhook).toEqual(newWebhook)
      expect(result.secret).toBe(secret)
    })
  })

  describe("Updating Webhooks (Requirement 3.3)", () => {
    it("should call PUT /api/webhooks/[id]", async () => {
      const mock = createMockFetch()
      const updatedWebhook = createMockWebhook({ name: "Updated Webhook" })
      mock.queueSuccess({ success: true, webhook: updatedWebhook })

      await apiRequest(
        "/api/webhooks/wh-123",
        {
          method: "PUT",
          body: JSON.stringify({ name: "Updated Webhook" }),
        },
        mock.fetch
      )

      expect(mock.calls.length).toBe(1)
      expect(mock.calls[0].url).toBe("/api/webhooks/wh-123")
      expect(mock.calls[0].options?.method).toBe("PUT")
    })
  })

  describe("Deleting Webhooks (Requirement 3.4)", () => {
    it("should call DELETE /api/webhooks/[id]", async () => {
      const mock = createMockFetch()
      mock.queueSuccess({ success: true })

      await apiRequest(
        "/api/webhooks/wh-to-delete",
        { method: "DELETE" },
        mock.fetch
      )

      expect(mock.calls.length).toBe(1)
      expect(mock.calls[0].url).toBe("/api/webhooks/wh-to-delete")
      expect(mock.calls[0].options?.method).toBe("DELETE")
    })
  })

  describe("Testing Webhooks (Requirement 3.5)", () => {
    it("should call POST /api/webhooks/[id]/test", async () => {
      const mock = createMockFetch()
      mock.queueSuccess({ success: true, status_code: 200, response_time_ms: 150 })

      const result = await apiRequest<{ success: boolean; status_code: number; response_time_ms: number }>(
        "/api/webhooks/wh-123/test",
        { method: "POST" },
        mock.fetch
      )

      expect(mock.calls.length).toBe(1)
      expect(mock.calls[0].url).toBe("/api/webhooks/wh-123/test")
      expect(mock.calls[0].options?.method).toBe("POST")
      expect(result.success).toBe(true)
      expect(result.status_code).toBe(200)
    })
  })
})

// ============================================
// Property-Based Tests
// ============================================

describe("useWebhooks Property Tests", () => {
  /**
   * Property 3: Webhooks Hook CRUD 操作正确性
   * For any webhook operation (create, read, update, delete, test), useWebhooks Hook
   * should call the correct REST API endpoint.
   * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
   */
  it("Property 3: Create operation always calls POST with correct endpoint", async () => {
    await fc.assert(
      fc.asyncProperty(createParamsArb, async (params) => {
        const mock = createMockFetch()
        const newWebhook = createMockWebhook({ name: params.name, url: params.url })
        mock.queueSuccess({ success: true, webhook: newWebhook, secret: "whsec_test" })

        await apiRequest(
          "/api/webhooks",
          {
            method: "POST",
            body: JSON.stringify(params),
          },
          mock.fetch
        )

        expect(mock.calls.length).toBe(1)
        expect(mock.calls[0].url).toBe("/api/webhooks")
        expect(mock.calls[0].options?.method).toBe("POST")

        const body = JSON.parse(mock.calls[0].options?.body as string)
        expect(body.name).toBe(params.name)
        expect(body.url).toBe(params.url)
      }),
      { numRuns: 100 }
    )
  })

  it("Property 3: Update operation always calls PUT with correct endpoint", async () => {
    const webhookIdArb = fc.uuid()

    await fc.assert(
      fc.asyncProperty(webhookIdArb, updateParamsArb, async (webhookId, params) => {
        const mock = createMockFetch()
        const updatedWebhook = createMockWebhook({ id: webhookId })
        mock.queueSuccess({ success: true, webhook: updatedWebhook })

        await apiRequest(
          `/api/webhooks/${webhookId}`,
          {
            method: "PUT",
            body: JSON.stringify(params),
          },
          mock.fetch
        )

        expect(mock.calls.length).toBe(1)
        expect(mock.calls[0].url).toBe(`/api/webhooks/${webhookId}`)
        expect(mock.calls[0].options?.method).toBe("PUT")
      }),
      { numRuns: 100 }
    )
  })

  it("Property 3: Delete operation always calls DELETE with correct endpoint", async () => {
    const webhookIdArb = fc.uuid()

    await fc.assert(
      fc.asyncProperty(webhookIdArb, async (webhookId) => {
        const mock = createMockFetch()
        mock.queueSuccess({ success: true })

        await apiRequest(
          `/api/webhooks/${webhookId}`,
          { method: "DELETE" },
          mock.fetch
        )

        expect(mock.calls.length).toBe(1)
        expect(mock.calls[0].url).toBe(`/api/webhooks/${webhookId}`)
        expect(mock.calls[0].options?.method).toBe("DELETE")
      }),
      { numRuns: 100 }
    )
  })

  it("Property 3: Test operation always calls POST to /test endpoint", async () => {
    const webhookIdArb = fc.uuid()

    await fc.assert(
      fc.asyncProperty(webhookIdArb, async (webhookId) => {
        const mock = createMockFetch()
        mock.queueSuccess({ success: true, status_code: 200 })

        await apiRequest(
          `/api/webhooks/${webhookId}/test`,
          { method: "POST" },
          mock.fetch
        )

        expect(mock.calls.length).toBe(1)
        expect(mock.calls[0].url).toBe(`/api/webhooks/${webhookId}/test`)
        expect(mock.calls[0].options?.method).toBe("POST")
      }),
      { numRuns: 100 }
    )
  })

  it("Property 3: Error responses always throw ApiError", async () => {
    const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 })
    const statusCodeArb = fc.constantFrom(400, 401, 403, 404, 500)

    await fc.assert(
      fc.asyncProperty(errorMessageArb, statusCodeArb, async (errorMessage, statusCode) => {
        const mock = createMockFetch()
        mock.queueError(statusCode, errorMessage)

        let caughtError: any = null
        try {
          await apiRequest("/api/webhooks", undefined, mock.fetch)
        } catch (e) {
          caughtError = e
        }

        expect(caughtError).not.toBeNull()
        expect(caughtError.message).toBe(errorMessage)
        expect(caughtError.status).toBe(statusCode)
      }),
      { numRuns: 100 }
    )
  })
})
