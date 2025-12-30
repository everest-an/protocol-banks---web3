import type { Payment } from "@/types"

/**
 * 按月聚合交易数据
 */
export function aggregateByMonth(payments: Payment[]): { month: string; amount: number }[] {
  const monthlyData: { [key: string]: number } = {}

  payments.forEach((payment) => {
    const date = new Date(payment.created_at)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = 0
    }

    monthlyData[monthKey] += payment.amount
  })

  // 转换为数组并排序
  return Object.entries(monthlyData)
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

/**
 * 计算 YTD 增长率
 */
export function calculateYTDGrowth(payments: Payment[]): number {
  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1)

  const recentPayments = payments.filter((p) => new Date(p.created_at) >= sixMonthsAgo)
  const oldPayments = payments.filter((p) => {
    const date = new Date(p.created_at)
    return date >= twelveMonthsAgo && date < sixMonthsAgo
  })

  const recentTotal = recentPayments.reduce((sum, p) => sum + p.amount, 0)
  const oldTotal = oldPayments.reduce((sum, p) => sum + p.amount, 0)

  if (oldTotal === 0) return recentTotal > 0 ? 100 : 0

  const growth = ((recentTotal - oldTotal) / oldTotal) * 100
  return Math.round(growth * 10) / 10
}

/**
 * 过滤交易记录
 */
export function filterTransactions(
  payments: Payment[],
  filters: {
    type?: "sent" | "received"
    status?: "completed" | "pending" | "failed"
    startDate?: Date
    endDate?: Date
    minAmount?: number
    maxAmount?: number
  },
): Payment[] {
  return payments.filter((payment) => {
    if (filters.type && payment.type !== filters.type) return false
    if (filters.status && payment.status !== filters.status) return false

    const paymentDate = new Date(payment.created_at)
    if (filters.startDate && paymentDate < filters.startDate) return false
    if (filters.endDate && paymentDate > filters.endDate) return false

    if (filters.minAmount !== undefined && payment.amount < filters.minAmount) return false
    if (filters.maxAmount !== undefined && payment.amount > filters.maxAmount) return false

    return true
  })
}

/**
 * 获取最近12个月的月度数据
 */
export function getLast12MonthsData(payments: Payment[]): { month: string; amount: number }[] {
  const now = new Date()
  const months: { month: string; amount: number }[] = []

  // 生成最近12个月的月份列表
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    months.push({ month: monthKey, amount: 0 })
  }

  // 填充实际数据
  payments.forEach((payment) => {
    const date = new Date(payment.created_at)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

    const monthData = months.find((m) => m.month === monthKey)
    if (monthData) {
      monthData.amount += payment.amount
    }
  })

  return months
}

/**
 * 计算交易统计
 */
export function calculateTransactionStats(payments: Payment[]) {
  const total = payments.length
  const completed = payments.filter((p) => p.status === "completed").length
  const pending = payments.filter((p) => p.status === "pending").length
  const failed = payments.filter((p) => p.status === "failed").length

  const totalVolume = payments.reduce((sum, p) => sum + p.amount, 0)
  const avgAmount = total > 0 ? totalVolume / total : 0

  return {
    total,
    completed,
    pending,
    failed,
    totalVolume,
    avgAmount,
    successRate: total > 0 ? (completed / total) * 100 : 0,
  }
}

/**
 * 按月聚合交易数据（别名，用于向后兼容）
 */
export function aggregateTransactionsByMonth(payments: Payment[]): { month: string; amount: number }[] {
  return aggregateByMonth(payments)
}
