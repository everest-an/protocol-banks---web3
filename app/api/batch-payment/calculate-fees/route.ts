import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSession } from "@/lib/auth/session"
import { validateBatch } from "@/services/batch-validator.service"
import { calculateFees } from "@/services/fee-calculator.service"
import { validateOrigin, validateCSRFToken, addSecurityHeaders } from "@/lib/security-middleware"

export async function POST(request: NextRequest) {
  const originCheck = validateOrigin(request)
  if (!originCheck.valid) {
    return NextResponse.json({ error: originCheck.error }, { status: 400 })
  }
  const csrf = validateCSRFToken(request)
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.error }, { status: 403 })
  }

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { draftId, paymentMethod, gasPriceGwei } = await request.json()
  if (!draftId || !paymentMethod) {
    return NextResponse.json({ error: "draftId and paymentMethod are required" }, { status: 400 })
  }

  if (!["standard", "x402"].includes(paymentMethod)) {
    return NextResponse.json({ error: "Invalid paymentMethod" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: draft, error } = await supabase
    .from("batch_drafts")
    .select("id, user_id, file_data")
    .eq("id", draftId)
    .single()

  if (error || !draft || draft.user_id !== session.userId) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 })
  }

  const validation = validateBatch(draft.file_data as any[])
  const fees = calculateFees({ items: validation.validItems, paymentMethod, gasPriceGwei })

  // Persist latest validation/fee snapshot in draft
  await supabase
    .from("batch_drafts")
    .update({ validation_status: validation })
    .eq("id", draftId)

  const response = NextResponse.json({
    success: true,
    gasEstimate: fees.gasEstimate,
    serviceFee: fees.serviceFee,
    totalFee: fees.totalFee,
    breakdown: fees.breakdown,
    validItems: validation.validItems.length,
    invalidItems: validation.invalidItems.length,
  })

  return addSecurityHeaders(response)
}
