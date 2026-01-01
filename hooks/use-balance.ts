"use client"

import { useState, useEffect, useCallback } from "react"
import { fetchMultiChainBalance, type MultiChainBalance } from "@/lib/multi-chain-balance"
import type { WalletBalance, ChainDistribution } from "@/types"

const DEMO_BALANCE: WalletBalance = {
  totalUSD: 125450.32,
  tokens: [
    { token: "USDC", chain: "Ethereum", balance: "75000", balanceUSD: 75000, price: 1.0 },
    { token: "USDC", chain: "Polygon", balance: "30000", balanceUSD: 30000, price: 1.0 },
    { token: "USDC", chain: "Arbitrum", balance: "15000", balanceUSD: 15000, price: 1.0 },
    { token: "USDC", chain: "Base", balance: "5450.32", balanceUSD: 5450.32, price: 1.0 },
  ],
  chainDistribution: [
    {
      chainKey: "ethereum",
      chainName: "Ethereum",
      chainIcon: "⟠",
      balanceUSD: 75000,
      percentage: 59.8,
      tokens: [{ symbol: "USDC", balance: "75000", balanceUSD: 75000, price: 1.0 }],
    },
    {
      chainKey: "polygon",
      chainName: "Polygon",
      chainIcon: "⬡",
      balanceUSD: 30000,
      percentage: 23.9,
      tokens: [{ symbol: "USDC", balance: "30000", balanceUSD: 30000, price: 1.0 }],
    },
    {
      chainKey: "arbitrum",
      chainName: "Arbitrum",
      chainIcon: "◆",
      balanceUSD: 15000,
      percentage: 12.0,
      tokens: [{ symbol: "USDC", balance: "15000", balanceUSD: 15000, price: 1.0 }],
    },
    {
      chainKey: "base",
      chainName: "Base",
      chainIcon: "🔵",
      balanceUSD: 5450.32,
      percentage: 4.3,
      tokens: [{ symbol: "USDC", balance: "5450.32", balanceUSD: 5450.32, price: 1.0 }],
    },
  ],
  lastUpdated: new Date().toISOString(),
}

const EMPTY_BALANCE: WalletBalance = {
  totalUSD: 0,
  tokens: [],
  chainDistribution: [],
  lastUpdated: new Date().toISOString(),
}

interface UseBalanceOptions {
  isDemoMode?: boolean
  walletAddress?: string
}

export function useBalance(options: UseBalanceOptions = {}) {
  const { isDemoMode = false, walletAddress } = options
  const [balance, setBalance] = useState<WalletBalance>(EMPTY_BALANCE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBalance = useCallback(async () => {
    if (isDemoMode) {
      setBalance(DEMO_BALANCE)
      return
    }

    if (!walletAddress) {
      setBalance(EMPTY_BALANCE)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const multiChainBalance: MultiChainBalance = await fetchMultiChainBalance(walletAddress)

      // Convert to WalletBalance format
      const tokens = multiChainBalance.chains.flatMap((chain) =>
        chain.tokens.map((token) => ({
          token: token.symbol,
          chain: chain.chainName,
          balance: token.balance,
          balanceUSD: token.balanceUSD,
          price: token.price,
        })),
      )

      const chainDistribution: ChainDistribution[] = multiChainBalance.chains.map((chain) => ({
        chainKey: chain.chainKey,
        chainName: chain.chainName,
        chainIcon: chain.chainIcon,
        balanceUSD: chain.balanceUSD,
        percentage: chain.percentage,
        tokens: chain.tokens,
      }))

      setBalance({
        totalUSD: multiChainBalance.totalUSD,
        tokens,
        chainDistribution,
        lastUpdated: multiChainBalance.lastUpdated,
      })
    } catch (err) {
      console.error("[useBalance] Error:", err)
      setError(err instanceof Error ? err.message : "Failed to load balance")
      setBalance(EMPTY_BALANCE)
    } finally {
      setLoading(false)
    }
  }, [isDemoMode, walletAddress])

  useEffect(() => {
    loadBalance()
  }, [loadBalance])

  // Auto refresh every 60 seconds
  useEffect(() => {
    if (!isDemoMode && walletAddress) {
      const interval = setInterval(loadBalance, 60000)
      return () => clearInterval(interval)
    }
  }, [isDemoMode, walletAddress, loadBalance])

  return {
    balance,
    loading,
    error,
    refresh: loadBalance,
  }
}
