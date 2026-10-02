import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/middleware/api-auth"

/**
 * GET /api/payment-groups/[id]
 * Get a single payment group with its payments.
 *
 * Both handlers were public and looked the group up by id alone, so anyone who
 * knew (or guessed) an id could read another user's group *and every payment in
 * it* — amounts, addresses and tx hashes — and PATCH it. Scoped to the
 * authenticated owner, case-insensitively (addresses are stored checksummed).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (_req, ownerAddress) => {
    try {
      const { id } = await params

      const group = await prisma.paymentGroup.findFirst({
        where: { id, owner_address: { equals: ownerAddress, mode: "insensitive" } },
        include: {
          payments: {
            orderBy: { created_at: "desc" },
          },
        },
      })

      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 })
      }

      return NextResponse.json({
        group: {
          ...group,
          payment_count: group.payments.length,
          created_at: group.created_at.toISOString(),
          updated_at: group.updated_at.toISOString(),
          payments: group.payments.map((p) => ({
            ...p,
            timestamp: p.created_at.toISOString(),
            created_at: p.created_at.toISOString(),
            completed_at: p.completed_at?.toISOString() ?? undefined,
          })),
        },
      })
    } catch (error: unknown) {
      console.error("[API] GET /api/payment-groups/[id] error:", error)
      const message = error instanceof Error ? error.message : "Internal Server Error"
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }, { component: "payment-groups-id" })(request)
}

/**
 * PATCH /api/payment-groups/[id]
 * Update a payment group (owner only).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async (_req, ownerAddress) => {
    try {
      const { id } = await params
      const body = await request.json()
      const { name, description, purpose, status, tags } = body

      const data: Record<string, unknown> = {}
      if (name !== undefined) data.name = name
      if (description !== undefined) data.description = description
      if (purpose !== undefined) data.purpose = purpose
      if (status !== undefined) data.status = status
      if (tags !== undefined) data.tags = tags

      // Verify ownership before mutating; update() by id alone would let any
      // caller edit any group.
      const owned = await prisma.paymentGroup.findFirst({
        where: { id, owner_address: { equals: ownerAddress, mode: "insensitive" } },
        select: { id: true },
      })
      if (!owned) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 })
      }

      const group = await prisma.paymentGroup.update({
        where: { id },
        data,
      })

      return NextResponse.json({
        group: {
          ...group,
          created_at: group.created_at.toISOString(),
          updated_at: group.updated_at.toISOString(),
        },
      })
    } catch (error: unknown) {
      console.error("[API] PATCH /api/payment-groups/[id] error:", error)
      const message = error instanceof Error ? error.message : "Internal Server Error"
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }, { component: "payment-groups-id" })(request)
}
