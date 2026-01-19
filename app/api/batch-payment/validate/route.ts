import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSession } from "@/lib/auth/session"
import { validateBatch } from "@/services/batch-validator.service"
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

  const { draftId } = await request.json()
  if (!draftId) {
    return NextResponse.json({ error: "draftId is required" }, { status: 400 })
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

  await supabase
    .from("batch_drafts")
    .update({ validation_status: validation })
    .eq("id", draftId)

  const response = NextResponse.json({
    success: true,
    validItems: validation.validItems.length,
    invalidItems: validation.invalidItems.length,
    summary: validation.summary,
    errors: validation.invalidItems,
  })

  return addSecurityHeaders(response)
}
