/**
 * The credential layer every /api/v1/agent/* route shares: API-key auth, the
 * key's policy, and today's spend. Handlers enforce the amount once they have
 * parsed it (the guard cannot know it before the body is read).
 */
import { NextResponse } from "next/server"
import { withAPIKeyAuth, type AuthenticatedRequest } from "@/lib/middleware/api-key-auth"
import { resolveAgentPolicy, type AgentOp, type AgentPolicy } from "@/lib/agent/policy"

export interface AgentRequest extends AuthenticatedRequest {
  agentPolicy?: AgentPolicy
  spentTodayUsd?: number
}

/** Sum of today's metered notional for a wallet. A lookup failure must not
 *  block the call; it falls back to 0 and the per-call cap still applies. */
export async function spentTodayUsd(wallet: string): Promise<number> {
  try {
    const { prisma } = await import("@/lib/prisma")
    const since = new Date()
    since.setUTCHours(0, 0, 0, 0)
    const rows = await prisma.usageEvent.findMany({
      where: { name: "agent_op", wallet: wallet.toLowerCase(), created_at: { gte: since } },
      select: { props: true },
    })
    return rows.reduce((sum, row) => {
      const props = (row.props ?? {}) as { notionalUsd?: number }
      return sum + Number(props.notionalUsd ?? 0)
    }, 0)
  } catch {
    return 0
  }
}

export function withAgentAuth(
  handler: (request: AgentRequest) => Promise<NextResponse>,
  op: AgentOp,
): (request: AuthenticatedRequest, context?: unknown) => Promise<NextResponse> {
  const wrapped = withAPIKeyAuth(async (request: AuthenticatedRequest) => {
    const req = request as AgentRequest
    const wallet = req.ownerAddress
    if (!wallet) return NextResponse.json({ error: "this key has no owner address" }, { status: 403 })

    const resolved = resolveAgentPolicy(req.apiKey?.policy)
    if (!resolved.ok) {
      return NextResponse.json({ error: "this key's policy is invalid", details: resolved.errors }, { status: 409 })
    }
    if (!resolved.policy.allowedOps.includes(op)) {
      return NextResponse.json({ error: `this key may not perform "${op}"` }, { status: 403 })
    }

    req.agentPolicy = resolved.policy
    req.spentTodayUsd = await spentTodayUsd(wallet)
    return handler(req)
  }, { requiredPermissions: op === "read" ? ["read"] : ["write"] })

  return wrapped as (request: AuthenticatedRequest, context?: unknown) => Promise<NextResponse>
}
