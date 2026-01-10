"use client"
import useSWR from "swr"

interface TokenPrices {
  [symbol: string]: number
}

// CoinGecko API IDs for tokens
const TOKEN_IDS: Record<string, string> = {
  ETH: "ethereum",
  WETH: "ethereum",
  BTC: "bitcoin",
  WBTC: "wrapped-bitcoin",
  USDC: "usd-coin",
  USDT: "tether",
  DAI: "dai",
  MATIC: "matic-network",
  BNB: "binancecoin",
  OP: "optimism",
  ARB: "arbitrum",
}

const STABLE_COINS = ["USDC", "USDT", "DAI"]

async function fetchPrices(): Promise<TokenPrices> {
  try {
    const ids = Object.values(TOKEN_IDS).join(",")
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 }, // Cache for 60 seconds
    })

    if (!response.ok) {
      throw new Error("Failed to fetch prices")
    }

    const data = await response.json()

    // Map back to token symbols
    const prices: TokenPrices = {}
    for (const [symbol, id] of Object.entries(TOKEN_IDS)) {
      if (data[id]?.usd) {
        prices[symbol] = data[id].usd
      }
    }

    // Stablecoins default to $1
    for (const stable of STABLE_COINS) {
      if (!prices[stable]) {
        prices[stable] = 1
      }
    }

    return prices
  } catch (error) {
    console.error("[v0] Failed to fetch token prices:", error)
    // Return default prices on error
    return {
      ETH: 3500,
      WETH: 3500,
      BTC: 100000,
      WBTC: 100000,
      USDC: 1,
      USDT: 1,
      DAI: 1,
      MATIC: 0.5,
      BNB: 600,
    }
  }
}

export function useTokenPrices() {
  const {
    data: prices,
    error,
    isLoading,
    mutate,
  } = useSWR<TokenPrices>("token-prices", fetchPrices, {
    refreshInterval: 60000, // Refresh every 60 seconds
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  })

  return {
    prices: prices || {},
    loading: isLoading,
    error,
    refresh: mutate,
  }
}

export function getTokenPrice(prices: TokenPrices, symbol: string): number {
  // Handle stablecoins
  if (STABLE_COINS.includes(symbol.toUpperCase())) {
    return 1
  }
  return prices[symbol.toUpperCase()] || 0
}
