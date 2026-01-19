import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSession } from "@/lib/auth/session"
import { parseCsv, parseExcel } from "@/services/file-parser.service"
import { validateBatch } from "@/services/batch-validator.service"
import { validateOrigin, validateCSRFToken, addSecurityHeaders } from "@/lib/security-middleware"

function decodeFile(file: string): Buffer {
  return Buffer.from(file, "base64")
}

export async function POST(request: NextRequest) {
  // Origin & CSRF
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

  const { file, fileName } = await request.json()
  if (!file || !fileName) {
    return NextResponse.json({ error: "file and fileName are required" }, { status: 400 })
  }

  const buffer = decodeFile(file)
  const isExcel = fileName.toLowerCase().endsWith(".xlsx") || fileName.toLowerCase().endsWith(".xls")

  const parseResult = isExcel ? parseExcel(buffer) : parseCsv(buffer.toString("utf-8"))
  const validation = validateBatch(parseResult.items)

  const supabase = await createClient()
  const { data: draft, error } = await supabase
    .from("batch_drafts")
    .insert({
      user_id: session.userId,
      draft_name: fileName,
      file_data: parseResult.items,
      validation_status: validation,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[Batch] Failed to store draft:", error)
    return NextResponse.json({ error: "Failed to store draft" }, { status: 500 })
  }

  const response = NextResponse.json({
    success: true,
    draftId: draft.id,
    itemCount: parseResult.items.length,
    validCount: validation.summary.valid,
    invalidCount: validation.summary.invalid,
    errors: validation.invalidItems,
  })

  return addSecurityHeaders(response)
}
