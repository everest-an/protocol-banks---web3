"use client"

import { useState, useEffect, useCallback } from "react"
import type { Payment, PaymentHistory, MonthlyPaymentData } from "@/types"

// Generate realistic demo payment history
const GENERATED_DEMO_PAYMENTS: Payment[] = (() => {
  const payments: Payment[] = []
  const now = new Date()
  const entities = [
    { name: "APAC Division", type: "subsidiary" },
    { name: "EMEA Operations", type: "subsidiary" },
    { name: "North America HQ", type: "subsidiary" },
    { name: "Salesforce", type: "partner" },
    { name: "AWS Services", type: "partner" },
    { name: "Google Cloud", type: "partner" },
    { name: "Stripe Inc", type: "partner" },
    { name: "Deel", type: "partner" },
    { name: "Binance Payout", type: "exchange" },
    { name: "Asia Pacific Supplier", type: "supplier" },
  ]
  
  const tokens = ["USDC", "USDT", "DAI"]
  const chains = ["Ethereum", "Polygon", "Arbitrum", "Base", "Optimism", "Tron"]

  // Generate 200 transactions over the last 90 days
  for (let i = 0; i < 200; i++) {
    const daysAgo = Math.floor(Math.random() * 90)
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60))
    
    const isReceived = Math.random() > 0.6 // 40% sent, 60% received
    const entity = entities[Math.floor(Math.random() * entities.length)]
    
    payments.push({
      id: `demo-${i}`,
      from_address: isReceived ? `0x${Math.random().toString(16).slice(2, 10)}...` : "0xMyWallet",
      to_address: isReceived ? "0xMyWallet" : `0x${Math.random().toString(16).slice(2, 10)}...`,
      amount: Math.floor(Math.random() * (isReceived ? 50000 : 20000) + 100).toString(),
      token: tokens[Math.floor(Math.random() * tokens.length)],
      chain: chains[Math.floor(Math.random() * chains.length)],
      status: Math.random() > 0.95 ? "pending" : "completed",
      type: isReceived ? "received" : "sent",
      method: "direct",
      tx_hash: `0x${Math.random().toString(16).slice(2)}`,
      created_at: date.toISOString(),
      timestamp: date.toISOString(),
      completed_at: date.toISOString(),
      created_by: "demo",
      vendor_name: entity.name,
      category: entity.type,
    })
  }
  
  return payments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
})()

const DEMO_PAYMENTS = GENERATED_DEMO_PAYMENTS

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

      // Fetch from Prisma-backed API route
      const params = new URLSearchParams({ wallet: walletAddress })
      if (type !== "all") {
        params.set("type", type)
      }

      const res = await fetch(`/api/payments?${params.toString()}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch payments (${res.status})`)
      }

      const { payments: data } = await res.json()

      console.log("[v0] usePaymentHistory: Loaded from API, count:", data?.length || 0)
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

      // POST to Prisma-backed API route
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payment),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to create payment")
      }

      const { payment: data } = await res.json()

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
        amount: existing.amount + Number.parseFloat(String(payment.amount)),
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

  // Calculate this month and last month totals
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

  const thisMonthTotal = payments
    .filter((p) => {
      const date = new Date(p.created_at)
      return p.type === "sent" && p.status === "completed" && date >= thisMonthStart
    })
    .reduce((sum, p) => sum + Number.parseFloat(String(p.amount)), 0)

  const lastMonthTotal = payments
    .filter((p) => {
      const date = new Date(p.created_at)
      return p.type === "sent" && p.status === "completed" && date >= lastMonthStart && date <= lastMonthEnd
    })
    .reduce((sum, p) => sum + Number.parseFloat(String(p.amount)), 0)

  const stats: PaymentHistory = {
    payments,
    totalSent: payments
      .filter((p) => p.type === "sent" && p.status === "completed")
      .reduce((sum, p) => sum + Number.parseFloat(String(p.amount)), 0),
    totalReceived: payments
      .filter((p) => p.type === "received" && p.status === "completed")
      .reduce((sum, p) => sum + Number.parseFloat(String(p.amount)), 0),
    thisMonth: thisMonthTotal,
    lastMonth: lastMonthTotal,
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
