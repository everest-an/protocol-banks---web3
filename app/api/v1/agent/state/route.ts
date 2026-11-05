import { NextResponse } from "next/server"
import { withAgentAuth, type AgentRequest } from "@/lib/agent/auth"
import { listRecentAgentPayments } from "@/lib/agent/payment-store"
import { resolveAgentForWallet } from "@/lib/trading/agent"

/**
 * GET /api/v1/agent/state — the account behind this API key: mode, equity, open
 * positions, activity and the effective risk config, plus what the key's policy
 * still allows today.
 */
export const dynamic = "force-dynamic"

async function handler(request: AgentRequest) {
  const policy = request.agentPolicy!
  const agent = await resolveAgentForWallet(request.ownerAddress as string)
  const payments = await listRecentAgentPayments(request.ownerAddress as string, 10)
  return NextResponse.json({
    ok: true,
    ...agent.toOverview(),
    payments,
    policy: {
      allowedOps: policy.allowedOps,
      maxNotionalUsd: policy.maxNotionalUsd,
      dailyCapUsd: policy.dailyCapUsd,
      allowedCoins: policy.allowedCoins,
      spentTodayUsd: Number((request.spentTodayUsd ?? 0).toFixed(2)),
    },
  })
}

export const GET = withAgentAuth(handler, "read")
