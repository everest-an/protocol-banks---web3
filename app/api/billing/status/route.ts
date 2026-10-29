import { NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { PLANS } from "@/lib/billing/plans"
import { getPlanForWallet, invalidatePlanCache } from "@/lib/billing/stripe"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/billing/status — the account's plan, its caps, and how many keys are
 * in use. `?refresh=1` drops the in-memory cache (used after checkout returns).
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withAuth(
  async (request, wallet) => {
    if (new URL(request.url).searchParams.get("refresh") === "1") {
      invalidatePlanCache(wallet)
    }

    const state = await getPlanForWallet(wallet)
    const plan = PLANS[state.plan]
    const keysUsed = await prisma.apiKey.count({ where: { owner_address: wallet.toLowerCase() } })

    return NextResponse.json({
      plan: plan.id,
      name: plan.name,
      status: state.status,
      monthlyUsd: plan.monthlyUsd,
      currentPeriodEnd: state.currentPeriodEnd ?? null,
      caps: {
        maxKeys: plan.maxKeys,
        maxNotionalUsd: plan.maxNotionalUsd,
        dailyCapUsd: plan.dailyCapUsd,
      },
      feeBps: plan.feeBps,
      keysUsed,
      billingConfigured: Boolean(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY),
    })
  },
  { component: "billing-status" },
)
