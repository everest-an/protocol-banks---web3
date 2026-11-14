const CACHE_MS = 6 * 60 * 60 * 1000
const SOURCE = "https://api.frankfurter.app/latest?from=USD"

interface FxCache {
  rates: Record<string, number>
  expiresAt: number
}

let cache: FxCache | null = null

export async function getUsdRates(): Promise<Record<string, number>> {
  if (cache && cache.expiresAt > Date.now()) return cache.rates

  try {
    const response = await fetch(SOURCE, { signal: AbortSignal.timeout(6000), cache: "no-store" })
    if (!response.ok) throw new Error(`FX HTTP ${response.status}`)
    const body = (await response.json()) as { rates?: Record<string, number> }
    const rates = { USD: 1, ...(body.rates ?? {}) }
    cache = { rates, expiresAt: Date.now() + CACHE_MS }
    return rates
  } catch {
    return cache?.rates ?? { USD: 1 }
  }
}

export async function convertToUsd(
  amount: number,
  currency: string,
): Promise<{ amountUsd: number; rate: number | null; converted: boolean }> {
  const code = currency.toUpperCase()
  if (code === "USD" || !code) return { amountUsd: amount, rate: 1, converted: false }
  const rates = await getUsdRates()
  const rate = rates[code]
  if (!rate || !Number.isFinite(rate) || rate <= 0) {
    return { amountUsd: amount, rate: null, converted: false }
  }
  return { amountUsd: Number((amount / rate).toFixed(2)), rate, converted: true }
}
