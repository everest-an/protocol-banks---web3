"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import { useSubscriptions } from "@/hooks/use-subscriptions"
import { usePaymentHistory } from "@/hooks/use-payment-history"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Key,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Shield,
  Calendar,
  Wallet,
  RefreshCw,
} from "lucide-react"

// Demo data for session keys overview
const DEMO_SESSION_KEYS = [
  {
    id: "1",
    name: "Trading Bot",
    status: "active",
    budgetUsed: 0.45,
    budgetTotal: 1.0,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "2",
    name: "DeFi Agent",
    status: "active",
    budgetUsed: 0.12,
    budgetTotal: 0.5,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "3",
    name: "NFT Minter",
    status: "frozen",
    budgetUsed: 0.3,
    budgetTotal: 0.3,
    expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

// Demo data for recent activities
const DEMO_ACTIVITIES = [
  { id: "1", type: "payment", description: "Subscription payment to Netflix", amount: "-$15.99", time: "2 hours ago", status: "success" },
  { id: "2", type: "session", description: "Trading Bot executed swap", amount: "-0.02 ETH", time: "4 hours ago", status: "success" },
  { id: "3", type: "payment", description: "Payment to AWS Services", amount: "-$250.00", time: "1 day ago", status: "success" },
  { id: "4", type: "session", description: "DeFi Agent staked tokens", amount: "-0.05 ETH", time: "1 day ago", status: "success" },
  { id: "5", type: "payment", description: "Payment to Spotify", amount: "-$16.99", time: "2 days ago", status: "failed" },
]

export default function DashboardPage() {
  const { wallets, activeChain, isConnected } = useWeb3()
  const { isDemoMode } = useDemo()
  const currentWallet = wallets[activeChain]

  const { subscriptions, loading: subsLoading, stats: subStats } = useSubscriptions({
    isDemoMode,
    walletAddress: currentWallet,
  })

  const { payments, loading: paymentsLoading, stats: paymentStats } = usePaymentHistory({
    isDemoMode,
    walletAddress: currentWallet,
  })

  const [sessionKeys, setSessionKeys] = useState(DEMO_SESSION_KEYS)
  const [activities, setActivities] = useState(DEMO_ACTIVITIES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 500)
    return () => clearTimeout(timer)
  }, [])

  // Calculate metrics
  const activeSessionKeys = sessionKeys.filter(s => s.status === "active").length
  const frozenSessionKeys = sessionKeys.filter(s => s.status === "frozen").length
  const totalBudgetUsed = sessionKeys.reduce((sum, s) => sum + s.budgetUsed, 0)
  const totalBudgetAllocated = sessionKeys.reduce((sum, s) => sum + s.budgetTotal, 0)

  // Payment success rate (simulated)
  const successfulPayments = isDemoMode ? 45 : payments.filter(p => p.status === "completed").length
  const totalPayments = isDemoMode ? 50 : payments.length
  const paymentSuccessRate = totalPayments > 0 ? Math.round((successfulPayments / totalPayments) * 100) : 100

  // Pending authorizations (simulated)
  const pendingAuthorizations = isDemoMode ? 3 : 0

  if (!isConnected && !isDemoMode) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-7xl">
          <Card className="p-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <Wallet className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Connect Your Wallet</h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Connect your wallet to view your dashboard with session keys, subscriptions, and payment activity.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Overview of your payment activity and AI agents</p>
          </div>
          <Button variant="outline" size="sm" className="self-start sm:self-auto" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Active Session Keys */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Active Session Keys
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{activeSessionKeys}</span>
                  {frozenSessionKeys > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {frozenSessionKeys} frozen
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Authorizations */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending Authorizations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{pendingAuthorizations}</span>
                  {pendingAuthorizations > 0 && (
                    <Badge variant="destructive" className="text-xs animate-pulse">
                      Action needed
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Success Rate */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Payment Success Rate
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${paymentSuccessRate >= 90 ? 'text-green-500' : paymentSuccessRate >= 70 ? 'text-yellow-500' : 'text-destructive'}`}>
                    {paymentSuccessRate}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {successfulPayments}/{totalPayments}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Spending */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Monthly Subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {subsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">${subStats.monthlyTotal.toFixed(0)}</span>
                  <span className="text-xs text-muted-foreground">
                    {subStats.active} active
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Session Keys Overview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-base font-semibold">Session Keys Overview</CardTitle>
                <CardDescription>AI Agent budget allocation</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/agents/session-keys" className="flex items-center gap-1">
                  View all <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : sessionKeys.length === 0 ? (
                <div className="text-center py-8">
                  <Key className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">No session keys yet</p>
                  <Button size="sm" asChild>
                    <Link href="/agents/session-keys">Create Session Key</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {sessionKeys.slice(0, 4).map((session) => {
                    const usagePercent = (session.budgetUsed / session.budgetTotal) * 100
                    const daysUntilExpiry = Math.ceil((new Date(session.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    
                    return (
                      <div key={session.id} className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{session.name}</span>
                            <Badge 
                              variant={session.status === "active" ? "default" : "secondary"}
                              className={session.status === "frozen" ? "bg-orange-500/10 text-orange-500 border-orange-500/20" : ""}
                            >
                              {session.status}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {daysUntilExpiry > 0 ? `${daysUntilExpiry}d left` : "Expired"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={usagePercent} className="h-1.5 flex-1" />
                          <span className="text-xs font-mono text-muted-foreground">
                            {session.budgetUsed.toFixed(2)}/{session.budgetTotal} ETH
                          </span>
                        </div>
                      </div>
                    )
                  })}

                  {/* Total Budget Summary */}
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Budget Used</span>
                      <span className="font-medium">
                        {totalBudgetUsed.toFixed(2)} / {totalBudgetAllocated.toFixed(2)} ETH
                      </span>
                    </div>
                    <Progress 
                      value={(totalBudgetUsed / totalBudgetAllocated) * 100} 
                      className="h-2 mt-2"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Payments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-base font-semibold">Upcoming Payments</CardTitle>
                <CardDescription>Next scheduled subscription payments</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/subscriptions" className="flex items-center gap-1">
                  View all <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {subsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : subscriptions.filter(s => s.status === "active").length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">No active subscriptions</p>
                  <Button size="sm" asChild>
                    <Link href="/subscriptions">Add Subscription</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {subscriptions
                    .filter(s => s.status === "active" && s.next_payment)
                    .sort((a, b) => new Date(a.next_payment!).getTime() - new Date(b.next_payment!).getTime())
                    .slice(0, 5)
                    .map((sub) => {
                      const nextDate = new Date(sub.next_payment!)
                      const daysUntil = Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                      
                      return (
                        <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div>
                            <p className="font-medium text-sm">{sub.service_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {nextDate.toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm">${sub.amount}</p>
                            <p className={`text-xs ${daysUntil <= 2 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                              {daysUntil <= 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
              <CardDescription>Latest transactions and agent operations</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/history" className="flex items-center gap-1">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        activity.status === "success" 
                          ? "bg-green-500/10" 
                          : "bg-destructive/10"
                      }`}>
                        {activity.status === "success" ? (
                          <CheckCircle2 className={`h-4 w-4 ${
                            activity.status === "success" ? "text-green-500" : "text-destructive"
                          }`} />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${
                        activity.amount.startsWith("-") ? "" : "text-green-500"
                      }`}>
                        {activity.amount}
                      </p>
                      <Badge 
                        variant={activity.type === "session" ? "secondary" : "outline"}
                        className="text-xs"
                      >
                        {activity.type === "session" ? "Agent" : "Payment"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
            <Link href="/agents/session-keys">
              <Key className="h-5 w-5" />
              <span className="text-sm">Manage Session Keys</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
            <Link href="/subscriptions">
              <Calendar className="h-5 w-5" />
              <span className="text-sm">Subscriptions</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
            <Link href="/settings/api-keys">
              <Shield className="h-5 w-5" />
              <span className="text-sm">API Keys</span>
            </Link>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
            <Link href="/batch-payment">
              <DollarSign className="h-5 w-5" />
              <span className="text-sm">Make Payment</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
