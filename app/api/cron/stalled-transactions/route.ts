import { NextRequest, NextResponse } from "next/server"
import { findStalledTransactions, transitionState } from "@/lib/services/cross-chain-state-machine"
import { verifyCronAuth } from "@/lib/cron-auth"

/**
 * GET /api/cron/stalled-transactions
 *
 * Every 10 minutes: Detects stalled cross-chain transactions and
 * transitions them to failed state after timeout.
 * Schedule: Every 10 minutes
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const start = Date.now()

  try {
    // Find transactions stalled for more than 30 minutes
    const stalled = await findStalledTransactions(30)

    let failed = 0
    const errors: string[] = []

    for (const tx of stalled) {
      try {
        // Check if estimated time has passed (with 2x buffer)
        const estimatedMs = (tx.estimated_time ?? 600) * 1000 * 2
        const elapsed = Date.now() - tx.updated_at.getTime()

        if (elapsed > estimatedMs) {
          await transitionState(tx.id, "failed", "timeout", {
            errorMessage: `Transaction stalled for ${Math.round(elapsed / 60000)} minutes (estimated: ${tx.estimated_time ?? 600}s)`,
            errorCode: "TIMEOUT",
          })
          failed++
        }
      } catch (e: any) {
        errors.push(`${tx.id}: ${e.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      results: {
        stalled_found: stalled.length,
        marked_failed: failed,
        still_waiting: stalled.length - failed,
        errors: errors.length,
      },
      duration_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("[Cron] Stalled transaction detection error:", error)
    return NextResponse.json(
      { success: false, error: error.message, duration_ms: Date.now() - start },
      { status: 500 }
    )
  }
}
