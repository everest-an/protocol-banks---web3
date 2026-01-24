"use client"

import { useState, useCallback, useEffect } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { useToast } from "@/hooks/use-toast"
import { getSupabase } from "@/lib/supabase"

export interface MCPProvider {
  id: string
  name: string
  description: string
  icon: string
  category: "productivity" | "development" | "analytics" | "communication"
  pricing: {
    free: { calls: number; features: string[] }
    pro: { price: number; calls: number; features: string[] }
    enterprise: { price: number; calls: number; features: string[] }
  }
}

export interface MCPSubscription {
  id: string
  provider_id: string
  provider_name: string
  plan: "free" | "pro" | "enterprise"
  status: "active" | "paused" | "cancelled"
  calls_used: number
  calls_limit: number
  current_period_start: string
  current_period_end: string
  created_at: string
}

export interface UseMCPSubscriptionsReturn {
  subscriptions: MCPSubscription[]
  subscription: MCPSubscription | null  // Current active subscription
  providers: MCPProvider[]
  plans: MCPProvider['pricing']  // Available plans
  loading: boolean
  error: string | null
  subscribe: (providerId: string, plan: "free" | "pro" | "enterprise") => Promise<void>
  unsubscribe: (subscriptionId: string) => Promise<void>
  cancel: (subscriptionId: string) => Promise<void>  // Alias for unsubscribe
  changePlan: (subscriptionId: string, newPlan: "free" | "pro" | "enterprise") => Promise<void>
  refresh: () => Promise<void>
}

// Available MCP providers
const MCP_PROVIDERS: MCPProvider[] = [
  {
    id: "linear",
    name: "Linear",
    description: "Project management and issue tracking",
    icon: "📋",
    category: "productivity",
    pricing: {
      free: { calls: 100, features: ["Read issues", "Basic search"] },
      pro: { price: 29, calls: 10000, features: ["Full API access", "Webhooks", "Priority support"] },
      enterprise: { price: 99, calls: 100000, features: ["Unlimited calls", "SLA", "Dedicated support"] },
    },
  },
  {
    id: "notion",
    name: "Notion",
    description: "Workspace and documentation platform",
    icon: "📝",
    category: "productivity",
    pricing: {
      free: { calls: 100, features: ["Read pages", "Basic search"] },
      pro: { price: 19, calls: 5000, features: ["Full API access", "Create pages"] },
      enterprise: { price: 79, calls: 50000, features: ["Unlimited calls", "Custom integrations"] },
    },
  },
  {
    id: "sentry",
    name: "Sentry",
    description: "Error tracking and performance monitoring",
    icon: "🐛",
    category: "development",
    pricing: {
      free: { calls: 50, features: ["View errors", "Basic alerts"] },
      pro: { price: 39, calls: 20000, features: ["Full API access", "Custom dashboards"] },
      enterprise: { price: 149, calls: 200000, features: ["Unlimited calls", "Advanced analytics"] },
    },
  },
  {
    id: "context7",
    name: "Context7",
    description: "Documentation and context tools",
    icon: "📚",
    category: "development",
    pricing: {
      free: { calls: 200, features: ["Basic search", "Public docs"] },
      pro: { price: 15, calls: 8000, features: ["Private docs", "Advanced search"] },
      enterprise: { price: 59, calls: 80000, features: ["Unlimited calls", "Custom training"] },
    },
  },
  {
    id: "slack",
    name: "Slack",
    description: "Team communication platform",
    icon: "💬",
    category: "communication",
    pricing: {
      free: { calls: 100, features: ["Read messages", "Basic notifications"] },
      pro: { price: 25, calls: 15000, features: ["Send messages", "Channel management"] },
      enterprise: { price: 89, calls: 150000, features: ["Unlimited calls", "Admin features"] },
    },
  },
]

export function useMCPSubscriptions(): UseMCPSubscriptionsReturn {
  const { address } = useWeb3()
  const { toast } = useToast()
  const [subscriptions, setSubscriptions] = useState<MCPSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSubscriptions = useCallback(async () => {
    if (!address) {
      setSubscriptions([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = getSupabase()
      const { data, error: fetchError } = await supabase
        .from("mcp_subscriptions")
        .select("*")
        .eq("wallet_address", address.toLowerCase())
        .order("created_at", { ascending: false })

      if (fetchError) {
        // Table might not exist, return empty
        console.warn("[MCP] Subscriptions table error:", fetchError)
        setSubscriptions([])
      } else {
        setSubscriptions(data || [])
      }
    } catch (err: any) {
      console.error("[MCP] Failed to fetch subscriptions:", err)
      setError(err.message)
      setSubscriptions([])
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    fetchSubscriptions()
  }, [fetchSubscriptions])

  const subscribe = useCallback(
    async (providerId: string, plan: "free" | "pro" | "enterprise") => {
      if (!address) {
        toast({
          title: "Error",
          description: "Please connect your wallet first",
          variant: "destructive",
        })
        return
      }

      const provider = MCP_PROVIDERS.find((p) => p.id === providerId)
      if (!provider) {
        toast({
          title: "Error",
          description: "Invalid provider",
          variant: "destructive",
        })
        return
      }

      try {
        const supabase = getSupabase()
        const now = new Date()
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

        const { data, error: insertError } = await supabase
          .from("mcp_subscriptions")
          .insert({
            wallet_address: address.toLowerCase(),
            provider_id: providerId,
            provider_name: provider.name,
            plan,
            status: "active",
            calls_used: 0,
            calls_limit: provider.pricing[plan].calls,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
          })
          .select()
          .single()

        if (insertError) throw insertError

        setSubscriptions((prev) => [data, ...prev])

        toast({
          title: "Subscribed",
          description: `Successfully subscribed to ${provider.name} (${plan} plan)`,
        })
      } catch (err: any) {
        console.error("[MCP] Subscribe error:", err)
        toast({
          title: "Subscription Failed",
          description: err.message || "Failed to subscribe",
          variant: "destructive",
        })
      }
    },
    [address, toast],
  )

  const unsubscribe = useCallback(
    async (subscriptionId: string) => {
      try {
        const supabase = getSupabase()
        const { error: updateError } = await supabase
          .from("mcp_subscriptions")
          .update({ status: "cancelled" })
          .eq("id", subscriptionId)

        if (updateError) throw updateError

        setSubscriptions((prev) =>
          prev.map((sub) => (sub.id === subscriptionId ? { ...sub, status: "cancelled" } : sub)),
        )

        toast({
          title: "Unsubscribed",
          description: "Subscription cancelled successfully",
        })
      } catch (err: any) {
        console.error("[MCP] Unsubscribe error:", err)
        toast({
          title: "Error",
          description: err.message || "Failed to unsubscribe",
          variant: "destructive",
        })
      }
    },
    [toast],
  )

  const changePlan = useCallback(
    async (subscriptionId: string, newPlan: "free" | "pro" | "enterprise") => {
      try {
        const subscription = subscriptions.find((s) => s.id === subscriptionId)
        if (!subscription) throw new Error("Subscription not found")

        const provider = MCP_PROVIDERS.find((p) => p.id === subscription.provider_id)
        if (!provider) throw new Error("Provider not found")

        const supabase = getSupabase()
        const { error: updateError } = await supabase
          .from("mcp_subscriptions")
          .update({
            plan: newPlan,
            calls_limit: provider.pricing[newPlan].calls,
          })
          .eq("id", subscriptionId)

        if (updateError) throw updateError

        setSubscriptions((prev) =>
          prev.map((sub) =>
            sub.id === subscriptionId
              ? { ...sub, plan: newPlan, calls_limit: provider.pricing[newPlan].calls }
              : sub,
          ),
        )

        toast({
          title: "Plan Changed",
          description: `Upgraded to ${newPlan} plan`,
        })
      } catch (err: any) {
        console.error("[MCP] Change plan error:", err)
        toast({
          title: "Error",
          description: err.message || "Failed to change plan",
          variant: "destructive",
        })
      }
    },
    [subscriptions, toast],
  )

  // Get current active subscription
  const currentSubscription = subscriptions.find(s => s.status === 'active') || null

  // Get plans from first provider (they're all the same structure)
  const plans = MCP_PROVIDERS[0]?.pricing || {
    free: { calls: 100, features: [] },
    pro: { price: 29, calls: 10000, features: [] },
    enterprise: { price: 99, calls: 100000, features: [] },
  }

  return {
    subscriptions,
    subscription: currentSubscription,
    providers: MCP_PROVIDERS,
    plans,
    loading,
    error,
    subscribe,
    unsubscribe,
    cancel: unsubscribe,  // Alias
    changePlan,
    refresh: fetchSubscriptions,
  }
}
