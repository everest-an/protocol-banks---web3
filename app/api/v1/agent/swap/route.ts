import { NextResponse } from "next/server"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import { evaluatePolicy } from "@/lib/agent/policy"
import { rangoService, type RangoAsset } from "@/lib/rango"

/**
 * POST /api/v1/agent/swap — a quote for an agent's swap, price-checked against
 * the key's policy. Execution stays with the agent: the route goes back with
 * the transaction it would need to sign, because the platform never holds keys.
 * A quote is not metered (nothing is spent), so the daily cap is untouched.
 */
export const dynamic = "force-dynamic"

async function handler(request: AgentRequest) {
  const wallet = request.ownerAddress as string
  const policy = request.agentPolicy!

  let body: { from?: unknown; to?: unknown; amount?: unknown; amountUsd?: unknown; slippage?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const from = body.from as RangoAsset | undefined
  const to = body.to as RangoAsset | undefined
  const amount = typeof body.amount === "string" ? body.amount : ""
  const amountUsd = typeof body.amountUsd === "number" ? body.amountUsd : Number.NaN
  if (!from?.symbol || !to?.symbol || !amount || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    return NextResponse.json(
      { error: "from {symbol, blockchain}, to {symbol, blockchain}, amount (token units) and amountUsd are required" },
      { status: 400 },
    )
  }

  const allowed = evaluatePolicy(
    policy,
    { op: "swap", notionalUsd: amountUsd, coin: String(from.symbol) },
    request.spentTodayUsd ?? 0,
  )
  if (!allowed.ok) return NextResponse.json({ ok: false, error: allowed.reason }, { status: 403 })

  rangoService.setWallet(wallet)
  const slippage = typeof body.slippage === "number" ? Math.min(5, Math.max(0.1, body.slippage)) : 1
  const route = await rangoService.getBestRoute(from, to, amount, slippage).catch(() => null)
  if (!route) return NextResponse.json({ ok: false, error: "no route for this pair right now" }, { status: 409 })

  return NextResponse.json({
    ok: true,
    route,
    note: "quote only — sign and submit the returned transaction from the agent's own wallet",
  })
}

export const POST = withAgentAuth(handler, "swap")
