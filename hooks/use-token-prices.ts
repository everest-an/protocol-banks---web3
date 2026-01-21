"use client"
import useSWR from "swr"

interface TokenPrices {
  [symbol: string]: number
}

const STABLE_COINS = ["USDC", "USDT", "DAI"]

// Default/fallback prices - updated periodically
// These are used when API is rate limited or unavailable
const DEFAULT_PRICES: TokenPrices = {
  ETH: 3500,
  WETH: 3500,
  BTC: 100000,
  WBTC: 100000,
  USDC: 1,
  USDT: 1,
  DAI: 1,
  MATIC: 0.5,
  BNB: 600,
  OP: 2.5,
  ARB: 1.2,
  SOL: 180,
  AVAX: 35,
}

// Cache prices in memory to avoid repeated API calls
let cachedPrices: TokenPrices | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

async function fetchPrices(): Promise<TokenPrices> {
  // Return cached prices if still valid
  if (cachedPrices && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedPrices
  }

  // Use default prices - avoids rate limiting from CoinGecko
  // In production, you would use a paid API or your own price oracle
  const prices = { ...DEFAULT_PRICES }
  
  // Ensure stablecoins are always $1
  for (const stable of STABLE_COINS) {
    prices[stable] = 1
  }

  // Update cache
  cachedPrices = prices
  cacheTimestamp = Date.now()

  return prices
}

export function useTokenPrices() {
  const {
    data: prices,
    error,
    isLoading,
    mutate,
  } = useSWR<TokenPrices>("token-prices", fetchPrices, {
    refreshInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    revalidateOnFocus: false,
    dedupingInterval: 60000, // Dedupe for 1 minute
    fallbackData: DEFAULT_PRICES,
  })

  return {
    prices: prices || DEFAULT_PRICES,
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
