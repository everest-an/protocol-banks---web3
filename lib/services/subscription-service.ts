import type { Subscription, SubscriptionInput } from "@/types"

/**
 * 验证订阅数据
 */
export function validateSubscription(data: SubscriptionInput): void {
  if (!data.service_name || data.service_name.trim().length === 0) {
    throw new Error("Service name is required")
  }

  if (!data.recipient_address || data.recipient_address.length < 10) {
    throw new Error("Invalid recipient address")
  }

  if (!data.amount || data.amount <= 0) {
    throw new Error("Amount must be greater than 0")
  }

  if (!data.max_amount || data.max_amount < data.amount) {
    throw new Error("Max amount must be greater than or equal to amount")
  }

  if (!data.frequency || !["daily", "weekly", "monthly", "yearly"].includes(data.frequency)) {
    throw new Error("Invalid frequency")
  }
}

/**
 * 计算下次支付日期
 */
export function calculateNextPaymentDate(
  lastPayment: Date,
  frequency: "daily" | "weekly" | "monthly" | "yearly",
): Date {
  const next = new Date(lastPayment)

  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + 1)
      break
    case "weekly":
      next.setDate(next.getDate() + 7)
      break
    case "monthly":
      next.setMonth(next.getMonth() + 1)
      break
    case "yearly":
      next.setFullYear(next.getFullYear() + 1)
      break
  }

  return next
}

/**
 * 计算订阅统计
 */
export function calculateSubscriptionStats(subscriptions: Subscription[]) {
  const active = subscriptions.filter((s) => s.status === "active").length
  const paused = subscriptions.filter((s) => s.status === "paused").length
  const cancelled = subscriptions.filter((s) => s.status === "cancelled").length

  const monthlyTotal = subscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => {
      let monthlyAmount = s.amount

      if (s.frequency === "weekly") monthlyAmount *= 4
      else if (s.frequency === "daily") monthlyAmount *= 30
      else if (s.frequency === "yearly") monthlyAmount /= 12

      return sum + monthlyAmount
    }, 0)

  // 找出最近的下次付款日期
  const nextPayment = subscriptions
    .filter((s) => s.status === "active" && s.next_payment)
    .map((s) => new Date(s.next_payment!))
    .sort((a, b) => a.getTime() - b.getTime())[0]

  return {
    active,
    paused,
    cancelled,
    monthlyTotal,
    nextPayment: nextPayment || null,
  }
}

/**
 * 格式化订阅用于显示
 */
export function formatSubscriptionForDisplay(subscription: Subscription) {
  const frequencyLabels = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
  }

  return {
    ...subscription,
    formattedAmount: `${subscription.amount} ${subscription.token}`,
    formattedFrequency: frequencyLabels[subscription.frequency],
    formattedNextPayment: subscription.next_payment ? new Date(subscription.next_payment).toLocaleDateString() : "N/A",
  }
}
