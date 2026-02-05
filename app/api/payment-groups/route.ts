import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/payment-groups?owner=0x...
 * List payment groups for an address
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const owner = searchParams.get("owner")

    if (!owner) {
      return NextResponse.json({ error: "Missing owner address" }, { status: 400 })
    }

    const groups = await prisma.paymentGroup.findMany({
      where: { owner_address: owner },
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
}

/**
 * POST /api/payment-groups
 * Create a new payment group
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, owner_address, purpose, tags } = body

    if (!name || !owner_address) {
      return NextResponse.json(
        { error: "Missing required fields: name, owner_address" },
        { status: 400 },
      )
    }

    const group = await prisma.paymentGroup.create({
      data: {
        name,
        description,
        owner_address,
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
}
