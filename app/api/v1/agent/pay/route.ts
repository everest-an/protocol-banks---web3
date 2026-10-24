import { NextResponse } from "next/server"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import { evaluatePolicy } from "@/lib/agent/policy"

/**
 * POST /api/v1/agent/pay — an agent asks to pay someone. The platform does not
 * hold keys and does not move the money: it validates the destination, checks
 * the key's policy and returns a signed-ready intent that the agent submits
 * from its own wallet. Nothing here can spend on the agent's behalf.
 */
export const dynamic = "force-dynamic"

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

async function handler(request: AgentRequest) {
  const policy = request.agentPolicy!

  let body: { to?: unknown; amountUsd?: unknown; token?: unknown; chain?: unknown; memo?: unknown }
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
  const memo = typeof body.memo === "string" ? body.memo.slice(0, 140) : undefined

  const allowed = evaluatePolicy(policy, { op: "pay", notionalUsd: amountUsd, coin: token }, request.spentTodayUsd ?? 0)
  if (!allowed.ok) return NextResponse.json({ ok: false, error: allowed.reason }, { status: 403 })

  return NextResponse.json({
    ok: true,
    intent: {
      kind: EVM_ADDRESS.test(to) ? "evm-transfer" : "solana-transfer",
      to,
      token,
      chain,
      amountUsd,
      memo,
      remainingTodayUsd: Number(
        Math.max(0, policy.dailyCapUsd - (request.spentTodayUsd ?? 0) - amountUsd).toFixed(2),
      ),
    },
    note: "sign and submit from the agent's own wallet; the platform never holds funds",
  })
}

export const POST = withAgentAuth(handler, "pay")
