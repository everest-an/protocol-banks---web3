import { NextResponse } from "next/server"
import { getLiveTrackRecord } from "@/lib/trading/track-record"

/**
 * GET /api/trading/track-record
 *
 * PUBLIC live track record — aggregated, anonymized proof of how the agent
 * is performing on real funds. This is the trust asset: anyone can see
 * real live accounts, their budgets, and realized PnL.
 *
 * Privacy rules:
 * - Never exposes wallet/agent addresses or keys.
 * - Account identity is a short stable hash.
 * - Only aggregates realized (closed-trade) PnL and trade counts.
 *
 * Aggregation lives in lib/trading/track-record.ts (shared with the
 * /live-track-record page and the MCP get_track_record tool).
 */
export const GET = async () => {
  try {
    return NextResponse.json(await getLiveTrackRecord())
  } catch (error) {
    console.error("[track-record] Failed to aggregate live accounts:", error)
    // 503 (not empty data) so the page can distinguish "no live accounts"
    // from "database unreachable" — never report fake zeros.
    return NextResponse.json(
      { error: "Track record temporarily unavailable", detail: "database unreachable" },
      { status: 503 },
    )
  }
}
