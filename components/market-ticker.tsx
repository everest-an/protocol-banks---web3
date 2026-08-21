"use client"

import { useEffect, useState } from "react"

/**
 * Live market ticker — real Hyperliquid perpetual data, refreshed every 30s.
 *
 * Shows the top markets by 24h volume with price, 24h change, and funding.
 * Degrades gracefully: offline/API failure keeps the last known snapshot;
 * before the first load a static coin list is shown so the strip never
 * looks broken.
 */

interface TickerItem {
  coin: string
  price: number
  changePct: number
  funding: number
}

const FALLBACK_COINS = ["BTC", "ETH", "SOL", "ARB", "OP", "LINK", "DOGE", "AVAX", "BNB", "XRP", "SUI", "APT"]

/** Network logo assets where available (public/networks/*.png). */
const COIN_LOGO: Record<string, string> = {
  ETH: "/networks/eth.png",
  SOL: "/networks/solana.png",
  ARB: "/networks/arb.png",
  OP: "/networks/optimism.png",
  AVAX: "/networks/avax.png",
  BNB: "/networks/bnb.png",
}

/** Brand colors for coins without a logo asset (fallback: colored initial). */
const COIN_COLOR: Record<string, string> = {
  BTC: "#F7931A",
  LINK: "#2A5ADA",
  DOGE: "#C2A633",
  XRP: "#23292F",
  SUI: "#4DA2FF",
  APT: "#0EA5E9",
}

function CoinIcon({ coin }: { coin: string }) {
  const logo = COIN_LOGO[coin]
  if (logo) {
    return <img src={logo} alt={coin} width={24} height={24} className="rounded-full shrink-0" loading="lazy" />
  }
  const color = COIN_COLOR[coin] ?? "#64748b"
  return (
    <span
      className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white shrink-0"
      style={{ backgroundColor: color }}
    >
      {coin[0]}
    </span>
  )
}

async function fetchTopMarkets(limit = 12): Promise<TickerItem[]> {
  const res = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Hyperliquid ${res.status}`)
  const data = (await res.json()) as [
    { universe: { name: string }[] },
    { markPx: string; prevDayPx: string; funding: string; dayNtlVlm: string }[],
  ]
  const universe = data[0]?.universe ?? []
  const ctxs = data[1] ?? []

  const items: TickerItem[] = []
  for (let i = 0; i < Math.min(universe.length, ctxs.length); i++) {
    const ctx = ctxs[i]
    if (!ctx) continue
    const mark = parseFloat(ctx.markPx)
    const prev = parseFloat(ctx.prevDayPx)
    const funding = parseFloat(ctx.funding) || 0
    const volume = parseFloat(ctx.dayNtlVlm) || 0
    if (!Number.isFinite(mark) || mark <= 0 || volume < 1_000_000) continue
    items.push({
      coin: universe[i].name,
      price: mark,
      changePct: Number.isFinite(prev) && prev > 0 ? ((mark - prev) / prev) * 100 : 0,
      funding,
    })
    if (items.length >= limit) break
  }
  return items
}

function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (p >= 1) return p.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return p.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

export function MarketTicker() {
  const [items, setItems] = useState<TickerItem[]>([])
  const [live, setLive] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await fetchTopMarkets()
        if (!cancelled && data.length > 0) {
          setItems(data)
          setLive(true)
        }
      } catch {
        // keep last snapshot / fallback — never break the page
      }
    }
    load()
    const timer = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const display = items.length > 0 ? items : FALLBACK_COINS.map((coin) => ({ coin, price: 0, changePct: 0, funding: 0 }))
  const loop = [...display, ...display] // duplicate for seamless marquee

  return (
    <div className="flex items-center gap-3">
      <style>{`
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation: tickerScroll 60s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>
      {live && (
        <span className="hidden sm:flex items-center gap-1.5 shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[11px] font-medium text-emerald-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      )}
      <div
        className="flex overflow-hidden relative"
        style={{
          maskImage: "linear-gradient(to right, transparent, black 3%, black 97%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 3%, black 97%, transparent)",
        }}
      >
        <div className="flex animate-ticker gap-8 items-center py-2">
          {loop.map((item, i) => (
            <div key={`${item.coin}-${i}`} className="flex items-center gap-2 shrink-0 text-sm">
              <CoinIcon coin={item.coin} />
              <span className="font-semibold text-foreground">{item.coin}</span>
              {item.price > 0 ? (
                <>
                  <span className="font-mono tabular-nums text-muted-foreground">${formatPrice(item.price)}</span>
                  <span
                    className={`font-mono tabular-nums text-xs ${
                      item.changePct >= 0 ? "text-emerald-500" : "text-red-500"
                    }`}
                  >
                    {item.changePct >= 0 ? "+" : ""}
                    {item.changePct.toFixed(2)}%
                  </span>
                  <span
                    className={`font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded ${
                      item.funding < 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500/90"
                    }`}
                  >
                    {item.funding >= 0 ? "+" : ""}
                    {(item.funding * 100).toFixed(3)}%/h
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">PERP</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
