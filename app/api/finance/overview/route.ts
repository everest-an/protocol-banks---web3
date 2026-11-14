import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { buildFinanceOverview } from "@/lib/finance/overview"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (request: NextRequest, address: string) => {
  const months = Number.parseInt(new URL(request.url).searchParams.get("months") || "6", 10)
  const overview = await buildFinanceOverview(address, Number.isFinite(months) ? months : 6)
  return NextResponse.json(overview, { headers: { "Cache-Control": "no-store" } })
})
