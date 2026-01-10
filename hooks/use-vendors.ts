"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase-client"
import type { Vendor, VendorTier, VendorCategory } from "@/types"

const DEMO_VENDORS: Vendor[] = [
  // Subsidiaries (6 named divisions)
  {
    id: "sub-1",
    wallet_address: "0x6ca90384622c1",
    company_name: "APAC Division",
    category: "subsidiary",
    tier: "subsidiary",
    chain: "Ethereum",
    created_by: "demo",
    created_at: "2024-01-15",
    updated_at: "2024-01-15",
    monthly_volume: 1372857,
    transaction_count: 168,
    email: "finance@apacdivision.com",
  },
  {
    id: "sub-2",
    wallet_address: "0x7db81495733d2",
    company_name: "EMEA Operations",
    category: "subsidiary",
    tier: "subsidiary",
    chain: "Polygon",
    created_by: "demo",
    created_at: "2024-01-20",
    updated_at: "2024-01-20",
    monthly_volume: 980432,
    transaction_count: 142,
    email: "ops@emea-operations.com",
  },
  {
    id: "sub-3",
    wallet_address: "0x8ec92506844e3",
    company_name: "North America HQ",
    category: "subsidiary",
    tier: "subsidiary",
    chain: "Arbitrum",
    created_by: "demo",
    created_at: "2024-02-01",
    updated_at: "2024-02-01",
    monthly_volume: 2145678,
    transaction_count: 203,
    email: "hq@northamerica.com",
  },
  {
    id: "sub-4",
    wallet_address: "0x9fd03617955f4",
    company_name: "LATAM Branch",
    category: "subsidiary",
    tier: "subsidiary",
    chain: "Base",
    created_by: "demo",
    created_at: "2024-02-10",
    updated_at: "2024-02-10",
    monthly_volume: 567890,
    transaction_count: 89,
    email: "latam@branch.com",
  },
  {
    id: "sub-5",
    wallet_address: "0xae014728066g5",
    company_name: "MEA Division",
    category: "subsidiary",
    tier: "subsidiary",
    chain: "Ethereum",
    created_by: "demo",
    created_at: "2024-02-15",
    updated_at: "2024-02-15",
    monthly_volume: 445000,
    transaction_count: 67,
    email: "mea@division.com",
  },

  // Partners (8 named companies)
  {
    id: "partner-1",
    wallet_address: "0x4567890123abc",
    company_name: "Salesforce",
    category: "partner",
    tier: "partner",
    chain: "Ethereum",
    created_by: "demo",
    created_at: "2024-01-10",
    updated_at: "2024-01-10",
    monthly_volume: 145000,
    transaction_count: 45,
    parentId: "sub-1",
  },
  {
    id: "partner-2",
    wallet_address: "0x5678901234bcd",
    company_name: "Slack",
    category: "partner",
    tier: "partner",
    chain: "Base",
    created_by: "demo",
    created_at: "2024-01-12",
    updated_at: "2024-01-12",
    monthly_volume: 89000,
    transaction_count: 34,
    parentId: "sub-1",
  },
  {
    id: "partner-3",
    wallet_address: "0x6789012345cde",
    company_name: "Ventures Lab",
    category: "partner",
    tier: "partner",
    chain: "Ethereum",
    created_by: "demo",
    created_at: "2024-01-18",
    updated_at: "2024-01-18",
    monthly_volume: 320000,
    transaction_count: 67,
    parentId: "sub-2",
  },
  {
    id: "partner-4",
    wallet_address: "0x7890123456def",
    company_name: "Cloudflare",
    category: "partner",
    tier: "partner",
    chain: "Polygon",
    created_by: "demo",
    created_at: "2024-01-25",
    updated_at: "2024-01-25",
    monthly_volume: 567000,
    transaction_count: 89,
    parentId: "sub-2",
  },
  {
    id: "partner-5",
    wallet_address: "0x8901234567ef0",
    company_name: "Stripe",
    category: "partner",
    tier: "partner",
    chain: "Arbitrum",
    created_by: "demo",
    created_at: "2024-02-05",
    updated_at: "2024-02-05",
    monthly_volume: 234000,
    transaction_count: 56,
    parentId: "sub-3",
  },
  {
    id: "partner-6",
    wallet_address: "0x9012345678f01",
    company_name: "Google Cloud",
    category: "partner",
    tier: "partner",
    chain: "Base",
    created_by: "demo",
    created_at: "2024-02-10",
    updated_at: "2024-02-10",
    monthly_volume: 178000,
    transaction_count: 42,
    parentId: "sub-3",
  },
  {
    id: "partner-7",
    wallet_address: "0x0123456789012",
    company_name: "AWS",
    category: "partner",
    tier: "partner",
    chain: "Ethereum",
    created_by: "demo",
    created_at: "2024-02-15",
    updated_at: "2024-02-15",
    monthly_volume: 445000,
    transaction_count: 78,
    parentId: "sub-4",
  },
  {
    id: "partner-8",
    wallet_address: "0x1234567890123",
    company_name: "Nework",
    category: "partner",
    tier: "partner",
    chain: "Polygon",
    created_by: "demo",
    created_at: "2024-02-18",
    updated_at: "2024-02-18",
    monthly_volume: 289000,
    transaction_count: 52,
    parentId: "sub-5",
  },

  // Vendors (40+ with parentId linking to subsidiaries/partners)
  ...Array.from({ length: 40 }, (_, i) => {
    // Generate unique vendor names
    const vendorNames = [
      "Vendor IQ7QS Lt",
      "Vendor GQ23O Lt",
      "Vendor 2P91 Lt",
      "Vendor NT049 Lt",
      "Vendor 6HI7T Lt",
      "Vendor Q0269 Lt",
      "Vendor 0ZR6D Lt",
      "Vendor EUSNY Lt",
      "Vendor BXVEW Lt",
      "Vendor PR0B Lt",
      "Vendor EL3GF Lt",
      "Vendor SI667 Lt",
      "Vendor VNP2L Lt",
      "Vendor 47YFG Lt",
      "Vendor MK892 Lt",
      "Vendor PL3KD Lt",
      "Vendor QW8RT Lt",
      "Vendor ZX4CV Lt",
      "Vendor BN7MK Lt",
      "Vendor JH2DF Lt",
      "Vendor YU9IO Lt",
      "Vendor TR6WE Lt",
      "Vendor AS3DF Lt",
      "Vendor GH5JK Lt",
      "Vendor NM1QW Lt",
      "Vendor OP4ER Lt",
      "Vendor TY7UI Lt",
      "Vendor FG8HJ Lt",
      "Vendor VB2NM Lt",
      "Vendor XC5ZA Lt",
      "Vendor SD9FG Lt",
      "Vendor WE3RT Lt",
      "Vendor KL6JH Lt",
      "Vendor PO1IU Lt",
      "Vendor MN4BV Lt",
      "Vendor CX7ZA Lt",
      "Vendor QA8WS Lt",
      "Vendor ED2RF Lt",
      "Vendor TG5YH Lt",
      "Vendor UJ9IK Lt",
    ]
    const subsidiaryIds = ["sub-1", "sub-2", "sub-3", "sub-4", "sub-5"]
    const partnerIds = [
      "partner-1",
      "partner-2",
      "partner-3",
      "partner-4",
      "partner-5",
      "partner-6",
      "partner-7",
      "partner-8",
    ]

    // Some vendors link to subsidiaries, some to partners
    const parentId = i < 20 ? subsidiaryIds[i % subsidiaryIds.length] : partnerIds[(i - 20) % partnerIds.length]

    return {
      id: `vendor-${i + 1}`,
      wallet_address: `0x${(1000 + i).toString(16)}f1a946b4a`,
      company_name: vendorNames[i] || `Vendor ${String.fromCharCode(65 + (i % 26))}${i}`,
      category: "supplier" as VendorCategory,
      tier: "vendor" as VendorTier,
      chain: ["Ethereum", "Polygon", "Arbitrum", "Base"][i % 4],
      created_by: "demo",
      created_at: `2024-0${1 + (i % 9)}-${10 + (i % 20)}`,
      updated_at: `2024-0${1 + (i % 9)}-${10 + (i % 20)}`,
      monthly_volume: Math.floor(Math.random() * 50000) + 10000,
      transaction_count: Math.floor(Math.random() * 30) + 5,
      parentId,
      email: `invoices@vendor${i + 1}.com`,
      notes: `Invoice #10${i + 20}`,
    }
  }),
]

const EMPTY_VENDORS: Vendor[] = []

interface UseVendorsOptions {
  isDemoMode?: boolean
  walletAddress?: string
}

export function useVendors(options: UseVendorsOptions = {}) {
  const { isDemoMode = false, walletAddress } = options
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadVendors = useCallback(async () => {
    console.log("[v0] useVendors: loadVendors called", { isDemoMode, walletAddress })
    setLoading(true)
    setError(null)

    try {
      if (isDemoMode) {
        console.log("[v0] useVendors: Using demo data, count:", DEMO_VENDORS.length)
        setVendors(DEMO_VENDORS)
        setLoading(false)
        return
      }

      if (!walletAddress) {
        console.log("[v0] useVendors: No wallet connected, showing empty state")
        setVendors(EMPTY_VENDORS)
        setLoading(false)
        return
      }

      const supabase = createClient()
      const { data, error: dbError } = await supabase
        .from("vendors")
        .select("*")
        .eq("created_by", walletAddress)
        .order("created_at", { ascending: false })

      if (dbError) throw dbError

      console.log("[v0] useVendors: Loaded from DB, count:", data?.length || 0)
      setVendors(data || EMPTY_VENDORS)
    } catch (err) {
      console.error("[v0] useVendors: Error loading vendors:", err)
      setError(err instanceof Error ? err.message : "Failed to load vendors")
      setVendors(EMPTY_VENDORS)
    } finally {
      setLoading(false)
    }
  }, [isDemoMode, walletAddress])

  const addVendor = useCallback(
    async (vendor: Omit<Vendor, "id" | "created_at" | "updated_at">) => {
      if (isDemoMode) {
        const newVendor: Vendor = {
          ...vendor,
          id: `demo-${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setVendors((prev) => [newVendor, ...prev])
        return newVendor
      }

      const supabase = createClient()
      const { data, error: dbError } = await supabase.from("vendors").insert([vendor]).select().single()

      if (dbError) throw dbError

      setVendors((prev) => [data, ...prev])
      return data
    },
    [isDemoMode],
  )

  const updateVendor = useCallback(
    async (id: string, updates: Partial<Vendor>) => {
      if (isDemoMode) {
        setVendors((prev) =>
          prev.map((v) => (v.id === id ? { ...v, ...updates, updated_at: new Date().toISOString() } : v)),
        )
        return
      }

      const supabase = createClient()
      const { error: dbError } = await supabase
        .from("vendors")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)

      if (dbError) throw dbError

      setVendors((prev) =>
        prev.map((v) => (v.id === id ? { ...v, ...updates, updated_at: new Date().toISOString() } : v)),
      )
    },
    [isDemoMode],
  )

  const deleteVendor = useCallback(
    async (id: string) => {
      if (isDemoMode) {
        setVendors((prev) => prev.filter((v) => v.id !== id))
        return
      }

      const supabase = createClient()
      const { error: dbError } = await supabase.from("vendors").delete().eq("id", id)

      if (dbError) throw dbError

      setVendors((prev) => prev.filter((v) => v.id !== id))
    },
    [isDemoMode],
  )

  useEffect(() => {
    loadVendors()
  }, [loadVendors])

  return {
    vendors,
    loading,
    error,
    refresh: loadVendors,
    addVendor,
    updateVendor,
    deleteVendor,
  }
}
