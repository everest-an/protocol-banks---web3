import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { transitionState } from "@/lib/services/cross-chain-state-machine"
import { createHmac, timingSafeEqual } from "crypto"

/**
 * POST /api/webhooks/cross-chain
 *
 * Webhook endpoint for cross-chain providers (Rango, ZetaChain).
 * Receives status updates and transitions the state machine accordingly.
 *
 * Rango status mapping:
 *   running → bridging
 *   success → completed
 *   failed  → failed
 *
 * Authentication: HMAC-SHA256 signature in x-webhook-signature header
 * Required in production (CROSS_CHAIN_WEBHOOK_SECRET must be set).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("x-webhook-signature")
    const provider = request.headers.get("x-provider") || "rango"

    // Verify webhook signature (mandatory in production)
    const secret = process.env.CROSS_CHAIN_WEBHOOK_SECRET
    if (secret) {
      if (!signature) {
        return NextResponse.json({ error: "Missing x-webhook-signature header" }, { status: 401 })
      }
      const expected = createHmac("sha256", secret).update(body).digest("hex")
      // Timing-safe comparison to prevent timing attacks
      const sigBuf = Buffer.from(signature, "utf8")
      const expBuf = Buffer.from(expected, "utf8")
      if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
      }
    } else if (process.env.NODE_ENV === "production") {
      console.error("[Webhook] CROSS_CHAIN_WEBHOOK_SECRET not configured in production")
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
    }

    const payload = JSON.parse(body)

    // Determine which provider sent this
    if (provider === "rango") {
      return handleRangoWebhook(payload)
    }

    if (provider === "zetachain") {
      return handleZetaChainWebhook(payload)
    }

    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
  } catch (error: any) {
    console.error("[Webhook] Cross-chain callback error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ─── Rango Handler ──────────────────────────────────────────────────────────

async function handleRangoWebhook(payload: any) {
  const { requestId, status, sourceTxHash, destTxHash, outputAmount, error } = payload

  if (!requestId) {
    return NextResponse.json({ error: "Missing requestId" }, { status: 400 })
  }

  // Find transaction by idempotency key or source tx hash
  const prismaClient = prisma
  const tx = await prismaClient.crossChainTransaction.findFirst({
    where: {
      OR: [
        { idempotency_key: requestId },
        { source_tx_hash: sourceTxHash },
      ],
    },
  })

  if (!tx) {
    // Unknown transaction - acknowledge but don't process
    return NextResponse.json({ received: true, matched: false })
  }

  // Map Rango status to our state machine
  const stateMap: Record<string, { state: string; trigger: string }> = {
    running: { state: "bridging", trigger: "provider_callback" },
    success: { state: "completed", trigger: "provider_callback" },
    failed: { state: "failed", trigger: "error" },
  }

  const mapping = stateMap[status]
  if (!mapping) {
    return NextResponse.json({ received: true, unknown_status: status })
  }

  try {
    await transitionState(tx.id, mapping.state as any, mapping.trigger as any, {
      sourceTxHash,
      destTxHash,
      destAmount: outputAmount?.toString(),
      errorMessage: error?.message,
      errorCode: error?.code,
      subState: status,
      provider: "rango",
      raw: payload,
    })

    return NextResponse.json({ received: true, transactionId: tx.id, newState: mapping.state })
  } catch (e: any) {
    // State transition might be invalid (e.g., already completed)
    console.warn(`[Webhook] Rango state transition failed for ${tx.id}:`, e.message)
    return NextResponse.json({ received: true, warning: e.message })
  }
}

// ─── ZetaChain Handler ──────────────────────────────────────────────────────

async function handleZetaChainWebhook(payload: any) {
  const { cctxHash, status, outboundTxHash, amount, error } = payload

  if (!cctxHash) {
    return NextResponse.json({ error: "Missing cctxHash" }, { status: 400 })
  }

  const prismaClient = prisma
  const tx = await prismaClient.crossChainTransaction.findFirst({
    where: { source_tx_hash: cctxHash },
  })

  if (!tx) {
    return NextResponse.json({ received: true, matched: false })
  }

  const stateMap: Record<string, { state: string; trigger: string }> = {
    PendingOutbound: { state: "dest_pending", trigger: "provider_callback" },
    OutboundMined: { state: "completed", trigger: "blockchain_event" },
    Aborted: { state: "failed", trigger: "error" },
    Reverted: { state: "failed", trigger: "error" },
  }

  const mapping = stateMap[status]
  if (!mapping) {
    return NextResponse.json({ received: true, unknown_status: status })
  }

  try {
    await transitionState(tx.id, mapping.state as any, mapping.trigger as any, {
      destTxHash: outboundTxHash,
      destAmount: amount?.toString(),
      errorMessage: error,
      subState: status,
      provider: "zetachain",
    })

    return NextResponse.json({ received: true, transactionId: tx.id, newState: mapping.state })
  } catch (e: any) {
    console.warn(`[Webhook] ZetaChain state transition failed for ${tx.id}:`, e.message)
    return NextResponse.json({ received: true, warning: e.message })
  }
}
