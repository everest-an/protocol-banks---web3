import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedAddress } from "@/lib/api-auth"
import { syncUserBalances, getSupportedSyncTargets } from "@/lib/services/balance-sync-service"

/**
 * GET /api/ledger/sync
 * List all supported chains and tokens for balance sync.
 */
export async function GET() {
  return NextResponse.json({
    targets: getSupportedSyncTargets(),
  })
}

/**
 * POST /api/ledger/sync
 * Trigger on-chain balance sync for the authenticated user.
 * Reads real balances from all supported chains and updates UserBalance.
 *
 * Body (optional):
 * - chains: string[] — limit sync to specific chains (e.g., ["ethereum", "tron"])
 */
export async function POST(request: NextRequest) {
  try {
    const userAddress = await getAuthenticatedAddress(request)
    if (!userAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let chains: string[] | undefined
    try {
      const body = await request.json()
      if (body.chains && Array.isArray(body.chains)) {
        chains = body.chains
      }
    } catch {
      // No body or invalid JSON — sync all chains
    }

    const result = await syncUserBalances(userAddress, chains)

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    console.error("[API] POST /api/ledger/sync error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
