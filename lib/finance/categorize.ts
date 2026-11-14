const RULES: Array<{ category: string; keywords: string[] }> = [
  { category: "Payroll", keywords: ["payroll", "salary", "wage", "gusto", "deel", "rippling", "工资", "薪资"] },
  { category: "Software", keywords: ["aws", "vercel", "github", "openai", "anthropic", "notion", "figma", "slack", "google", "microsoft", "software", "subscription", "saas"] },
  { category: "Travel", keywords: ["airbnb", "hotel", "flight", "airline", "uber", "lyft", "delta", "travel", "机票", "酒店"] },
  { category: "Meals", keywords: ["restaurant", "coffee", "cafe", "doordash", "ubereats", "grubhub", "starbucks", "meal", "餐饮"] },
  { category: "Advertising", keywords: ["google ads", "meta ads", "facebook ads", "linkedin ads", "advertising", "marketing", "推广", "广告"] },
  { category: "Office", keywords: ["office", "rent", "coworking", "wework", "supplies", "staples", "办公", "租金"] },
  { category: "Taxes", keywords: ["tax", "irs", "vat", "gst", "税"] },
  { category: "Fees", keywords: ["fee", "gas", "network fee", "service charge", "手续费"] },
  { category: "Utilities", keywords: ["electric", "water", "internet", "phone", "utility", "utilities", "水电"] },
  { category: "Income", keywords: ["invoice", "payment received", "deposit", "revenue", "sale", "收入", "回款"] },
  { category: "Transfer", keywords: ["transfer", "withdrawal", "deposit", "转账"] },
]

export function categorizeTransaction(input: {
  description?: string | null
  counterparty?: string | null
  kind?: string | null
}): string {
  const haystack = `${input.description ?? ""} ${input.counterparty ?? ""}`.toLowerCase()
  for (const rule of RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) return rule.category
  }
  return input.kind === "income" ? "Income" : "Uncategorized"
}
