import { prisma } from "@/lib/prisma"
import { notificationService } from "@/lib/services/notification-service"

const SETTLED = ["completed", "confirmed", "paid", "success", "settled"]

export function budgetAlertLevel(spentUsd: number, budgetUsd: number): 0 | 80 | 100 {
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || !Number.isFinite(spentUsd) || spentUsd <= 0) return 0
  const percent = (spentUsd / budgetUsd) * 100
  if (percent >= 100) return 100
  if (percent >= 80) return 80
  return 0
}

function monthBounds(month: string): { start: Date; end: Date } {
  const [year, monthNumber] = month.split("-").map(Number)
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1)),
    end: new Date(Date.UTC(year, monthNumber, 1)),
  }
}

export async function runBudgetAlerts(input?: {
  month?: string
  ownerAddress?: string
}): Promise<{ month: string; checked: number; alerted: number; failed: number }> {
  const month = input?.month ?? new Date().toISOString().slice(0, 7)
  const { start, end } = monthBounds(month)
  const budgets = await prisma.financeBudget.findMany({
    where: {
      month,
      amount_usd: { gt: 0 },
      ...(input?.ownerAddress ? { owner_address: input.ownerAddress.toLowerCase() } : {}),
    },
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
      const level = budgetAlertLevel(spent, budget.amount_usd)
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
        (spent / budget.amount_usd) * 100,
      )
      alerted += 1
    } catch (error) {
      failed += 1
      console.error("[finance/budget-alerts] failed:", error)
    }
  }

  return { month, checked, alerted, failed }
}
