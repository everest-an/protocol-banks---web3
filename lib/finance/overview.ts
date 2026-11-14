import { prisma } from "@/lib/prisma"
import { syncFinanceLedger } from "./ledger"

export type FinanceDirection = "in" | "out"
export type FinanceTone = "positive" | "warning" | "neutral"

export interface FinanceEvent {
  id: string
  source: string
  title: string
  counterparty: string | null
  amountUsd: number
  direction: FinanceDirection
  occurredAt: string
  status: string
  category: string
  settled: boolean
  href?: string
}

export interface FinanceAccount {
  id: string
  kind: "cash" | "trading" | "receivable"
  name: string
  balance: number
  currency: string
  meta?: Record<string, string | number | boolean | null>
}

export interface FinanceInsight {
  tone: FinanceTone
  title: string
  detail: string
}

export interface FinanceBudgetView {
  id: string
  category: string
  month: string
  amountUsd: number
  spentUsd: number
  remainingUsd: number
  percent: number
}

export interface FinanceOverview {
  generatedAt: string
  currency: "USD"
  months: number
  netWorth: number
  cash: number
  receivables: number
  tradingEquity: number
  income: number
  expenses: number
  netCashflow: number
  accounts: FinanceAccount[]
  monthly: Array<{ month: string; label: string; income: number; expenses: number; net: number }>
  categories: Array<{ name: string; amount: number }>
  budgets: FinanceBudgetView[]
  transactions: FinanceEvent[]
  trading: {
    mode: string
    equity: number
    budget: number
    realizedPnl: number
    unrealizedPnl: number
    fees: number
    openPositions: number
    closedTrades: number
    winRate: number | null
  }
  insights: FinanceInsight[]
}

const STABLES = new Set(["USDC", "USDT", "DAI", "USD", "USDP", "PYUSD"])
const SETTLED = new Set(["completed", "confirmed", "paid", "success", "settled"])
const HREFS: Record<string, string> = {
  payment: "/history",
  invoice: "/history",
  subscription: "/subscriptions",
  acquiring: "/analytics",
  agent: "/agents/fleet",
  trade: "/trading",
  csv: "/finance",
}

function round(value: number): number {
  return Number(value.toFixed(2))
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7)
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { month: "short" })
}

function startOfMonthsAgo(months: number): Date {
  const date = new Date()
  date.setUTCDate(1)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCMonth(date.getUTCMonth() - (months - 1))
  return date
}

function walletFilter(wallet: string) {
  return { equals: wallet, mode: "insensitive" as const }
}

export async function buildFinanceOverview(walletAddress: string, months = 6): Promise<FinanceOverview> {
  const wallet = walletAddress.toLowerCase()
  const range = Math.min(Math.max(months, 3), 12)
  const start = startOfMonthsAgo(range)

  await syncFinanceLedger(wallet).catch(() => undefined)

  const month = new Date().toISOString().slice(0, 7)
  const [balances, trading, trades, ledger, budgetRows] = await Promise.all([
    prisma.userBalance.findMany({ where: { user_address: walletFilter(wallet) } }),
    prisma.tradingAccount.findUnique({
      where: { wallet_address: wallet },
      select: { status: true, budget_usd: true, state_json: true },
    }),
    prisma.tradeRecord.findMany({
      where: { wallet_address: wallet },
      orderBy: { opened_at: "desc" },
      take: 300,
    }),
    prisma.financeTransaction.findMany({
      where: { owner_address: wallet, occurred_at: { gte: start } },
      orderBy: { occurred_at: "desc" },
      take: 1000,
    }),
    prisma.financeBudget.findMany({
      where: { owner_address: wallet, month },
      orderBy: { category: "asc" },
    }),
  ])

  const state = (trading?.state_json ?? null) as {
    mode?: string
    account?: { totalEquity?: number; budget?: number }
    positions?: Array<{ pnl?: number }>
  } | null

  let realizedPnl = 0
  let tradingFees = 0
  let closedTrades = 0
  let wins = 0
  for (const trade of trades) {
    tradingFees += trade.fees || 0
    if (trade.status !== "closed" || trade.pnl === null) continue
    const pnl = Number(trade.pnl)
    if (!Number.isFinite(pnl)) continue
    realizedPnl += pnl
    closedTrades += 1
    if (pnl > 0) wins += 1
  }

  const unrealizedPnl = (state?.positions ?? []).reduce((sum, position) => sum + Number(position.pnl ?? 0), 0)
  const tradingEquity = Number(state?.account?.totalEquity ?? 0)
  const tradingBudget = Number(trading?.budget_usd ?? state?.account?.budget ?? 0)
  const openPositions = state?.positions?.length ?? 0

  const events: FinanceEvent[] = ledger.map((row) => ({
    id: row.id,
    source: row.source,
    title: row.description || `${row.source} ${row.counterparty || ""}`.trim(),
    counterparty: row.counterparty,
    amountUsd: round(row.amount_usd),
    direction: row.direction === "in" ? "in" : "out",
    occurredAt: row.occurred_at.toISOString(),
    status: row.status,
    category: row.category,
    settled: SETTLED.has(row.status.toLowerCase()),
    href: HREFS[row.source],
  }))

  let cash = 0
  const accounts: FinanceAccount[] = []
  for (const balance of balances) {
    const token = balance.token.toUpperCase()
    const value = Number(balance.total.toString())
    if (!Number.isFinite(value) || value <= 0) continue
    if (STABLES.has(token)) cash += value
    accounts.push({
      id: `cash:${token}:${balance.chain}`,
      kind: "cash",
      name: `${token} · ${balance.chain}`,
      balance: round(value),
      currency: token,
      meta: { chain: balance.chain, stable: STABLES.has(token) },
    })
  }

  accounts.push({
    id: "trading",
    kind: "trading",
    name: "AI Trading",
    balance: round(tradingEquity),
    currency: "USD",
    meta: {
      mode: trading?.status ?? state?.mode ?? "paper",
      budget: round(tradingBudget),
      openPositions,
      unrealizedPnl: round(unrealizedPnl),
    },
  })

  const receivables = ledger
    .filter((row) => row.category === "Receivables" && !SETTLED.has(row.status.toLowerCase()))
    .reduce((sum, row) => sum + row.amount_usd, 0)

  if (receivables > 0) {
    accounts.push({
      id: "receivables",
      kind: "receivable",
      name: "Open invoices",
      balance: round(receivables),
      currency: "USD",
      meta: { status: "awaiting payment" },
    })
  }

  const monthly: FinanceOverview["monthly"] = []
  const buckets = new Map<string, { income: number; expenses: number }>()
  for (let index = 0; index < range; index += 1) {
    const date = new Date(start)
    date.setUTCMonth(start.getUTCMonth() + index)
    const key = monthKey(date)
    buckets.set(key, { income: 0, expenses: 0 })
    monthly.push({ month: key, label: monthLabel(key), income: 0, expenses: 0, net: 0 })
  }

  let income = 0
  let expenses = 0
  const expenseCategories = new Map<string, number>()
  for (const event of events) {
    if (!event.settled) continue
    const bucket = buckets.get(event.occurredAt.slice(0, 7))
    if (!bucket) continue
    if (event.direction === "in") {
      bucket.income += event.amountUsd
      income += event.amountUsd
    } else {
      bucket.expenses += event.amountUsd
      expenses += event.amountUsd
      expenseCategories.set(event.category, (expenseCategories.get(event.category) ?? 0) + event.amountUsd)
    }
  }

  for (const month of monthly) {
    const bucket = buckets.get(month.month)
    if (!bucket) continue
    month.income = round(bucket.income)
    month.expenses = round(bucket.expenses)
    month.net = round(bucket.income - bucket.expenses)
  }

  const categories = [...expenseCategories.entries()]
    .map(([name, value]) => ({ name, amount: round(value) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 7)

  const monthSpent = new Map<string, number>()
  for (const event of events) {
    if (!event.settled || event.direction !== "out" || !event.occurredAt.startsWith(month)) continue
    monthSpent.set(event.category, (monthSpent.get(event.category) ?? 0) + event.amountUsd)
  }
  const budgets: FinanceBudgetView[] = budgetRows.map((budget) => {
    const spent = monthSpent.get(budget.category) ?? 0
    const amount = budget.amount_usd
    return {
      id: budget.id,
      category: budget.category,
      month: budget.month,
      amountUsd: round(amount),
      spentUsd: round(spent),
      remainingUsd: round(amount - spent),
      percent: amount > 0 ? Number(Math.min(999, (spent / amount) * 100).toFixed(0)) : 0,
    }
  })

  const netCashflow = round(income - expenses)
  const netWorth = round(cash + tradingEquity + receivables)
  const latest = monthly[monthly.length - 1]
  const previous = monthly[monthly.length - 2]
  const insights: FinanceInsight[] = []

  if (previous && previous.expenses > 0 && latest.expenses > 0) {
    const change = ((latest.expenses - previous.expenses) / previous.expenses) * 100
    insights.push({
      tone: change > 10 ? "warning" : change < -10 ? "positive" : "neutral",
      title: `Spending ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(0)}% month over month`,
      detail: `${latest.label}: $${latest.expenses.toFixed(2)} vs ${previous.label}: $${previous.expenses.toFixed(2)}.`,
    })
  }

  if (netCashflow < 0) {
    insights.push({
      tone: "warning",
      title: "Negative net cashflow this period",
      detail: `Income $${income.toFixed(2)} minus expenses $${expenses.toFixed(2)} = -$${Math.abs(netCashflow).toFixed(2)}.`,
    })
  } else if (income > 0) {
    insights.push({
      tone: "positive",
      title: "Positive net cashflow",
      detail: `Income exceeds expenses by $${netCashflow.toFixed(2)} across the selected period.`,
    })
  }

  if (receivables > 0) {
    insights.push({
      tone: "neutral",
      title: `$${receivables.toFixed(2)} waiting in invoices`,
      detail: "Paid invoices would add to cash once settled.",
    })
  }

  if (closedTrades > 0) {
    const winRate = wins / closedTrades
    insights.push({
      tone: realizedPnl >= 0 ? "positive" : "warning",
      title: `Trading P&L ${realizedPnl >= 0 ? "+" : "-"}$${Math.abs(realizedPnl).toFixed(2)}`,
      detail: `${closedTrades} closed trades, ${(winRate * 100).toFixed(0)}% win rate, $${tradingFees.toFixed(2)} fees.`,
    })
  }

  if (cash > 0 && expenses > 0) {
    const averageMonthlyExpenses = expenses / Math.max(1, monthly.filter((month) => month.expenses > 0).length)
    if (averageMonthlyExpenses > 0) {
      insights.push({
        tone: "neutral",
        title: `Runway ${(cash / averageMonthlyExpenses).toFixed(1)} months`,
        detail: `Based on $${cash.toFixed(2)} stablecoin cash and the current average monthly spend.`,
      })
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    currency: "USD",
    months: range,
    netWorth,
    cash: round(cash),
    receivables: round(receivables),
    tradingEquity: round(tradingEquity),
    income: round(income),
    expenses: round(expenses),
    netCashflow,
    accounts,
    monthly,
    categories,
    budgets,
    transactions: events.slice(0, 20),
    trading: {
      mode: trading?.status ?? state?.mode ?? "paper",
      equity: round(tradingEquity),
      budget: round(tradingBudget),
      realizedPnl: round(realizedPnl),
      unrealizedPnl: round(unrealizedPnl),
      fees: round(tradingFees),
      openPositions,
      closedTrades,
      winRate: closedTrades > 0 ? Number(((wins / closedTrades) * 100).toFixed(0)) : null,
    },
    insights,
  }
}
