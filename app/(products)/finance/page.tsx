"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Landmark,
  Loader2,
  ReceiptText,
  TrendingUp,
  Wallet,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { authHeaders } from "@/lib/authenticated-fetch"
import type { FinanceEvent, FinanceOverview } from "@/lib/finance/overview"
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CsvImport } from "@/components/finance/csv-import"

const COLORS = ["#111111", "#6b7280", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"]

function usd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })
}

function eventDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function toneClass(tone: "positive" | "warning" | "neutral"): string {
  if (tone === "positive") return "bg-emerald-500"
  if (tone === "warning") return "bg-amber-500"
  return "bg-neutral-400"
}

export default function FinancePage() {
  const { address, isConnected, connectWallet, isConnecting } = useUnifiedWallet()
  const [data, setData] = useState<FinanceOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!address) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/finance/overview?months=6", { headers: authHeaders(address) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || `HTTP ${response.status}`)
      setData(body as FinanceOverview)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load finance overview.")
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    void load()
  }, [load])

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16">
        <GlassCard className="mx-auto max-w-lg">
          <GlassCardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <GlassCardTitle>Connect your wallet</GlassCardTitle>
                <GlassCardDescription>
                  See cash, invoices, subscriptions, acquiring and trading P&L in one place.
                </GlassCardDescription>
              </div>
            </div>
          </GlassCardHeader>
          <GlassCardContent>
            <Button onClick={() => void connectWallet()} disabled={isConnecting}>
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          </GlassCardContent>
        </GlassCard>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-16">
        <GlassCard className="mx-auto max-w-lg">
          <GlassCardHeader>
            <GlassCardTitle>Finance is temporarily unavailable</GlassCardTitle>
            <GlassCardDescription>{error || "No data returned."}</GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            <Button variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </GlassCardContent>
        </GlassCard>
      </div>
    )
  }

  const summary = [
    {
      label: "Net worth",
      value: usd(data.netWorth),
      detail: `${usd(data.cash)} cash · ${usd(data.tradingEquity)} trading · ${usd(data.receivables)} invoices`,
      icon: Landmark,
    },
    {
      label: "Net cashflow",
      value: `${data.netCashflow >= 0 ? "+" : "−"}${usd(Math.abs(data.netCashflow))}`,
      detail: `${usd(data.income)} in · ${usd(data.expenses)} out`,
      icon: data.netCashflow >= 0 ? ArrowDownLeft : ArrowUpRight,
      tone: data.netCashflow >= 0 ? "text-emerald-600" : "text-red-600",
    },
    {
      label: "Trading P&L",
      value: `${data.trading.realizedPnl >= 0 ? "+" : "−"}${usd(Math.abs(data.trading.realizedPnl))}`,
      detail: `${data.trading.openPositions} open · ${data.trading.winRate === null ? "no closed trades" : `${data.trading.winRate}% win rate`}`,
      icon: TrendingUp,
      tone: data.trading.realizedPnl >= 0 ? "text-emerald-600" : "text-red-600",
    },
    {
      label: "Open invoices",
      value: usd(data.receivables),
      detail: "Receivables waiting to settle",
      icon: ReceiptText,
    },
  ]

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Finance</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            A read-only view of cash, business activity, invoices and trading. Nothing here can move funds.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {address ? <CsvImport wallet={address} onImported={() => void load()} /> : null}
          <Button asChild variant="outline" size="sm">
            <Link href="/analytics">Detailed reports</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => {
          const Icon = item.icon
          return (
            <GlassCard key={item.label}>
              <GlassCardContent className="pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    <p className={`mt-2 text-2xl font-bold tabular-nums ${item.tone ?? ""}`}>{item.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>Cashflow</GlassCardTitle>
            <GlassCardDescription>Income and expenses over the last {data.months} months.</GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickFormatter={(value) => `$${value}`} tickLine={false} axisLine={false} fontSize={11} width={52} />
                  <Tooltip formatter={(value) => usd(Number(value))} />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCardContent>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>Where money goes</GlassCardTitle>
            <GlassCardDescription>Expenses grouped by source.</GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            {data.categories.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No expenses in this period.</p>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.categories}
                      dataKey="amount"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {data.categories.map((category, index) => (
                        <Cell key={category.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => usd(Number(value))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassCardContent>
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>Accounts</GlassCardTitle>
            <GlassCardDescription>Cash, trading and receivables for this wallet.</GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent className="space-y-3">
            {data.accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts yet.</p>
            ) : (
              data.accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{account.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {account.kind === "trading"
                        ? `${account.meta?.mode ?? "paper"} · budget ${usd(Number(account.meta?.budget ?? 0))}`
                        : account.kind === "receivable"
                          ? "awaiting payment"
                          : account.currency}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-sm tabular-nums">
                    {account.currency === "USD" ? usd(account.balance) : `${account.balance} ${account.currency}`}
                  </p>
                </div>
              ))
            )}
          </GlassCardContent>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>Automatic insights</GlassCardTitle>
            <GlassCardDescription>Deterministic analysis of this wallet&apos;s data.</GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            {data.insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not enough activity yet to generate insights.</p>
            ) : (
              <ul className="space-y-3">
                {data.insights.map((insight) => (
                  <li key={insight.title} className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneClass(insight.tone)}`} />
                    <div>
                      <p className="text-sm font-medium">{insight.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{insight.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </GlassCardContent>
        </GlassCard>
      </div>

      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>Recent activity</GlassCardTitle>
          <GlassCardDescription>Payments, invoices, subscriptions, acquiring and trading.</GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent>
          {data.transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No activity in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.map((event: FinanceEvent) => (
                    <TableRow key={event.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{eventDate(event.occurredAt)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{event.source}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <p className="truncate text-sm">{event.title}</p>
                        {event.counterparty && event.counterparty !== event.title ? (
                          <p className="truncate text-[11px] text-muted-foreground">{event.counterparty}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{event.status}</TableCell>
                      <TableCell className={`text-right font-mono text-sm tabular-nums ${event.direction === "in" ? "text-emerald-600" : "text-red-600"}`}>
                        {event.direction === "in" ? "+" : "−"}{usd(event.amountUsd)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassCardContent>
      </GlassCard>
    </div>
  )
}
