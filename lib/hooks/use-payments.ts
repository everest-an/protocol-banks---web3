/**
 * usePayments Hook
 * SWR-based data fetching for payments and transactions
 */

import useSWR from "swr"
import useSWRMutation from "swr/mutation"
import { useWalletStore } from "@/lib/stores/wallet-store"

// ============================================
// Types
// ============================================

interface Payment {
  id: string
  tx_hash: string
  from_address: string
  to_address: string
  amount: string
  amount_usd: number
  token_symbol: string
  status: "pending" | "completed" | "failed"
  timestamp: string
  tags?: string[]
  notes?: string
  vendor?: {
    id: string
    name: string
  }
}

interface BatchPayment {
  id: string
  batch_name: string
  total_recipients: number
  total_amount_usd: number
  status: string
  created_at: string
}

interface PaymentFilters {
  status?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}

interface PaymentStats {
  totalSent: number
  totalTransactions: number
  totalVendors: number
  avgTransaction: number
}

// ============================================
// Fetcher
// ============================================

const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }))
    throw new Error(error.message || "Request failed")
  }
  return res.json()
}

// ============================================
// Hooks
// ============================================

/**
 * Fetch payments list with optional filters
 */
export function usePayments(filters?: PaymentFilters) {
  const address = useWalletStore((state) => state.address)

  const params = new URLSearchParams()
  if (address) params.set("address", address)
  if (filters?.status) params.set("status", filters.status)
  if (filters?.startDate) params.set("startDate", filters.startDate)
  if (filters?.endDate) params.set("endDate", filters.endDate)
  if (filters?.limit) params.set("limit", String(filters.limit))
  if (filters?.offset) params.set("offset", String(filters.offset))

  const key = address ? `/api/payments?${params.toString()}` : null

  const { data, error, isLoading, mutate } = useSWR<{ payments: Payment[] }>(
    key,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  return {
    payments: data?.payments ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Fetch batch payments
 */
export function useBatchPayments(limit = 20) {
  const address = useWalletStore((state) => state.address)

  const key = address ? `/api/batch-payments?wallet=${address}&limit=${limit}` : null

  const { data, error, isLoading, mutate } = useSWR<{ batches: BatchPayment[] }>(
    key,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  )

  return {
    batches: data?.batches ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Fetch payment stats
 */
export function usePaymentStats() {
  const address = useWalletStore((state) => state.address)

  const key = address ? `/api/analytics/stats?wallet=${address}` : null

  const { data, error, isLoading } = useSWR<PaymentStats>(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  })

  return {
    stats: data ?? {
      totalSent: 0,
      totalTransactions: 0,
      totalVendors: 0,
      avgTransaction: 0,
    },
    isLoading,
    isError: !!error,
    error,
  }
}

/**
 * Fetch single payment by ID
 */
export function usePayment(id: string | null) {
  const key = id ? `/api/payments/${id}` : null

  const { data, error, isLoading, mutate } = useSWR<{ payment: Payment }>(
    key,
    fetcher
  )

  return {
    payment: data?.payment ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Create payment mutation
 */
export function useCreatePayment() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/payments",
    async (url: string, { arg }: { arg: Partial<Payment> }) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arg),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || "Failed to create payment")
      }
      return res.json()
    }
  )

  return {
    createPayment: trigger,
    isCreating: isMutating,
    error,
  }
}

/**
 * Update payment tags
 */
export function useUpdatePaymentTags() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/payments/tags",
    async (url: string, { arg }: { arg: { id: string; tags: string[] } }) => {
      const res = await fetch(`${url}/${arg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: arg.tags }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || "Failed to update tags")
      }
      return res.json()
    }
  )

  return {
    updateTags: trigger,
    isUpdating: isMutating,
    error,
  }
}

// ============================================
// Cache Keys
// ============================================

export const PAYMENTS_CACHE_KEY = "/api/payments"
export const BATCH_PAYMENTS_CACHE_KEY = "/api/batch-payments"
export const PAYMENT_STATS_CACHE_KEY = "/api/analytics/stats"
