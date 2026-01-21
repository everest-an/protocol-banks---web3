"use client"

import { useState, useEffect, useCallback } from "react"

// ============================================================================
// Types
// ============================================================================

export interface MCPSubscriptionPlan {
  id: string
  name: string
  description: string | null
  price: number
  token: string
  interval: "monthly" | "yearly" | "one-time"
  features: string[]
  max_api_calls: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MCPUserSubscription {
  id: string
  user_id: string
  plan_id: string
  status: "pending" | "active" | "cancelled" | "expired"
  start_date: string | null
  end_date: string | null
  auto_renew: boolean
  created_at: string
  updated_at: string
  subscription_plans?: MCPSubscriptionPlan
}

export interface MCPPaymentRecord {
  id: string
  subscription_id: string
  amount: number
  token: string
  tx_hash: string | null
  network: string
  status: "pending" | "confirmed" | "failed"
  created_at: string
}

// ============================================================================
// Hook Options
// ============================================================================

interface UseMCPSubscriptionsOptions {
  walletAddress?: string
  autoLoad?: boolean
}


// ============================================================================
// Hook Implementation
// ============================================================================

export function useMCPSubscriptions(options: UseMCPSubscriptionsOptions = {}) {
  const { walletAddress, autoLoad = true } = options
  
  const [plans, setPlans] = useState<MCPSubscriptionPlan[]>([])
  const [subscriptions, setSubscriptions] = useState<MCPUserSubscription[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load subscription plans
  const loadPlans = useCallback(async () => {
    try {
      const response = await fetch("/api/mcp/plans")
      if (!response.ok) throw new Error("Failed to fetch plans")
      const data = await response.json()
      setPlans(data.plans || [])
    } catch (err) {
      console.error("[MCP] Failed to load plans:", err)
      setError(err instanceof Error ? err.message : "Failed to load plans")
    }
  }, [])

  // Load user subscriptions
  const loadSubscriptions = useCallback(async () => {
    if (!walletAddress) {
      setSubscriptions([])
      return
    }

    try {
      const response = await fetch(`/api/mcp/subscriptions?userId=${walletAddress}`)
      if (!response.ok) throw new Error("Failed to fetch subscriptions")
      const data = await response.json()
      setSubscriptions(data.subscriptions || [])
    } catch (err) {
      console.error("[MCP] Failed to load subscriptions:", err)
      setError(err instanceof Error ? err.message : "Failed to load subscriptions")
    }
  }, [walletAddress])

  // Load all data
  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    await Promise.all([loadPlans(), loadSubscriptions()])
    setLoading(false)
  }, [loadPlans, loadSubscriptions])

  // Create subscription
  const subscribe = useCallback(async (planId: string, autoRenew = true) => {
    if (!walletAddress) throw new Error("Wallet not connected")

    const response = await fetch("/api/mcp/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, userId: walletAddress, autoRenew }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || "Failed to create subscription")
    }

    const data = await response.json()
    setSubscriptions((prev) => [data.subscription, ...prev])
    return data.subscription
  }, [walletAddress])

  // Update subscription status
  const updateStatus = useCallback(async (
    subscriptionId: string,
    status: "active" | "paused" | "cancelled"
  ) => {
    const response = await fetch("/api/mcp/subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId, status }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || "Failed to update subscription")
    }

    const data = await response.json()
    setSubscriptions((prev) =>
      prev.map((s) => (s.id === subscriptionId ? data.subscription : s))
    )
    return data.subscription
  }, [])

  // Cancel subscription
  const cancel = useCallback(async (subscriptionId: string) => {
    const response = await fetch(`/api/mcp/subscriptions?id=${subscriptionId}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || "Failed to cancel subscription")
    }

    setSubscriptions((prev) =>
      prev.map((s) => (s.id === subscriptionId ? { ...s, status: "cancelled" as const } : s))
    )
  }, [])

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      refresh()
    }
  }, [autoLoad, refresh])

  // Computed stats
  const stats = {
    totalPlans: plans.length,
    activeSubscriptions: subscriptions.filter((s) => s.status === "active").length,
    pendingSubscriptions: subscriptions.filter((s) => s.status === "pending").length,
    monthlySpend: subscriptions
      .filter((s) => s.status === "active" && s.subscription_plans?.interval === "monthly")
      .reduce((sum, s) => sum + (s.subscription_plans?.price || 0), 0),
  }

  return {
    plans,
    subscriptions,
    loading,
    error,
    stats,
    refresh,
    subscribe,
    updateStatus,
    cancel,
  }
}
