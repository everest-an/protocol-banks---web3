const CACHE_MS = 5 * 60 * 1000

const IDS: Record<string, string> = {
  ETH: "ethereum",
  WETH: "ethereum",
  BTC: "bitcoin",
  WBTC: "bitcoin",
  BNB: "binancecoin",
  SOL: "solana",
  MATIC: "matic-network",
  POL: "matic-network",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  UNI: "uniswap",
  AAVE: "aave",
  ARB: "arbitrum",
  OP: "optimism",
  HYPE: "hyperliquid",
  PAXG: "pax-gold",
  KAG: "kinesis-silver",
}

const STABLES = new Set(["USDC", "USDT", "DAI", "USD", "USDP", "PYUSD"])

let cache: { prices: Record<string, number>; expiresAt: number } | null = null
let failedUntil = 0

export async function getTokenUsdPrices(symbols: string[]): Promise<Record<string, number>> {
  const requested = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))]
  const result: Record<string, number> = {}
  const missing: string[] = []

  for (const symbol of requested) {
    if (STABLES.has(symbol)) result[symbol] = 1
    else if (cache?.prices[symbol]) result[symbol] = cache.prices[symbol]
    else if (IDS[symbol]) missing.push(symbol)
  }

  if (!missing.length) return result

  const prices: Record<string, number> = {}
  if (failedUntil <= Date.now()) {
    try {
      const ids = [...new Set(missing.map((symbol) => IDS[symbol]).filter(Boolean))]
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`
      const response = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" })
      if (!response.ok) throw new Error(`price HTTP ${response.status}`)
      const body = (await response.json()) as Record<string, { usd?: number }>
      for (const symbol of missing) {
        const id = IDS[symbol]
        const price = id ? body[id]?.usd : undefined
        if (typeof price === "number" && Number.isFinite(price) && price > 0) prices[symbol] = price
      }
    } catch {
      failedUntil = Date.now() + CACHE_MS
    }
  }

  const stillMissing = missing.filter((symbol) => !prices[symbol] && IDS[symbol])
  if (stillMissing.length) {
    try {
      const keys = [...new Set(stillMissing.map((symbol) => `coingecko:${IDS[symbol]}`))]
      const response = await fetch(`https://coins.llama.fi/prices/current/${keys.join(",")}`, {
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      })
      if (response.ok) {
        const body = (await response.json()) as { coins?: Record<string, { price?: number }> }
        for (const symbol of stillMissing) {
          const price = body.coins?.[`coingecko:${IDS[symbol]}`]?.price
          if (typeof price === "number" && Number.isFinite(price) && price > 0) prices[symbol] = price
        }
      }
    } catch {
      // Keep whatever CoinGecko returned.
    }
  }

  cache = { prices: { ...(cache?.prices ?? {}), ...prices }, expiresAt: Date.now() + CACHE_MS }
  return { ...result, ...prices }
}
