/**
 * Hyperliquid public info API client (read-only, no keys required).
 *
 * Used by the paper trading agent for REAL market data:
 *   - metaAndAssetCtxs: universe metadata + per-asset context (mark price,
 *     funding rate, 24h volume, open interest)
 *   - candles: OHLCV history for signal computation
 *
 * All responses are cached in-memory to stay well within rate limits.
 * Live trading (order placement, agent wallets) will extend this client
 * with signed exchange-endpoint calls in a later milestone.
 */

const INFO_URL = "https://api.hyperliquid.xyz/info"

export interface UniverseAsset {
  name: string
  szDecimals: number
}

export interface AssetCtx {
  dayNtlVlm: string
  markPx: string
  midPx: string
  prevDayPx: string
  funding: string
  openInterest: string
  oraclePx: string
}

export interface Candle {
  t: number // unix ms
  o: number
  h: number
  l: number
  c: number
  v: number
}

interface CacheEntry<T> {
  at: number
  data: T
}

async function postInfo<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    throw new Error(`Hyperliquid info API error: ${res.status}`)
  }
  return (await res.json()) as T
}

export class HyperliquidClient {
  private cache = new Map<string, CacheEntry<unknown>>()

  private async cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key)
    if (hit && Date.now() - hit.at < ttlMs) {
      return hit.data as T
    }
    const data = await loader()
    this.cache.set(key, { at: Date.now(), data })
    return data
  }

  async metaAndAssetCtxs(): Promise<{ universe: UniverseAsset[]; ctxs: AssetCtx[] }> {
    return this.cached("meta", 30_000, async () => {
      const [metaRes, ctxRes] = await Promise.all([
        postInfo<{ universe: UniverseAsset[] }>({ type: "meta" }),
        postInfo<AssetCtx[]>({ type: "metaAndAssetCtxs" }),
      ])
      // metaAndAssetCtxs returns [universe, ctxs] as a 2-tuple
      const ctxs = (ctxRes as unknown as [UniverseAsset[], AssetCtx[]])[1] ?? (ctxRes as unknown as AssetCtx[])
      return { universe: metaRes.universe, ctxs }
    })
  }

  async candles(coin: string, interval: "1h" | "4h" | "1d", lookbackDays: number): Promise<Candle[]> {
    const key = `candles:${coin}:${interval}:${lookbackDays}`
    return this.cached(key, 300_000, async () => {
      const end = Date.now()
      const start = end - lookbackDays * 86_400_000
      const res = await postInfo<Candle[]>({
        type: "candleSnapshot",
        req: { coin, interval, startTime: start, endTime: end },
      })
      // The API returns numeric fields as strings — coerce to numbers.
      return (res ?? []).map((c) => ({
        t: Number(c.t),
        o: parseFloat(c.o as unknown as string),
        h: parseFloat(c.h as unknown as string),
        l: parseFloat(c.l as unknown as string),
        c: parseFloat(c.c as unknown as string),
        v: parseFloat(c.v as unknown as string),
      }))
    })
  }
}
