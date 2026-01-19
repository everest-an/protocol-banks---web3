import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSession } from "@/lib/auth/session"
import { validateOrigin, addSecurityHeaders } from "@/lib/security-middleware"

export async function GET(request: NextRequest, { params }: { params: { authorizationId: string } }) {
  const origin = validateOrigin(request)
  if (!origin.valid) return NextResponse.json({ error: origin.error }, { status: 400 })

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()
  const { data: auth, error } = await supabase
    .from("x402_authorizations")
    .select("id, user_id, status, transaction_hash, relayer_address, relayer_fee, valid_before, valid_after")
    .eq("id", params.authorizationId)
    .single()

  if (error || !auth || auth.user_id !== session.userId) {
    return NextResponse.json({ error: "Authorization not found" }, { status: 404 })
  }

  const response = NextResponse.json({ success: true, ...auth })
  return addSecurityHeaders(response)
}
