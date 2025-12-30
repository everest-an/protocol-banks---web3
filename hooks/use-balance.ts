"use client"

import { useState, useEffect, useCallback } from "react"
import type { ethers } from "ethers"
import type { WalletBalance } from "@/types"

const DEMO_BALANCE: WalletBalance = {
  totalUSD: 125450.32,
  tokens: [
    { token: "USDC", chain: "Ethereum", balance: "75000", balanceUSD: 75000, price: 1.0 },
    { token: "USDC", chain: "Polygon", balance: "30000", balanceUSD: 30000, price: 1.0 },
    { token: "USDC", chain: "Arbitrum", balance: "15000", balanceUSD: 15000, price: 1.0 },
    { token: "USDC", chain: "Base", balance: "5450.32", balanceUSD: 5450.32, price: 1.0 },
  ],
  lastUpdated: new Date().toISOString(),
}

interface UseBalanceOptions {
  isDemoMode?: boolean
  walletAddress?: string
  provider?: ethers.BrowserProvider
}

export function useBalance(options: UseBalanceOptions = {}) {
  const { isDemoMode = false, walletAddress, provider } = options
  const [balance, setBalance] = useState<WalletBalance>(DEMO_BALANCE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBalance = useCallback(async () => {
    console.log("[v0] useBalance: Loading balance", { isDemoMode, walletAddress })

    if (isDemoMode || !walletAddress || !provider) {
      console.log("[v0] useBalance: Using demo balance")
      setBalance(DEMO_BALANCE)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // TODO: Implement real balance fetching from multiple chains
      // For now, use demo data
      setBalance(DEMO_BALANCE)
    } catch (err) {
      console.error("[v0] useBalance: Error:", err)
      setError(err instanceof Error ? err.message : "Failed to load balance")
      setBalance(DEMO_BALANCE)
    } finally {
      setLoading(false)
    }
  }, [isDemoMode, walletAddress, provider])

  useEffect(() => {
    loadBalance()
  }, [loadBalance])

  return {
    balance,
    loading,
    error,
    refresh: loadBalance,
  }
}
