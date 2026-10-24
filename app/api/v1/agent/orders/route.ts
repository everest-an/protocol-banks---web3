import { NextResponse } from "next/server"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import { evaluatePolicy } from "@/lib/agent/policy"
import { resolveAgentForWallet } from "@/lib/trading/agent"
import { recordEvent } from "@/lib/analytics/events"

/**
 * POST /api/v1/agent/orders — a partner places an order for the account the API
 * key belongs to. Two envelopes apply: the key's policy (ops, per-call cap,
 * daily cap, coin allowlist) and the agent's own risk envelope (position cap,
 * breakers, funds). Billing is per executed order at PARTNER_FEE_BPS.
 */
export const dynamic = "force-dynamic"

const FEE_BPS = Number(process.env.PARTNER_FEE_BPS || 8)

async function handler(request: AgentRequest) {
  const wallet = request.ownerAddress as string
  const policy = request.agentPolicy!

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

  const allowed = evaluatePolicy(policy, { op: "trade", notionalUsd: sizeUsd, coin }, request.spentTodayUsd ?? 0)
  if (!allowed.ok) return NextResponse.json({ ok: false, error: allowed.reason }, { status: 403 })

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
    name: "agent_op",
    wallet,
    props: {
      op: "trade",
      coin,
      side,
      notionalUsd: Number(result.notional.toFixed(2)),
      feeBps: FEE_BPS,
      fee,
      mode: agent.isLive() ? "live" : "paper",
    },
  })

  return NextResponse.json({
    ok: true,
    fill: { coin, side, avgPx: result.avgPx, size: result.size, notional: Number(result.notional.toFixed(2)) },
    fee,
    mode: agent.isLive() ? "live" : "paper",
    remainingTodayUsd: Number(
      Math.max(0, policy.dailyCapUsd - (request.spentTodayUsd ?? 0) - result.notional).toFixed(2),
    ),
  })
}

export const POST = withAgentAuth(handler, "trade")
