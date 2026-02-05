"use client"

import { useState, useEffect, useCallback } from "react"
import type { Subscription, SubscriptionStatus, AutoPayUseCase } from "@/types"

// ============================================
// Demo Data
// ============================================

const DEMO_SUBSCRIPTIONS: Subscription[] = [
  // Individual subscriptions
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
    next_payment: "2027-04-01",
    last_payment: "2027-03-01",
    created_by: "demo",
    created_at: "2027-01-01",
    updated_at: "2027-03-01",
    use_case: "individual",
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
    next_payment: "2027-04-05",
    last_payment: "2027-03-05",
    created_by: "demo",
    created_at: "2027-01-05",
    updated_at: "2027-03-05",
    use_case: "individual",
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
    last_payment: "2027-02-10",
    created_by: "demo",
    created_at: "2027-01-10",
    updated_at: "2027-02-15",
    use_case: "individual",
  },
  {
    id: "4",
    service_name: "OpenAI Plus",
    recipient_address: "0xOpenAI...",
    amount: "20",
    token: "USDC",
    chain: "Polygon",
    frequency: "monthly",
    status: "active",
    max_amount: "25",
    next_payment: "2027-04-20",
    last_payment: "2027-03-20",
    created_by: "demo",
    created_at: "2027-01-20",
    updated_at: "2027-03-20",
    use_case: "individual",
  },
  // Enterprise auto-pay
  {
    id: "5",
    service_name: "Engineering Payroll",
    recipient_address: "0xPayroll...",
    amount: "15000",
    token: "USDC",
    chain: "Ethereum",
    frequency: "monthly",
    status: "active",
    next_payment: "2027-04-05",
    last_payment: "2027-03-05",
    created_by: "demo",
    created_at: "2027-01-01",
    updated_at: "2027-03-05",
    use_case: "enterprise",
    max_authorized_amount: "200000",
    authorization_expires_at: "2027-12-31",
    total_paid: "45000",
    payment_count: 3,
    schedule_day: 5,
    schedule_time: "09:00",
    timezone: "UTC",
    description: "Monthly payroll for engineering team",
    recipients: [
      { address: "0xAlice...", amount: "5000", name: "Alice Chen" },
      { address: "0xBob...", amount: "5000", name: "Bob Wang" },
      { address: "0xCarol...", amount: "5000", name: "Carol Li" },
    ],
    remaining_quota: "155000",
    authorization_valid: true,
  },
  {
    id: "6",
    service_name: "AWS Cloud Services",
    recipient_address: "0xAWS...",
    amount: "2500",
    token: "USDC",
    chain: "Arbitrum",
    frequency: "monthly",
    status: "active",
    next_payment: "2027-04-01",
    last_payment: "2027-03-01",
    created_by: "demo",
    created_at: "2027-01-01",
    updated_at: "2027-03-01",
    use_case: "enterprise",
    max_authorized_amount: "10000",
    authorization_expires_at: "2027-06-30",
    total_paid: "7500",
    payment_count: 3,
    schedule_day: 1,
    schedule_time: "00:00",
    timezone: "UTC",
    description: "Monthly cloud infrastructure payment",
    remaining_quota: "2500",
    authorization_valid: true,
  },
  {
    id: "7",
    service_name: "Marketing Agency",
    recipient_address: "0xAgency...",
    amount: "3000",
    token: "USDC",
    chain: "Base",
    frequency: "monthly",
    status: "authorization_expired",
    last_payment: "2027-02-15",
    created_by: "demo",
    created_at: "2027-01-15",
    updated_at: "2027-03-15",
    use_case: "enterprise",
    max_authorized_amount: "9000",
    authorization_expires_at: "2027-03-15",
    total_paid: "9000",
    payment_count: 3,
    schedule_day: 15,
    schedule_time: "10:00",
    timezone: "America/New_York",
    description: "Monthly retainer for marketing services",
    remaining_quota: "0",
    authorization_valid: false,
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
  useCase?: AutoPayUseCase
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

  // Update subscription fields via REST API
  const updateSubscription = useCallback(
    async (id: string, updates: Partial<Subscription>) => {
      if (isDemoMode) {
        setSubscriptions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s)),
        )
        return
      }

      await apiRequest<{ success: boolean }>(
        `/api/subscriptions/${id}`,
        {
          method: "PUT",
          body: JSON.stringify(updates),
        }
      )

      setSubscriptions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s)),
      )
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

  // Filter by use_case if specified
  const filteredSubscriptions = options.useCase
    ? subscriptions.filter((s) => s.use_case === options.useCase)
    : subscriptions

  // Calculate enhanced stats
  const activeSubs = filteredSubscriptions.filter((s) => s.status === "active")
  const stats = {
    active: activeSubs.length,
    paused: filteredSubscriptions.filter((s) => s.status === "paused").length,
    monthlyTotal: activeSubs
      .filter((s) => s.frequency === "monthly")
      .reduce((sum, s) => sum + Number.parseFloat(s.amount), 0),
    nextPayment: activeSubs
      .filter((s) => s.next_payment)
      .sort((a, b) => new Date(a.next_payment!).getTime() - new Date(b.next_payment!).getTime())[0]?.next_payment,
    // Auto Pay enhanced stats
    totalPaymentCount: filteredSubscriptions.reduce((sum, s) => sum + (s.payment_count || 0), 0),
    enterpriseCount: subscriptions.filter((s) => s.use_case === "enterprise").length,
    individualCount: subscriptions.filter((s) => s.use_case === "individual" || !s.use_case).length,
    totalRemainingQuota: filteredSubscriptions
      .filter((s) => s.remaining_quota)
      .reduce((sum, s) => sum + Number.parseFloat(s.remaining_quota || "0"), 0),
    expiringAuthorizations: activeSubs.filter((s) => {
      if (!s.authorization_expires_at) return false
      const expiresAt = new Date(s.authorization_expires_at)
      const sevenDaysFromNow = new Date()
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
      return expiresAt <= sevenDaysFromNow
    }).length,
  }

  return {
    subscriptions,
    loading,
    error,
    stats,
    refresh: loadSubscriptions,
    addSubscription,
    updateSubscription,
    updateStatus: updateSubscriptionStatus,
    deleteSubscription,
  }
}
