/**
 * Render today's agent-scan card from live data.
 *
 * Run: npx tsx -r dotenv/config scripts/render-scan-card.ts   (DOTENV_CONFIG_PATH=.env.local)
 * Prints the rows it drew so the caption can quote real numbers.
 */
import fs from "node:fs"
import { HyperliquidClient } from "../lib/trading/hyperliquid"
import { momentumZ, combineSignal } from "../lib/trading/strategies"
import { DEFAULT_RISK, passesUniverseFilters } from "../lib/trading/risk"
import { getUserState } from "../lib/trading/exchange"
import { renderScanCard, type ScanDecision, type ScanRow } from "../lib/media/scan-card"

const WALLET = process.env.SCAN_WALLET || "0xBf0D7119F553eB5f85C9806f0849f9c86a9B768C"
const UNIVERSE = Number(process.env.SCAN_UNIVERSE || 12)

async function main() {
  const client = new HyperliquidClient()
  const { universe, ctxs } = await client.metaAndAssetCtxs()
  const ranked = universe
    .map((u, i) => ({ coin: u.name, ctx: ctxs[i] }))
    .filter((x) => x.ctx)
    .map((x) => ({ coin: x.coin, ctx: x.ctx, volumeUsd: parseFloat(x.ctx.dayNtlVlm) || 0 }))
    .sort((a, b) => b.volumeUsd - a.volumeUsd)
    .slice(0, UNIVERSE)

  const state = await getUserState(WALLET).catch(() => null)
  const held = new Map(
    (state?.assetPositions ?? []).map((p) => [p.position.coin, Number(p.position.szi) > 0 ? "long" : "short"]),
  )

  const rows: ScanRow[] = []
  for (const { coin, ctx, volumeUsd } of ranked) {
    const markPx = parseFloat(ctx.markPx)
    if (!passesUniverseFilters(volumeUsd, markPx, DEFAULT_RISK)) continue
    const candles = await client.candles(coin, "1h", 5).catch(() => [])
    if (candles.length < 20) continue
    const z = momentumZ(candles.map((c) => c.c))
    const funding = parseFloat(ctx.funding) || 0
    const { score, side } = combineSignal(z, funding)
    const decision: ScanDecision = held.has(coin)
      ? "HOLD"
      : Math.abs(score) >= DEFAULT_RISK.entryThreshold
        ? "SIGNAL"
        : "WATCH"
    rows.push({ coin, side, z, funding, score, decision })
  }

  rows.sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
  const top = rows.slice(0, 5)
  const signals = rows.filter((r) => r.decision === "SIGNAL").length
  const shorts = rows.filter((r) => r.side === "short").length
  const equityUsd = Number(state?.marginSummary?.accountValue ?? 0)

  const png = renderScanCard({
    rows: top,
    equityUsd,
    openPositions: held.size,
    marketsScanned: ranked.length,
    signals,
    shortBiased: shorts,
    entryThreshold: DEFAULT_RISK.entryThreshold,
  })

  const out = process.env.SCAN_OUT || "docs/growth/x-agent/out/scan.png"
  fs.mkdirSync(out.slice(0, out.lastIndexOf("/")) || ".", { recursive: true })
  fs.writeFileSync(out, png)

  console.log(`wrote ${out} (${(png.length / 1024).toFixed(0)} KB)`)
  console.log(`scanned=${ranked.length} shorts=${shorts} signals=${signals} open=${held.size} equity=$${equityUsd.toFixed(2)}`)
  for (const r of top) {
    console.log(
      `  ${r.coin.padEnd(8)} ${r.side.padEnd(5)} z=${r.z.toFixed(2).padStart(6)} funding=${(r.funding * 100).toFixed(4)}%/h score=${r.score.toFixed(2).padStart(5)} -> ${r.decision}`,
    )
  }
}

main().catch((e) => {
  console.error("FAILED", e)
  process.exit(1)
})
