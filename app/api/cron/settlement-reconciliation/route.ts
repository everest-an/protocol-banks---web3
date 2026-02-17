import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createSettlement } from "@/lib/services/settlement-service"

/**
 * GET /api/cron/settlement-reconciliation
 *
 * Daily cron: Creates settlement records for all active users.
 * Compares ledger balances vs on-chain (when available).
 * Schedule: Once daily at 02:00 UTC
 */
export async function GET(request: NextRequest) {
  const start = Date.now()

  // Auth check
  if (process.env.NODE_ENV === "production") {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    // Get all users with ledger balances
    const balances = await prisma.userBalance.findMany({
      select: {
        user_address: true,
        token: true,
        chain: true,
      },
      distinct: ["user_address", "token", "chain"],
    })

    const now = new Date()
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate()) // Start of today
    const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000) // Start of yesterday

    let created = 0
    let reconciled = 0
    let discrepancies = 0
    const errors: string[] = []

    for (const balance of balances) {
      try {
        const result = await createSettlement({
          userAddress: balance.user_address,
          periodStart,
          periodEnd,
          token: balance.token,
          chain: balance.chain,
          // onChainBalance not provided here - will be added when balance sync is implemented
        })

        created++
        if (result.status === "reconciled") reconciled++
        if (result.status === "discrepancy_found") discrepancies++
      } catch (e: any) {
        errors.push(`${balance.user_address}/${balance.token}/${balance.chain}: ${e.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      results: {
        total_users: balances.length,
        settlements_created: created,
        reconciled,
        discrepancies,
        errors: errors.length,
        error_details: errors.slice(0, 10), // First 10 errors
      },
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
      duration_ms: Date.now() - start,
      timestamp: now.toISOString(),
    })
  } catch (error: any) {
    console.error("[Cron] Settlement reconciliation error:", error)
    return NextResponse.json(
      { success: false, error: error.message, duration_ms: Date.now() - start },
      { status: 500 }
    )
  }
}
