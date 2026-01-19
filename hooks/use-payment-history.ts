"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase-client"
import type { Payment, PaymentHistory, MonthlyPaymentData } from "@/types"

// Demo payment history
const DEMO_PAYMENTS: Payment[] = [
  {
    id: "1",
    from_address: "0xMyWallet",
    to_address: "0xAPAC...",
    amount: "50000",
    token: "USDC",
    chain: "Ethereum",
    status: "completed",
    type: "sent",
    method: "eip3009",
    tx_hash: "0xabc...",
    created_at: "2024-03-15T10:30:00Z",
    completed_at: "2024-03-15T10:31:00Z",
    created_by: "demo",
    vendor_name: "APAC Division",
    category: "subsidiary",
  },
  {
    id: "2",
    from_address: "0xVendor...",
    to_address: "0xMyWallet",
    amount: "25000",
    token: "USDC",
    chain: "Polygon",
    status: "completed",
    type: "received",
    method: "direct",
    tx_hash: "0xdef...",
    created_at: "2024-03-14T14:20:00Z",
    completed_at: "2024-03-14T14:21:00Z",
    created_by: "demo",
    vendor_name: "Salesforce",
    category: "partner",
  },
  {
    id: "3",
    from_address: "0xMyWallet",
    to_address: "0xVendor...",
    amount: "12500",
    token: "USDC",
    chain: "Arbitrum",
    status: "completed",
    type: "sent",
    method: "batch",
    created_at: "2024-03-13T09:15:00Z",
    completed_at: "2024-03-13T09:16:00Z",
    created_by: "demo",
    vendor_name: "AWS Services",
    category: "partner",
  },
  {
    id: "4",
    from_address: "0xMyWallet",
    to_address: "0xEMEA...",
    amount: "75000",
    token: "USDC",
    chain: "Base",
    status: "pending",
    type: "sent",
    method: "eip3009",
    created_at: "2024-03-16T16:45:00Z",
    created_by: "demo",
    vendor_name: "EMEA Operations",
    category: "subsidiary",
  },
  {
    id: "5",
    from_address: "0xPartner...",
    to_address: "0xMyWallet",
    amount: "33000",
    token: "USDC",
    chain: "Ethereum",
    status: "completed",
    type: "received",
    method: "direct",
    tx_hash: "0xghi...",
    created_at: "2024-03-12T11:00:00Z",
    completed_at: "2024-03-12T11:01:00Z",
    created_by: "demo",
    vendor_name: "Stripe Inc",
    category: "partner",
  },
]

const EMPTY_PAYMENTS: Payment[] = []

interface UsePaymentHistoryOptions {
  isDemoMode?: boolean
  walletAddress?: string
  type?: "sent" | "received" | "all"
}

export function usePaymentHistory(options: UsePaymentHistoryOptions = {}) {
  const { isDemoMode = false, walletAddress, type = "all" } = options
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPayments = useCallback(async () => {
    console.log("[v0] usePaymentHistory: Loading payments", { isDemoMode, walletAddress, type })
    setLoading(true)
    setError(null)

    try {
      if (isDemoMode) {
        const filtered = type === "all" ? DEMO_PAYMENTS : DEMO_PAYMENTS.filter((p) => p.type === type)
        console.log("[v0] usePaymentHistory: Using demo data, count:", filtered.length)
        setPayments(filtered)
        setLoading(false)
        return
      }

      if (!walletAddress) {
        console.log("[v0] usePaymentHistory: No wallet connected, showing empty state")
        setPayments(EMPTY_PAYMENTS)
        setLoading(false)
        return
      }

      const supabase = createClient()
      let query = supabase
        .from("payments")
        .select("*")
        .eq("created_by", walletAddress)
        .order("created_at", { ascending: false })

      if (type !== "all") {
        query = query.eq("type", type)
      }

      const { data, error: dbError } = await query

      if (dbError) throw dbError

      console.log("[v0] usePaymentHistory: Loaded from DB, count:", data?.length || 0)
      setPayments(data || EMPTY_PAYMENTS)
    } catch (err) {
      console.error("[v0] usePaymentHistory: Error:", err)
      setError(err instanceof Error ? err.message : "Failed to load payments")
      setPayments(EMPTY_PAYMENTS)
    } finally {
      setLoading(false)
    }
  }, [isDemoMode, walletAddress, type])

  const addPayment = useCallback(
    async (payment: Omit<Payment, "id" | "created_at">) => {
      if (isDemoMode) {
        const newPayment: Payment = {
          ...payment,
          id: `demo-${Date.now()}`,
          created_at: new Date().toISOString(),
        }
        setPayments((prev) => [newPayment, ...prev])
        return newPayment
      }

      const supabase = createClient()
      const { data, error: dbError } = await supabase.from("payments").insert([payment]).select().single()

      if (dbError) throw dbError

      setPayments((prev) => [data, ...prev])
      return data
    },
    [isDemoMode],
  )

  const getMonthlyData = useCallback((): MonthlyPaymentData[] => {
    const monthlyMap = new Map<string, { amount: number; count: number }>()

    payments.forEach((payment) => {
      if (payment.status !== "completed") return

      const date = new Date(payment.created_at)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

      const existing = monthlyMap.get(monthKey) || { amount: 0, count: 0 }
      monthlyMap.set(monthKey, {
        amount: existing.amount + Number.parseFloat(payment.amount),
        count: existing.count + 1,
      })
    })

    return Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [payments])

  useEffect(() => {
    loadPayments()
  }, [loadPayments])

  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${lastMonthDate.getMonth()}`

  const stats: PaymentHistory = {
    payments,
    totalSent: payments
      .filter((p) => p.type === "sent" && p.status === "completed")
      .reduce((sum, p) => sum + Number.parseFloat(p.amount), 0),
    totalReceived: payments
      .filter((p) => p.type === "received" && p.status === "completed")
      .reduce((sum, p) => sum + Number.parseFloat(p.amount), 0),
    thisMonth: payments
      .filter((p) => p.status === "completed")
      .filter((p) => {
        const date = new Date(p.created_at)
        const key = `${date.getFullYear()}-${date.getMonth()}`
        return key === currentMonthKey
      })
      .reduce((sum, p) => sum + Number.parseFloat(p.amount), 0),
    lastMonth: payments
      .filter((p) => p.status === "completed")
      .filter((p) => {
        const date = new Date(p.created_at)
        const key = `${date.getFullYear()}-${date.getMonth()}`
        return key === lastMonthKey
      })
      .reduce((sum, p) => sum + Number.parseFloat(p.amount), 0),
  }

  return {
    payments,
    loading,
    error,
    stats,
    refresh: loadPayments,
    addPayment,
    getMonthlyData,
  }
}
