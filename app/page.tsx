"use client"

import { useWeb3 } from "@/contexts/web3-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Users, Send, BarChart3, DollarSign, TrendingUp, Info, Receipt } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { getSupabase } from "@/lib/supabase"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { FinancialReport } from "@/components/financial-report"
import { VendorSidebar } from "@/components/vendor-sidebar"
import { BusinessMetrics } from "@/components/business-metrics"
import { PaymentActivity } from "@/components/payment-activity"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface DashboardStats {
  totalSent: number
  totalTransactions: number
  totalVendors: number
  recentPayments: number
}

export default function HomePage() {
  const { isConnected, connectWallet, wallet, usdtBalance, usdcBalance, daiBalance, chainId } = useWeb3()
  const isDemoMode = !isConnected
  const [stats, setStats] = useState<DashboardStats>({
    totalSent: 0,
    totalTransactions: 0,
    totalVendors: 0,
    recentPayments: 0,
  })
  const [chartData, setChartData] = useState<Array<{ date: string; amount: number }>>([])
  const [paymentsList, setPaymentsList] = useState<any[]>([])
  const [vendorsList, setVendorsList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Calculate total balance for runway estimation
  const totalBalance =
    Number.parseFloat(usdtBalance || "0") + Number.parseFloat(usdcBalance || "0") + Number.parseFloat(daiBalance || "0")

  useEffect(() => {
    if (isConnected && wallet) {
      loadDashboardData()
    }
  }, [isConnected, wallet])

  const loadDashboardData = async () => {
    try {
      const supabase = getSupabase()

      const { data: vendors } = supabase
        ? await supabase.from("vendors").select("*").eq("created_by", wallet)
        : { data: [] }

      // Ideally: .select("*, vendors(*)")
      const { data: payments, error } = supabase
        ? await supabase
            .from("payments")
            .select("*")
            .eq("from_address", wallet)
            .order("timestamp", { ascending: false })
        : { data: [], error: null }

      if (error) throw error

      let allPayments = payments || []

      if (wallet) {
        try {
          const currentChainId = chainId || "1"
          const response = await fetch(`/api/transactions?address=${wallet}&chainId=${currentChainId}`)
          const data = await response.json()

          if (data.transactions) {
            const externalTxs = data.transactions

            // Create Set of existing tx_hashes to prevent duplicates
            const existingHashes = new Set(allPayments.map((p: any) => p.tx_hash.toLowerCase()))

            const newExternalTxs = externalTxs.filter(
              (tx: any) =>
                !existingHashes.has(tx.tx_hash.toLowerCase()) && tx.from_address.toLowerCase() === wallet.toLowerCase(),
            )

            // Merge and sort
            allPayments = [...allPayments, ...newExternalTxs].sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
            )
          }
        } catch (err) {
          console.error("[Dashboard] Failed to fetch external transactions:", err)
        }
      }

      const enrichedPayments = allPayments.map((p) => {
        const vendor =
          vendors?.find((v) => v.id === p.vendor_id) ||
          vendors?.find((v) => v.wallet_address.toLowerCase() === p.to_address.toLowerCase())
        return { ...p, vendor }
      })

      const enrichedVendors = vendors?.map((v) => {
        const totalReceived = allPayments
          .filter((p) => p.vendor_id === v.id || p.to_address.toLowerCase() === v.wallet_address.toLowerCase())
          .reduce((sum, p) => sum + (p.amount_usd || 0), 0)
        return { ...v, totalReceived }
      })

      setPaymentsList(enrichedPayments || [])
      setVendorsList(enrichedVendors || [])

      // Calculate statistics
      const totalSent = allPayments.reduce((sum, p) => sum + (p.amount_usd || 0), 0)
      const totalTransactions = allPayments.length
      const totalVendors = vendors?.length || 0

      // Get payments from last 7 days
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const recentPayments = allPayments.filter((p) => new Date(p.timestamp) >= sevenDaysAgo).length

      setStats({
        totalSent,
        totalTransactions,
        totalVendors,
        recentPayments,
      })

      // Prepare chart data for last 7 days
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - (6 - i))
        return date.toISOString().split("T")[0]
      })

      const chartData = last7Days.map((date) => {
        const dayPayments = allPayments.filter((p) => p.timestamp.startsWith(date))
        const total = dayPayments.reduce((sum, p) => sum + (p.amount_usd || 0), 0)
        return {
          date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          amount: Number.parseFloat(total.toFixed(2)),
        }
      })

      setChartData(chartData)
    } catch (error) {
      console.error("[Dashboard] Failed to load dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  // Mock data for Demo Mode
  const demoStats: DashboardStats = {
    totalSent: 124500.5,
    totalTransactions: 1248,
    totalVendors: 86,
    recentPayments: 42,
  }

  const demoChartData = [
    { date: "Nov 14", amount: 4500 },
    { date: "Nov 15", amount: 12000 },
    { date: "Nov 16", amount: 3200 },
    { date: "Nov 17", amount: 18500 },
    { date: "Nov 18", amount: 9000 },
    { date: "Nov 19", amount: 24000 },
    { date: "Nov 20", amount: 15600 },
  ]

  const demoVendors = [
    { id: "1", name: "Cloud Services Inc", wallet_address: "0x123...abc", totalReceived: 45000 },
    { id: "2", name: "Dev Team Alpha", wallet_address: "0x456...def", totalReceived: 32000 },
    { id: "3", name: "Marketing Agency", wallet_address: "0x789...ghi", totalReceived: 15000 },
    { id: "4", name: "Legal Consultants", wallet_address: "0xabc...jkl", totalReceived: 8500 },
    { id: "5", name: "Office Supplies", wallet_address: "0xdef...mno", totalReceived: 2500 },
  ]

  const demoPayments = [
    {
      id: "1",
      timestamp: new Date().toISOString(),
      to_address: "0x123...abc",
      amount: "5000",
      amount_usd: 5000,
      status: "completed",
      notes: "Monthly Server Costs",
      token_symbol: "USDC",
      tx_hash: "0x...",
      vendor: { name: "Cloud Services Inc" },
    },
    {
      id: "2",
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      to_address: "0x456...def",
      amount: "3200",
      amount_usd: 3200,
      status: "completed",
      notes: "Frontend Development Milestone",
      token_symbol: "USDT",
      tx_hash: "0x...",
      vendor: { name: "Dev Team Alpha" },
    },
    {
      id: "3",
      timestamp: new Date(Date.now() - 172800000).toISOString(),
      to_address: "0x789...ghi",
      amount: "1500",
      amount_usd: 1500,
      status: "pending",
      notes: "Q4 Marketing Campaign",
      token_symbol: "USDC",
      tx_hash: "0x...",
      vendor: { name: "Marketing Agency" },
    },
  ]

  // Use real stats or demo stats
  const displayStats = isDemoMode ? demoStats : stats
  const displayChartData = isDemoMode ? demoChartData : chartData
  const displayVendors = isDemoMode ? demoVendors : vendorsList
  const displayPayments = isDemoMode ? demoPayments : paymentsList

  return (
    <div className="flex flex-col min-h-screen">
      {/* {isDemoMode && <PaymentNetworkGraph />} */}

      <div className="container mx-auto py-8 px-4 space-y-8">
        {isDemoMode && (
          <Alert className="bg-blue-500/10 border-blue-500/20 text-blue-500">
            <Info className="h-4 w-4" />
            <AlertTitle>Demo Mode Active</AlertTitle>
            <AlertDescription>
              You are viewing the dashboard in demo mode with simulated data. Connect your wallet to see your real
              activity.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Manage your crypto payments and vendors</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sent</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground font-mono">
                {loading && !isDemoMode
                  ? "..."
                  : `$${displayStats.totalSent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Lifetime payments</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {loading && !isDemoMode ? "..." : displayStats.totalTransactions.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total payments made</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Wallet Tags</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {loading && !isDemoMode ? "..." : displayStats.totalVendors.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Registered tags</p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {loading && !isDemoMode ? "..." : displayStats.recentPayments.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Payments last 7 days</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Financial Health</h2>
          <p className="text-muted-foreground">Key business performance indicators</p>
        </div>

        <BusinessMetrics payments={displayPayments} balance={totalBalance} loading={loading && !isDemoMode} />

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="bg-card border-border lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-foreground">Payment Trend</CardTitle>
              <CardDescription className="text-muted-foreground">
                Your transaction volume over the last 7 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading && !isDemoMode ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Loading chart data...
                </div>
              ) : displayChartData.length === 0 || displayChartData.every((d) => d.amount === 0) ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No payment data available. Start by creating your first batch payment.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={displayChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                    <XAxis dataKey="date" stroke="#737373" style={{ fontSize: "12px" }} />
                    <YAxis stroke="#737373" style={{ fontSize: "12px" }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111111",
                        border: "1px solid #262626",
                        borderRadius: "8px",
                        color: "#ededed",
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, "Amount"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-1">
            <VendorSidebar vendors={displayVendors} loading={loading && !isDemoMode} />
          </div>
        </div>

        <PaymentActivity
          payments={displayPayments}
          walletAddress={wallet}
          loading={loading && !isDemoMode}
          title="Recent Transactions"
          description="Your latest payment activity"
        />

        <FinancialReport payments={displayPayments} loading={loading && !isDemoMode} />

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">Quick Actions</h2>
          <p className="text-muted-foreground">Access your main features</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group">
            <Link href="/batch-payment">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Send className="h-8 w-8 text-primary" />
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle className="text-foreground">Batch Payment</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Send USDT/USDC to multiple recipients in one transaction
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group">
            <Link href="/receive">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Receipt className="h-8 w-8 text-primary" />
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle className="text-foreground">Receive</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Generate secure payment links to receive funds
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group">
            <Link href="/vendors">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Users className="h-8 w-8 text-primary" />
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle className="text-foreground">Wallet Tags</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Manage and organize your wallet address tags
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group">
            <Link href="/analytics">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <BarChart3 className="h-8 w-8 text-primary" />
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <CardTitle className="text-foreground">Analytics</CardTitle>
                <CardDescription className="text-muted-foreground">
                  View detailed payment history and financial reports
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
