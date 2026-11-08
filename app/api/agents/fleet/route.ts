import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function policyOf(rules: unknown): Record<string, unknown> | null {
  const value = rules as { policy?: unknown } | null
  return value?.policy && typeof value.policy === "object" ? value.policy as Record<string, unknown> : null
}

function num(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const GET = withAuth(async (_request, owner) => {
  try {
    const wallet = owner.toLowerCase()
    const agents = await prisma.agent.findMany({
      where: { owner_address: wallet },
      orderBy: { created_at: "desc" },
    })
    const budgets = await prisma.agentBudget.findMany({
      where: { owner_address: wallet },
      orderBy: { created_at: "desc" },
    })
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const events = await prisma.usageEvent.findMany({
      where: { wallet, name: "agent_op", created_at: { gte: today } },
      select: { props: true },
    })
    const spentTodayUsd = events.reduce((sum, event) => {
      const props = (event.props ?? {}) as { notionalUsd?: number }
      return sum + num(props.notionalUsd)
    }, 0)

    const rows = agents.map((agent) => {
      const agentBudgets = budgets.filter((budget) => budget.agent_id === agent.id)
      const allocatedUsd = agentBudgets.reduce((sum, budget) => sum + num(budget.amount), 0)
      const remainingUsd = agentBudgets.reduce((sum, budget) => sum + num(budget.remaining_amount), 0)
      const usedUsd = agentBudgets.reduce((sum, budget) => sum + num(budget.used_amount), 0)
      const policy = policyOf(agent.auto_execute_rules)
      const utilization = allocatedUsd > 0 ? usedUsd / allocatedUsd : 0
      const alerts: string[] = []

      if (agent.status !== "active") alerts.push(agent.status)
      if (agentBudgets.length === 0) alerts.push("no budget")
      if (allocatedUsd > 0 && utilization >= 0.8) alerts.push("budget over 80%")
      if (remainingUsd <= 0 && allocatedUsd > 0) alerts.push("budget exhausted")
      if (!policy) alerts.push("no policy")

      return {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        type: agent.type,
        status: agent.status,
        lastActiveAt: agent.last_active_at?.toISOString() ?? null,
        createdAt: agent.created_at.toISOString(),
        policy,
        budgets: agentBudgets.map((budget) => ({
          id: budget.id,
          amount: budget.amount,
          remaining: budget.remaining_amount,
          used: budget.used_amount,
          token: budget.token,
          period: budget.period,
          periodEnd: budget.period_end?.toISOString() ?? null,
        })),
        allocatedUsd: Number(allocatedUsd.toFixed(2)),
        remainingUsd: Number(remainingUsd.toFixed(2)),
        usedUsd: Number(usedUsd.toFixed(2)),
        utilizationPct: Number((utilization * 100).toFixed(1)),
        alerts,
      }
    })

    const active = rows.filter((row) => row.status === "active").length
    const paused = rows.filter((row) => row.status === "paused").length
    return NextResponse.json({
      ok: true,
      totals: {
        agents: rows.length,
        active,
        paused,
        alerts: rows.filter((row) => row.alerts.length > 0).length,
        allocatedUsd: Number(rows.reduce((sum, row) => sum + row.allocatedUsd, 0).toFixed(2)),
        remainingUsd: Number(rows.reduce((sum, row) => sum + row.remainingUsd, 0).toFixed(2)),
        usedUsd: Number(rows.reduce((sum, row) => sum + row.usedUsd, 0).toFixed(2)),
        spentTodayUsd: Number(spentTodayUsd.toFixed(2)),
      },
      agents: rows,
    })
  } catch (error) {
    console.error("[agent-fleet] GET failed:", error)
    return NextResponse.json({ error: "Could not load the agent fleet" }, { status: 500 })
  }
}, { component: "agent-fleet" })

export const PATCH = withAuth(async (request: NextRequest, owner) => {
  try {
    const body = await request.json()
    const agentIds = Array.isArray(body.agentIds) ? body.agentIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 100) : []
    const status = body.status === "active" || body.status === "paused" ? body.status : undefined
    const policy = body.policy && typeof body.policy === "object" ? body.policy as Record<string, unknown> : undefined

    if (!agentIds.length || (!status && !policy)) {
      return NextResponse.json({ error: "agentIds and status or policy are required" }, { status: 400 })
    }

    const wallet = owner.toLowerCase()
    const agents = await prisma.agent.findMany({ where: { id: { in: agentIds }, owner_address: wallet } })
    if (agents.length !== agentIds.length) {
      return NextResponse.json({ error: "One or more agents do not belong to this account" }, { status: 403 })
    }

    const maxNotionalUsd = policy?.maxNotionalUsd === undefined ? undefined : Number(policy.maxNotionalUsd)
    const dailyCapUsd = policy?.dailyCapUsd === undefined ? undefined : Number(policy.dailyCapUsd)
    if ((maxNotionalUsd !== undefined && (!Number.isFinite(maxNotionalUsd) || maxNotionalUsd < 1 || maxNotionalUsd > 10000)) ||
        (dailyCapUsd !== undefined && (!Number.isFinite(dailyCapUsd) || dailyCapUsd < 1 || dailyCapUsd > 100000))) {
      return NextResponse.json({ error: "Policy caps are out of range" }, { status: 400 })
    }

    let updated = 0
    for (const agent of agents) {
      const data: Record<string, unknown> = {}
      if (status) data.status = status
      if (policy) {
        const rules = (agent.auto_execute_rules ?? {}) as Record<string, unknown>
        const existing = policyOf(agent.auto_execute_rules) ?? {}
        data.auto_execute_rules = {
          ...rules,
          policy: {
            ...existing,
            ...(maxNotionalUsd !== undefined ? { maxNotionalUsd } : {}),
            ...(dailyCapUsd !== undefined ? { dailyCapUsd } : {}),
          },
        }
      }
      await prisma.agent.update({ where: { id: agent.id }, data })
      updated++
    }

    return NextResponse.json({ ok: true, updated })
  } catch (error) {
    console.error("[agent-fleet] PATCH failed:", error)
    return NextResponse.json({ error: "Could not update the agent fleet" }, { status: 500 })
  }
}, { component: "agent-fleet" })
