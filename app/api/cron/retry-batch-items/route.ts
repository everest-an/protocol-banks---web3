import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { retryFailedItems } from "@/lib/services/batch-item-service"
import { verifyCronAuth } from "@/lib/cron-auth"

/**
 * GET /api/cron/retry-batch-items
 *
 * Every 5 minutes: Finds active batches with failed items
 * and resets them for retry (up to max_retries).
 * Schedule: Every 5 minutes
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const start = Date.now()

  try {
    // Find batches that are still in processing/pending state with failed items
    const activeBatches = await prisma.batchPayment.findMany({
      where: {
        status: { in: ["pending", "processing"] },
      },
      select: { batch_id: true },
    })

    let totalReset = 0
    let batchesProcessed = 0
    const errors: string[] = []

    for (const batch of activeBatches) {
      try {
        const result = await retryFailedItems(batch.batch_id)
        if (result.resetCount > 0) {
          totalReset += result.resetCount
          batchesProcessed++
        }
      } catch (e: any) {
        errors.push(`${batch.batch_id}: ${e.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      results: {
        active_batches_checked: activeBatches.length,
        batches_with_retries: batchesProcessed,
        items_reset_for_retry: totalReset,
        errors: errors.length,
      },
      duration_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("[Cron] Batch item retry error:", error)
    return NextResponse.json(
      { success: false, error: error.message, duration_ms: Date.now() - start },
      { status: 500 }
    )
  }
}
