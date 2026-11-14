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
}

const STABLES = new Set(["USDC", "USDT", "DAI", "USD", "USDP", "PYUSD"])

let cache: { prices: Record<string, number>; expiresAt: number } | null = null

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
  if (cache && cache.expiresAt > Date.now()) {
    for (const symbol of missing) if (cache.prices[symbol]) result[symbol] = cache.prices[symbol]
    return result
  }

  try {
    const ids = [...new Set(missing.map((symbol) => IDS[symbol]).filter(Boolean))]
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`
    const response = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" })
    if (!response.ok) throw new Error(`price HTTP ${response.status}`)
    const body = (await response.json()) as Record<string, { usd?: number }>
    const prices: Record<string, number> = {}
    for (const symbol of missing) {
      const id = IDS[symbol]
      const price = id ? body[id]?.usd : undefined
      if (typeof price === "number" && Number.isFinite(price) && price > 0) prices[symbol] = price
    }
    cache = { prices: { ...(cache?.prices ?? {}), ...prices }, expiresAt: Date.now() + CACHE_MS }
    return { ...result, ...prices }
  } catch {
    return result
  }
}
