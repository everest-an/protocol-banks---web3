import { NextResponse } from "next/server"
import { withAPIKeyAuth, type AuthenticatedRequest } from "@/lib/middleware/api-key-auth"
import { resolveAgentForWallet } from "@/lib/trading/agent"
import { recordEvent } from "@/lib/analytics/events"

/**
 * POST /api/v1/agent/orders — a partner places an order for the account the API
 * key belongs to. The order runs through the same risk envelope the strategy
 * does: no bypass of caps, breakers, funds or position limits. Billing is per
 * executed order (PARTNER_FEE_BPS, default 8 bps of notional) and is metered as
 * a `partner_order` event.
 */
export const dynamic = "force-dynamic"

const FEE_BPS = Number(process.env.PARTNER_FEE_BPS || 8)

async function handler(request: AuthenticatedRequest) {
  const wallet = request.ownerAddress
  if (!wallet) return NextResponse.json({ error: "this key has no owner address" }, { status: 403 })

  let body: { coin?: unknown; side?: unknown; sizeUsd?: unknown; reason?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const coin = typeof body.coin === "string" ? body.coin.trim().toUpperCase() : ""
  const side = body.side === "long" || body.side === "short" ? body.side : null
  const sizeUsd = typeof body.sizeUsd === "number" ? body.sizeUsd : Number.NaN
  if (!coin || !side || !Number.isFinite(sizeUsd) || sizeUsd <= 0) {
    return NextResponse.json({ error: "coin, side (long|short) and a positive sizeUsd are required" }, { status: 400 })
  }

  const agent = await resolveAgentForWallet(wallet)
  const result = await agent.executeManualOrder({
    coin,
    side,
    sizeUsd,
    reason: typeof body.reason === "string" ? body.reason : undefined,
  })
  if (!result.ok) return NextResponse.json({ ok: false, error: result.reason }, { status: 409 })

  const fee = Number(((result.notional * FEE_BPS) / 10_000).toFixed(4))
  void recordEvent({
    name: "partner_order",
    wallet,
    props: { coin, side, notional: Number(result.notional.toFixed(2)), feeBps: FEE_BPS, fee, mode: agent.isLive() ? "live" : "paper" },
  })

  return NextResponse.json({
    ok: true,
    fill: {
      coin,
      side,
      avgPx: result.avgPx,
      size: result.size,
      notional: Number(result.notional.toFixed(2)),
    },
    fee,
    mode: agent.isLive() ? "live" : "paper",
  })
}

export const POST = withAPIKeyAuth(handler, { requiredPermissions: ["write"] })
