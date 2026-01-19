import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSession } from "@/lib/auth/session"
import { validateOrigin } from "@/lib/security-middleware"
import { generateBatchCsvReport } from "@/services/report-generator.service"

export async function GET(request: NextRequest, { params }: { params: { batchId: string } }) {
  const origin = validateOrigin(request)
  if (!origin.valid) return NextResponse.json({ error: origin.error }, { status: 400 })

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()
  const { data: batch, error: batchError } = await supabase
    .from("batch_payments")
    .select("id, user_id")
    .eq("id", params.batchId)
    .single()

  if (batchError || !batch || batch.user_id !== session.userId) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 })
  }

  const { data: items, error: itemsError } = await supabase
    .from("payment_items")
    .select("recipient_address, amount, token_symbol, status, transaction_hash, error_reason")
    .eq("batch_id", params.batchId)

  if (itemsError || !items) {
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 })
  }

  const csv = generateBatchCsvReport(params.batchId, items)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=Batch-${params.batchId}.csv`,
    },
  })
}
