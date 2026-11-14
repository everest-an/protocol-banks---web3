import { prisma } from "@/lib/prisma"

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
const SETTLED_PAYMENT = new Set(["completed", "confirmed", "success"])
const SETTLED_ACQUIRING = new Set(["paid", "completed", "success"])

function round(value: number): number {
  return Number(value.toFixed(2))
}

function amount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function shortAddress(value: string | null | undefined): string {
  if (!value) return "unknown"
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value
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

  const merchants = await prisma.merchant.findMany({
    where: {
      OR: [
        { wallet_address: walletFilter(wallet) },
        { user: { wallet_address: walletFilter(wallet) } },
      ],
    },
    select: { id: true, name: true },
  })
  const merchantIds = merchants.map((merchant) => merchant.id)

  const [payments, invoices, subscriptionPayments, agentPayments, acquiringOrders, balances, trading, trades] =
    await Promise.all([
      prisma.payment.findMany({
        where: {
          created_at: { gte: start },
          OR: [{ from_address: walletFilter(wallet) }, { to_address: walletFilter(wallet) }],
        },
        orderBy: { created_at: "desc" },
        take: 500,
      }),
      prisma.invoice.findMany({
        where: { recipient_address: walletFilter(wallet), created_at: { gte: start } },
        orderBy: { created_at: "desc" },
        take: 300,
      }),
      prisma.subscriptionPayment.findMany({
        where: {
          created_at: { gte: start },
          subscription: { owner_address: walletFilter(wallet) },
        },
        include: { subscription: { select: { service_name: true } } },
        orderBy: { created_at: "desc" },
        take: 300,
      }),
      prisma.agentPayment.findMany({
        where: { owner_address: walletFilter(wallet), created_at: { gte: start } },
        orderBy: { created_at: "desc" },
        take: 300,
      }),
      merchantIds.length
        ? prisma.acquiringOrder.findMany({
            where: { merchant_id: { in: merchantIds }, created_at: { gte: start } },
            include: { merchant: { select: { name: true } } },
            orderBy: { created_at: "desc" },
            take: 300,
          })
        : Promise.resolve([]),
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
    ])

  const events: FinanceEvent[] = []

  for (const payment of payments) {
    const direction: FinanceDirection = payment.from_address.toLowerCase() === wallet ? "out" : "in"
    const value = payment.amount_usd ?? amount(payment.amount)
    if (!value) continue
    events.push({
      id: `payment:${payment.id}`,
      source: "Payment",
      title:
        direction === "out"
          ? `Paid ${payment.vendor_name || shortAddress(payment.to_address)}`
          : `Received from ${shortAddress(payment.from_address)}`,
      counterparty: direction === "out" ? payment.to_address : payment.from_address,
      amountUsd: round(value),
      direction,
      occurredAt: (payment.completed_at ?? payment.created_at).toISOString(),
      status: payment.status,
      category: payment.category || (direction === "in" ? "Income" : "Payments"),
      settled: SETTLED_PAYMENT.has(payment.status.toLowerCase()),
      href: "/history",
    })
  }

  let receivables = 0
  for (const invoice of invoices) {
    const value = amount(invoice.amount_fiat ?? invoice.amount)
    if (!value) continue
    const paid = invoice.status.toLowerCase() === "paid"
    if (!paid) receivables += value
    events.push({
      id: `invoice:${invoice.id}`,
      source: "Invoice",
      title: paid ? `Invoice ${invoice.invoice_id} paid` : `Invoice ${invoice.invoice_id} awaiting payment`,
      counterparty: invoice.customer_name || invoice.customer_email || invoice.customer_wallet || "Customer",
      amountUsd: round(value),
      direction: "in",
      occurredAt: (invoice.paid_at ?? invoice.created_at).toISOString(),
      status: invoice.status,
      category: paid ? "Invoices" : "Receivables",
      settled: paid,
      href: "/history",
    })
  }

  for (const payment of subscriptionPayments) {
    const value = amount(payment.amount)
    if (!value) continue
    events.push({
      id: `subscription:${payment.id}`,
      source: "Subscription",
      title: `Subscription · ${payment.subscription.service_name}`,
      counterparty: payment.subscription.service_name,
      amountUsd: round(value),
      direction: "out",
      occurredAt: payment.created_at.toISOString(),
      status: payment.status,
      category: "Subscriptions",
      settled: payment.status.toLowerCase() === "completed",
      href: "/subscriptions",
    })
  }

  for (const payment of agentPayments) {
    const value = amount(payment.amount_usd)
    if (!value) continue
    events.push({
      id: `agent:${payment.id}`,
      source: "Agent",
      title: `Agent payment to ${shortAddress(payment.to_address)}`,
      counterparty: payment.to_address,
      amountUsd: round(value),
      direction: "out",
      occurredAt: (payment.confirmed_at ?? payment.created_at).toISOString(),
      status: payment.status,
      category: "Agent spend",
      settled: payment.status.toLowerCase() === "confirmed",
      href: "/agents/fleet",
    })
  }

  for (const order of acquiringOrders) {
    const value = amount(order.amount)
    if (!value) continue
    const settled = SETTLED_ACQUIRING.has(order.status.toLowerCase())
    events.push({
      id: `acquiring:${order.id}`,
      source: "Acquiring",
      title: `${order.merchant.name} order ${order.order_no}`,
      counterparty: order.payer_address || order.merchant.name,
      amountUsd: round(value),
      direction: "in",
      occurredAt: (order.paid_at ?? order.created_at).toISOString(),
      status: order.status,
      category: "Acquiring",
      settled,
      href: "/analytics",
    })
  }

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
    events.push({
      id: `trade:${trade.id}`,
      source: "Trading",
      title: `${trade.symbol} ${trade.side} closed`,
      counterparty: trade.symbol,
      amountUsd: round(Math.abs(pnl)),
      direction: pnl >= 0 ? "in" : "out",
      occurredAt: (trade.closed_at ?? trade.opened_at).toISOString(),
      status: trade.status,
      category: "Trading P&L",
      settled: true,
      href: "/trading",
    })
  }

  const state = (trading?.state_json ?? null) as {
    mode?: string
    account?: { totalEquity?: number; budget?: number }
    positions?: Array<{ pnl?: number }>
  } | null

  const unrealizedPnl = (state?.positions ?? []).reduce((sum, position) => sum + Number(position.pnl ?? 0), 0)
  const tradingEquity = Number(state?.account?.totalEquity ?? 0)
  const tradingBudget = Number(trading?.budget_usd ?? state?.account?.budget ?? 0)
  const openPositions = state?.positions?.length ?? 0

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
    const key = event.occurredAt.slice(0, 7)
    const bucket = buckets.get(key)
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

  const transactions = events
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 20)

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
    transactions,
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
