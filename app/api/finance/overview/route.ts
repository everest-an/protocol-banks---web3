import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { buildFinanceOverview } from "@/lib/finance/overview"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (request: NextRequest, address: string) => {
  const query = new URL(request.url).searchParams
  const months = Number.parseInt(query.get("months") || "6", 10)
  const sync = query.get("sync") === "1"
  const overview = await buildFinanceOverview(address, Number.isFinite(months) ? months : 6, sync)
  return NextResponse.json(overview, { headers: { "Cache-Control": "no-store" } })
})
