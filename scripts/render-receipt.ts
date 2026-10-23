/**
 * Render a receipt for the largest open position.
 * The venue is the source of truth for entry/mark/size/uPnL; the agent's ledger
 * only enriches it (reason, openedAt, margin) when the symbol matches.
 *
 * Run: npx tsx -r dotenv/config scripts/render-receipt.ts
 */
import fs from "node:fs"
import { prisma } from "../lib/prisma"
import { getUserState } from "../lib/trading/exchange"
import { DEFAULT_RISK } from "../lib/trading/risk"
import { renderPositionReceipt, type ReceiptPosition } from "../lib/media/receipt-card"

interface LedgerPosition {
  symbol: string
  side: "long" | "short"
  size: number
  entry: number
  mark: number
  allocated: number
  leverage: number
  reason: string
  openedAt: string
}

interface VenueLike {
  marginSummary?: { accountValue?: string }
  assetPositions?: Array<{
    position: {
      coin: string
      szi: string
      entryPx: string | null
      positionValue: string
      unrealizedPnl: string
      leverage?: { value: number }
    }
  }>
}

async function main() {
  const accounts = await prisma.tradingAccount.findMany({
    where: { status: "live" },
    select: { wallet_address: true, state_json: true },
  })
  if (!accounts.length) throw new Error("no live account")

  let best: { wallet: string; venue: VenueLike; ledger: LedgerPosition[] } | null = null
  for (const account of accounts) {
    const venue = (await getUserState(account.wallet_address).catch(() => null)) as VenueLike | null
    if (!venue?.assetPositions?.length) continue
    const ledger = ((account.state_json as { positions?: LedgerPosition[] } | null)?.positions ?? []) as LedgerPosition[]
    if (!best || venue.assetPositions.length > (best.venue.assetPositions?.length ?? 0)) {
      best = { wallet: account.wallet_address, venue, ledger }
    }
  }
  if (!best) throw new Error("no venue positions on any live account")

  const pick = [...(best.venue.assetPositions ?? [])]
    .map((p) => p.position)
    .sort((a, b) => Number(b.positionValue) - Number(a.positionValue))[0]

  const szi = Number(pick.szi)
  const side: "long" | "short" = szi > 0 ? "long" : "short"
  const size = Math.abs(szi)
  const entry = Number(pick.entryPx) || 0
  const positionValue = Number(pick.positionValue) || 0
  const mark = size > 0 && positionValue > 0 ? positionValue / size : entry
  const unrealized = Number(pick.unrealizedPnl) || 0
  const leverage = pick.leverage?.value ?? DEFAULT_RISK.leverage

  const ledger = best.ledger.find((p) => p.symbol === pick.coin)
  const allocated = ledger?.allocated ?? positionValue / Math.max(leverage, 1)
  const stopPrice = side === "long" ? entry * (1 - DEFAULT_RISK.stopLossPct) : entry * (1 + DEFAULT_RISK.stopLossPct)
  const takeProfitPrice =
    side === "long" ? entry * (1 + DEFAULT_RISK.takeProfitPct) : entry * (1 - DEFAULT_RISK.takeProfitPct)

  const position: ReceiptPosition = {
    symbol: pick.coin,
    side,
    entry,
    mark,
    size,
    allocated,
    unrealizedPnl: unrealized,
    leverage,
    stopPrice,
    takeProfitPrice,
    openedAt: ledger?.openedAt ?? new Date().toISOString(),
    reason: ledger?.reason ?? "adopted from the exchange during reconciliation",
  }

  const png = renderPositionReceipt({ position, equityUsd: Number(best.venue.marginSummary?.accountValue ?? 0) })
  const out = process.env.RECEIPT_OUT || "docs/growth/x-agent/out/receipt.png"
  fs.mkdirSync(out.slice(0, out.lastIndexOf("/")) || ".", { recursive: true })
  fs.writeFileSync(out, png)

  console.log(`wrote ${out} (${(png.length / 1024).toFixed(0)} KB)`)
  console.log(
    `${position.symbol} ${side} entry=${entry.toFixed(2)} mark=${mark.toFixed(2)} size=${size} margin=$${allocated.toFixed(2)} (${leverage}x) upnl=${unrealized.toFixed(2)} stop=${stopPrice.toFixed(2)} target=${takeProfitPrice.toFixed(2)}`,
  )
  console.log(`reason: ${position.reason}`)
}

main().catch((e) => {
  console.error("FAILED", e instanceof Error ? e.message : e)
  process.exit(1)
})
