/**
 * SWR Hooks Tests
 * Tests for lib/hooks/ - focuses on hook logic and data transformations
 */

// Mock SWR before imports
const mockUseSWR = jest.fn()
const mockUseSWRMutation = jest.fn()

jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string, fetcher: any, options?: any) => mockUseSWR(key, fetcher, options),
}))

jest.mock("swr/mutation", () => ({
  __esModule: true,
  default: (key: string, mutator: any) => mockUseSWRMutation(key, mutator),
}))

jest.mock("@/lib/stores/wallet-store", () => ({
  useWalletStore: jest.fn((selector) =>
    selector({ address: "0x1234567890123456789012345678901234567890" })
  ),
}))

// Types for testing
interface MockOrder {
  id: string
  order_no: string
  merchant_id: string
  amount: number
  status: "pending" | "paid" | "expired" | "cancelled"
  created_at: string
  expires_at: string
}

interface MockMerchant {
  id: string
  name: string
  wallet_address: string
  status: "active" | "paused" | "suspended"
  created_at: string
  updated_at: string
}

interface MockPayment {
  id: string
  tx_hash: string
  from_address: string
  to_address: string
  amount: string
  amount_usd: number
  token_symbol: string
  status: "pending" | "completed" | "failed"
  timestamp: string
}

describe("useOrders Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should build correct query string with filters", () => {
    mockUseSWR.mockReturnValue({
      data: { success: true, orders: [] },
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    })

    const { useOrders } = require("@/lib/hooks/use-orders")

    useOrders({ merchantId: "m1", status: "pending", limit: 10, offset: 5 })

    const calledKey = mockUseSWR.mock.calls[0][0]
    expect(calledKey).toContain("merchant_id=m1")
    expect(calledKey).toContain("status=pending")
    expect(calledKey).toContain("limit=10")
    expect(calledKey).toContain("offset=5")
  })

  it("should return empty orders array when no data", () => {
    mockUseSWR.mockReturnValue({
      data: null,
      error: null,
      isLoading: true,
      mutate: jest.fn(),
    })

    const { useOrders } = require("@/lib/hooks/use-orders")
    const result = useOrders()

    expect(result.orders).toEqual([])
    expect(result.isLoading).toBe(true)
  })

  it("should return orders from API response", () => {
    const mockOrders: MockOrder[] = [
      {
        id: "1",
        order_no: "ORD001",
        merchant_id: "m1",
        amount: 100,
        status: "pending",
        created_at: "2024-01-01T00:00:00Z",
        expires_at: "2024-01-01T01:00:00Z",
      },
    ]

    mockUseSWR.mockReturnValue({
      data: { success: true, orders: mockOrders },
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    })

    const { useOrders } = require("@/lib/hooks/use-orders")
    const result = useOrders()

    expect(result.orders).toEqual(mockOrders)
    expect(result.isError).toBe(false)
  })
})

describe("useOrder Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should not fetch when orderNo is null", () => {
    mockUseSWR.mockReturnValue({
      data: null,
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    })

    const { useOrder } = require("@/lib/hooks/use-orders")
    useOrder(null)

    expect(mockUseSWR.mock.calls[0][0]).toBeNull()
  })

  it("should fetch with correct key when orderNo is provided", () => {
    mockUseSWR.mockReturnValue({
      data: { success: true, order: { id: "1" } },
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    })

    const { useOrder } = require("@/lib/hooks/use-orders")
    useOrder("ORD001")

    expect(mockUseSWR.mock.calls[0][0]).toBe("/api/acquiring/orders/ORD001")
  })
})

describe("useOrderStats Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should calculate stats from orders", () => {
    const mockOrders: MockOrder[] = [
      { id: "1", order_no: "O1", merchant_id: "m1", amount: 100, status: "paid", created_at: "", expires_at: "" },
      { id: "2", order_no: "O2", merchant_id: "m1", amount: 200, status: "paid", created_at: "", expires_at: "" },
      { id: "3", order_no: "O3", merchant_id: "m1", amount: 150, status: "pending", created_at: "", expires_at: "" },
      { id: "4", order_no: "O4", merchant_id: "m1", amount: 50, status: "expired", created_at: "", expires_at: "" },
    ]

    mockUseSWR.mockReturnValue({
      data: { success: true, orders: mockOrders },
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    })

    const { useOrderStats } = require("@/lib/hooks/use-orders")
    const { stats } = useOrderStats()

    expect(stats.totalOrders).toBe(4)
    expect(stats.totalAmount).toBe(500)
    expect(stats.paidCount).toBe(2)
    expect(stats.paidAmount).toBe(300)
    expect(stats.pendingCount).toBe(1)
    expect(stats.expiredCount).toBe(1)
  })
})

describe("useCheckout Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should identify pending order status", () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString()

    mockUseSWR.mockReturnValue({
      data: {
        success: true,
        order: { id: "1", status: "pending", expires_at: futureDate },
      },
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    })

    const { useCheckout } = require("@/lib/hooks/use-orders")
    const result = useCheckout("ORD001")

    expect(result.isPending).toBe(true)
    expect(result.isPaid).toBe(false)
    expect(result.isActive).toBe(true)
  })

  it("should identify paid order status", () => {
    mockUseSWR.mockReturnValue({
      data: {
        success: true,
        order: { id: "1", status: "paid", expires_at: "2024-01-01T00:00:00Z" },
      },
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    })

    const { useCheckout } = require("@/lib/hooks/use-orders")
    const result = useCheckout("ORD001")

    expect(result.isPending).toBe(false)
    expect(result.isPaid).toBe(true)
    expect(result.isActive).toBe(false)
  })

  it("should identify expired order", () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString()

    mockUseSWR.mockReturnValue({
      data: {
        success: true,
        order: { id: "1", status: "pending", expires_at: pastDate },
      },
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    })

    const { useCheckout } = require("@/lib/hooks/use-orders")
    const result = useCheckout("ORD001")

    expect(result.isPending).toBe(true)
    expect(result.isActive).toBe(false) // expired even though status is pending
  })
})

describe("useMerchants Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should return merchants from API", () => {
    const mockMerchants: MockMerchant[] = [
      {
        id: "1",
        name: "Test Merchant",
        wallet_address: "0x123",
        status: "active",
        created_at: "",
        updated_at: "",
      },
    ]

    mockUseSWR.mockReturnValue({
      data: { success: true, merchants: mockMerchants },
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    })

    const { useMerchants } = require("@/lib/hooks/use-merchants")
    const result = useMerchants()

    expect(result.merchants).toEqual(mockMerchants)
  })
})

describe("useMerchantStats Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should calculate merchant stats", () => {
    const mockMerchants: MockMerchant[] = [
      { id: "1", name: "M1", wallet_address: "0x1", status: "active", created_at: "", updated_at: "" },
      { id: "2", name: "M2", wallet_address: "0x2", status: "active", created_at: "", updated_at: "" },
      { id: "3", name: "M3", wallet_address: "0x3", status: "paused", created_at: "", updated_at: "" },
    ]

    mockUseSWR.mockReturnValue({
      data: { success: true, merchants: mockMerchants },
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    })

    const { useMerchantStats } = require("@/lib/hooks/use-merchants")
    const { stats } = useMerchantStats()

    expect(stats.total).toBe(3)
    expect(stats.active).toBe(2)
    expect(stats.paused).toBe(1)
  })
})

describe("usePayments Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should build query params from filters", () => {
    mockUseSWR.mockReturnValue({
      data: { payments: [] },
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    })

    const { usePayments } = require("@/lib/hooks/use-payments")
    usePayments({ status: "completed", limit: 20 })

    const calledKey = mockUseSWR.mock.calls[0][0]
    expect(calledKey).toContain("status=completed")
    expect(calledKey).toContain("limit=20")
  })

  it("should return payments from API", () => {
    const mockPayments: MockPayment[] = [
      {
        id: "1",
        tx_hash: "0xabc",
        from_address: "0x123",
        to_address: "0x456",
        amount: "100",
        amount_usd: 100,
        token_symbol: "USDC",
        status: "completed",
        timestamp: "2024-01-01T00:00:00Z",
      },
    ]

    mockUseSWR.mockReturnValue({
      data: { payments: mockPayments },
      error: null,
      isLoading: false,
      mutate: jest.fn(),
    })

    const { usePayments } = require("@/lib/hooks/use-payments")
    const result = usePayments()

    expect(result.payments).toEqual(mockPayments)
  })
})

describe("usePaymentStats Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should return default stats when no data", () => {
    mockUseSWR.mockReturnValue({
      data: null,
      error: null,
      isLoading: true,
    })

    const { usePaymentStats } = require("@/lib/hooks/use-payments")
    const { stats } = usePaymentStats()

    expect(stats.totalSent).toBe(0)
    expect(stats.totalTransactions).toBe(0)
    expect(stats.totalVendors).toBe(0)
    expect(stats.avgTransaction).toBe(0)
  })

  it("should return stats from API", () => {
    mockUseSWR.mockReturnValue({
      data: {
        totalSent: 5000,
        totalTransactions: 50,
        totalVendors: 10,
        avgTransaction: 100,
      },
      error: null,
      isLoading: false,
    })

    const { usePaymentStats } = require("@/lib/hooks/use-payments")
    const { stats } = usePaymentStats()

    expect(stats.totalSent).toBe(5000)
    expect(stats.totalTransactions).toBe(50)
  })
})

describe("Mutation Hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseSWRMutation.mockReturnValue({
      trigger: jest.fn(),
      isMutating: false,
      error: null,
      reset: jest.fn(),
    })
  })

  it("useCreateOrder should return trigger function", () => {
    const { useCreateOrder } = require("@/lib/hooks/use-orders")
    const result = useCreateOrder()

    expect(result.createOrder).toBeDefined()
    expect(result.isCreating).toBe(false)
  })

  it("useCancelOrder should return trigger function", () => {
    const { useCancelOrder } = require("@/lib/hooks/use-orders")
    const result = useCancelOrder()

    expect(result.cancelOrder).toBeDefined()
    expect(result.isCancelling).toBe(false)
  })

  it("useCreateMerchant should return trigger function", () => {
    const { useCreateMerchant } = require("@/lib/hooks/use-merchants")
    const result = useCreateMerchant()

    expect(result.createMerchant).toBeDefined()
    expect(result.isCreating).toBe(false)
  })

  it("useUpdateMerchant should return trigger function", () => {
    const { useUpdateMerchant } = require("@/lib/hooks/use-merchants")
    const result = useUpdateMerchant()

    expect(result.updateMerchant).toBeDefined()
    expect(result.isUpdating).toBe(false)
  })

  it("useCreatePayment should return trigger function", () => {
    const { useCreatePayment } = require("@/lib/hooks/use-payments")
    const result = useCreatePayment()

    expect(result.createPayment).toBeDefined()
    expect(result.isCreating).toBe(false)
  })
})
