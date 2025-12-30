"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase-client"
import type { Subscription, SubscriptionStatus } from "@/types"

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

interface UseSubscriptionsOptions {
  isDemoMode?: boolean
  walletAddress?: string
}

export function useSubscriptions(options: UseSubscriptionsOptions = {}) {
  const { isDemoMode = false, walletAddress } = options
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSubscriptions = useCallback(async () => {
    console.log("[v0] useSubscriptions: Loading", { isDemoMode, walletAddress })
    setLoading(true)
    setError(null)

    try {
      if (isDemoMode || !walletAddress) {
        console.log("[v0] useSubscriptions: Using demo data, count:", DEMO_SUBSCRIPTIONS.length)
        setSubscriptions(DEMO_SUBSCRIPTIONS)
        setLoading(false)
        return
      }

      const supabase = createClient()
      const { data, error: dbError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("created_by", walletAddress)
        .order("created_at", { ascending: false })

      if (dbError) throw dbError

      console.log("[v0] useSubscriptions: Loaded from DB, count:", data?.length || 0)
      setSubscriptions(data || [])
    } catch (err) {
      console.error("[v0] useSubscriptions: Error:", err)
      setError(err instanceof Error ? err.message : "Failed to load subscriptions")
      setSubscriptions(DEMO_SUBSCRIPTIONS)
    } finally {
      setLoading(false)
    }
  }, [isDemoMode, walletAddress])

  const addSubscription = useCallback(
    async (subscription: Omit<Subscription, "id" | "created_at" | "updated_at">) => {
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

      const supabase = createClient()
      const { data, error: dbError } = await supabase.from("subscriptions").insert([subscription]).select().single()

      if (dbError) throw dbError

      setSubscriptions((prev) => [data, ...prev])
      return data
    },
    [isDemoMode],
  )

  const updateSubscriptionStatus = useCallback(
    async (id: string, status: SubscriptionStatus) => {
      if (isDemoMode) {
        setSubscriptions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status, updated_at: new Date().toISOString() } : s)),
        )
        return
      }

      const supabase = createClient()
      const { error: dbError } = await supabase
        .from("subscriptions")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id)

      if (dbError) throw dbError

      setSubscriptions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status, updated_at: new Date().toISOString() } : s)),
      )
    },
    [isDemoMode],
  )

  const deleteSubscription = useCallback(
    async (id: string) => {
      if (isDemoMode) {
        setSubscriptions((prev) => prev.filter((s) => s.id !== id))
        return
      }

      const supabase = createClient()
      const { error: dbError } = await supabase.from("subscriptions").delete().eq("id", id)

      if (dbError) throw dbError

      setSubscriptions((prev) => prev.filter((s) => s.id !== id))
    },
    [isDemoMode],
  )

  useEffect(() => {
    loadSubscriptions()
  }, [loadSubscriptions])

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
