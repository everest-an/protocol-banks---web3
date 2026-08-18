import { NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { getUserState } from "@/lib/trading/exchange"

/**
 * GET /api/trading/live/state
 *
 * LIVE mode: the authenticated user's real Hyperliquid account state.
 * Read-only info query — no keys involved.
 */
export const GET = withAuth(async (_req, address) => {
  const state = await getUserState(address)
  if (!state) {
    return NextResponse.json(
      { error: "Could not fetch Hyperliquid state for this address (account may not exist yet)" },
      { status: 404 },
    )
  }

  const accountValue = parseFloat(state.marginSummary?.accountValue ?? "0")
  const positions = (state.assetPositions ?? [])
    .filter((p) => p.position && parseFloat(p.position.szi) !== 0)
    .map((p) => {
      const pos = p.position
      const szi = parseFloat(pos.szi)
      return {
        coin: pos.coin,
        side: szi > 0 ? "long" : "short",
        size: Math.abs(szi),
        entryPx: pos.entryPx ? parseFloat(pos.entryPx) : null,
        positionValue: parseFloat(pos.positionValue),
        unrealizedPnl: parseFloat(pos.unrealizedPnl),
      }
    })

  return NextResponse.json({
    accountValue,
    totalMarginUsed: parseFloat(state.marginSummary?.totalMarginUsed ?? "0"),
    totalNtlPos: parseFloat(state.marginSummary?.totalNtlPos ?? "0"),
    positions,
  })
})
