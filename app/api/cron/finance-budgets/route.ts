import { NextRequest, NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron-auth"
import { prisma } from "@/lib/prisma"
import { notificationService } from "@/lib/services/notification-service"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const SETTLED = ["completed", "confirmed", "paid", "success", "settled"]

function monthBounds(month: string): { start: Date; end: Date } {
  const [year, monthNumber] = month.split("-").map(Number)
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1)),
    end: new Date(Date.UTC(year, monthNumber, 1)),
  }
}

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const month = new Date().toISOString().slice(0, 7)
  const { start, end } = monthBounds(month)
  const budgets = await prisma.financeBudget.findMany({
    where: { month, amount_usd: { gt: 0 } },
    orderBy: { updated_at: "asc" },
    take: 2000,
  })

  let checked = 0
  let alerted = 0
  let failed = 0

  for (const budget of budgets) {
    try {
      checked += 1
      const result = await prisma.financeTransaction.aggregate({
        where: {
          owner_address: budget.owner_address,
          direction: "out",
          category: budget.category,
          status: { in: SETTLED },
          occurred_at: { gte: start, lt: end },
        },
        _sum: { amount_usd: true },
      })
      const spent = Number(result._sum.amount_usd ?? 0)
      const percent = (spent / budget.amount_usd) * 100
      const level = percent >= 100 ? 100 : percent >= 80 ? 80 : 0
      if (level <= budget.alert_level || level === 0) continue

      await prisma.financeBudget.update({
        where: { id: budget.id },
        data: { alert_level: level, alerted_at: new Date() },
      })
      await notificationService.notifyBudgetAlert(
        budget.owner_address,
        budget.category,
        spent,
        budget.amount_usd,
        percent,
      )
      alerted += 1
    } catch (error) {
      failed += 1
      console.error("[cron/finance-budgets] failed:", error)
    }
  }

  return NextResponse.json({
    ok: true,
    month,
    checked,
    alerted,
    failed,
    timestamp: new Date().toISOString(),
  })
}
