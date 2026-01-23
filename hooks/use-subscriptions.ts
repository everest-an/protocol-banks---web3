"use client"

import { useState, useEffect, useCallback } from "react"
import type { Subscription, SubscriptionStatus } from "@/types"

// ============================================
// Demo Data
// ============================================

const DEMO_SUBSCRIPTIONS: Subscription[] = [
  {
    id: "1",
    service_name: "Netflix Premium",
    recipient_address: "0xNetflix...",
    amount: "15.99",
    token: "USDC",
    chain: "Ethereum",
    frequency: "monthly",
    status: "active",
    max_amount: "20",
    next_payment: "2024-04-01",
    last_payment: "2024-03-01",
    created_by: "demo",
    created_at: "2024-01-01",
    updated_at: "2024-03-01",
  },
  {
    id: "2",
    service_name: "Spotify Family",
    recipient_address: "0xSpotify...",
    amount: "16.99",
    token: "USDC",
    chain: "Polygon",
    frequency: "monthly",
    status: "active",
    max_amount: "20",
    next_payment: "2024-04-05",
    last_payment: "2024-03-05",
    created_by: "demo",
    created_at: "2024-01-05",
    updated_at: "2024-03-05",
  },
  {
    id: "3",
    service_name: "GitHub Pro",
    recipient_address: "0xGitHub...",
    amount: "4",
    token: "USDC",
    chain: "Base",
    frequency: "monthly",
    status: "paused",
    max_amount: "10",
    last_payment: "2024-02-10",
    created_by: "demo",
    created_at: "2024-01-10",
    updated_at: "2024-02-15",
  },
  {
    id: "4",
    service_name: "AWS Services",
    recipient_address: "0xAWS...",
    amount: "250",
    token: "USDC",
    chain: "Arbitrum",
    frequency: "monthly",
    status: "active",
    max_amount: "500",
    next_payment: "2024-04-01",
    last_payment: "2024-03-01",
    created_by: "demo",
    created_at: "2024-01-01",
    updated_at: "2024-03-01",
  },
  {
    id: "5",
    service_name: "Gym Membership",
    recipient_address: "0xGym...",
    amount: "50",
    token: "USDC",
    chain: "Ethereum",
    frequency: "monthly",
    status: "active",
    max_amount: "60",
    next_payment: "2024-04-15",
    last_payment: "2024-03-15",
    created_by: "demo",
    created_at: "2024-01-15",
    updated_at: "2024-03-15",
  },
  {
    id: "6",
    service_name: "OpenAI Plus",
    recipient_address: "0xOpenAI...",
    amount: "20",
    token: "USDC",
    chain: "Polygon",
    frequency: "monthly",
    status: "active",
    max_amount: "25",
    next_payment: "2024-04-20",
    last_payment: "2024-03-20",
    created_by: "demo",
    created_at: "2024-01-20",
    updated_at: "2024-03-20",
  },
]

// ============================================
// API Helper
// ============================================

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = "ApiError"
  }
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
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
// Types
// ============================================

interface UseSubscriptionsOptions {
  isDemoMode?: boolean
  walletAddress?: string
}

// ============================================
// Hook Implementation
// ============================================

export function useSubscriptions(options: UseSubscriptionsOptions = {}) {
  const { isDemoMode = false, walletAddress } = options
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load subscriptions via REST API
  const loadSubscriptions = useCallback(async () => {
    console.log("[v0] useSubscriptions: Loading", { isDemoMode, walletAddress })
    setLoading(true)
    setError(null)

    try {
      // Demo mode - use static data
      if (isDemoMode) {
        console.log("[v0] useSubscriptions: Using demo data, count:", DEMO_SUBSCRIPTIONS.length)
        setSubscriptions(DEMO_SUBSCRIPTIONS)
        setLoading(false)
        return
      }

      // No wallet - return empty
      if (!walletAddress) {
        console.log("[v0] useSubscriptions: No wallet, returning empty")
        setSubscriptions([])
        setLoading(false)
        return
      }

      // Fetch from REST API
      const response = await apiRequest<{ success: boolean; subscriptions: Subscription[] }>(
        "/api/subscriptions"
      )

      console.log("[v0] useSubscriptions: Loaded from API, count:", response.subscriptions?.length || 0)
      setSubscriptions(response.subscriptions || [])
    } catch (err) {
      console.error("[v0] useSubscriptions: Error:", err)
      setError(err instanceof Error ? err.message : "Failed to load subscriptions")
      setSubscriptions([])
    } finally {
      setLoading(false)
    }
  }, [isDemoMode, walletAddress])

  // Add subscription via REST API
  const addSubscription = useCallback(
    async (subscription: Omit<Subscription, "id" | "created_at" | "updated_at">) => {
      // Demo mode - add locally
      if (isDemoMode) {
        const newSub: Subscription = {
          ...subscription,
          id: `demo-${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setSubscriptions((prev) => [newSub, ...prev])
        return newSub
      }

      // Create via REST API
      const response = await apiRequest<{ success: boolean; subscription: Subscription }>(
        "/api/subscriptions",
        {
          method: "POST",
          body: JSON.stringify(subscription),
        }
      )

      setSubscriptions((prev) => [response.subscription, ...prev])
      return response.subscription
    },
    [isDemoMode],
  )

  // Update subscription status via REST API
  const updateSubscriptionStatus = useCallback(
    async (id: string, status: SubscriptionStatus) => {
      // Demo mode - update locally
      if (isDemoMode) {
        setSubscriptions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status, updated_at: new Date().toISOString() } : s)),
        )
        return
      }

      // Update via REST API
      await apiRequest<{ success: boolean }>(
        `/api/subscriptions/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({ status }),
        }
      )

      setSubscriptions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status, updated_at: new Date().toISOString() } : s)),
      )
    },
    [isDemoMode],
  )

  // Delete subscription via REST API
  const deleteSubscription = useCallback(
    async (id: string) => {
      // Demo mode - delete locally
      if (isDemoMode) {
        setSubscriptions((prev) => prev.filter((s) => s.id !== id))
        return
      }

      // Delete via REST API
      await apiRequest<{ success: boolean }>(
        `/api/subscriptions/${id}`,
        { method: "DELETE" }
      )

      setSubscriptions((prev) => prev.filter((s) => s.id !== id))
    },
    [isDemoMode],
  )

  // Load on mount and when dependencies change
  useEffect(() => {
    loadSubscriptions()
  }, [loadSubscriptions])

  // Calculate stats
  const stats = {
    active: subscriptions.filter((s) => s.status === "active").length,
    paused: subscriptions.filter((s) => s.status === "paused").length,
    monthlyTotal: subscriptions
      .filter((s) => s.status === "active" && s.frequency === "monthly")
      .reduce((sum, s) => sum + Number.parseFloat(s.amount), 0),
    nextPayment: subscriptions
      .filter((s) => s.status === "active" && s.next_payment)
      .sort((a, b) => new Date(a.next_payment!).getTime() - new Date(b.next_payment!).getTime())[0]?.next_payment,
  }

  return {
    subscriptions,
    loading,
    error,
    stats,
    refresh: loadSubscriptions,
    addSubscription,
    updateStatus: updateSubscriptionStatus,
    deleteSubscription,
  }
}
