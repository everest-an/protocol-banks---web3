import { NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { syncFinanceLedger } from "@/lib/finance/ledger"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export const POST = withAuth(async (_request, address: string) => {
  try {
    await syncFinanceLedger(address, true)
    return NextResponse.json({ ok: true, syncedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[finance/sync] failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Finance sync failed." },
      { status: 503 },
    )
  }
})
