import { NextResponse } from "next/server"
import { parseUnits } from "viem"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import { evaluatePolicy } from "@/lib/agent/policy"
import { budgetService } from "@/lib/services/budget-service"
import { agentActivityService } from "@/lib/services/agent-activity-service"
import { recordEvent } from "@/lib/analytics/events"
import { verifyPaymentAuthorization } from "@/lib/agent/pay"
import { getTokenAddress } from "@/lib/erc3009"
import { submitTransferWithAuthorization } from "@/lib/services/relayer-submit"
import { createAgentPayment, getAgentPaymentByNonce, markAgentPaymentConfirmed, markAgentPaymentFailed, markAgentPaymentSubmitted } from "@/lib/agent/payment-store"
import {
  callDeepSeek,
  callOpenRouter,
  callPriceUsd,
  normalizeMaxTokens,
  normalizeMessages,
  normalizeModel,
  OpenRouterError,
} from "@/lib/agent/openrouter"

/**
 * POST /api/v1/agent/llm
 *
 * A paid model call. The key's `pay` operation and caps are checked first; an
 * agent-scoped credential also needs an active USDC budget. The provider call
 * happens after the budget reservation, and the reservation is refunded if the
 * provider rejects or times out.
 *
 * This is a platform-brokered OpenRouter gateway, not a card charge. The
 * receipt is recorded in the agent budget and in the policy's daily spend.
 */
export const dynamic = "force-dynamic"
export const maxDuration = 60

const X402_CHAIN = "base"
const X402_CHAIN_ID = 8453
const X402_TOKEN = "USDC"

function x402PayTo(): string | null {
  return process.env.AGENT_LLM_PAY_TO || process.env.ASSET_DISTRIBUTOR_ADDRESS || null
}

function b64(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64")
}

function paymentRequired(priceUsd: number) {
  const payTo = x402PayTo()
  if (!payTo) {
    return NextResponse.json({ error: "paid model calls are not configured (AGENT_LLM_PAY_TO missing)" }, { status: 503 })
  }
  const request = {
    version: "1.0",
    network: X402_CHAIN,
    paymentAddress: payTo,
    amount: priceUsd.toFixed(2),
    token: X402_TOKEN,
    chainId: X402_CHAIN_ID,
    memo: "Protocol Bank paid model call",
    expiresAt: Date.now() + 15 * 60_000,
  }
  const response = NextResponse.json({
    error: "Payment Required",
    paymentRequest: request,
    accepts: [{
      scheme: "exact",
      network: X402_CHAIN,
      maxAmountRequired: parseUnits(priceUsd.toFixed(6), 6).toString(),
      resource: "/api/v1/agent/llm",
      description: "One paid model call through Protocol Bank",
      payTo,
      asset: getTokenAddress(X402_CHAIN_ID, X402_TOKEN),
    }],
  }, { status: 402 })
  response.headers.set("X-Payment-Request", b64(request))
  return response
}

type X402Proof = {
  from?: string
  signature?: {
    v?: number | string
    r?: string
    s?: string
    nonce?: string
    validAfter?: number | string
    validBefore?: number | string
  }
}

async function settleX402(header: string, owner: string, priceUsd: number) {
  const payTo = x402PayTo()
  if (!payTo) return { ok: false as const, error: "paid model calls are not configured", status: 503 }
  let proof: X402Proof
  try {
    proof = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as X402Proof
  } catch {
    return { ok: false as const, error: "invalid X-Payment header", status: 400 }
  }
  const signature = proof.signature
  const from = proof.from || ""
  if (!from || !signature?.r || !signature.s || !signature.nonce) {
    return { ok: false as const, error: "X-Payment is missing signature fields", status: 400 }
  }
  const authorization = {
    from,
    to: payTo,
    value: parseUnits(priceUsd.toFixed(6), 6).toString(),
    validAfter: Number(signature.validAfter),
    validBefore: Number(signature.validBefore),
    nonce: signature.nonce,
  }
  const checked = await verifyPaymentAuthorization({
    owner,
    to: payTo,
    amountUsd: priceUsd,
    token: X402_TOKEN,
    chain: X402_CHAIN,
    authorization,
    signature: { v: Number(signature.v), r: signature.r, s: signature.s },
  })
  if (!checked.ok) return { ok: false as const, error: checked.error, status: 400 }

  const existing = await getAgentPaymentByNonce(authorization.nonce)
  if (existing) return { ok: false as const, error: "this x402 payment was already used", status: 409 }

  const { payment } = await createAgentPayment({
    ownerAddress: owner,
    fromAddress: authorization.from,
    toAddress: payTo,
    token: X402_TOKEN,
    chain: X402_CHAIN,
    chainId: X402_CHAIN_ID,
    amountUsd: priceUsd,
    amountUnits: authorization.value,
    nonce: authorization.nonce,
    memo: "x402:llm",
  })

  const tokenAddress = getTokenAddress(X402_CHAIN_ID, X402_TOKEN)
  if (!tokenAddress) return { ok: false as const, error: "USDC is not configured on Base", status: 503 }
  try {
    const txHash = await submitTransferWithAuthorization({
      chainId: X402_CHAIN_ID,
      tokenAddress,
      from: authorization.from,
      to: payTo,
      value: BigInt(authorization.value),
      validAfter: authorization.validAfter,
      validBefore: authorization.validBefore,
      nonce: authorization.nonce,
      v: checked.v,
      r: checked.r,
      s: checked.s,
    })
    await markAgentPaymentSubmitted(payment.id, txHash)
    await markAgentPaymentConfirmed(payment.id)
    return { ok: true as const, txHash, paymentId: payment.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : "x402 settlement failed"
    await markAgentPaymentFailed(payment.id, message).catch(() => {})
    return { ok: false as const, error: message, status: 502 }
  }
}

async function handler(request: AgentRequest) {
  const policy = request.agentPolicy!
  const spent = request.spentTodayUsd ?? 0
  const priceUsd = callPriceUsd()

  let body: {
    model?: unknown
    messages?: unknown
    max_tokens?: unknown
    temperature?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  let messages
  let model
  let maxTokens
  try {
    messages = normalizeMessages(body.messages)
    model = normalizeModel(body.model)
    maxTokens = normalizeMaxTokens(body.max_tokens)
  } catch (error) {
    if (error instanceof OpenRouterError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    throw error
  }

  const temperature = body.temperature === undefined ? 0.2 : Number(body.temperature)
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    return NextResponse.json({ error: "temperature must be between 0 and 2" }, { status: 400 })
  }

  const allowed = evaluatePolicy(policy, { op: "pay", notionalUsd: priceUsd, coin: "USDC" }, spent)
  if (!allowed.ok) {
    return NextResponse.json({ ok: false, error: allowed.reason }, { status: 403 })
  }

  const agentId = request.agentId
  const xPayment = request.headers.get("x-payment")
  let budgetId: string | undefined
  let budgetRemaining: string | undefined
  let x402Receipt: { txHash: string; paymentId: string } | undefined

  if (xPayment) {
    const settled = await settleX402(xPayment, request.ownerAddress as string, priceUsd)
    if (!settled.ok) return NextResponse.json({ ok: false, error: settled.error, code: "x402_settlement_failed" }, { status: settled.status })
    x402Receipt = { txHash: settled.txHash, paymentId: settled.paymentId }
  } else if (agentId) {
    const availability = await budgetService.checkAvailability(agentId, priceUsd.toFixed(6), "USDC")
    if (!availability.available || !availability.budget) return paymentRequired(priceUsd)
    budgetId = availability.budget.id
  }

  try {
    let result
    try {
      result = await callOpenRouter({ model, messages, maxTokens, temperature })
    } catch (providerError) {
      const canFallback =
        providerError instanceof OpenRouterError &&
        process.env.DEEPSEEK_API_KEY &&
        ["provider_error", "provider_not_configured", "provider_timeout", "empty_completion"].includes(providerError.code)
      if (!canFallback) throw providerError
      console.warn("[agent/llm] OpenRouter unavailable; using DeepSeek fallback:", providerError.message)
      result = await callDeepSeek({ messages, maxTokens, temperature })
    }

    if (budgetId) {
      const charged = await budgetService.deductBudget(budgetId, priceUsd.toFixed(6))
      budgetRemaining = charged.remaining_amount
    }

    const remainingTodayUsd = Number(Math.max(0, policy.dailyCapUsd - spent - priceUsd).toFixed(2))

    await recordEvent({
      name: "agent_op",
      wallet: request.ownerAddress as string,
      path: "/api/v1/agent/llm",
      props: {
        op: "llm",
        kind: "openrouter",
        notionalUsd: priceUsd,
        model: result.model,
        provider: result.provider,
        usage: result.usage,
        budgetId,
      },
    })

    if (agentId) {
      await agentActivityService
        .log(agentId, request.ownerAddress as string, "payment_executed", {
          kind: "paid_llm_call",
          provider: result.provider,
          model: result.model,
          amountUsd: priceUsd,
          budgetId,
          usage: result.usage,
        })
        .catch((error) => console.warn("[agent/llm] activity log failed:", error))
    }

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      model: result.model,
      content: result.content,
      usage: result.usage,
      charge: {
        amountUsd: priceUsd,
        currency: "USDC",
        kind: x402Receipt ? "x402" : budgetId ? "agent_budget" : "policy_metered",
        txHash: x402Receipt?.txHash,
        paymentId: x402Receipt?.paymentId,
        budgetId,
        budgetRemaining,
      },
      policy: {
        spentTodayUsd: Number((spent + priceUsd).toFixed(2)),
        remainingTodayUsd,
      },
    })
  } catch (error) {
    if (error instanceof OpenRouterError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status })
    }
    console.error("[agent/llm] failed:", error)
    return NextResponse.json({ ok: false, error: "model call failed" }, { status: 502 })
  }
}

export const POST = withAgentAuth(handler, "pay")
