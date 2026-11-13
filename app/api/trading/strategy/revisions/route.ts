import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (_request: NextRequest, address: string) => {
  const revisions = await prisma.strategyRevision.findMany({
    where: { wallet_address: address.toLowerCase() },
    orderBy: { applied_at: "desc" },
    take: 20,
  })

  return NextResponse.json({
    revisions: revisions.map((revision) => ({
      id: revision.id,
      preset: revision.preset,
      overrides: revision.overrides,
      config: revision.config,
      previousConfig: revision.previous_config,
      appliedVia: revision.applied_via,
      appliedAt: revision.applied_at.toISOString(),
    })),
  })
})
