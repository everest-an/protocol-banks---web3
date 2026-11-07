"use client"

import { useState, useEffect, useCallback } from "react"
import type { WalletBalance, TokenBalance, ChainDistribution, TokenDistribution } from "@/types"
import { useTokenPrices, getTokenPrice } from "@/hooks/use-token-prices"

const DEMO_BALANCE: WalletBalance = {
  totalUSD: 145450.32,
  tokens: [
    { token: "USDC", chain: "Ethereum", balance: "50000", balanceUSD: 50000, price: 1.0 },
    { token: "ETH", chain: "Ethereum", balance: "7.14", balanceUSD: 25000, price: 3500 },
    { token: "USDC", chain: "Polygon", balance: "20000", balanceUSD: 20000, price: 1.0 },
    { token: "MATIC", chain: "Polygon", balance: "20000", balanceUSD: 10000, price: 0.5 },
    { token: "USDC", chain: "Arbitrum", balance: "12000", balanceUSD: 12000, price: 1.0 },
    { token: "ETH", chain: "Arbitrum", balance: "0.857", balanceUSD: 3000, price: 3500 },
    { token: "USDC", chain: "Base", balance: "5000", balanceUSD: 5000, price: 1.0 },
    { token: "ETH", chain: "Base", balance: "0.128", balanceUSD: 450.32, price: 3500 },
    { token: "USDT", chain: "Tron", balance: "20000", balanceUSD: 20000, price: 1.0 },
  ],
  chainDistribution: [
    { chain: "Ethereum", chainId: 1, totalUSD: 75000, percentage: 51.6, tokenCount: 2 },
    { chain: "Polygon", chainId: 137, totalUSD: 30000, percentage: 20.6, tokenCount: 2 },
    { chain: "Tron", chainId: 728126428, totalUSD: 20000, percentage: 13.8, tokenCount: 1 },
    { chain: "Arbitrum", chainId: 42161, totalUSD: 15000, percentage: 10.3, tokenCount: 2 },
    { chain: "Base", chainId: 8453, totalUSD: 5450.32, percentage: 3.7, tokenCount: 2 },
  ],
  tokenDistribution: [
    { token: "USDC", totalBalance: 87000, totalUSD: 87000, percentage: 59.8, price: 1.0, chains: ["Ethereum", "Polygon", "Arbitrum", "Base"] },
    { token: "ETH", totalBalance: 8.125, totalUSD: 28450.32, percentage: 19.6, price: 3500, chains: ["Ethereum", "Arbitrum", "Base"] },
    { token: "USDT", totalBalance: 20000, totalUSD: 20000, percentage: 13.8, price: 1.0, chains: ["Tron"] },
    { token: "MATIC", totalBalance: 20000, totalUSD: 10000, percentage: 6.9, price: 0.5, chains: ["Polygon"] },
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

interface RawToken {
  token: string
  chain: string
  balance: string
  contractAddress?: string
}

export function useBalance(options: UseBalanceOptions = {}) {
  const { isDemoMode = false, walletAddress } = options
  const { prices, loading: pricesLoading } = useTokenPrices()
  const [balance, setBalance] = useState<WalletBalance>(EMPTY_BALANCE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBalances = useCallback(async () => {
    if (isDemoMode) {
      setBalance(DEMO_BALANCE)
      setError(null)
      setLoading(false)
      return
    }
    if (!walletAddress) {
      setBalance(EMPTY_BALANCE)
      setError(null)
      setLoading(false)
      return
    }
    if (pricesLoading) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/balance?address=${encodeURIComponent(walletAddress)}`, {
        cache: "no-store",
        signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(25_000) : undefined,
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Balance request failed (${response.status})`)

      const raw = (Array.isArray(data.tokens) ? data.tokens : []) as RawToken[]
      const tokens: TokenBalance[] = raw
        .map((item) => {
          const price = getTokenPrice(prices, item.token)
          return {
            token: item.token,
            chain: item.chain,
            balance: item.balance,
            balanceUSD: Number.parseFloat(item.balance) * price,
            price,
            contractAddress: item.contractAddress,
          }
        })
        .filter((item) => item.balanceUSD > 0.01)
        .sort((a, b) => b.balanceUSD - a.balanceUSD)

      const totalUSD = tokens.reduce((sum, token) => sum + token.balanceUSD, 0)
      const chainTotals: Record<string, { totalUSD: number; tokenCount: number }> = {}
      for (const token of tokens) {
        if (!chainTotals[token.chain]) chainTotals[token.chain] = { totalUSD: 0, tokenCount: 0 }
        chainTotals[token.chain].totalUSD += token.balanceUSD
        chainTotals[token.chain].tokenCount += 1
      }
      const chainDistribution: ChainDistribution[] = Object.entries(chainTotals)
        .map(([chain, value]) => ({
          chain,
          chainId: 0,
          totalUSD: value.totalUSD,
          percentage: totalUSD > 0 ? (value.totalUSD / totalUSD) * 100 : 0,
          tokenCount: value.tokenCount,
        }))
        .sort((a, b) => b.totalUSD - a.totalUSD)

      const tokenTotals: Record<string, { totalBalance: number; totalUSD: number; price: number; chains: Set<string> }> = {}
      for (const token of tokens) {
        if (!tokenTotals[token.token]) {
          tokenTotals[token.token] = { totalBalance: 0, totalUSD: 0, price: token.price, chains: new Set() }
        }
        tokenTotals[token.token].totalBalance += Number.parseFloat(token.balance)
        tokenTotals[token.token].totalUSD += token.balanceUSD
        tokenTotals[token.token].chains.add(token.chain)
      }
      const tokenDistribution: TokenDistribution[] = Object.entries(tokenTotals)
        .map(([token, value]) => ({
          token,
          totalBalance: value.totalBalance,
          totalUSD: value.totalUSD,
          percentage: totalUSD > 0 ? (value.totalUSD / totalUSD) * 100 : 0,
          price: value.price,
          chains: [...value.chains],
        }))
        .sort((a, b) => b.totalUSD - a.totalUSD)

      setBalance({
        totalUSD,
        tokens,
        chainDistribution,
        tokenDistribution,
        lastUpdated: new Date().toISOString(),
      })
    } catch (err) {
      console.error("[useBalance] Balance request failed:", err)
      setError(err instanceof Error ? err.message : "Failed to load balance")
      setBalance(EMPTY_BALANCE)
    } finally {
      setLoading(false)
    }
  }, [isDemoMode, walletAddress, prices, pricesLoading])

  useEffect(() => {
    fetchBalances()
  }, [fetchBalances])

  return {
    balance,
    loading: loading || pricesLoading,
    error,
    refresh: fetchBalances,
  }
}
