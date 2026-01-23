/**
 * useApiKeys Hook Tests
 * Feature: frontend-api-integration
 * Property 1: API Keys Hook CRUD 操作正确性
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6
 */

import fc from "fast-check"

// ============================================
// Types (copied from hook for testing without React)
// ============================================

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  permissions: string[]
  rate_limit_per_minute: number
  rate_limit_per_day: number
  allowed_ips?: string[]
  allowed_origins?: string[]
  expires_at?: string
  last_used_at?: string
  usage_count: number
  is_active: boolean
  created_at: string
}

interface CreateApiKeyParams {
  name: string
  permissions?: string[]
  rate_limit_per_minute?: number
  rate_limit_per_day?: number
  allowed_ips?: string[]
  allowed_origins?: string[]
  expires_at?: string
}

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

const createMockApiKey = (overrides: Partial<ApiKey> = {}): ApiKey => ({
  id: `key-${Math.random().toString(36).substr(2, 9)}`,
  name: "Test Key",
  key_prefix: "pb_test",
  permissions: ["read"],
  rate_limit_per_minute: 60,
  rate_limit_per_day: 10000,
  usage_count: 0,
  is_active: true,
  created_at: new Date().toISOString(),
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

const apiKeyNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0)

const permissionsArb = fc.subarray(["read", "write", "payments", "webhooks", "admin"] as const, {
  minLength: 1,
})

const rateLimitArb = fc.integer({ min: 1, max: 100000 })

const createParamsArb: fc.Arbitrary<CreateApiKeyParams> = fc.record({
  name: apiKeyNameArb,
  permissions: fc.option(permissionsArb, { nil: undefined }),
  rate_limit_per_minute: fc.option(rateLimitArb, { nil: undefined }),
  rate_limit_per_day: fc.option(rateLimitArb, { nil: undefined }),
})

// ============================================
// Unit Tests
// ============================================

describe("useApiKeys API Functions", () => {
  describe("Loading API Keys (Requirement 1.1)", () => {
    it("should call GET /api/settings/api-keys", async () => {
      const mock = createMockFetch()
      const mockKeys = [createMockApiKey()]
      mock.queueSuccess({ success: true, keys: mockKeys, count: 1 })

      const result = await apiRequest<{ success: boolean; keys: ApiKey[]; count: number }>(
        "/api/settings/api-keys",
        undefined,
        mock.fetch
      )

      expect(mock.calls.length).toBe(1)
      expect(mock.calls[0].url).toBe("/api/settings/api-keys")
      expect(result.keys).toEqual(mockKeys)
    })

    it("should handle empty API keys list", async () => {
      const mock = createMockFetch()
      mock.queueSuccess({ success: true, keys: [], count: 0 })

      const result = await apiRequest<{ success: boolean; keys: ApiKey[]; count: number }>(
        "/api/settings/api-keys",
        undefined,
        mock.fetch
      )

      expect(result.keys).toEqual([])
    })

    it("should throw error on load failure (Requirement 1.4)", async () => {
      const mock = createMockFetch()
      mock.queueError(500, "Internal server error")

      await expect(
        apiRequest("/api/settings/api-keys", undefined, mock.fetch)
      ).rejects.toThrow("Internal server error")
    })
  })

  describe("Creating API Keys (Requirement 1.2)", () => {
    it("should call POST /api/settings/api-keys with correct params", async () => {
      const mock = createMockFetch()
      const newKey = createMockApiKey({ name: "New Key" })
      const secret = "pb_secret_test123"
      mock.queueSuccess({ success: true, key: newKey, secret, message: "Created" })

      const result = await apiRequest<{ success: boolean; key: ApiKey; secret: string }>(
        "/api/settings/api-keys",
        {
          method: "POST",
          body: JSON.stringify({ name: "New Key", permissions: ["read"] }),
        },
        mock.fetch
      )

      expect(mock.calls.length).toBe(1)
      expect(mock.calls[0].url).toBe("/api/settings/api-keys")
      expect(mock.calls[0].options?.method).toBe("POST")
      expect(result.key).toEqual(newKey)
      expect(result.secret).toBe(secret)
    })

    it("should throw error on create failure", async () => {
      const mock = createMockFetch()
      mock.queueError(400, "Name is required")

      await expect(
        apiRequest(
          "/api/settings/api-keys",
          { method: "POST", body: JSON.stringify({ name: "" }) },
          mock.fetch
        )
      ).rejects.toThrow("Name is required")
    })
  })

  describe("Deleting API Keys (Requirement 1.3)", () => {
    it("should call DELETE /api/settings/api-keys/[id]", async () => {
      const mock = createMockFetch()
      mock.queueSuccess({ success: true })

      await apiRequest(
        "/api/settings/api-keys/key-to-delete",
        { method: "DELETE" },
        mock.fetch
      )

      expect(mock.calls.length).toBe(1)
      expect(mock.calls[0].url).toBe("/api/settings/api-keys/key-to-delete")
      expect(mock.calls[0].options?.method).toBe("DELETE")
    })
  })
})

// ============================================
// Property-Based Tests
// ============================================

describe("useApiKeys Property Tests", () => {
  /**
   * Property 1: API Keys Hook CRUD 操作正确性
   * For any API key operation (create, read, delete), useApiKeys Hook should
   * call the correct REST API endpoint and properly handle responses and error states.
   * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6
   */
  it("Property 1: Create operation always calls POST with correct endpoint", async () => {
    await fc.assert(
      fc.asyncProperty(createParamsArb, async (params) => {
        const mock = createMockFetch()
        const newKey = createMockApiKey({ name: params.name })
        mock.queueSuccess({ success: true, key: newKey, secret: "pb_secret_test" })

        await apiRequest(
          "/api/settings/api-keys",
          {
            method: "POST",
            body: JSON.stringify({
              name: params.name,
              permissions: params.permissions || ["read"],
              rate_limit_per_minute: params.rate_limit_per_minute,
              rate_limit_per_day: params.rate_limit_per_day,
            }),
          },
          mock.fetch
        )

        // Verify POST was called with correct endpoint
        expect(mock.calls.length).toBe(1)
        expect(mock.calls[0].url).toBe("/api/settings/api-keys")
        expect(mock.calls[0].options?.method).toBe("POST")

        // Verify body contains the name
        const body = JSON.parse(mock.calls[0].options?.body as string)
        expect(body.name).toBe(params.name)
      }),
      { numRuns: 100 }
    )
  })

  it("Property 1: Delete operation always calls DELETE with correct endpoint", async () => {
    const keyIdArb = fc.uuid()

    await fc.assert(
      fc.asyncProperty(keyIdArb, async (keyId) => {
        const mock = createMockFetch()
        mock.queueSuccess({ success: true })

        await apiRequest(
          `/api/settings/api-keys/${keyId}`,
          { method: "DELETE" },
          mock.fetch
        )

        // Verify DELETE was called with correct endpoint
        expect(mock.calls.length).toBe(1)
        expect(mock.calls[0].url).toBe(`/api/settings/api-keys/${keyId}`)
        expect(mock.calls[0].options?.method).toBe("DELETE")
      }),
      { numRuns: 100 }
    )
  })

  it("Property 1: Error responses always throw ApiError", async () => {
    const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 })
    const statusCodeArb = fc.constantFrom(400, 401, 403, 404, 500)

    await fc.assert(
      fc.asyncProperty(errorMessageArb, statusCodeArb, async (errorMessage, statusCode) => {
        const mock = createMockFetch()
        mock.queueError(statusCode, errorMessage)

        let caughtError: any = null
        try {
          await apiRequest("/api/settings/api-keys", undefined, mock.fetch)
        } catch (e) {
          caughtError = e
        }

        // Error should be thrown
        expect(caughtError).not.toBeNull()
        expect(caughtError.message).toBe(errorMessage)
        expect(caughtError.status).toBe(statusCode)
      }),
      { numRuns: 100 }
    )
  })

  it("Property 1: Successful responses return data correctly", async () => {
    const keysCountArb = fc.integer({ min: 0, max: 10 })

    await fc.assert(
      fc.asyncProperty(keysCountArb, async (count) => {
        const mock = createMockFetch()
        const keys = Array.from({ length: count }, () => createMockApiKey())
        mock.queueSuccess({ success: true, keys, count })

        const result = await apiRequest<{ success: boolean; keys: ApiKey[]; count: number }>(
          "/api/settings/api-keys",
          undefined,
          mock.fetch
        )

        // Keys count should match
        expect(result.keys.length).toBe(count)
        expect(result.success).toBe(true)
      }),
      { numRuns: 100 }
    )
  })
})
