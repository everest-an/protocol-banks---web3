import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/middleware/api-auth"

// GET: List subscriptions for authenticated wallet
export const GET = withAuth(async (request: NextRequest, walletAddress: string) => {
  try {
    const subscriptions = await prisma.mcpSubscription.findMany({
      where: { owner_address: walletAddress.toLowerCase() },
      orderBy: { created_at: "desc" },
    })

    // Map to include backward-compat fields
    const mapped = subscriptions.map((s) => ({
      ...s,
      calls_used: s.usage_count,
      calls_limit: 0,
    }))

    return NextResponse.json(mapped)
  } catch (err: any) {
    console.error("[API] mcp-subscriptions GET error:", err)
    return NextResponse.json({ error: err.message || "Failed to fetch subscriptions" }, { status: 500 })
  }
}, { component: 'mcp-subscriptions' })

// POST: Create a new subscription
export const POST = withAuth(async (request: NextRequest, walletAddress: string) => {
  try {
    const body = await request.json()

    const subscription = await prisma.mcpSubscription.create({
      data: {
        owner_address: walletAddress.toLowerCase(),
        provider_id: body.provider_id,
        provider_name: body.provider_name,
        plan: body.plan,
        status: body.status || "active",
        usage_count: body.calls_used ?? body.usage_count ?? 0,
        monthly_cost: body.monthly_cost ?? 0,
        current_period_start: body.current_period_start ? new Date(body.current_period_start) : new Date(),
        current_period_end: body.current_period_end ? new Date(body.current_period_end) : null,
      },
    })

    // Return with backward-compat fields
    return NextResponse.json({
      ...subscription,
      calls_used: subscription.usage_count,
      calls_limit: 0,
    })
  } catch (err: any) {
    console.error("[API] mcp-subscriptions POST error:", err)
    return NextResponse.json({ error: err.message || "Failed to create subscription" }, { status: 500 })
  }
}, { component: 'mcp-subscriptions' })

// PATCH: Update subscription (cancel / change plan)
export const PATCH = withAuth(async (request: NextRequest, walletAddress: string) => {
  try {
    const body = await request.json()
    const { id, status, plan, calls_limit } = body

    if (!id) {
      return NextResponse.json({ error: "Subscription id is required" }, { status: 400 })
    }

    // Build update data from provided fields
    const updateData: Record<string, any> = {}
    if (status !== undefined) updateData.status = status
    if (plan !== undefined) updateData.plan = plan
    // calls_limit is not a real Prisma field, but we accept it for compat

    const updated = await prisma.mcpSubscription.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      ...updated,
      calls_used: updated.usage_count,
      calls_limit: 0,
    })
  } catch (err: any) {
    console.error("[API] mcp-subscriptions PATCH error:", err)
    return NextResponse.json({ error: err.message || "Failed to update subscription" }, { status: 500 })
  }
}, { component: 'mcp-subscriptions' })
