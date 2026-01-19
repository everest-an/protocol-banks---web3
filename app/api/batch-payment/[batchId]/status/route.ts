import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSession } from "@/lib/auth/session"
import { validateOrigin, addSecurityHeaders } from "@/lib/security-middleware"

export async function GET(request: NextRequest, { params }: { params: { batchId: string } }) {
  const origin = validateOrigin(request)
  if (!origin.valid) return NextResponse.json({ error: origin.error }, { status: 400 })

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()
  const { data: batch, error } = await supabase
    .from("batch_payments")
    .select("id, user_id, status, total_fee, item_count, successful_count, failed_count, created_at")
    .eq("id", params.batchId)
    .single()

  if (error || !batch || batch.user_id !== session.userId) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 })
  }

  const { data: items } = await supabase
    .from("payment_items")
    .select("id, recipient_address, amount, token_symbol, status, transaction_hash, error_reason")
    .eq("batch_id", params.batchId)

  const response = NextResponse.json({
    success: true,
    batch: {
      id: batch.id,
      status: batch.status,
      totalFee: batch.total_fee,
      itemCount: batch.item_count,
      successCount: batch.successful_count,
      failedCount: batch.failed_count,
      createdAt: batch.created_at,
    },
    items,
  })

  return addSecurityHeaders(response)
}
