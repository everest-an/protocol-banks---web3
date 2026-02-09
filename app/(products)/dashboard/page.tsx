"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useDemo } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/dashboard"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Send,
  CreditCard,
  Users,
  RefreshCw,
  TrendingUp,
  Clock,
  ChevronRight,
  Zap,
  Grid3X3,
  ExternalLink,
  Inbox,
} from "lucide-react"
import { useBalance } from "@/hooks/use-balance"
import { usePaymentHistory } from "@/hooks/use-payment-history"
import { BalanceDistribution } from "@/components/balance-distribution"
import type { Payment } from "@/types"

// Quick action buttons for the dashboard
const quickActions = [
  { href: "/pay", label: "Send", icon: Send, color: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" },
  { href: "/receive", label: "Receive", icon: ArrowDownLeft, color: "bg-green-500/10 text-green-500 hover:bg-green-500/20" },
  { href: "/swap", label: "Swap", icon: RefreshCw, color: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20" },
  { href: "/batch-payment", label: "Batch", icon: Users, color: "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20" },
]

// Chain explorer base URLs for tx links
const CHAIN_EXPLORERS: Record<string, string> = {
  Ethereum: "https://etherscan.io/tx/",
  Polygon: "https://polygonscan.com/tx/",
  Arbitrum: "https://arbiscan.io/tx/",
  Base: "https://basescan.org/tx/",
  Optimism: "https://optimistic.etherscan.io/tx/",
  BNB: "https://bscscan.com/tx/",
}

function formatAddr(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export default function DashboardPage() {
  const { address: wallet } = useUnifiedWallet()
  const { isDemoMode } = useDemo()
  const { balance, loading: balanceLoading } = useBalance({ isDemoMode, walletAddress: wallet || undefined })
  const { payments, loading: paymentsLoading } = usePaymentHistory({
    isDemoMode,
    walletAddress: wallet || undefined,
  })
  const [activityTab, setActivityTab] = useState("all")

  const displayBalance = (balance?.totalUSD ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  // Filter payments by tab
  const filteredPayments = useMemo(() => {
    const recent = payments.slice(0, 10) // Show latest 10
    if (activityTab === "payouts") return recent.filter((p) => p.type === "sent")
    if (activityTab === "topups") return recent.filter((p) => p.type === "received")
    return recent
  }, [payments, activityTab])

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-6 px-4 space-y-6">

        {/* Balance Card */}
        <GlassCard variant="primary" className="bg-gradient-to-br from-primary/10 via-background to-background">
          <GlassCardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
                <h1 className="text-4xl sm:text-5xl font-bold font-mono tracking-tight">
                  ${displayBalance}
                </h1>
                {balance?.chainDistribution && balance.chainDistribution.length > 0 && (
                  <div className="mt-3">
                    <BalanceDistribution
                      distribution={balance.chainDistribution}
                      totalUSD={balance.totalUSD}
                      className="mt-2"
                    />
                  </div>
                )}
              </div>
              <Link href="/balances">
                <Button variant="ghost" size="sm" className="gap-1">
                  <span className="hidden sm:inline">View Details</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <GlassCard
                size="sm"
                interactive
                className={`${action.color} border-0 cursor-pointer`}
              >
                <GlassCardContent className="flex flex-col items-center justify-center py-4 px-2">
                  <action.icon className="h-6 w-6 mb-2" />
                  <span className="text-xs font-medium">{action.label}</span>
                </GlassCardContent>
              </GlassCard>
            </Link>
          ))}
        </div>

        {/* Products Quick Access */}
        <GlassCard>
          <GlassCardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Grid3X3 className="h-5 w-5 text-muted-foreground" />
                <GlassCardTitle className="text-lg">Products</GlassCardTitle>
              </div>
              <Link href="/products">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Link href="/checkout">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-white/10 dark:border-white/5 hover:bg-primary/5 dark:hover:bg-primary/10 backdrop-blur-sm transition-all cursor-pointer">
                  <div className="p-2 rounded-lg bg-green-500/10 backdrop-blur-sm">
                    <CreditCard className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Checkout</p>
                    <p className="text-xs text-muted-foreground">Accept payments</p>
                  </div>
                </div>
              </Link>
              <Link href="/subscriptions">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-white/10 dark:border-white/5 hover:bg-primary/5 dark:hover:bg-primary/10 backdrop-blur-sm transition-all cursor-pointer">
                  <div className="p-2 rounded-lg bg-purple-500/10 backdrop-blur-sm">
                    <RefreshCw className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Subscriptions</p>
                    <p className="text-xs text-muted-foreground">Recurring payments</p>
                  </div>
                </div>
              </Link>
              <Link href="/agents">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-white/10 dark:border-white/5 hover:bg-primary/5 dark:hover:bg-primary/10 backdrop-blur-sm transition-all cursor-pointer">
                  <div className="p-2 rounded-lg bg-blue-500/10 backdrop-blur-sm">
                    <Zap className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">AI Agents</p>
                    <p className="text-xs text-muted-foreground">Session keys</p>
                  </div>
                </div>
              </Link>
              <Link href="/omnichain">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-white/10 dark:border-white/5 hover:bg-primary/5 dark:hover:bg-primary/10 backdrop-blur-sm transition-all cursor-pointer">
                  <div className="p-2 rounded-lg bg-orange-500/10 backdrop-blur-sm">
                    <TrendingUp className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Omnichain</p>
                    <p className="text-xs text-muted-foreground">Cross-chain vault</p>
                  </div>
                </div>
              </Link>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Recent Activity — Payouts / Top-ups / All */}
        <GlassCard>
          <GlassCardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <GlassCardTitle className="text-lg">Recent Activity</GlassCardTitle>
              </div>
              <Link href="/history">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </GlassCardHeader>
          <GlassCardContent>
            <Tabs value={activityTab} onValueChange={setActivityTab}>
              <TabsList className="mb-4 h-9">
                <TabsTrigger value="all" className="text-xs px-3">All activity</TabsTrigger>
                <TabsTrigger value="payouts" className="text-xs px-3">Payouts</TabsTrigger>
                <TabsTrigger value="topups" className="text-xs px-3">Top-ups</TabsTrigger>
              </TabsList>

              {/* Shared content for all tabs */}
              <div>
                {paymentsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-8 w-8 rounded-full" />
                          <div className="space-y-1.5">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                        </div>
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                ) : filteredPayments.length === 0 ? (
                  <EmptyState
                    icon={Inbox}
                    title="No transactions yet"
                    description={
                      activityTab === "payouts"
                        ? "Outgoing payments will appear here"
                        : activityTab === "topups"
                          ? "Incoming payments will appear here"
                          : "Your transaction history will appear here"
                    }
                    size="sm"
                  />
                ) : (
                  <>
                    {/* Column headers */}
                    <div className="grid grid-cols-3 text-xs text-muted-foreground font-medium px-1 pb-2 border-b">
                      <span>Amount</span>
                      <span>Destination</span>
                      <span className="text-right">Date</span>
                    </div>

                    {/* Transaction rows */}
                    <div className="divide-y">
                      {filteredPayments.slice(0, 5).map((payment) => {
                        const isSent = payment.type === "sent"
                        const counterparty = isSent ? payment.to_address : payment.from_address
                        const displayName = payment.vendor_name || formatAddr(counterparty)
                        const explorerBase = CHAIN_EXPLORERS[payment.chain]
                        const txUrl = payment.tx_hash && explorerBase ? `${explorerBase}${payment.tx_hash}` : null

                        return (
                          <div
                            key={payment.id}
                            className="grid grid-cols-3 items-center py-3 px-1 text-sm hover:bg-muted/30 rounded-sm transition-colors"
                          >
                            {/* Amount */}
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-full ${isSent ? "bg-red-500/10" : "bg-green-500/10"}`}>
                                {isSent ? (
                                  <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />
                                ) : (
                                  <ArrowDownLeft className="h-3.5 w-3.5 text-green-500" />
                                )}
                              </div>
                              <div>
                                <p className={`font-medium font-mono tabular-nums ${isSent ? "text-foreground" : "text-green-600 dark:text-green-400"}`}>
                                  {isSent ? "-" : "+"}{Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {payment.token_symbol || payment.token} · {payment.chain}
                                </p>
                              </div>
                            </div>

                            {/* Destination / Source */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm truncate">{displayName}</span>
                              {txUrl && (
                                <a href={txUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              <Badge
                                variant={payment.status === "completed" ? "secondary" : payment.status === "failed" ? "destructive" : "outline"}
                                className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                              >
                                {payment.status}
                              </Badge>
                            </div>

                            {/* Date */}
                            <p className="text-xs text-muted-foreground text-right tabular-nums">
                              {formatDate(payment.timestamp || payment.created_at)}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </Tabs>
          </GlassCardContent>
        </GlassCard>

      </div>
    </div>
  )
}
