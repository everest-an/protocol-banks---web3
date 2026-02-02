/**
 * useMerchants Hook
 * SWR-based data fetching for acquiring merchants
 */

import useSWR from "swr"
import useSWRMutation from "swr/mutation"

// ============================================
// Types
// ============================================

export interface Merchant {
  id: string
  name: string
  wallet_address: string
  callback_url?: string
  logo_url?: string
  status: "active" | "paused" | "suspended"
  created_at: string
  updated_at: string
}

interface CreateMerchantPayload {
  name: string
  wallet_address: string
  callback_url?: string
  logo_url?: string
}

interface ApiKeyResponse {
  key_id: string
  key_secret: string
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
 * Fetch all merchants
 */
export function useMerchants() {
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean
    merchants: Merchant[]
  }>("/api/acquiring/merchants", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  })

  return {
    merchants: data?.merchants ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Fetch single merchant by ID
 */
export function useMerchant(id: string | null) {
  const key = id ? `/api/acquiring/merchants/${id}` : null

  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean
    merchant: Merchant
  }>(key, fetcher)

  return {
    merchant: data?.merchant ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

/**
 * Create merchant mutation
 */
export function useCreateMerchant() {
  const { trigger, isMutating, error, reset } = useSWRMutation(
    "/api/acquiring/merchants",
    async (
      url: string,
      { arg }: { arg: CreateMerchantPayload }
    ): Promise<{
      success: boolean
      merchant: Merchant
      api_key: ApiKeyResponse
    }> => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arg),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create merchant")
      }
      return res.json()
    }
  )

  return {
    createMerchant: trigger,
    isCreating: isMutating,
    error,
    reset,
  }
}

/**
 * Update merchant mutation
 */
export function useUpdateMerchant() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/acquiring/merchants",
    async (
      url: string,
      { arg }: { arg: { id: string; data: Partial<Merchant> } }
    ) => {
      const res = await fetch(`${url}/${arg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arg.data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update merchant")
      }
      return res.json()
    }
  )

  return {
    updateMerchant: trigger,
    isUpdating: isMutating,
    error,
  }
}

/**
 * Regenerate API key mutation
 */
export function useRegenerateApiKey() {
  const { trigger, isMutating, error } = useSWRMutation(
    "/api/acquiring/merchants",
    async (
      url: string,
      { arg }: { arg: { merchantId: string } }
    ): Promise<{
      success: boolean
      api_key: ApiKeyResponse
    }> => {
      const res = await fetch(`${url}/${arg.merchantId}/api-key`, {
        method: "POST",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to regenerate API key")
      }
      return res.json()
    }
  )

  return {
    regenerateApiKey: trigger,
    isRegenerating: isMutating,
    error,
  }
}

// ============================================
// Merchant Stats Hook
// ============================================

interface MerchantStats {
  total: number
  active: number
  paused: number
  totalVolume: number
}

export function useMerchantStats() {
  const { merchants, isLoading } = useMerchants()

  const stats: MerchantStats = {
    total: merchants.length,
    active: merchants.filter((m) => m.status === "active").length,
    paused: merchants.filter((m) => m.status === "paused").length,
    totalVolume: 0, // Would need separate API call
  }

  return {
    stats,
    isLoading,
  }
}

// ============================================
// Cache Keys
// ============================================

export const MERCHANTS_CACHE_KEY = "/api/acquiring/merchants"
