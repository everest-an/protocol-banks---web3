import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSession } from "@/lib/auth/session"
import { validateOrigin, validateCSRFToken, addSecurityHeaders } from "@/lib/security-middleware"
import { markNonceUsed } from "@/services/nonce-manager.service"

export async function POST(request: NextRequest, { params }: { params: { authorizationId: string } }) {
  const origin = validateOrigin(request)
  if (!origin.valid) return NextResponse.json({ error: origin.error }, { status: 400 })
  const csrf = validateCSRFToken(request)
  if (!csrf.valid) return NextResponse.json({ error: csrf.error }, { status: 403 })

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()
  const { data: auth, error } = await supabase
    .from("x402_authorizations")
    .select("id, user_id, token_address, chain_id, nonce, status")
    .eq("id", params.authorizationId)
    .single()

  if (error || !auth || auth.user_id !== session.userId) {
    return NextResponse.json({ error: "Authorization not found" }, { status: 404 })
  }

  if (auth.status !== "pending") {
    return NextResponse.json({ error: "Only pending authorizations can be cancelled" }, { status: 400 })
  }

  await supabase
    .from("x402_authorizations")
    .update({ status: "cancelled" })
    .eq("id", params.authorizationId)

  await markNonceUsed(auth.user_id, auth.token_address, auth.chain_id, auth.nonce)

  await supabase.from("x402_audit_logs").insert({
    user_id: session.userId,
    authorization_id: params.authorizationId,
    action: "cancelled",
  })

  const response = NextResponse.json({ success: true, status: "cancelled" })
  return addSecurityHeaders(response)
}
