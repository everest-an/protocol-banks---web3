import { NextResponse } from "next/server"

const COINGECKO_IDS: Record<string, string> = {
  ETH: "ethereum",
  WETH: "ethereum",
  BTC: "bitcoin",
  WBTC: "bitcoin",
  MATIC: "matic-network",
  BNB: "binancecoin",
  OP: "optimism",
  ARB: "arbitrum",
  SOL: "solana",
  AVAX: "avalanche-2",
  HSK: "hashkey-global",
}

const DEFAULT_PRICES: Record<string, number> = {
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
  HSK: 1,
}

// Server-side cache
let serverCache: { prices: Record<string, number>; timestamp: number } | null = null
const SERVER_CACHE_TTL = 60_000 // 60 seconds

export async function GET() {
  if (serverCache && Date.now() - serverCache.timestamp < SERVER_CACHE_TTL) {
    return NextResponse.json(serverCache.prices)
  }

  try {
    const ids = [...new Set(Object.values(COINGECKO_IDS))].join(",")
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(5000) }
    )

    if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`)

    const data = await res.json()

    const prices: Record<string, number> = {
      USDC: 1,
      USDT: 1,
      DAI: 1,
    }

    for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
      const price = data[geckoId]?.usd
      if (price) {
        prices[symbol] = price
      } else {
        prices[symbol] = DEFAULT_PRICES[symbol] ?? 0
      }
    }

    serverCache = { prices, timestamp: Date.now() }
    return NextResponse.json(prices)
  } catch (error) {
    console.error("[Prices] CoinGecko fetch failed:", error)
    return NextResponse.json(DEFAULT_PRICES)
  }
}
