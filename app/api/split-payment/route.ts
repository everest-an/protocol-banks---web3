import { type NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import {
  splitPaymentService,
  validateSplitPayment,
  calculateSplitAmounts,
} from "@/lib/services/split-payment-service"
import type {
  SplitPaymentRequest,
  SplitRecipient,
  AllocationMethod,
} from "@/types/split-payment"

/**
 * POST /api/split-payment
 * Create and execute a split payment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      totalAmount,
      token,
      method,
      recipients,
      fromAddress,
      templateId,
      memo,
      chainId,
      options,
    } = body

    // Validate required fields
    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json(
        { error: "totalAmount must be greater than 0" },
        { status: 400 }
      )
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: "recipients array required" },
        { status: 400 }
      )
    }

    if (!fromAddress) {
      return NextResponse.json(
        { error: "fromAddress required" },
        { status: 400 }
      )
    }

    if (!method || !["percentage", "fixed"].includes(method)) {
      return NextResponse.json(
        { error: "method must be 'percentage' or 'fixed'" },
        { status: 400 }
      )
    }

    // Build split payment request
    const splitRecipients: SplitRecipient[] = recipients.map((r: any) => ({
      address: r.address,
      allocation: Number(r.allocation || r.percentage || r.amount),
      name: r.name,
      memo: r.memo,
    }))

    const splitRequest: SplitPaymentRequest = {
      totalAmount: Number(totalAmount),
      token: token || "USDC",
      method: method as AllocationMethod,
      recipients: splitRecipients,
      templateId,
      chainId: chainId || 8453,
      memo,
    }

    // Validate request
    const validation = validateSplitPayment(splitRequest)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      )
    }

    // Calculate amounts
    const calculation = calculateSplitAmounts(
      splitRequest.totalAmount,
      splitRequest.recipients,
      splitRequest.method,
      options
    )

    // Store split payment record
    const supabase = getSupabase()
    const splitId = `split_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const { error: dbError } = await supabase.from("split_payments").insert({
      split_id: splitId,
      from_address: fromAddress.toLowerCase(),
      total_amount: splitRequest.totalAmount,
      token: splitRequest.token,
      method: splitRequest.method,
      recipient_count: splitRecipients.length,
      template_id: templateId,
      status: "pending",
      recipients: calculation.recipients,
      memo,
      chain_id: chainId || 8453,
      created_at: new Date().toISOString(),
    })

    if (dbError) {
      console.error("[SplitPayment] DB insert error:", dbError)
      // Continue even if DB fails (demo mode support)
    }

    // Execute split payment
    const result = await splitPaymentService.execute(
      splitRequest,
      fromAddress,
      options,
      (current, total) => {
        console.log(`[SplitPayment] Progress: ${current}/${total}`)
      }
    )

    // Update database with result
    const { error: updateError } = await supabase
      .from("split_payments")
      .update({
        status: result.status,
        success_count: result.successCount,
        failed_count: result.failedCount,
        paid_amount: result.paidAmount,
        results: result.results,
        completed_at: result.completed_at,
      })
      .eq("split_id", splitId)

    if (updateError) {
      console.error("[SplitPayment] DB update error:", updateError)
    }

    return NextResponse.json({
      success: result.status !== "failed",
      splitId,
      ...result,
    })
  } catch (error: any) {
    console.error("[SplitPayment] Execute error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to execute split payment" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/split-payment?splitId=xxx or ?fromAddress=xxx
 * Get split payment history
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const splitId = searchParams.get("splitId")
    const fromAddress = searchParams.get("fromAddress")
    const limit = Number(searchParams.get("limit")) || 50

    const supabase = getSupabase()

    if (splitId) {
      // Get specific split payment
      const { data: split, error } = await supabase
        .from("split_payments")
        .select("*")
        .eq("split_id", splitId)
        .single()

      if (error || !split) {
        return NextResponse.json(
          { error: "Split payment not found" },
          { status: 404 }
        )
      }

      return NextResponse.json({ split })
    }

    if (fromAddress) {
      // Get all split payments for address
      const { data: splits, error } = await supabase
        .from("split_payments")
        .select("*")
        .eq("from_address", fromAddress.toLowerCase())
        .order("created_at", { ascending: false })
        .limit(limit)

      if (error) {
        console.error("[SplitPayment] Query error:", error)
        return NextResponse.json({ splits: [] })
      }

      return NextResponse.json({ splits: splits || [] })
    }

    return NextResponse.json(
      { error: "splitId or fromAddress required" },
      { status: 400 }
    )
  } catch (error: any) {
    console.error("[SplitPayment] Get error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
