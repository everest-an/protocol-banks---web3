import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSession } from "@/lib/auth/session"
import { validateOrigin, validateCSRFToken, addSecurityHeaders } from "@/lib/security-middleware"
import { submitToRelayer } from "@/services/relayer-client.service"
import { buildDomain, AuthorizationMessage } from "@/services/eip712.service"
import { isWithinValidityWindow } from "@/services/validity-window.service"

export async function POST(request: NextRequest) {
  const origin = validateOrigin(request)
  if (!origin.valid) return NextResponse.json({ error: origin.error }, { status: 400 })
  const csrf = validateCSRFToken(request)
  if (!csrf.valid) return NextResponse.json({ error: csrf.error }, { status: 403 })

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { authorizationId } = await request.json()
  if (!authorizationId) {
    return NextResponse.json({ error: "authorizationId is required" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: auth, error } = await supabase
    .from("x402_authorizations")
    .select("id, user_id, token_address, chain_id, from_address, to_address, amount, nonce, valid_after, valid_before, signature")
    .eq("id", authorizationId)
    .single()

  if (error || !auth || auth.user_id !== session.userId) {
    return NextResponse.json({ error: "Authorization not found" }, { status: 404 })
  }

  if (!auth.signature) {
    return NextResponse.json({ error: "Signature missing" }, { status: 400 })
  }

  const validAfter = new Date(auth.valid_after)
  const validBefore = new Date(auth.valid_before)
  if (!isWithinValidityWindow(validAfter, validBefore)) {
    await supabase.from("x402_authorizations").update({ status: "expired" }).eq("id", authorizationId)
    return NextResponse.json({ error: "Authorization expired" }, { status: 400 })
  }

  const domain = buildDomain({
    name: "ProtocolBanks",
    version: "1",
    chainId: auth.chain_id,
    verifyingContract: auth.token_address,
  })

  const message: AuthorizationMessage = {
    from: auth.from_address,
    to: auth.to_address,
    value: auth.amount,
    validAfter: Math.floor(new Date(auth.valid_after).getTime() / 1000),
    validBefore: Math.floor(new Date(auth.valid_before).getTime() / 1000),
    nonce: auth.nonce ? `0x${auth.nonce.toString(16).padStart(64, "0")}` : "0x0",
    data: "0x",
  }

  try {
    const relayerResp = await submitToRelayer({ domain, message, signature: auth.signature })

    await supabase
      .from("x402_authorizations")
      .update({ status: "submitted", relayer_address: relayerResp?.relayerAddress, transaction_hash: relayerResp?.txHash })
      .eq("id", authorizationId)

    await supabase
      .from("x402_audit_logs")
      .insert({ user_id: session.userId, authorization_id: authorizationId, action: "relayer_submitted", details: relayerResp })

    const response = NextResponse.json({ success: true, status: "relayer_submitted", relayerResponse: relayerResp })
    return addSecurityHeaders(response)
  } catch (relayerError) {
    console.error("[x402] relayer submit error", relayerError)
    return NextResponse.json({ error: "Relayer submission failed" }, { status: 502 })
  }
}
