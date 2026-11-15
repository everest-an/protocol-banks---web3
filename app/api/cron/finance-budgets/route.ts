import { NextRequest, NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron-auth"
import { runBudgetAlerts } from "@/lib/finance/budget-alerts"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const result = await runBudgetAlerts()
  return NextResponse.json({
    ok: true,
    ...result,
    timestamp: new Date().toISOString(),
  })
}
