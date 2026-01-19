import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { validateOrigin, validateCSRFToken, addSecurityHeaders } from "@/lib/security-middleware"
import { verifyAuthorizationSignature } from "@/services/signature-verifier.service"

export async function POST(request: NextRequest) {
  const origin = validateOrigin(request)
  if (!origin.valid) return NextResponse.json({ error: origin.error }, { status: 400 })
  const csrf = validateCSRFToken(request)
  if (!csrf.valid) return NextResponse.json({ error: csrf.error }, { status: 403 })

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { authorizationId, domain, message, signature } = await request.json()
  if (!authorizationId || !domain || !message || !signature) {
    return NextResponse.json({ error: "authorizationId, domain, message, signature are required" }, { status: 400 })
  }

  try {
    const result = await verifyAuthorizationSignature({ authorizationId, domain, message, signature })
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    const response = NextResponse.json({ success: true, status: "submitted" })
    return addSecurityHeaders(response)
  } catch (error) {
    console.error("[x402] submit-signature error", error)
    return NextResponse.json({ error: "Failed to submit signature" }, { status: 500 })
  }
}
