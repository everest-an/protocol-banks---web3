"use client"

import { useState, useCallback, useEffect } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { useToast } from "@/hooks/use-toast"
import { getSupabase } from "@/lib/supabase"
import { hashKey } from "@/lib/hash-key"

export interface PricingTier {
  id: string
  name: string
  price: number // USDC per 1000 calls
  rateLimit: number // calls per minute
  features: string[]
}

export interface APIKey {
  id: string
  key_prefix: string
  key_hash: string
  name: string
  tier: string
  is_active: boolean
  status?: "active" | "revoked" // Computed from is_active for UI
  usage_count: number
  calls_limit: number
  created_at: string
  last_used_at: string | null
}

export interface UsageData {
  date: string
  calls: number
  revenue: number
}

export interface MonetizeConfig {
  enabled: boolean
  tiers: PricingTier[]
  defaultTier: string
  webhookUrl: string | null
  rateLimitEnabled: boolean
}

export interface UseMonetizeConfigReturn {
  config: MonetizeConfig
  apiKeys: APIKey[]
  usage: UsageData[]
  totalRevenue: number
  totalCalls: number
  loading: boolean
  error: string | null
  updateConfig: (updates: Partial<MonetizeConfig>) => Promise<void>
  createAPIKey: (name: string, tier: string) => Promise<APIKey | null>
  revokeAPIKey: (keyId: string) => Promise<void>
  addTier: (tier: Omit<PricingTier, "id">) => Promise<void>
  updateTier: (tierId: string, updates: Partial<PricingTier>) => Promise<void>
  deleteTier: (tierId: string) => Promise<void>
  refresh: () => Promise<void>
}

const DEFAULT_TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    rateLimit: 10,
    features: ["100 calls/month", "Basic support"],
  },
  {
    id: "starter",
    name: "Starter",
    price: 0.5,
    rateLimit: 60,
    features: ["10,000 calls/month", "Email support", "Basic analytics"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 0.3,
    rateLimit: 300,
    features: ["100,000 calls/month", "Priority support", "Advanced analytics", "Webhooks"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 0.1,
    rateLimit: 1000,
    features: ["Unlimited calls", "Dedicated support", "Custom SLA", "White-label"],
  },
]

const DEFAULT_CONFIG: MonetizeConfig = {
  enabled: false,
  tiers: DEFAULT_TIERS,
  defaultTier: "free",
  webhookUrl: null,
  rateLimitEnabled: true,
}

export function useMonetizeConfig(): UseMonetizeConfigReturn {
  const { address } = useWeb3()
  const { toast } = useToast()
  const [config, setConfig] = useState<MonetizeConfig>(DEFAULT_CONFIG)
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [usage, setUsage] = useState<UsageData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!address) {
      setConfig(DEFAULT_CONFIG)
      setApiKeys([])
      setUsage([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = getSupabase()

      // Fetch config
      const { data: configData } = await supabase
        .from("monetize_configs")
        .select("*")
        .eq("owner_address", address.toLowerCase())
        .single()

      if (configData) {
        setConfig({
          enabled: configData.enabled,
          tiers: configData.tiers || DEFAULT_TIERS,
          defaultTier: configData.default_tier || "free",
          webhookUrl: configData.webhook_url,
          rateLimitEnabled: configData.rate_limit_enabled ?? true,
        })
      }

      // Fetch API keys
      const { data: keysData } = await supabase
        .from("api_keys")
        .select("*")
        .eq("owner_address", address.toLowerCase())
        .order("created_at", { ascending: false })

      setApiKeys(keysData || [])

      // Generate mock usage data for last 30 days
      const mockUsage: UsageData[] = []
      const now = new Date()
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        mockUsage.push({
          date: date.toISOString().split("T")[0],
          calls: Math.floor(Math.random() * 5000) + 500,
          revenue: Math.random() * 50 + 10,
        })
      }
      setUsage(mockUsage)
    } catch (err: any) {
      console.error("[Monetize] Failed to fetch data:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const updateConfig = useCallback(
    async (updates: Partial<MonetizeConfig>) => {
      if (!address) return

      try {
        const supabase = getSupabase()
        const newConfig = { ...config, ...updates }

        const { error: upsertError } = await supabase.from("monetize_configs").upsert({
          owner_address: address.toLowerCase(),
          enabled: newConfig.enabled,
          tiers: newConfig.tiers,
          default_tier: newConfig.defaultTier,
          webhook_url: newConfig.webhookUrl,
          rate_limit_enabled: newConfig.rateLimitEnabled,
          updated_at: new Date().toISOString(),
        })

        if (upsertError) throw upsertError

        setConfig(newConfig)
        toast({
          title: "Config Updated",
          description: "Monetization settings saved successfully",
        })
      } catch (err: any) {
        console.error("[Monetize] Update config error:", err)
        toast({
          title: "Error",
          description: err.message || "Failed to update config",
          variant: "destructive",
        })
      }
    },
    [address, config, toast],
  )

  const createAPIKey = useCallback(
    async (name: string, tier: string): Promise<APIKey | null> => {
      if (!address) return null

      try {
        const supabase = getSupabase()
        const keyValue = `pb_${crypto.randomUUID().replace(/-/g, "")}`
        const keyHash = await hashKey(keyValue)
        const tierConfig = config.tiers.find((t) => t.id === tier)

        const { data, error: insertError } = await supabase
          .from("api_keys")
          .insert({
            owner_address: address.toLowerCase(),
            key_prefix: keyValue.substring(0, 8),
            key_hash: keyHash,
            name,
            tier,
            is_active: true,
            usage_count: 0,
            calls_limit: tier === "enterprise" ? -1 : tierConfig?.rateLimit ? tierConfig.rateLimit * 30 * 24 * 60 : 1000,
          })
          .select()
          .single()

        if (insertError) throw insertError

        setApiKeys((prev) => [data, ...prev])
        toast({
          title: "API Key Created",
          description: `Key "${name}" created successfully`,
        })
        return data
      } catch (err: any) {
        console.error("[Monetize] Create key error:", err)
        toast({
          title: "Error",
          description: err.message || "Failed to create API key",
          variant: "destructive",
        })
        return null
      }
    },
    [address, config.tiers, toast],
  )

  const revokeAPIKey = useCallback(
    async (keyId: string) => {
      try {
        const supabase = getSupabase()
        const { error: updateError } = await supabase
          .from("api_keys")
          .update({ is_active: false })
          .eq("id", keyId)

        if (updateError) throw updateError

        setApiKeys((prev) => prev.map((key) => (key.id === keyId ? { ...key, is_active: false, status: "revoked" } : key)))
        toast({
          title: "API Key Revoked",
          description: "The API key has been revoked",
        })
      } catch (err: any) {
        console.error("[Monetize] Revoke key error:", err)
        toast({
          title: "Error",
          description: err.message || "Failed to revoke API key",
          variant: "destructive",
        })
      }
    },
    [toast],
  )

  const addTier = useCallback(
    async (tier: Omit<PricingTier, "id">) => {
      const newTier: PricingTier = {
        ...tier,
        id: `tier_${Date.now()}`,
      }
      await updateConfig({ tiers: [...config.tiers, newTier] })
    },
    [config.tiers, updateConfig],
  )

  const updateTier = useCallback(
    async (tierId: string, updates: Partial<PricingTier>) => {
      const newTiers = config.tiers.map((t) => (t.id === tierId ? { ...t, ...updates } : t))
      await updateConfig({ tiers: newTiers })
    },
    [config.tiers, updateConfig],
  )

  const deleteTier = useCallback(
    async (tierId: string) => {
      const newTiers = config.tiers.filter((t) => t.id !== tierId)
      await updateConfig({ tiers: newTiers })
    },
    [config.tiers, updateConfig],
  )

  const totalRevenue = usage.reduce((sum, d) => sum + d.revenue, 0)
  const totalCalls = usage.reduce((sum, d) => sum + d.calls, 0)

  return {
    config,
    apiKeys,
    usage,
    totalRevenue,
    totalCalls,
    loading,
    error,
    updateConfig,
    createAPIKey,
    revokeAPIKey,
    addTier,
    updateTier,
    deleteTier,
    refresh: fetchData,
  }
}
