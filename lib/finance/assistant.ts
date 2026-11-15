import { buildFinanceOverview, type FinanceOverview } from "./overview"

const SYSTEM = [
  "You are Protocol Bank's read-only finance assistant.",
  "Answer only from the financial snapshot supplied by the server.",
  "You cannot move funds, trade, change budgets, or access another wallet.",
  "Amounts are USD unless stated. Trading P&L is separated from operating cashflow.",
  "Be concise, practical and explicit about missing or approximate data.",
  "Never invent a transaction, balance, category or customer.",
  "If the snapshot is insufficient, say what is missing instead of guessing.",
].join(" ")

function snapshot(overview: FinanceOverview) {
  return {
    netWorthUsd: overview.netWorth,
    cashUsd: overview.cash,
    receivablesUsd: overview.receivables,
    tradingEquityUsd: overview.tradingEquity,
    periodMonths: overview.months,
    incomeUsd: overview.income,
    expensesUsd: overview.expenses,
    netCashflowUsd: overview.netCashflow,
    monthly: overview.monthly,
    categories: overview.categories,
    budgets: overview.budgets,
    accounts: overview.accounts,
    trading: overview.trading,
    insights: overview.insights,
    recentTransactions: overview.transactions.slice(0, 12).map((event) => ({
      source: event.source,
      title: event.title,
      direction: event.direction,
      amountUsd: event.amountUsd,
      category: event.category,
      status: event.status,
      occurredAt: event.occurredAt,
    })),
  }
}

function fallbackAnswer(overview: FinanceOverview): string {
  const top = overview.categories.slice(0, 3).map((category) => `${category.name} $${category.amount.toFixed(2)}`)
  return [
    `Net worth: $${overview.netWorth.toFixed(2)} (cash $${overview.cash.toFixed(2)}, trading $${overview.tradingEquity.toFixed(2)}, receivables $${overview.receivables.toFixed(2)}).`,
    `Last ${overview.months} months: income $${overview.income.toFixed(2)}, expenses $${overview.expenses.toFixed(2)}, net $${overview.netCashflow.toFixed(2)}.`,
    top.length ? `Top expense categories: ${top.join(", ")}.` : "No expense categories recorded yet.",
    `Trading: ${overview.trading.openPositions} open positions, realized P&L $${overview.trading.realizedPnl.toFixed(2)}, win rate ${overview.trading.winRate === null ? "not available" : `${overview.trading.winRate}%`}.`,
    "The AI model is temporarily unavailable, so this is the deterministic summary.",
  ].join("\n")
}

export async function askFinanceAssistant(
  walletAddress: string,
  question: string,
): Promise<{ answer: string; provider: string; generatedAt: string }> {
  const overview = await buildFinanceOverview(walletAddress, 6)
  const user = `Question: ${question}\n\nFinancial snapshot:\n${JSON.stringify(snapshot(overview))}`

  const { completeWithPlatform } = await import("@/lib/trading/llm-advisor")
  const result = await completeWithPlatform(SYSTEM, user, 25_000).catch(() => null)
  if (!result?.raw?.trim()) {
    return {
      answer: fallbackAnswer(overview),
      provider: "deterministic",
      generatedAt: new Date().toISOString(),
    }
  }

  return {
    answer: result.raw.trim().slice(0, 6000),
    provider: result.provider,
    generatedAt: new Date().toISOString(),
  }
}
