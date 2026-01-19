import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { validateOrigin, validateCSRFToken, addSecurityHeaders } from "@/lib/security-middleware"
import { retryFailedItems } from "@/services/recovery-manager.service"

export async function POST(request: NextRequest, { params }: { params: { batchId: string } }) {
  const origin = validateOrigin(request)
  if (!origin.valid) return NextResponse.json({ error: origin.error }, { status: 400 })
  const csrf = validateCSRFToken(request)
  if (!csrf.valid) return NextResponse.json({ error: csrf.error }, { status: 403 })

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await retryFailedItems(params.batchId, session.userId)
    const response = NextResponse.json({ success: true, ...result })
    return addSecurityHeaders(response)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Retry failed" }, { status: 400 })
  }
}
