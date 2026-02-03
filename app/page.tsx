"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  ArrowDownLeft, 
  Send, 
  CreditCard, 
  Users, 
  RefreshCw,
  Wallet,
  TrendingUp,
  Clock,
  ChevronRight,
  Zap,
  Grid3X3
} from "lucide-react"
import { useBalance } from "@/hooks/use-balance"
import { BalanceDistribution } from "@/components/balance-distribution"
import { DashboardActivity } from "@/components/dashboard-activity"

// Quick action buttons for the dashboard
const quickActions = [
  { href: "/pay", label: "Send", icon: Send, color: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20" },
  { href: "/receive", label: "Receive", icon: ArrowDownLeft, color: "bg-green-500/10 text-green-500 hover:bg-green-500/20" },
  { href: "/swap", label: "Swap", icon: RefreshCw, color: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20" },
  { href: "/batch-payment", label: "Batch", icon: Users, color: "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20" },
]

export default function HomePage() {
  const { isConnected, connectWallet, wallet } = useWeb3()
  const { isDemoMode, setWalletConnected } = useDemo()
  const { balance, loading: balanceLoading } = useBalance({ isDemoMode, walletAddress: wallet || undefined })

  useEffect(() => {
    setWalletConnected(isConnected)
  }, [isConnected, setWalletConnected])

  const displayBalance = (balance?.totalUSD ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-6 px-4 space-y-6">
        
        {/* Balance Card */}
        <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
          <CardContent className="pt-6">
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
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className={`${action.color} border-0 cursor-pointer transition-all hover:scale-105`}>
                <CardContent className="flex flex-col items-center justify-center py-4 px-2">
                  <action.icon className="h-6 w-6 mb-2" />
                  <span className="text-xs font-medium">{action.label}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Products Quick Access */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Grid3X3 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Products</CardTitle>
              </div>
              <Link href="/products">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Link href="/checkout">
                <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <CreditCard className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Checkout</p>
                    <p className="text-xs text-muted-foreground">Accept payments</p>
                  </div>
                </div>
              </Link>
              <Link href="/subscriptions">
                <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <RefreshCw className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Subscriptions</p>
                    <p className="text-xs text-muted-foreground">Recurring payments</p>
                  </div>
                </div>
              </Link>
              <Link href="/agents">
                <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Zap className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">AI Agents</p>
                    <p className="text-xs text-muted-foreground">Session keys</p>
                  </div>
                </div>
              </Link>
              <Link href="/omnichain">
                <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <TrendingUp className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Omnichain</p>
                    <p className="text-xs text-muted-foreground">Cross-chain vault</p>
                  </div>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </div>
              <Link href="/history">
                <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <DashboardActivity 
              walletAddress={wallet || undefined} 
              limit={5} 
              showTabs={false}
              compact={true}
            />
          </CardContent>
        </Card>

        {/* Connect Wallet CTA (if not connected) */}
        {!isConnected && !isDemoMode && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <Wallet className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Connect your wallet to view balances, send payments, and access all features.
              </p>
              <Button onClick={() => connectWallet()}>
                Connect Wallet
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
