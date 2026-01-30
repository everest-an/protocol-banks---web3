import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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

    // Use service role key to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // Store in retry queue table
    const { data, error } = await supabase
      .from("payment_retry_queue")
      .insert({
        tx_hash: txHash,
        payment_data: paymentData,
        retry_count: 0,
        status: "pending",
        next_retry_at: new Date(Date.now() + 60000).toISOString(), // Retry in 1 minute
      })
      .select()
      .single()

    if (error) {
      console.error("[Retry Queue] Insert error:", error)
      return NextResponse.json(
        { error: "Failed to queue payment for retry", details: error.message },
        { status: 500 }
      )
    }

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
