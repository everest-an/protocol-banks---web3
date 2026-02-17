import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedAddress } from "@/lib/api-auth"
import {
  createSettlement,
  listSettlements,
  resolveDiscrepancy,
} from "@/lib/services/settlement-service"

/**
 * GET /api/settlements
 * List settlement records for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const userAddress = await getAuthenticatedAddress(request)
    if (!userAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    const result = await listSettlements({
      userAddress,
      status: (searchParams.get("status") as any) ?? undefined,
      token: searchParams.get("token") ?? undefined,
      chain: searchParams.get("chain") ?? undefined,
      limit: Number(searchParams.get("limit") || "20"),
      offset: Number(searchParams.get("offset") || "0"),
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error("[API] GET /api/settlements error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/settlements
 * Create a new settlement/reconciliation record
 */
export async function POST(request: NextRequest) {
  try {
    const userAddress = await getAuthenticatedAddress(request)
    if (!userAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { periodStart, periodEnd, token, chain, onChainBalance } = body

    if (!periodStart || !periodEnd || !token || !chain) {
      return NextResponse.json(
        { error: "Missing required fields: periodStart, periodEnd, token, chain" },
        { status: 400 }
      )
    }

    const result = await createSettlement({
      userAddress,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      token,
      chain,
      onChainBalance,
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error("[API] POST /api/settlements error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/settlements
 * Resolve a discrepancy
 */
export async function PATCH(request: NextRequest) {
  try {
    const userAddress = await getAuthenticatedAddress(request)
    if (!userAddress) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { settlementId, notes } = body

    if (!settlementId || !notes) {
      return NextResponse.json(
        { error: "Missing required fields: settlementId, notes" },
        { status: 400 }
      )
    }

    const result = await resolveDiscrepancy(settlementId, userAddress, notes)
    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error("[API] PATCH /api/settlements error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
