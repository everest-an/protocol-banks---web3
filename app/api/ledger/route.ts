import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { getUserBalances, getLedgerEntries } from "@/lib/services/ledger-service"

/**
 * GET /api/ledger
 * Get user balances and ledger entries
 *
 * Query parameters:
 * - view: "balances" | "entries" (default: "balances")
 * - token: filter by token
 * - chain: filter by chain
 * - category: filter entries by category
 * - limit: pagination limit (default 50)
 * - offset: pagination offset (default 0)
 */
export const GET = withAuth(async (request: NextRequest, userAddress: string) => {
  try {
    const { searchParams } = new URL(request.url)
    const view = searchParams.get("view") || "balances"

    if (view === "balances") {
      const balances = await getUserBalances(userAddress)
      return NextResponse.json({ balances })
    }

    if (view === "entries") {
      const result = await getLedgerEntries({
        accountAddress: userAddress,
        token: searchParams.get("token") ?? undefined,
        chain: searchParams.get("chain") ?? undefined,
        category: searchParams.get("category") ?? undefined,
        limit: Number(searchParams.get("limit") || "50"),
        offset: Number(searchParams.get("offset") || "0"),
      })
      return NextResponse.json(result)
    }

    return NextResponse.json(
      { error: "Invalid view parameter. Use 'balances' or 'entries'" },
      { status: 400 }
    )
  } catch (error: unknown) {
    console.error("[API] GET /api/ledger error:", error)
    const message = error instanceof Error ? error.message : "Internal Server Error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}, { component: 'ledger' })
