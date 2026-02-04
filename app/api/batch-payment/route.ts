import { type NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { validateBatch, calculateBatchTotals, type BatchPaymentItem } from "@/backend"

/**
 * POST /api/batch-payment
 * Create a new batch payment job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recipients, token, chainId, fromAddress, memo } = body

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "Recipients array required" }, { status: 400 })
    }

    if (!fromAddress) {
      return NextResponse.json({ error: "fromAddress required" }, { status: 400 })
    }

    // Validate batch
    const items: BatchPaymentItem[] = recipients.map((r: any, idx: number) => ({
      id: `item_${idx}`,
      recipient: r.address || r.recipient,
      amount: Number.parseFloat(r.amount),
      token: r.token || token || "USDC",
      memo: r.memo || memo,
    }))

    const validation = validateBatch(items)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.errors,
        },
        { status: 400 },
      )
    }

    // Calculate totals
    const totals = calculateBatchTotals(items)

    // Create batch job in database
    const supabase = getSupabase()
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const { data: batch, error: dbError } = await supabase
      .from("batch_payments")
      .insert({
        batch_id: batchId,
        from_address: fromAddress.toLowerCase(),
        total_amount: totals.totalAmount,
        total_items: totals.itemCount,
        token: token || "USDC",
        chain_id: chainId || 8453,
        status: "pending",
        items: items,
        memo,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      console.error("[BatchPayment] DB error:", dbError)
      // Continue even if DB fails (demo mode support)
    }

    return NextResponse.json({
      success: true,
      batchId,
      totals,
      itemCount: items.length,
      status: "pending",
      message: `Batch created with ${items.length} payments totaling ${totals.totalAmount} ${token || "USDC"}`,
    })
  } catch (error: any) {
    console.error("[BatchPayment] Create error:", error)
    return NextResponse.json({ error: error.message || "Failed to create batch" }, { status: 500 })
  }
}

/**
 * GET /api/batch-payment?batchId=xxx
 * Get batch payment status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get("batchId")
    const fromAddress = searchParams.get("fromAddress")

    const supabase = getSupabase()

    if (batchId) {
      // Get specific batch
      const { data: batch, error } = await supabase
        .from("batch_payments")
        .select("*")
        .eq("batch_id", batchId)
        .single()

      if (error || !batch) {
        return NextResponse.json({ error: "Batch not found" }, { status: 404 })
      }

      return NextResponse.json({ batch })
    }

    if (fromAddress) {
      // Get all batches for address
      const { data: batches, error } = await supabase
        .from("batch_payments")
        .select("*")
        .eq("from_address", fromAddress.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) {
        console.error("[BatchPayment] Query error:", error)
        return NextResponse.json({ batches: [] })
      }

      return NextResponse.json({ batches: batches || [] })
    }

    return NextResponse.json({ error: "batchId or fromAddress required" }, { status: 400 })
  } catch (error: any) {
    console.error("[BatchPayment] Get error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
