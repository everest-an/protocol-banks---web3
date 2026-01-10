export type Category =
  | "Infrastructure"
  | "Payroll"
  | "Marketing"
  | "Legal"
  | "Software"
  | "Office"
  | "Contractors"
  | "Uncategorized"

export const CATEGORIES: Category[] = [
  "Infrastructure",
  "Payroll",
  "Marketing",
  "Legal",
  "Software",
  "Office",
  "Contractors",
  "Uncategorized",
]

export const CATEGORY_COLORS: Record<Category, string> = {
  Infrastructure: "#3b82f6", // Blue
  Payroll: "#10b981", // Green
  Marketing: "#f59e0b", // Amber
  Legal: "#ef4444", // Red
  Software: "#8b5cf6", // Purple
  Office: "#ec4899", // Pink
  Contractors: "#06b6d4", // Cyan
  Uncategorized: "#737373", // Gray
}

export function categorizeTransaction(vendorName?: string, notes?: string): Category {
  const text = `${vendorName || ""} ${notes || ""}`.toLowerCase()

  if (text.includes("cloud") || text.includes("aws") || text.includes("server") || text.includes("hosting")) {
    return "Infrastructure"
  }
  if (text.includes("salary") || text.includes("payroll") || text.includes("bonus") || text.includes("wage")) {
    return "Payroll"
  }
  if (text.includes("ad") || text.includes("marketing") || text.includes("campaign") || text.includes("promo")) {
    return "Marketing"
  }
  if (text.includes("legal") || text.includes("lawyer") || text.includes("compliance") || text.includes("audit")) {
    return "Legal"
  }
  if (text.includes("software") || text.includes("saas") || text.includes("subscription") || text.includes("tool")) {
    return "Software"
  }
  if (text.includes("office") || text.includes("rent") || text.includes("supply") || text.includes("utility")) {
    return "Office"
  }
  if (text.includes("contractor") || text.includes("freelance") || text.includes("consultant")) {
    return "Contractors"
  }

  return "Uncategorized"
}

export function calculateMonthlyBurnRate(payments: any[]): number {
  if (!payments.length) return 0

  const now = new Date()
  const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30))

  const last30DaysPayments = payments.filter((p) => new Date(p.timestamp) >= thirtyDaysAgo)
  return last30DaysPayments.reduce((sum, p) => sum + (p.amount_usd || 0), 0)
}

export function calculateRunway(balance: number, burnRate: number): number {
  if (burnRate <= 0) return 999 // Infinite runway if no burn
  return balance / burnRate
}

export function getTopCategories(payments: any[]): { name: string; value: number; color: string }[] {
  const distribution: Record<string, number> = {}

  payments.forEach((p) => {
    const category = categorizeTransaction(p.vendor?.name, p.notes)
    distribution[category] = (distribution[category] || 0) + (p.amount_usd || 0)
  })

  return Object.entries(distribution)
    .map(([name, value]) => ({
      name,
      value,
      color: CATEGORY_COLORS[name as Category] || "#737373",
    }))
    .sort((a, b) => b.value - a.value)
}
