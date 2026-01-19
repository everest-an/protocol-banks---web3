import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSession } from "@/lib/auth/session"
import { validateOrigin, validateCSRFToken, addSecurityHeaders } from "@/lib/security-middleware"
import { validateBatch } from "@/services/batch-validator.service"
import { calculateFees } from "@/services/fee-calculator.service"

export async function POST(request: NextRequest) {
  const origin = validateOrigin(request)
  if (!origin.valid) return NextResponse.json({ error: origin.error }, { status: 400 })
  const csrf = validateCSRFToken(request)
  if (!csrf.valid) return NextResponse.json({ error: csrf.error }, { status: 403 })

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { draftId, paymentMethod } = await request.json()
  if (!draftId || !paymentMethod) {
    return NextResponse.json({ error: "draftId and paymentMethod are required" }, { status: 400 })
  }
  if (!["standard", "x402"].includes(paymentMethod)) {
    return NextResponse.json({ error: "Invalid paymentMethod" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: draft, error: draftError } = await supabase
    .from("batch_drafts")
    .select("id, user_id, file_data")
    .eq("id", draftId)
    .single()

  if (draftError || !draft || draft.user_id !== session.userId) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 })
  }

  const validation = validateBatch(draft.file_data as any[])
  if (validation.validItems.length === 0) {
    return NextResponse.json({ error: "No valid items to submit" }, { status: 400 })
  }

  const fees = calculateFees({ items: validation.validItems, paymentMethod })

  // Compute naive totals (token-mixed: store count, fee only)
  const itemCount = validation.validItems.length

  // Create batch and items in a transaction-like sequence
  const { data: batch, error: batchInsertError } = await supabase
    .from("batch_payments")
    .insert({
      user_id: session.userId,
      batch_name: draftId,
      status: "processing",
      total_amount: itemCount, // token-mixed; using count as placeholder aggregate
      total_fee: fees.totalFee,
      payment_method: paymentMethod,
      item_count: itemCount,
    })
    .select("id")
    .single()

  if (batchInsertError || !batch) {
    console.error("[Batch] Failed to create batch:", batchInsertError)
    return NextResponse.json({ error: "Failed to create batch" }, { status: 500 })
  }

  const paymentRows = validation.validItems.map((item) => ({
    batch_id: batch.id,
    recipient_address: item.recipient_address,
    amount: item.amount,
    token_symbol: item.token_symbol,
    token_address: item.token_address,
    chain_id: item.chain_id,
    status: "pending",
  }))

  const { error: itemsError } = await supabase.from("payment_items").insert(paymentRows)
  if (itemsError) {
    console.error("[Batch] Failed to insert payment items:", itemsError)
    return NextResponse.json({ error: "Failed to store payment items" }, { status: 500 })
  }

  await supabase.from("payment_audit_logs").insert({
    batch_id: batch.id,
    user_id: session.userId,
    action: "batch_submitted",
    details: { itemCount, paymentMethod, draftId },
  })

  const response = NextResponse.json({
    success: true,
    batchId: batch.id,
    status: "processing",
    itemCount,
    fees,
    estimatedCompletion: null,
  })
  return addSecurityHeaders(response)
}
