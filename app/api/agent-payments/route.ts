import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { listRecentAgentPayments } from "@/lib/agent/payment-store"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (request: NextRequest, address: string) => {
  const limitParam = Number.parseInt(request.nextUrl.searchParams.get("limit") || "20", 10)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20
  try {
    const payments = await listRecentAgentPayments(address, limit)
    return NextResponse.json({ ok: true, payments })
  } catch (error) {
    console.error("[agent-payments] list failed:", error)
    return NextResponse.json({ error: "could not load agent payments" }, { status: 500 })
  }
}, { component: "agent-payments" })
