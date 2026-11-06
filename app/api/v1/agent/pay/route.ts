import { NextResponse } from "next/server"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import { evaluatePolicy } from "@/lib/agent/policy"
import { buildPaymentIntent, verifyPaymentAuthorization } from "@/lib/agent/pay"
import {
  createAgentPayment,
  getAgentPaymentByNonce,
  getTransferStatus,
  markAgentPaymentConfirmed,
  markAgentPaymentFailed,
  markAgentPaymentSubmitted,
  paymentEventData,
  paymentView,
} from "@/lib/agent/payment-store"
import { getTokenAddress } from "@/lib/erc3009"
import { submitTransferWithAuthorization } from "@/lib/services/relayer-submit"
import { webhookTriggerService } from "@/lib/services/webhook-trigger-service"
import { recordEvent } from "@/lib/analytics/events"
import { CommerceError, getPaymentOrder, markOrderPaid, releaseOrderPayment, reserveOrderPayment } from "@/lib/agent/commerce"

/**
 * POST /api/v1/agent/pay
 *
 * Without a signature: validate the destination, the amount and the key's
 * policy, and return an EIP-712 intent to sign (EVM USDC) or a prepare-only
 * intent (Solana / non-3009 tokens).
 *
 * With `authorization` { from, to, value, validAfter, validBefore, nonce, v, r, s }:
 * verify the payer's signature, then submit `transferWithAuthorization` with the
 * platform relayer. The authorization moves the payer's own USDC; the platform
 * never holds funds and only pays gas.
 *
 * Both paths check the key policy (op `pay`, per-call cap, daily cap, coin
 * allowlist) before anything is signed or submitted.
 */
export const dynamic = "force-dynamic"
/** The relayer waits for the receipt before answering. */
export const maxDuration = 60

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

interface AuthorizationBody {
  from?: unknown
  to?: unknown
  value?: unknown
  validAfter?: unknown
  validBefore?: unknown
  nonce?: unknown
  v?: unknown
  r?: unknown
  s?: unknown
}

async function handler(request: AgentRequest) {
  const wallet = request.ownerAddress as string
  const policy = request.agentPolicy!
  const spent = request.spentTodayUsd ?? 0

  let body: {
    to?: unknown
    amountUsd?: unknown
    token?: unknown
    chain?: unknown
    memo?: unknown
    orderId?: unknown
    authorization?: AuthorizationBody
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const to = typeof body.to === "string" ? body.to.trim() : ""
  const amountUsd = typeof body.amountUsd === "number" ? body.amountUsd : Number.NaN
  if (!EVM_ADDRESS.test(to) && !SOLANA_ADDRESS.test(to)) {
    return NextResponse.json({ error: "to must be a 0x EVM address or a base58 Solana address" }, { status: 400 })
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return NextResponse.json({ error: "amountUsd must be a positive number" }, { status: 400 })
  }

  const token = typeof body.token === "string" && body.token.trim() ? body.token.trim().toUpperCase() : "USDC"
  const chain = typeof body.chain === "string" && body.chain.trim() ? body.chain.trim().toLowerCase() : "base"
  let memo = typeof body.memo === "string" ? body.memo.slice(0, 140) : undefined
  const orderId = typeof body.orderId === "string" && body.orderId.trim() ? body.orderId.trim() : undefined
  let order: Awaited<ReturnType<typeof getPaymentOrder>> | null = null
  if (orderId) {
    try {
      order = await getPaymentOrder(wallet, orderId)
    } catch (error) {
      if (error instanceof CommerceError) {
        return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
      }
      console.error("[agent/pay] order lookup failed:", error)
      return NextResponse.json({ error: "order lookup failed" }, { status: 500 })
    }
    if (order.seller_address !== to.toLowerCase()) {
      return NextResponse.json({ error: "order seller does not match the destination" }, { status: 400 })
    }
    if (Math.abs(order.amount_usd - amountUsd) > 0.000001 || order.token !== token || order.chain !== chain) {
      return NextResponse.json({ error: "payment does not match the order amount, token or chain" }, { status: 400 })
    }
    memo = `order:${order.id}`
  }

  const allowed = evaluatePolicy(policy, { op: "pay", notionalUsd: amountUsd, coin: token }, spent)
  if (!allowed.ok) return NextResponse.json({ ok: false, error: allowed.reason }, { status: 403 })

  const remaining = (amount: number) => Number(Math.max(0, policy.dailyCapUsd - spent - amount).toFixed(2))

  if (body.authorization) {
    if (!EVM_ADDRESS.test(to)) {
      return NextResponse.json({ error: "EIP-3009 payments require an EVM destination" }, { status: 400 })
    }

    const raw = body.authorization
    const authorization = {
      from: String(raw.from ?? ""),
      to: String(raw.to ?? ""),
      value: String(raw.value ?? ""),
      validAfter: Number(raw.validAfter),
      validBefore: Number(raw.validBefore),
      nonce: String(raw.nonce ?? ""),
    }

    const checked = await verifyPaymentAuthorization({
      owner: wallet,
      to,
      amountUsd,
      token,
      chain,
      authorization,
      signature: { v: Number(raw.v), r: String(raw.r ?? ""), s: String(raw.s ?? "") },
    })
    if (!checked.ok) {
      return NextResponse.json({ ok: false, error: `authorization invalid: ${checked.error}` }, { status: 400 })
    }

    const tokenAddress = getTokenAddress(checked.chainId, checked.token)
    if (!tokenAddress) {
      return NextResponse.json({ error: `missing token address for ${checked.token}` }, { status: 400 })
    }

    const existing = await getAgentPaymentByNonce(authorization.nonce)
    if (existing) {
      if (existing.owner_address.toLowerCase() !== wallet.toLowerCase()) {
        return NextResponse.json(
          { ok: false, error: "this authorization nonce has already been used" },
          { status: 409 },
        )
      }
      if (order && existing.status === "confirmed") {
        await markOrderPaid(order.id, existing.id).catch((error) => {
          console.warn("[agent/pay] order mark-paid failed:", error instanceof Error ? error.message : String(error))
        })
      } else if (order && existing.status === "failed") {
        await releaseOrderPayment(order.id, existing.id).catch((error) => {
          console.warn("[agent/pay] order release failed:", error instanceof Error ? error.message : String(error))
        })
      }
      return NextResponse.json({
        ok: true,
        payment: paymentView(existing),
        note: "this authorization nonce was already submitted",
        remainingTodayUsd: remaining(amountUsd),
      })
    }

    const { payment: record, created } = await createAgentPayment({
      ownerAddress: wallet,
      fromAddress: authorization.from,
      toAddress: to,
      token: checked.token,
      chain,
      chainId: checked.chainId,
      amountUsd,
      amountUnits: checked.value.toString(),
      nonce: authorization.nonce,
      memo,
      orderId: order?.id,
    })

    if (!created) {
      if (record.owner_address.toLowerCase() !== wallet.toLowerCase()) {
        return NextResponse.json(
          { ok: false, error: "this authorization nonce has already been used" },
          { status: 409 },
        )
      }
      if (order && record.status === "confirmed") {
        await markOrderPaid(order.id, record.id).catch((error) => {
          console.warn("[agent/pay] order mark-paid failed:", error instanceof Error ? error.message : String(error))
        })
      } else if (order && record.status === "failed") {
        await releaseOrderPayment(order.id, record.id).catch((error) => {
          console.warn("[agent/pay] order release failed:", error instanceof Error ? error.message : String(error))
        })
      }
      return NextResponse.json({
        ok: true,
        payment: paymentView(record),
        note: "this authorization nonce was already submitted",
        remainingTodayUsd: remaining(amountUsd),
      })
    }

    if (order) {
      const reserved = await reserveOrderPayment(order.id, record.id)
      if (!reserved) {
        const failed = await markAgentPaymentFailed(record.id, "order payment already in progress").catch(() => null)
        return NextResponse.json(
          {
            ok: false,
            error: "another payment is already in progress for this order",
            payment: failed ? paymentView(failed) : null,
          },
          { status: 409 },
        )
      }
    }

    try {
      const txHash = await submitTransferWithAuthorization({
        chainId: checked.chainId,
        tokenAddress,
        from: authorization.from,
        to,
        value: checked.value,
        validAfter: authorization.validAfter,
        validBefore: authorization.validBefore,
        nonce: authorization.nonce,
        v: checked.v,
        r: checked.r,
        s: checked.s,
      })

      const submitted = await markAgentPaymentSubmitted(record.id, txHash)
      const chainStatus = await getTransferStatus(checked.chainId, txHash)

      let final = submitted
      if (chainStatus === "confirmed") {
        final = await markAgentPaymentConfirmed(record.id)
        if (order) {
          await markOrderPaid(order.id, final.id).catch((error) => {
            console.warn("[agent/pay] order mark-paid failed:", error instanceof Error ? error.message : String(error))
          })
        }
        void webhookTriggerService.triggerPaymentCompleted(wallet, paymentEventData(final))
      } else if (chainStatus === "failed") {
        final = await markAgentPaymentFailed(record.id, "transaction reverted")
        if (order) await releaseOrderPayment(order.id, final.id).catch(() => {})
        void webhookTriggerService.triggerPaymentFailed(wallet, paymentEventData(final))
      }

      void recordEvent({
        name: "agent_op",
        wallet,
        props: {
          op: "pay",
          notionalUsd: Number(amountUsd.toFixed(2)),
          fee: 0,
          txHash,
          paymentId: final.id,
          token: checked.token,
          chain,
          mode: "onchain",
        },
      })

      return NextResponse.json({
        ok: true,
        payment: paymentView(final),
        note:
          chainStatus === "confirmed"
            ? "confirmed on-chain; the payer's own USDC moved and the relayer paid gas"
            : chainStatus === "failed"
              ? "submitted but reverted on-chain"
              : "submitted; the reconciler will confirm the receipt",
        remainingTodayUsd: remaining(amountUsd),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const failed = await markAgentPaymentFailed(record.id, message).catch(() => null)
      if (order) await releaseOrderPayment(order.id, record.id).catch(() => {})
      if (failed) {
        void webhookTriggerService.triggerPaymentFailed(wallet, paymentEventData(failed))
      }
      const failedView = failed ? paymentView(failed) : null
      if (/authorization is used|already used|invalid signature|expired/i.test(message)) {
        return NextResponse.json({ ok: false, error: message.slice(0, 300), payment: failedView }, { status: 409 })
      }
      if (/Relayer not configured/i.test(message)) {
        return NextResponse.json({ error: "payments are not configured on this deployment", payment: failedView }, { status: 503 })
      }
      console.error("[agent/pay] submit failed:", error)
      return NextResponse.json(
        { ok: false, error: "the payment was rejected by the chain", message: message.slice(0, 300), payment: failedView },
        { status: 502 },
      )
    }
  }

  const built = buildPaymentIntent({ from: wallet, to, amountUsd, token, chain })
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: 400 })
  }
  const executable = built.intent.executable

  return NextResponse.json({
    ok: true,
    intent: {
      kind: EVM_ADDRESS.test(to) ? "evm-transfer" : "solana-transfer",
      to,
      token: built.intent.token,
      chain: built.intent.chain,
      amountUsd,
      memo,
      remainingTodayUsd: remaining(amountUsd),
      chainId: built.intent.chainId,
      orderId: order?.id ?? null,
      termsHash: order?.terms_hash ?? null,
      authorization: built.intent.authorization,
      typedData: built.intent.typedData,
      executable,
    },
    note: executable
      ? "sign the typedData, then POST the authorization { ...message, v, r, s } back to this endpoint to execute"
      : "prepared only: EIP-3009 execution is available for EVM USDC; sign and submit from the agent's own wallet",
  })
}

export const POST = withAgentAuth(handler, "pay")
