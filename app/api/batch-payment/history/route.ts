import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSession } from "@/lib/auth/session"
import { validateOrigin, addSecurityHeaders } from "@/lib/security-middleware"

export async function GET(request: NextRequest) {
  const origin = validateOrigin(request)
  if (!origin.valid) return NextResponse.json({ error: origin.error }, { status: 400 })

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limitParam = Number.parseInt(searchParams.get("limit") || "10", 10)
  const limit = Number.isNaN(limitParam) ? 10 : Math.min(Math.max(limitParam, 1), 50)

  const supabase = await createClient()
  const { data: batches, error } = await supabase
    .from("batch_payments")
    .select("id, batch_name, status, total_amount, total_fee, item_count, successful_count, failed_count, created_at")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("[Batch] Failed to load history:", error)
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 })
  }

  const response = NextResponse.json({ success: true, batches: batches || [] })
  return addSecurityHeaders(response)
}
