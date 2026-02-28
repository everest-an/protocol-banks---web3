import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { screenAddress, getRiskHistory } from "@/lib/services/risk-service"

/**
 * GET /api/risk
 * Get risk assessment history or screen an address
 *
 * Query parameters:
 * - view: "history" | "screen" (default: "history")
 * - address: address to screen (required for view=screen)
 * - limit/offset: pagination for history
 */
export const GET = withAuth(async (request: NextRequest, userAddress: string) => {
  try {
    const { searchParams } = new URL(request.url)
    const view = searchParams.get("view") || "history"

    if (view === "screen") {
      const address = searchParams.get("address")
      if (!address) {
        return NextResponse.json(
          { error: "Missing required parameter: address" },
          { status: 400 }
        )
      }
      const result = await screenAddress(address)
      return NextResponse.json(result)
    }

    if (view === "history") {
      const result = await getRiskHistory({
        userAddress,
        limit: Number(searchParams.get("limit") || "20"),
        offset: Number(searchParams.get("offset") || "0"),
      })
      return NextResponse.json(result)
    }

    return NextResponse.json(
      { error: "Invalid view parameter. Use 'history' or 'screen'" },
      { status: 400 }
    )
  } catch (error: unknown) {
    console.error("[API] GET /api/risk error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}, { component: 'risk' })
