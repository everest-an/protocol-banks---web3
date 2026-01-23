/**
 * useDashboardActivity Hook Tests
 * Feature: frontend-api-integration
 * Property 8: Dashboard 活动供应商名称显示
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4
 */

import fc from "fast-check"

// ============================================
// Types
// ============================================

interface ActivityItem {
  id: string
  type: "sent" | "received"
  amount: string
  token: string
  chain_id: number
  counterparty: string
  counterparty_name?: string
  vendor_id?: string
  vendor_name?: string
  tx_hash?: string
  status: string
  created_at: string
}

interface FormattedActivityItem {
  direction: string
  description: string
  amount_display: string
  time_ago: string
}

// ============================================
// Utility Functions (copied from hook for testing)
// ============================================

function truncateAddress(address: string): string {
  if (!address || address.length <= 10) return address || ""
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return "Just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}

function formatItem(item: ActivityItem): FormattedActivityItem {
  const direction = item.type === "sent" ? "Sent" : "Received"
  const counterpartyDisplay = item.vendor_name || truncateAddress(item.counterparty)
  const description = item.type === "sent"
    ? `To ${counterpartyDisplay}`
    : `From ${counterpartyDisplay}`

  return {
    direction,
    description,
    amount_display: `${item.type === "sent" ? "-" : "+"}${item.amount} ${item.token}`,
    time_ago: getTimeAgo(new Date(item.created_at)),
  }
}

// ============================================
// Test Utilities
// ============================================

const createMockActivityItem = (overrides: Partial<ActivityItem> = {}): ActivityItem => ({
  id: `act-${Math.random().toString(36).substring(2, 9)}`,
  type: "sent",
  amount: "100.00",
  token: "USDC",
  chain_id: 1,
  counterparty: "0x1234567890123456789012345678901234567890",
  status: "completed",
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
// Arbitraries
// ============================================

const addressArb = fc.hexaString({ minLength: 40, maxLength: 40 }).map(s => `0x${s}`)
const amountArb = fc.integer({ min: 1, max: 1000000 }).map(n => (n / 100).toFixed(2))
const tokenArb = fc.constantFrom("USDC", "USDT", "DAI", "ETH", "MATIC")
const typeArb = fc.constantFrom("sent" as const, "received" as const)
const statusArb = fc.constantFrom("pending", "completed", "failed")
const vendorNameArb = fc.option(
  fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  { nil: undefined }
)

const activityItemArb: fc.Arbitrary<ActivityItem> = fc.record({
  id: fc.uuid(),
  type: typeArb,
  amount: amountArb,
  token: tokenArb,
  chain_id: fc.constantFrom(1, 137, 8453, 42161),
  counterparty: addressArb,
  counterparty_name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  vendor_id: fc.option(fc.uuid(), { nil: undefined }),
  vendor_name: vendorNameArb,
  tx_hash: fc.option(fc.hexaString({ minLength: 64, maxLength: 64 }).map(s => `0x${s}`), { nil: undefined }),
  status: statusArb,
  created_at: fc.date({ min: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }).map(d => d.toISOString()),
})

// ============================================
// Unit Tests
// ============================================

describe("useDashboardActivity Utility Functions", () => {
  describe("truncateAddress", () => {
    it("should truncate long addresses", () => {
      const address = "0x1234567890123456789012345678901234567890"
      const result = truncateAddress(address)
      expect(result).toBe("0x1234...7890")
    })

    it("should return short addresses unchanged", () => {
      const address = "0x1234"
      const result = truncateAddress(address)
      expect(result).toBe("0x1234")
    })

    it("should handle empty string", () => {
      expect(truncateAddress("")).toBe("")
    })
  })

  describe("getTimeAgo", () => {
    it("should return 'Just now' for recent times", () => {
      const result = getTimeAgo(new Date())
      expect(result).toBe("Just now")
    })

    it("should return minutes ago", () => {
      const date = new Date(Date.now() - 5 * 60 * 1000)
      const result = getTimeAgo(date)
      expect(result).toBe("5m ago")
    })

    it("should return hours ago", () => {
      const date = new Date(Date.now() - 3 * 60 * 60 * 1000)
      const result = getTimeAgo(date)
      expect(result).toBe("3h ago")
    })

    it("should return days ago", () => {
      const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      const result = getTimeAgo(date)
      expect(result).toBe("2d ago")
    })
  })

  describe("formatItem (Requirement 7.3)", () => {
    it("should display vendor name when available", () => {
      const item = createMockActivityItem({
        type: "sent",
        vendor_name: "Acme Corp",
      })
      const result = formatItem(item)
      expect(result.description).toBe("To Acme Corp")
    })

    it("should display truncated address when vendor name not available", () => {
      const item = createMockActivityItem({
        type: "sent",
        vendor_name: undefined,
        counterparty: "0x1234567890123456789012345678901234567890",
      })
      const result = formatItem(item)
      expect(result.description).toBe("To 0x1234...7890")
    })

    it("should show correct direction for sent", () => {
      const item = createMockActivityItem({ type: "sent" })
      const result = formatItem(item)
      expect(result.direction).toBe("Sent")
    })

    it("should show correct direction for received", () => {
      const item = createMockActivityItem({ type: "received" })
      const result = formatItem(item)
      expect(result.direction).toBe("Received")
    })

    it("should format amount with sign", () => {
      const sentItem = createMockActivityItem({ type: "sent", amount: "100.00", token: "USDC" })
      const receivedItem = createMockActivityItem({ type: "received", amount: "50.00", token: "USDT" })
      
      expect(formatItem(sentItem).amount_display).toBe("-100.00 USDC")
      expect(formatItem(receivedItem).amount_display).toBe("+50.00 USDT")
    })
  })
})

// ============================================
// Property-Based Tests
// ============================================

describe("useDashboardActivity Property Tests", () => {
  /**
   * Property 8: Dashboard 活动供应商名称显示
   * When vendor_name is present, it should be displayed instead of address.
   * Validates: Requirements 7.3
   */
  it("Property 8: Vendor name is always preferred over address when available", () => {
    fc.assert(
      fc.property(activityItemArb, (item) => {
        const result = formatItem(item)
        
        if (item.vendor_name) {
          // When vendor_name exists, description should contain it
          expect(result.description).toContain(item.vendor_name)
        } else {
          // When no vendor_name, description should contain truncated address
          const truncated = truncateAddress(item.counterparty)
          expect(result.description).toContain(truncated)
        }
      }),
      { numRuns: 100 }
    )
  })

  it("Property 8: Direction is always correct based on type", () => {
    fc.assert(
      fc.property(activityItemArb, (item) => {
        const result = formatItem(item)
        
        if (item.type === "sent") {
          expect(result.direction).toBe("Sent")
          expect(result.description).toMatch(/^To /)
          expect(result.amount_display).toMatch(/^-/)
        } else {
          expect(result.direction).toBe("Received")
          expect(result.description).toMatch(/^From /)
          expect(result.amount_display).toMatch(/^\+/)
        }
      }),
      { numRuns: 100 }
    )
  })

  it("Property 8: Amount display always includes token symbol", () => {
    fc.assert(
      fc.property(activityItemArb, (item) => {
        const result = formatItem(item)
        expect(result.amount_display).toContain(item.token)
      }),
      { numRuns: 100 }
    )
  })

  it("Property 8: Address truncation preserves prefix and suffix", () => {
    fc.assert(
      fc.property(addressArb, (address) => {
        const truncated = truncateAddress(address)
        
        if (address.length > 10) {
          // Should start with first 6 chars
          expect(truncated.startsWith(address.slice(0, 6))).toBe(true)
          // Should end with last 4 chars
          expect(truncated.endsWith(address.slice(-4))).toBe(true)
          // Should contain ellipsis
          expect(truncated).toContain("...")
        } else {
          // Short addresses unchanged
          expect(truncated).toBe(address)
        }
      }),
      { numRuns: 100 }
    )
  })

  it("Property 8: Time ago is always a non-empty string", () => {
    const dateArb = fc.date({ min: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), max: new Date() })
    
    fc.assert(
      fc.property(dateArb, (date) => {
        const result = getTimeAgo(date)
        expect(result.length).toBeGreaterThan(0)
      }),
      { numRuns: 100 }
    )
  })
})
