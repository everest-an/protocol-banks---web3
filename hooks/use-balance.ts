"use client"

import { useState, useEffect, useCallback } from "react"
import { createPublicClient, http, formatUnits, type Address } from "viem"
import { mainnet, polygon, arbitrum, base, optimism, bsc } from "viem/chains"
import type { WalletBalance, TokenBalance, ChainDistribution, TokenDistribution } from "@/types"
import { useTokenPrices, getTokenPrice } from "@/hooks/use-token-prices"

// ERC20 ABI for balanceOf
const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

// Chain configurations with RPC endpoints
const CHAINS = [
  { chain: mainnet, name: "Ethereum", nativeSymbol: "ETH", rpc: "https://eth.llamarpc.com" },
  { chain: polygon, name: "Polygon", nativeSymbol: "MATIC", rpc: "https://polygon.llamarpc.com" },
  { chain: arbitrum, name: "Arbitrum", nativeSymbol: "ETH", rpc: "https://arbitrum.llamarpc.com" },
  { chain: base, name: "Base", nativeSymbol: "ETH", rpc: "https://base.llamarpc.com" },
  { chain: optimism, name: "Optimism", nativeSymbol: "ETH", rpc: "https://optimism.llamarpc.com" },
  { chain: bsc, name: "BNB Chain", nativeSymbol: "BNB", rpc: "https://bsc.llamarpc.com" },
]

// Common tokens with their addresses on different chains
const TOKENS: Record<string, { decimals: number; addresses: Record<number, string> }> = {
  USDC: {
    decimals: 6,
    addresses: {
      1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    },
  },
  USDT: {
    decimals: 6,
    addresses: {
      1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      56: "0x55d398326f99059fF775485246999027B3197955",
    },
  },
  DAI: {
    decimals: 18,
    addresses: {
      1: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      137: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
      42161: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
      10: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    },
  },
  WETH: {
    decimals: 18,
    addresses: {
      137: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
      42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      8453: "0x4200000000000000000000000000000000000006",
      10: "0x4200000000000000000000000000000000000006",
    },
  },
  WBTC: {
    decimals: 8,
    addresses: {
      1: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      137: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
      42161: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    },
  },
}

// Demo balance data
const DEMO_BALANCE: WalletBalance = {
  totalUSD: 125450.32,
  tokens: [
    { token: "USDC", chain: "Ethereum", balance: "50000", balanceUSD: 50000, price: 1.0 },
    { token: "ETH", chain: "Ethereum", balance: "7.14", balanceUSD: 25000, price: 3500 },
    { token: "USDC", chain: "Polygon", balance: "20000", balanceUSD: 20000, price: 1.0 },
    { token: "MATIC", chain: "Polygon", balance: "20000", balanceUSD: 10000, price: 0.5 },
    { token: "USDC", chain: "Arbitrum", balance: "12000", balanceUSD: 12000, price: 1.0 },
    { token: "ETH", chain: "Arbitrum", balance: "0.857", balanceUSD: 3000, price: 3500 },
    { token: "USDC", chain: "Base", balance: "5000", balanceUSD: 5000, price: 1.0 },
    { token: "ETH", chain: "Base", balance: "0.128", balanceUSD: 450.32, price: 3500 },
  ],
  chainDistribution: [
    { chain: "Ethereum", chainId: 1, totalUSD: 75000, percentage: 59.8, tokenCount: 2 },
    { chain: "Polygon", chainId: 137, totalUSD: 30000, percentage: 23.9, tokenCount: 2 },
    { chain: "Arbitrum", chainId: 42161, totalUSD: 15000, percentage: 12.0, tokenCount: 2 },
    { chain: "Base", chainId: 8453, totalUSD: 5450.32, percentage: 4.3, tokenCount: 2 },
  ],
  tokenDistribution: [
    { token: "USDC", totalBalance: 87000, totalUSD: 87000, percentage: 69.3, price: 1.0, chains: ["Ethereum", "Polygon", "Arbitrum", "Base"] },
    { token: "ETH", totalBalance: 8.125, totalUSD: 28450.32, percentage: 22.7, price: 3500, chains: ["Ethereum", "Arbitrum", "Base"] },
    { token: "MATIC", totalBalance: 20000, totalUSD: 10000, percentage: 8.0, price: 0.5, chains: ["Polygon"] },
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
  const { prices, loading: pricesLoading } = useTokenPrices()

  const [balance, setBalance] = useState<WalletBalance>(EMPTY_BALANCE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBalances = useCallback(async () => {
    // Demo mode - return demo data
    if (isDemoMode) {
      setBalance(DEMO_BALANCE)
      setLoading(false)
      return
    }

    // No wallet - return empty
    if (!walletAddress) {
      setBalance(EMPTY_BALANCE)
      setLoading(false)
      return
    }

    // Wait for prices
    if (pricesLoading) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const tokens: TokenBalance[] = []
      const chainTotals: Record<number, { totalUSD: number; tokenCount: number }> = {}
      const address = walletAddress as Address

      // Fetch balances for each chain in parallel
      const chainPromises = CHAINS.map(async ({ chain, name, nativeSymbol, rpc }) => {
        try {
          const client = createPublicClient({
            chain,
            transport: http(rpc),
          })

          // Fetch native token balance
          const nativeBalance = await client.getBalance({ address })
          if (nativeBalance > 0n) {
            const formatted = formatUnits(nativeBalance, 18)
            const price = getTokenPrice(prices, nativeSymbol)
            const balanceUSD = Number.parseFloat(formatted) * price

            if (balanceUSD > 0.01) {
              tokens.push({
                token: nativeSymbol,
                chain: name,
                balance: formatted,
                balanceUSD,
                price,
              })

              if (!chainTotals[chain.id]) {
                chainTotals[chain.id] = { totalUSD: 0, tokenCount: 0 }
              }
              chainTotals[chain.id].totalUSD += balanceUSD
              chainTotals[chain.id].tokenCount += 1
            }
          }

          // Fetch ERC20 token balances
          for (const [symbol, tokenInfo] of Object.entries(TOKENS)) {
            const tokenAddress = tokenInfo.addresses[chain.id]
            if (!tokenAddress) continue

            try {
              const tokenBalance = await client.readContract({
                address: tokenAddress as Address,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [address],
              })

              if (tokenBalance && tokenBalance > 0n) {
                const formatted = formatUnits(tokenBalance, tokenInfo.decimals)
                const price = getTokenPrice(prices, symbol)
                const balanceUSD = Number.parseFloat(formatted) * price

                if (balanceUSD > 0.01) {
                  tokens.push({
                    token: symbol,
                    chain: name,
                    balance: formatted,
                    balanceUSD,
                    price,
                    contractAddress: tokenAddress,
                  })

                  if (!chainTotals[chain.id]) {
                    chainTotals[chain.id] = { totalUSD: 0, tokenCount: 0 }
                  }
                  chainTotals[chain.id].totalUSD += balanceUSD
                  chainTotals[chain.id].tokenCount += 1
                }
              }
            } catch {
              // Skip tokens that fail to load
            }
          }
        } catch (chainError) {
          console.warn(`[v0] Failed to fetch balances on ${name}:`, chainError)
        }
      })

      await Promise.all(chainPromises)

      // Calculate totals
      const totalUSD = tokens.reduce((sum, t) => sum + t.balanceUSD, 0)

      // Build chain distribution
      const chainDistribution: ChainDistribution[] = Object.entries(chainTotals)
        .map(([chainIdStr, data]) => {
          const chainId = Number.parseInt(chainIdStr)
          const chainConfig = CHAINS.find((c) => c.chain.id === chainId)
          return {
            chain: chainConfig?.name || "Unknown",
            chainId,
            totalUSD: data.totalUSD,
            percentage: totalUSD > 0 ? (data.totalUSD / totalUSD) * 100 : 0,
            tokenCount: data.tokenCount,
          }
        })
        .filter((c) => c.totalUSD > 0)
        .sort((a, b) => b.totalUSD - a.totalUSD)

      // Build token distribution (aggregate by token symbol across chains)
      const tokenAgg: Record<string, { totalUSD: number; totalBalance: number; price: number; chains: Set<string> }> = {}
      for (const t of tokens) {
        if (!tokenAgg[t.token]) {
          tokenAgg[t.token] = { totalUSD: 0, totalBalance: 0, price: t.price, chains: new Set() }
        }
        tokenAgg[t.token].totalUSD += t.balanceUSD
        tokenAgg[t.token].totalBalance += Number.parseFloat(t.balance)
        tokenAgg[t.token].chains.add(t.chain)
      }

      const tokenDistribution: TokenDistribution[] = Object.entries(tokenAgg)
        .map(([token, data]) => ({
          token,
          totalBalance: data.totalBalance,
          totalUSD: data.totalUSD,
          percentage: totalUSD > 0 ? (data.totalUSD / totalUSD) * 100 : 0,
          price: data.price,
          chains: Array.from(data.chains),
        }))
        .filter((t) => t.totalUSD > 0.01)
        .sort((a, b) => b.totalUSD - a.totalUSD)

      setBalance({
        totalUSD,
        tokens: tokens.sort((a, b) => b.balanceUSD - a.balanceUSD),
        chainDistribution,
        tokenDistribution,
        lastUpdated: new Date().toISOString(),
      })
    } catch (err) {
      console.error("[v0] useBalance: Error fetching balances:", err)
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
