import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (request: NextRequest, address: string) => {
  const query = new URL(request.url).searchParams
  const limit = Math.min(Math.max(Number.parseInt(query.get("limit") || "50", 10), 1), 200)
  const category = query.get("category")
  const direction = query.get("direction")
  const from = query.get("from")
  const to = query.get("to")

  const rows = await prisma.financeTransaction.findMany({
    where: {
      owner_address: address.toLowerCase(),
      ...(category ? { category } : {}),
      ...(direction === "in" || direction === "out" ? { direction } : {}),
      ...(from || to
        ? {
            occurred_at: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { occurred_at: "desc" },
    take: limit,
  })

  return NextResponse.json({
    transactions: rows.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      source: row.source,
      kind: row.kind,
      direction: row.direction,
      category: row.category,
      counterparty: row.counterparty,
      description: row.description,
      amountUsd: row.amount_usd,
      currency: row.currency,
      occurredAt: row.occurred_at.toISOString(),
      status: row.status,
      metadata: row.metadata,
    })),
  })
})
