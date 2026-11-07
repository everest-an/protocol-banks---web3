import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { commerceFailure } from "@/lib/agent/commerce-http"
import {
  getPaymentOrder,
  markOrderPaid,
  releaseOrderPayment,
  reserveOrderPayment,
} from "@/lib/agent/commerce"
import { buildPaymentIntent, verifyPaymentAuthorization } from "@/lib/agent/pay"
import { getTokenAddress } from "@/lib/erc3009"
import {
  createAgentPayment,
  getAgentPaymentByNonce,
  getTransferStatus,
  markAgentPaymentConfirmed,
  markAgentPaymentFailed,
  markAgentPaymentSubmitted,
  paymentView,
} from "@/lib/agent/payment-store"
import { submitTransferWithAuthorization } from "@/lib/services/relayer-submit"
import { webhookTriggerService } from "@/lib/services/webhook-trigger-service"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export const POST = withAuth(async (request: NextRequest, owner: string) => {
  try {
    const body = await request.json()
    if (typeof body.orderId !== "string" || !body.orderId.trim()) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 })
    }
    const order = await getPaymentOrder(owner, body.orderId.trim())
    if (!["accepted", "delivered"].includes(order.status)) {
      return NextResponse.json({ error: `order is ${order.status}` }, { status: 409 })
    }

    const built = buildPaymentIntent({
      from: owner,
      to: order.seller_address,
      amountUsd: order.amount_usd,
      token: order.token,
      chain: order.chain,
    })
    if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 })

    if (!body.authorization) {
      return NextResponse.json({
        ok: true,
        intent: {
          ...built.intent,
          orderId: order.id,
          termsHash: order.terms_hash,
        },
      })
    }

    const raw = body.authorization as Record<string, unknown>
    const authorization = {
      from: String(raw.from ?? ""),
      to: String(raw.to ?? ""),
      value: String(raw.value ?? ""),
      validAfter: Number(raw.validAfter),
      validBefore: Number(raw.validBefore),
      nonce: String(raw.nonce ?? ""),
    }
    const checked = await verifyPaymentAuthorization({
      owner,
      to: order.seller_address,
      amountUsd: order.amount_usd,
      token: order.token,
      chain: order.chain,
      authorization,
      signature: { v: Number(raw.v), r: String(raw.r ?? ""), s: String(raw.s ?? "") },
    })
    if (!checked.ok) {
      return NextResponse.json({ error: `authorization invalid: ${checked.error}` }, { status: 400 })
    }
    const tokenAddress = getTokenAddress(checked.chainId, checked.token)
    if (!tokenAddress) {
      return NextResponse.json({ error: `missing token address for ${checked.token}` }, { status: 400 })
    }

    const existing = await getAgentPaymentByNonce(authorization.nonce)
    if (existing) {
      if (existing.owner_address.toLowerCase() !== owner.toLowerCase()) {
        return NextResponse.json({ error: "this authorization nonce has already been used" }, { status: 409 })
      }
      if (existing.status === "confirmed") {
        await markOrderPaid(order.id, existing.id).catch(() => {})
      }
      return NextResponse.json({ ok: true, payment: paymentView(existing), note: "already submitted" })
    }

    const { payment: record, created } = await createAgentPayment({
      ownerAddress: owner,
      fromAddress: authorization.from,
      toAddress: order.seller_address,
      token: checked.token,
      chain: order.chain,
      chainId: checked.chainId,
      amountUsd: order.amount_usd,
      amountUnits: checked.value.toString(),
      nonce: authorization.nonce,
      memo: `order:${order.id}`,
      orderId: order.id,
    })
    if (!created) {
      if (record.owner_address.toLowerCase() !== owner.toLowerCase()) {
        return NextResponse.json({ error: "this authorization nonce has already been used" }, { status: 409 })
      }
      return NextResponse.json({ ok: true, payment: paymentView(record), note: "already submitted" })
    }

    if (!(await reserveOrderPayment(order.id, record.id))) {
      const failed = await markAgentPaymentFailed(record.id, "order payment already in progress").catch(() => null)
      return NextResponse.json(
        {
          error: "another payment is already in progress for this order",
          payment: failed ? paymentView(failed) : null,
        },
        { status: 409 },
      )
    }

    try {
      const txHash = await submitTransferWithAuthorization({
        chainId: checked.chainId,
        tokenAddress,
        from: authorization.from,
        to: order.seller_address,
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
        await markOrderPaid(order.id, final.id).catch(() => {})
        void webhookTriggerService.triggerPaymentCompleted(owner, {
          payment_id: final.id,
          from_address: final.from_address,
          to_address: final.to_address,
          amount: final.amount_usd.toString(),
          token_symbol: final.token,
          chain_id: final.chain_id,
          tx_hash: final.tx_hash ?? undefined,
          status: final.status,
          created_at: final.created_at.toISOString(),
        })
      } else if (chainStatus === "failed") {
        final = await markAgentPaymentFailed(record.id, "transaction reverted")
        await releaseOrderPayment(order.id, final.id).catch(() => {})
      }
      return NextResponse.json({
        ok: true,
        payment: paymentView(final),
        note:
          chainStatus === "confirmed"
            ? "confirmed on-chain; the order is paid"
            : chainStatus === "failed"
              ? "submitted but reverted on-chain"
              : "submitted; the reconciler will confirm the receipt",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const failed = await markAgentPaymentFailed(record.id, message).catch(() => null)
      await releaseOrderPayment(order.id, record.id).catch(() => {})
      return NextResponse.json(
        {
          ok: false,
          error: "the payment was rejected by the chain",
          message: message.slice(0, 300),
          payment: failed ? paymentView(failed) : null,
        },
        { status: 502 },
      )
    }
  } catch (error) {
    return commerceFailure(error, "commerce/orders/pay")
  }
}, { component: "commerce-orders-pay" })
