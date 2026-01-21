import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSession } from "@/lib/auth/session"
import { validateOrigin, validateCSRFToken, addSecurityHeaders } from "@/lib/security-middleware"
import { submitToRelayer } from "@/services/relayer-client.service"
import { buildDomain, AuthorizationMessage } from "@/services/eip712.service"
import { isWithinValidityWindow } from "@/services/validity-window.service"
import { calculateRelayerFee } from "@/services/x402-fee-calculator.service"
import { logFeeDistribution } from "@/services/fee-distributor.service"
import {
  getCDPFacilitator,
  buildPaymentPayload,
  buildPaymentRequirements,
  isCDPSupported,
} from "@/services/cdp-facilitator.service"

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
    .select("id, user_id, token_address, chain_id, from_address, to_address, amount, nonce, valid_after, valid_before, signature, token_symbol")
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

  // ============================================================================
  // 优先使用 CDP Facilitator (Base 链 USDC 免费)
  // ============================================================================
  const chainId = auth.chain_id
  const token = auth.token_symbol || "USDC"
  
  if (isCDPSupported(chainId, token)) {
    const cdp = getCDPFacilitator()
    
    if (cdp) {
      try {
        const paymentPayload = buildPaymentPayload({
          signature: auth.signature,
          from: auth.from_address,
          to: auth.to_address,
          value: auth.amount,
          validAfter: Math.floor(validAfter.getTime() / 1000),
          validBefore: Math.floor(validBefore.getTime() / 1000),
          nonce: auth.nonce,
        })

        const paymentRequirements = buildPaymentRequirements({
          amount: auth.amount,
          payTo: auth.to_address,
          resource: "x402-payment",
          description: "ProtocolBanks x402 Payment",
        })

        const cdpResult = await cdp.settle({ paymentPayload, paymentRequirements })

        if (cdpResult.success) {
          // CDP 结算成功 - 0 手续费
          await supabase
            .from("x402_authorizations")
            .update({
              status: "settled",
              transaction_hash: cdpResult.transactionHash,
              settlement_method: "cdp",
              relayer_fee: "0", // CDP 免费
            })
            .eq("id", authorizationId)

          await supabase.from("x402_audit_logs").insert({
            user_id: session.userId,
            authorization_id: authorizationId,
            action: "cdp_settled",
            details: cdpResult,
          })

          const response = NextResponse.json({
            success: true,
            status: "cdp_settled",
            transactionHash: cdpResult.transactionHash,
            network: cdpResult.network,
            method: "cdp",
            fee: "0",
          })
          return addSecurityHeaders(response)
        }
        
        // CDP 失败，继续使用 Relayer
        console.warn("[x402] CDP settle failed, falling back to relayer:", cdpResult.error)
      } catch (cdpError) {
        console.warn("[x402] CDP error, falling back to relayer:", cdpError)
      }
    }
  }

  // ============================================================================
  // 回退到自建 Relayer
  // ============================================================================
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
    const bps = Number.parseInt(process.env.X402_FEE_BPS || "50", 10)
    const cap = process.env.X402_FEE_CAP
    const { fee } = calculateRelayerFee({ amount: auth.amount, bps, cap })

    const relayerResp = await submitToRelayer({ domain, message, signature: auth.signature })

    await supabase
      .from("x402_authorizations")
      .update({
        status: "submitted",
        relayer_address: relayerResp?.relayerAddress,
        transaction_hash: relayerResp?.txHash,
        relayer_fee: fee,
        settlement_method: "relayer",
      })
      .eq("id", authorizationId)

    await supabase
      .from("x402_audit_logs")
      .insert({ user_id: session.userId, authorization_id: authorizationId, action: "relayer_submitted", details: relayerResp })

    await logFeeDistribution({
      authorizationId,
      userId: session.userId,
      relayerAddress: relayerResp?.relayerAddress,
      fee,
    })

    const response = NextResponse.json({ 
      success: true, 
      status: "relayer_submitted", 
      relayerResponse: relayerResp,
      method: "relayer",
      fee,
    })
    return addSecurityHeaders(response)
  } catch (relayerError) {
    console.error("[x402] relayer submit error", relayerError)
    return NextResponse.json({ error: "Relayer submission failed" }, { status: 502 })
  }
}
