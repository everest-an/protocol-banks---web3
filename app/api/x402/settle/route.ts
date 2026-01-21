/**
 * x402 Settlement API
 * 
 * 使用 CDP Facilitator 结算支付
 * - 优先使用 CDP (Base 链 USDC 免费)
 * - 回退到自建 Relayer
 */

import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { validateOrigin, validateCSRFToken, addSecurityHeaders } from "@/lib/security-middleware"
import { createClient } from "@/lib/supabase/server"
import {
  getCDPFacilitator,
  buildPaymentPayload,
  buildPaymentRequirements,
  isCDPSupported,
} from "@/services/cdp-facilitator.service"
import { submitToRelayer } from "@/services/relayer-client.service"
import { buildDomain, type AuthorizationMessage } from "@/services/eip712.service"
import { isWithinValidityWindow } from "@/services/validity-window.service"

// ============================================================================
// Types
// ============================================================================

interface SettleRequestBody {
  authorizationId: string;
  // 可选：直接传入参数（用于 SDK 调用）
  signature?: string;
  from?: string;
  to?: string;
  value?: string;
  validAfter?: number;
  validBefore?: number;
  nonce?: string;
  chainId?: number;
  token?: string;
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  // 安全验证
  const origin = validateOrigin(request)
  if (!origin.valid) {
    return NextResponse.json({ error: origin.error }, { status: 400 })
  }
  
  const csrf = validateCSRFToken(request)
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.error }, { status: 403 })
  }

  // 获取请求体
  const body: SettleRequestBody = await request.json()
  
  // 如果有 authorizationId，从数据库获取授权信息
  if (body.authorizationId) {
    return handleDatabaseSettle(body.authorizationId)
  }
  
  // 否则使用直接传入的参数
  if (body.signature && body.from && body.to && body.value) {
    return handleDirectSettle(body)
  }

  return NextResponse.json(
    { error: "Either authorizationId or complete payment params required" },
    { status: 400 }
  )
}


// ============================================================================
// Handler Functions
// ============================================================================

/**
 * 从数据库获取授权并结算
 */
async function handleDatabaseSettle(authorizationId: string) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()
  
  // 获取授权记录
  const { data: auth, error } = await supabase
    .from("x402_authorizations")
    .select("*")
    .eq("id", authorizationId)
    .single()

  if (error || !auth) {
    return NextResponse.json({ error: "Authorization not found" }, { status: 404 })
  }

  // 验证用户权限
  if (auth.user_id !== session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  // 检查签名
  if (!auth.signature) {
    return NextResponse.json({ error: "Signature missing" }, { status: 400 })
  }

  // 检查有效期
  const validAfter = new Date(auth.valid_after)
  const validBefore = new Date(auth.valid_before)
  if (!isWithinValidityWindow(validAfter, validBefore)) {
    await supabase
      .from("x402_authorizations")
      .update({ status: "expired" })
      .eq("id", authorizationId)
    return NextResponse.json({ error: "Authorization expired" }, { status: 400 })
  }

  // 尝试 CDP 结算
  const chainId = auth.chain_id
  const token = auth.token_symbol || "USDC"
  
  if (isCDPSupported(chainId, token)) {
    const result = await settleByCDP({
      signature: auth.signature,
      from: auth.from_address,
      to: auth.to_address,
      value: auth.amount,
      validAfter: Math.floor(validAfter.getTime() / 1000),
      validBefore: Math.floor(validBefore.getTime() / 1000),
      nonce: auth.nonce,
      chainId,
    })

    if (result.success) {
      // 更新数据库
      await supabase
        .from("x402_authorizations")
        .update({
          status: "settled",
          transaction_hash: result.transactionHash,
          settlement_method: "cdp",
        })
        .eq("id", authorizationId)

      // 记录审计日志
      await supabase.from("x402_audit_logs").insert({
        user_id: session.userId,
        authorization_id: authorizationId,
        action: "cdp_settled",
        details: result,
      })

      const response = NextResponse.json({
        success: true,
        transactionHash: result.transactionHash,
        network: result.network,
        method: "cdp",
      })
      return addSecurityHeaders(response)
    }
    
    // CDP 失败，记录错误并回退到 Relayer
    console.warn("[x402] CDP settle failed, falling back to relayer:", result.error)
  }

  // 回退到自建 Relayer
  return settleByRelayer(auth, authorizationId, session.userId, supabase)
}

/**
 * 直接使用参数结算（SDK 调用）
 */
async function handleDirectSettle(params: SettleRequestBody) {
  const chainId = params.chainId || 8453 // 默认 Base
  const token = params.token || "USDC"

  // 尝试 CDP 结算
  if (isCDPSupported(chainId, token)) {
    const result = await settleByCDP({
      signature: params.signature!,
      from: params.from!,
      to: params.to!,
      value: params.value!,
      validAfter: params.validAfter!,
      validBefore: params.validBefore!,
      nonce: params.nonce!,
      chainId,
    })

    if (result.success) {
      const response = NextResponse.json({
        success: true,
        transactionHash: result.transactionHash,
        network: result.network,
        method: "cdp",
      })
      return addSecurityHeaders(response)
    }

    // CDP 失败
    return NextResponse.json({
      success: false,
      error: result.error || "CDP settlement failed",
      method: "cdp",
    }, { status: 502 })
  }

  // 不支持 CDP，返回错误（或可以扩展支持其他方式）
  return NextResponse.json({
    success: false,
    error: `CDP not supported for chain ${chainId} and token ${token}. Use Base chain with USDC.`,
  }, { status: 400 })
}


// ============================================================================
// Settlement Methods
// ============================================================================

/**
 * 使用 CDP Facilitator 结算
 */
async function settleByCDP(params: {
  signature: string;
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
  chainId: number;
}) {
  const cdp = getCDPFacilitator()
  
  if (!cdp) {
    return {
      success: false,
      error: "CDP Facilitator not configured",
    }
  }

  const paymentPayload = buildPaymentPayload({
    signature: params.signature,
    from: params.from,
    to: params.to,
    value: params.value,
    validAfter: params.validAfter,
    validBefore: params.validBefore,
    nonce: params.nonce,
  })

  const paymentRequirements = buildPaymentRequirements({
    amount: params.value,
    payTo: params.to,
    resource: "x402-payment",
    description: "ProtocolBanks x402 Payment",
  })

  const result = await cdp.settle({
    paymentPayload,
    paymentRequirements,
  })

  return result
}

/**
 * 使用自建 Relayer 结算（回退方案）
 */
async function settleByRelayer(
  auth: any,
  authorizationId: string,
  userId: string,
  supabase: any
) {
  try {
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

    const relayerResp = await submitToRelayer({
      domain,
      message,
      signature: auth.signature,
    })

    // 更新数据库
    await supabase
      .from("x402_authorizations")
      .update({
        status: "submitted",
        relayer_address: relayerResp?.relayerAddress,
        transaction_hash: relayerResp?.txHash,
        settlement_method: "relayer",
      })
      .eq("id", authorizationId)

    // 记录审计日志
    await supabase.from("x402_audit_logs").insert({
      user_id: userId,
      authorization_id: authorizationId,
      action: "relayer_submitted",
      details: relayerResp,
    })

    const response = NextResponse.json({
      success: true,
      transactionHash: relayerResp?.txHash,
      method: "relayer",
      relayerResponse: relayerResp,
    })
    return addSecurityHeaders(response)
  } catch (error) {
    console.error("[x402] Relayer settle error:", error)
    return NextResponse.json({
      success: false,
      error: "Settlement failed",
      method: "relayer",
    }, { status: 502 })
  }
}

// ============================================================================
// GET Handler - Check settlement status
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const txHash = searchParams.get("txHash")

  if (!txHash) {
    return NextResponse.json({ error: "txHash required" }, { status: 400 })
  }

  const cdp = getCDPFacilitator()
  if (!cdp) {
    return NextResponse.json({ error: "CDP not configured" }, { status: 503 })
  }

  const status = await cdp.getStatus(txHash)
  return NextResponse.json(status)
}
