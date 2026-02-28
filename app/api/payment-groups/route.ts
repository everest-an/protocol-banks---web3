import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/middleware/api-auth"

/**
 * GET /api/payment-groups?owner=0x...
 * List payment groups for an address
 */
export const GET = withAuth(async (request: NextRequest, callerAddress: string) => {
  try {
    const groups = await prisma.paymentGroup.findMany({
      where: { owner_address: { equals: callerAddress, mode: "insensitive" } },
      orderBy: { created_at: "desc" },
      include: {
        _count: { select: { payments: true } },
      },
    })

    const mapped = groups.map((g) => ({
      ...g,
      payment_count: g._count.payments,
      created_at: g.created_at.toISOString(),
      updated_at: g.updated_at.toISOString(),
    }))

    return NextResponse.json({ groups: mapped })
  } catch (error: unknown) {
    console.error("[API] GET /api/payment-groups error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}, { component: 'payment-groups' })

/**
 * POST /api/payment-groups
 * Create a new payment group
 */
export const POST = withAuth(async (request: NextRequest, callerAddress: string) => {
  try {
    const body = await request.json()
    const { name, description, owner_address, purpose, tags } = body

    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 },
      )
    }

    // Enforce owner is the authenticated caller
    const resolvedOwner = owner_address || callerAddress
    if (resolvedOwner.toLowerCase() !== callerAddress.toLowerCase()) {
      return NextResponse.json({ error: "Forbidden: Cannot create group for another user" }, { status: 403 })
    }

    const group = await prisma.paymentGroup.create({
      data: {
        name,
        description,
        owner_address: callerAddress,
        purpose,
        tags: tags || [],
      },
    })

    return NextResponse.json({
      group: {
        ...group,
        created_at: group.created_at.toISOString(),
        updated_at: group.updated_at.toISOString(),
      },
    })
  } catch (error: unknown) {
    console.error("[API] POST /api/payment-groups error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}, { component: 'payment-groups' })
