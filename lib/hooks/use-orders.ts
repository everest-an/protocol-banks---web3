/**
 * useOrders Hook
 * SWR-based data fetching for acquiring orders
 */

import useSWR from "swr"
import useSWRMutation from "swr/mutation"

// ============================================
// Types
// ============================================

export interface AcquiringOrder {
  id: string
  order_no: string
  merchant_id: string
  amount: number
  token: string
  chain_id: number
  status: "pending" | "paid" | "expired" | "cancelled"
  payment_method?: string
  payer_address?: string
  tx_hash?: string
  created_at: string
  expires_at: string
  paid_at?: string
}

interface OrderFilters {
  merchantId?: string
  status?: string
  limit?: number
  offset?: number
}

interface CreateOrderPayload {
  merchant_id: string
  amount: number
  token?: string
  expire_minutes?: number
}

// ============================================
// Fetcher
// ============================================

const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }))
    throw new Error(error.error || "Request failed")
  }
  return res.json()
}

// ============================================
// Hooks
// ============================================

/**
 * Fetch orders list with optional filters
 */
export function useOrders(filters?: OrderFilters) {
  const params = new URLSearchParams()
  if (filters?.merchantId) params.set("merchant_id", filters.merchantId)
  if (filters?.status) params.set("status", filters.status)
  if (filters?.limit) params.set("limit", String(filters.limit))
  if (filters?.offset) params.set("offset", String(filters.offset))

  const queryString = params.toString()
  const key = `/api/acquiring/orders${queryString ? `?${queryString}` : ""}`

  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean
    orders: AcquiringOrder[]
  }>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    refreshInterval: 30000, // Auto-refresh every 30 seconds for pending orders
  })

  return {
    orders: data?.orders ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Fetch single order by ID or order_no
 */
export function useOrder(orderNo: string | null) {
  const key = orderNo ? `/api/acquiring/orders/${orderNo}` : null

  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean
    order: AcquiringOrder
  }>(key, fetcher, {
    refreshInterval: 5000, // Refresh frequently for payment status
  })

  return {
    order: data?.order ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Create order mutation
 */
export function useCreateOrder() {
  const { trigger, isMutating, error, reset } = useSWRMutation(
    "/api/acquiring/orders",
    async (
      url: string,
      { arg }: { arg: CreateOrderPayload }
    ): Promise<{
      success: boolean
      order: AcquiringOrder
      checkout_url: string
    }> => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arg),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create order")
      }
      return res.json()
    }
  )

  return {
    createOrder: trigger,
    isCreating: isMutating,
    error,
    reset,
  }
}

/**
 * Cancel order mutation
 */
export function useCancelOrder() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/acquiring/orders",
    async (url: string, { arg }: { arg: { orderNo: string } }) => {
      const res = await fetch(`${url}/${arg.orderNo}/cancel`, {
        method: "POST",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to cancel order")
      }
      return res.json()
    }
  )

  return {
    cancelOrder: trigger,
    isCancelling: isMutating,
    error,
  }
}

// ============================================
// Order Stats Hook
// ============================================

interface OrderStats {
  totalOrders: number
  totalAmount: number
  paidCount: number
  paidAmount: number
  pendingCount: number
  expiredCount: number
}

export function useOrderStats(filters?: OrderFilters) {
  const { orders, isLoading } = useOrders({ ...filters, limit: 1000 })

  const stats: OrderStats = {
    totalOrders: orders.length,
    totalAmount: orders.reduce((sum, o) => sum + (o.amount || 0), 0),
    paidCount: orders.filter((o) => o.status === "paid").length,
    paidAmount: orders
      .filter((o) => o.status === "paid")
      .reduce((sum, o) => sum + (o.amount || 0), 0),
    pendingCount: orders.filter((o) => o.status === "pending").length,
    expiredCount: orders.filter((o) => o.status === "expired").length,
  }

  return {
    stats,
    isLoading,
  }
}

// ============================================
// Checkout Hook (for payment page)
// ============================================

export function useCheckout(orderNo: string | null) {
  const { order, isLoading, isError, error, mutate } = useOrder(orderNo)

  const isPending = order?.status === "pending"
  const isPaid = order?.status === "paid"
  const isExpired = order?.status === "expired"
  const isCancelled = order?.status === "cancelled"

  const isActive = isPending && order ? new Date(order.expires_at) > new Date() : false

  return {
    order,
    isLoading,
    isError,
    error,
    isPending,
    isPaid,
    isExpired,
    isCancelled,
    isActive,
    refresh: mutate,
  }
}

// ============================================
// Cache Keys
// ============================================

export const ORDERS_CACHE_KEY = "/api/acquiring/orders"
