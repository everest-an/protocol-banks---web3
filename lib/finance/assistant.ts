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

export async function askFinanceAssistant(
  walletAddress: string,
  question: string,
): Promise<{ answer: string; provider: string; generatedAt: string }> {
  const overview = await buildFinanceOverview(walletAddress, 6)
  const user = `Question: ${question}\n\nFinancial snapshot:\n${JSON.stringify(snapshot(overview))}`

  const { completeWithPlatform } = await import("@/lib/trading/llm-advisor")
  const result = await completeWithPlatform(SYSTEM, user, 25_000)
  if (!result?.raw?.trim()) {
    throw new Error("The finance assistant is not configured or all model channels are unavailable.")
  }

  return {
    answer: result.raw.trim().slice(0, 6000),
    provider: result.provider,
    generatedAt: new Date().toISOString(),
  }
}
