// rls:system — this route runs without a wallet-scoped RLS context
// (pre-auth / session-cookie / cron / public endpoint). Database access
// keeps full (superuser) access; identity is enforced here, not by RLS.
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * POST /api/payment/retry-queue
 * Adds failed payment records to retry queue for later processing
 */
export async function POST(req: NextRequest) {
  try {
    const { txHash, paymentData } = await req.json()

    if (!txHash || !paymentData) {
      return NextResponse.json(
        { error: "Missing required fields: txHash and paymentData" },
        { status: 400 }
      )
    }

    // Store in retry queue table
    const data = await prisma.paymentRetryQueue.create({
      data: {
        tx_hash: txHash,
        payment_data: paymentData,
        retry_count: 0,
        status: "pending",
        next_retry: new Date(Date.now() + 60000), // Retry in 1 minute
      },
    })

    console.log(`[Retry Queue] Payment ${txHash} queued for retry`)

    return NextResponse.json({
      success: true,
      message: "Payment queued for retry",
      queueId: data.id,
    })
  } catch (error: any) {
    console.error("[Retry Queue] Error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}
