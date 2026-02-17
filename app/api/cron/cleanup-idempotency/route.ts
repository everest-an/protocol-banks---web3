import { NextRequest, NextResponse } from "next/server"
import { cleanExpiredKeys } from "@/lib/services/idempotency-service"
import { verifyCronAuth } from "@/lib/cron-auth"

/**
 * GET /api/cron/cleanup-idempotency
 *
 * Hourly cron: Removes expired idempotency keys (>24h old).
 * Prevents table bloat from accumulated request keys.
 * Schedule: Every hour at :15
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const start = Date.now()

  try {
    const deletedCount = await cleanExpiredKeys()

    return NextResponse.json({
      success: true,
      results: {
        expired_keys_deleted: deletedCount,
      },
      duration_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("[Cron] Idempotency cleanup error:", error)
    return NextResponse.json(
      { success: false, error: error.message, duration_ms: Date.now() - start },
      { status: 500 }
    )
  }
}
