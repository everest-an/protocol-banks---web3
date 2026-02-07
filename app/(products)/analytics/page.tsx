"use client"

import { useState, useEffect } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useDemo } from "@/contexts/demo-context"
import { authHeaders } from "@/lib/authenticated-fetch"
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ArrowUpRight, TrendingUp, Users, DollarSign, X, Plus, FileText, TableIcon } from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import PaymentNetworkGraph from "@/components/payment-network-graph"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { getTopCategories } from "@/lib/business-logic"

interface Payment {
  id: string
  tx_hash: string
  to_address: string
  from_address?: string // Added from_address
  token_symbol: string
  amount: string
  amount_usd: number
  timestamp: string
  status: string
  tags?: string[]
  notes?: string
  vendor?: {
    name: string
  }
  is_external?: boolean // Added flag for external transactions
}

interface BatchPayment {
  id: string
  batch_name: string
  total_recipients: number
  total_amount_usd: number
  status: string
  created_at: string
}

interface Stats {
  totalSent: number
  totalTransactions: number
  totalVendors: number
  avgTransaction: number
}

export default function AnalyticsPage() {
  const { address: wallet, isConnected, chainId } = useUnifiedWallet()
  const { isDemoMode } = useDemo()
  const [payments, setPayments] = useState<Payment[]>([])
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([])
  const [batches, setBatches] = useState<BatchPayment[]>([])
  const [stats, setStats] = useState<Stats>({
    totalSent: 0,
    totalTransactions: 0,
    totalVendors: 0,
    avgTransaction: 0,
  })
  const [loading, setLoading] = useState(true)

  const [dateRange, setDateRange] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [newTag, setNewTag] = useState("")
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false)

  useEffect(() => {
    if (isDemoMode) {
      setPayments(demoPayments)
      setFilteredPayments(demoPayments)
      setBatches(demoBatches)
      setStats(demoStats)
      setLoading(false)
      return
    }

    if (isConnected && wallet) {
      loadData()
    }
  }, [isDemoMode, isConnected, wallet])

  useEffect(() => {
    filterPayments()
  }, [startDate, endDate, payments])

  const handleDateRangeChange = (value: string) => {
    setDateRange(value)
    const today = new Date()
    const formatDateStr = (date: Date) => date.toISOString().split("T")[0]

    if (value === "all") {
      setStartDate("")
      setEndDate("")
    } else if (value === "7d") {
      const start = new Date(today)
      start.setDate(today.getDate() - 7)
      setStartDate(formatDateStr(start))
      setEndDate(formatDateStr(today))
    } else if (value === "30d") {
      const start = new Date(today)
      start.setDate(today.getDate() - 30)
      setStartDate(formatDateStr(start))
      setEndDate(formatDateStr(today))
    } else if (value === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      setStartDate(formatDateStr(start))
      setEndDate(formatDateStr(today))
    } else if (value === "custom") {
      // Keep existing dates or clear if needed
    }
  }

  const handleDateChange = (type: "start" | "end", value: string) => {
    if (type === "start") setStartDate(value)
    else setEndDate(value)
    setDateRange("custom")
  }

  const loadData = async () => {
    try {
      setLoading(true) // Ensure loading state is set
      // Load payments from Prisma-backed API
      const paymentsResponse = await fetch(`/api/payments?wallet=${wallet}&type=sent`, {
        headers: authHeaders(wallet),
      })
      if (!paymentsResponse.ok) {
        throw new Error("Failed to load payments")
      }

      const paymentsData = await paymentsResponse.json()
      let allPayments = paymentsData.payments || []

      if (wallet) {
        try {
          // Determine chain ID (default to Mainnet if undefined)
          const currentChainId = chainId || "1"

          const response = await fetch(`/api/transactions?address=${wallet}&chainId=${currentChainId}`)
          const data = await response.json()

          if (data.transactions) {
            const externalTxs = data.transactions

            // Merge logic: Create a map of existing tx_hashes to avoid duplicates
            const existingHashes = new Set(allPayments.map((p: any) => p.tx_hash.toLowerCase()))

            const newExternalTxs = externalTxs.filter(
              (tx: any) =>
                !existingHashes.has(tx.tx_hash.toLowerCase()) && tx.from_address.toLowerCase() === wallet.toLowerCase(), // Only show sent txs for now, or remove check to show all
            )

            // Combine and sort
            allPayments = [...allPayments, ...newExternalTxs].sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
            )
          }
        } catch (err) {
          console.error("[Analytics] Failed to fetch external transactions:", err)
          // Continue with just Prisma data if external fetch fails
        }
      }

      // Load batch payments
      // Load batch payments from Prisma-backed API
      const batchesResponse = await fetch(`/api/batch-payment?fromAddress=${wallet}`, {
        headers: authHeaders(wallet),
      })
      if (batchesResponse.ok) {
        const batchesPayload = await batchesResponse.json()
        const mappedBatches = (batchesPayload.batches || []).map((batch: any) => ({
          id: batch.batch_id || batch.id,
          batch_name: batch.memo || batch.batch_id || "Batch Payment",
          total_recipients: batch.total_items ?? 0,
          total_amount_usd: batch.total_amount ?? 0,
          status: batch.status || "pending",
          created_at: batch.created_at,
        }))
        setBatches(mappedBatches)
      } else {
        setBatches([])
      }

      setPayments(allPayments) // Set merged payments

      // Calculate stats
      const totalSent = allPayments.reduce((sum: number, p: any) => sum + (p.amount_usd || 0), 0)
      const totalTransactions = allPayments.length
      const uniqueVendors = new Set(allPayments.filter((p: any) => p.vendor_id).map((p: any) => p.vendor_id)).size
      const avgTransaction = totalTransactions > 0 ? totalSent / totalTransactions : 0

      setStats({
        totalSent,
        totalTransactions,
        totalVendors: uniqueVendors,
        avgTransaction,
      })
    } catch (error) {
      console.error("[Analytics] Failed to load analytics data:", error)
    } finally {
      setLoading(false)
    }
  }

  const filterPayments = () => {
    let filtered = [...payments]

    if (startDate) {
      filtered = filtered.filter((p) => new Date(p.timestamp) >= new Date(startDate))
    }

    if (endDate) {
      const endDateTime = new Date(endDate)
      endDateTime.setHours(23, 59, 59, 999)
      filtered = filtered.filter((p) => new Date(p.timestamp) <= endDateTime)
    }

    setFilteredPayments(filtered)
  }

  const addTag = async () => {
    if (!selectedPayment || !newTag.trim()) return

    try {
      const updatedTags = [...(selectedPayment.tags || []), newTag.trim()]
      const response = await fetch("/api/payments", {
        method: "PATCH",
        headers: authHeaders(wallet, { "Content-Type": "application/json" }),
        body: JSON.stringify({ id: selectedPayment.id, tags: updatedTags }),
      })

      if (!response.ok) throw new Error("Failed to update tags")

      // Update local state
      setPayments(payments.map((p) => (p.id === selectedPayment.id ? { ...p, tags: updatedTags } : p)))

      setSelectedPayment({ ...selectedPayment, tags: updatedTags })
      setNewTag("")
    } catch (error) {
      console.error("[Analytics] Failed to add tag:", error)
      alert("Failed to add tag. Please try again.")
    }
  }

  const removeTag = async (paymentId: string, tagToRemove: string) => {
    try {
      const payment = payments.find((p) => p.id === paymentId)
      if (!payment) return

      const updatedTags = (payment.tags || []).filter((t) => t !== tagToRemove)
      const response = await fetch("/api/payments", {
        method: "PATCH",
        headers: authHeaders(wallet, { "Content-Type": "application/json" }),
        body: JSON.stringify({ id: paymentId, tags: updatedTags }),
      })

      if (!response.ok) throw new Error("Failed to update tags")

      // Update local state
      setPayments(payments.map((p) => (p.id === paymentId ? { ...p, tags: updatedTags } : p)))

      if (selectedPayment?.id === paymentId) {
        setSelectedPayment({ ...selectedPayment, tags: updatedTags })
      }
    } catch (error) {
      console.error("[Analytics] Failed to remove tag:", error)
      alert("Failed to remove tag. Please try again.")
    }
  }

  const clearFilters = () => {
    setStartDate("")
    setEndDate("")
    setDateRange("all")
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getChartData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      return date.toISOString().split("T")[0]
    })

    const dataToUse = filteredPayments.length > 0 ? filteredPayments : payments

    return last7Days.map((date) => {
      const dayPayments = dataToUse.filter((p) => p.timestamp.startsWith(date))
      const total = dayPayments.reduce((sum, p) => sum + (p.amount_usd || 0), 0)
      return {
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        amount: Number.parseFloat(total.toFixed(2)),
      }
    })
  }

  const getTokenDistribution = () => {
    const dataToUse = filteredPayments.length > 0 ? filteredPayments : payments
    const distribution: { [key: string]: number } = {}
    dataToUse.forEach((p) => {
      distribution[p.token_symbol] = (distribution[p.token_symbol] || 0) + (p.amount_usd || 0)
    })
    return Object.entries(distribution).map(([name, value]) => ({
      name,
      value: Number.parseFloat(value.toFixed(2)),
    }))
  }

  const getCategoryData = () => {
    const dataToUse = filteredPayments.length > 0 ? filteredPayments : payments
    return getTopCategories(dataToUse)
  }

  const getTopVendorsData = () => {
    const dataToUse = filteredPayments.length > 0 ? filteredPayments : payments
    const vendorMap: Record<string, number> = {}

    dataToUse.forEach((p) => {
      const name = p.vendor?.name || (p.is_external ? "External" : "Unknown")
      vendorMap[name] = (vendorMap[name] || 0) + (p.amount_usd || 0)
    })

    return Object.entries(vendorMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"]

  // Mock data for Demo Mode
  const demoPayments: Payment[] = Array.from({ length: 15 })
    .map((_, i) => ({
      id: `demo-${i}`,
      tx_hash: `0x${Math.random().toString(16).slice(2)}`,
      to_address: `0x${Math.random().toString(16).slice(2)}`,
      from_address: `0x${Math.random().toString(16).slice(2)}`,
      token_symbol: Math.random() > 0.5 ? "USDT" : "USDC",
      amount: (Math.random() * 5000 + 100).toString(),
      amount_usd: Math.random() * 5000 + 100,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: "completed",
      tags: Math.random() > 0.7 ? ["Tag", "Monthly"] : [],
      vendor: { name: `Test Tag ${i + 1}` },
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const demoStats: Stats = {
    totalSent: 124500.5,
    totalTransactions: 1248,
    totalVendors: 86,
    avgTransaction: 99.76,
  }

  const demoBatches: BatchPayment[] = [
    {
      id: "demo-batch-1",
      batch_name: "January Payroll",
      total_recipients: 42,
      total_amount_usd: 58200,
      status: "completed",
      created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "demo-batch-2",
      batch_name: "Vendor Settlements",
      total_recipients: 18,
      total_amount_usd: 21450,
      status: "processing",
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "demo-batch-3",
      batch_name: "Partner Disbursements",
      total_recipients: 9,
      total_amount_usd: 9800,
      status: "completed",
      created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]

  // Use real data or demo data
  const displayPayments = isDemoMode
    ? demoPayments
    : filteredPayments.length > 0 || startDate || endDate
      ? filteredPayments
      : payments
  const displayStats = isDemoMode ? demoStats : stats
  const showAnalytics = isConnected || isDemoMode

  if (!showAnalytics) {
    return (
      <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <GlassCard className="max-w-md w-full bg-card border-border">
          <GlassCardHeader className="text-center">
            <GlassCardTitle className="text-foreground">Connect Wallet</GlassCardTitle>
            <GlassCardDescription className="text-muted-foreground">
              Please connect your wallet to view analytics
            </GlassCardDescription>
          </GlassCardHeader>
        </GlassCard>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    )
  }

  const exportCSV = () => {
    const headers = ["Date", "Recipient", "Wallet Tag", "Token", "Amount (USD)", "Status", "Tx Hash"]
    const rows = displayPayments.map((p) => [
      formatDate(p.timestamp),
      p.to_address,
      p.vendor?.name || "-",
      p.token_symbol,
      p.amount_usd.toFixed(2),
      p.status,
      p.tx_hash,
    ])

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `protocol-banks-report-${new Date().toISOString().split("T")[0]}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const exportPDF = () => {
    const doc = new jsPDF()

    doc.setFontSize(18)
    doc.text("Protocol Banks - Financial Report", 14, 22)

    doc.setFontSize(11)
    doc.setTextColor(100)
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30)

    // Stats Summary
    doc.text(`Total Sent: $${displayStats.totalSent.toFixed(2)}`, 14, 40)
    doc.text(`Total Transactions: ${displayStats.totalTransactions}`, 14, 46)

    autoTable(doc, {
      startY: 55,
      head: [["Date", "Recipient", "Tag", "Token", "Amount", "Status"]],
      body: displayPayments.map((p) => [
        formatDate(p.timestamp),
        formatAddress(p.to_address),
        p.vendor?.name || "-",
        p.token_symbol,
        `$${p.amount_usd.toFixed(2)}`,
        p.status,
      ]),
      theme: "grid",
      headStyles: { fillColor: [0, 47, 167] }, // Klein Blue
    })

    doc.save(`protocol-banks-report-${new Date().toISOString().split("T")[0]}.pdf`)
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Financial Intelligence</h1>
          <p className="text-muted-foreground">Advanced analytics and network topology analysis</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} className="border-border bg-transparent">
            <TableIcon className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="default"
            onClick={exportPDF}
            className="bg-gradient-to-r from-[#002FA7] to-white text-white shadow-sm hover:opacity-90"
          >
            <FileText className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Network Graph Section */}
      <GlassCard className="bg-black border-border overflow-hidden">
        <PaymentNetworkGraph />
      </GlassCard>

      <div className="grid gap-6 md:grid-cols-2">
        <GlassCard className="bg-card border-border">
          <GlassCardHeader>
            <GlassCardTitle>Spending by Category</GlassCardTitle>
            <GlassCardDescription>Distribution of expenses across business categories</GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getCategoryData()}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {getCategoryData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#111111",
                      border: "1px solid #262626",
                      borderRadius: "8px",
                      color: "#ededed",
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Amount"]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCardContent>
        </GlassCard>

        <GlassCard className="bg-card border-border">
          <GlassCardHeader>
            <GlassCardTitle>Top Vendors</GlassCardTitle>
            <GlassCardDescription>Highest volume suppliers by total payment amount</GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={getTopVendorsData()}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                  <XAxis type="number" stroke="#737373" fontSize={12} tickFormatter={(value) => `$${value / 1000}k`} />
                  <YAxis dataKey="name" type="category" stroke="#737373" fontSize={12} width={100} />
                  <Tooltip
                    cursor={{ fill: "#262626", opacity: 0.5 }}
                    contentStyle={{
                      backgroundColor: "#111111",
                      border: "1px solid #262626",
                      borderRadius: "8px",
                      color: "#ededed",
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Total Paid"]}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCardContent>
        </GlassCard>
      </div>

      <GlassCard className="bg-card border-border">
        <GlassCardHeader>
          <GlassCardTitle className="text-foreground">Filter by Date Range</GlassCardTitle>
          <GlassCardDescription className="text-muted-foreground">
            Select a date range to filter your transactions
          </GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px] space-y-2">
              <label className="text-sm text-muted-foreground">Range</label>
              <Select value={dateRange} onValueChange={handleDateRangeChange}>
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All History</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(dateRange === "custom" || startDate || endDate) && (
              <>
                <div className="flex-1 min-w-[200px] space-y-2">
                  <label className="text-sm text-muted-foreground">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleDateChange("start", e.target.value)}
                    className="bg-background border-border text-foreground"
                  />
                </div>
                <div className="flex-1 min-w-[200px] space-y-2">
                  <label className="text-sm text-muted-foreground">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleDateChange("end", e.target.value)}
                    className="bg-background border-border text-foreground"
                  />
                </div>
              </>
            )}

            <Button onClick={clearFilters} variant="outline" className="border-border bg-transparent">
              Clear Filters
            </Button>
          </div>
          {(startDate || endDate) && (
            <p className="text-sm text-muted-foreground mt-4">
              Showing {displayPayments.length} of {payments.length} transactions
            </p>
          )}
        </GlassCardContent>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="bg-card border-border">
          <GlassCardHeader className="flex flex-row items-center justify-between pb-2">
            <GlassCardTitle className="text-sm font-medium text-muted-foreground">Total Sent</GlassCardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </GlassCardHeader>
          <GlassCardContent>
            <div className="text-2xl font-bold text-foreground font-mono">
              $
              {displayStats.totalSent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Lifetime payments</p>
          </GlassCardContent>
        </GlassCard>

        <GlassCard className="bg-card border-border">
          <GlassCardHeader className="flex flex-row items-center justify-between pb-2">
            <GlassCardTitle className="text-sm font-medium text-muted-foreground">Transactions</GlassCardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </GlassCardHeader>
          <GlassCardContent>
            <div className="text-2xl font-bold text-foreground">{displayStats.totalTransactions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Total payments made</p>
          </GlassCardContent>
        </GlassCard>

        <GlassCard className="bg-card border-border">
          <GlassCardHeader className="flex flex-row items-center justify-between pb-2">
            <GlassCardTitle className="text-sm font-medium text-muted-foreground">Wallet Tags</GlassCardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </GlassCardHeader>
          <GlassCardContent>
            <div className="text-2xl font-bold text-foreground">{displayStats.totalVendors.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Unique tags used</p>
          </GlassCardContent>
        </GlassCard>

        <GlassCard className="bg-card border-border">
          <GlassCardHeader className="flex flex-row items-center justify-between pb-2">
            <GlassCardTitle className="text-sm font-medium text-muted-foreground">Avg Transaction</GlassCardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </GlassCardHeader>
          <GlassCardContent>
            <div className="text-2xl font-bold text-foreground font-mono">
              $
              {displayStats.avgTransaction.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per payment</p>
          </GlassCardContent>
        </GlassCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="bg-card border-border">
          <GlassCardHeader>
            <GlassCardTitle className="text-foreground">Payment Trend (Last 7 Days)</GlassCardTitle>
            <GlassCardDescription className="text-muted-foreground">Daily payment volume</GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getChartData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="date" stroke="#737373" />
                <YAxis stroke="#737373" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111111",
                    border: "1px solid #262626",
                    borderRadius: "8px",
                    color: "#ededed",
                  }}
                />
                <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </GlassCardContent>
        </GlassCard>

        <GlassCard className="bg-card border-border">
          <GlassCardHeader>
            <GlassCardTitle className="text-foreground">Token Distribution</GlassCardTitle>
            <GlassCardDescription className="text-muted-foreground">Payment breakdown by token</GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getTokenDistribution()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getTokenDistribution().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111111",
                    border: "1px solid #262626",
                    borderRadius: "8px",
                    color: "#ededed",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </GlassCardContent>
        </GlassCard>
      </div>

      <Tabs defaultValue="payments" className="space-y-4">
        <TabsList className="bg-secondary border-border">
          <TabsTrigger value="payments">Payment History</TabsTrigger>
          <TabsTrigger value="batches">Batch Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <GlassCard className="bg-card border-border">
            <GlassCardHeader>
              <GlassCardTitle className="text-foreground">Recent Payments</GlassCardTitle>
              <GlassCardDescription className="text-muted-foreground">
                {isDemoMode
                  ? "Showing test transaction data"
                  : displayPayments.length === payments.length
                    ? `Your last ${displayPayments.length} transactions`
                    : `Showing ${displayPayments.length} filtered transactions`}
              </GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="rounded-lg border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                      <TableHead className="text-foreground whitespace-nowrap">Date</TableHead>
                      <TableHead className="text-foreground whitespace-nowrap">Recipient</TableHead>
                      <TableHead className="text-foreground whitespace-nowrap">Wallet Tag</TableHead>
                      <TableHead className="text-foreground whitespace-nowrap">Token</TableHead>
                      <TableHead className="text-foreground text-right whitespace-nowrap">Amount</TableHead>
                      <TableHead className="text-foreground whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-foreground whitespace-nowrap">Tags</TableHead>
                      <TableHead className="text-foreground whitespace-nowrap">Tx Hash</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          {startDate || endDate
                            ? "No payments found in the selected date range."
                            : "No payments yet. Create your first batch payment to get started."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayPayments.map((payment) => (
                        <TableRow key={payment.id} className="border-border">
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {formatDate(payment.timestamp)}
                          </TableCell>
                          <TableCell className="font-mono text-foreground whitespace-nowrap">
                            {formatAddress(payment.to_address)}
                          </TableCell>
                          <TableCell className="text-foreground whitespace-nowrap">
                            {payment.vendor?.name || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{payment.token_symbol}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-foreground whitespace-nowrap">
                            ${payment.amount_usd.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={payment.status === "completed" ? "default" : "secondary"}
                              className={payment.status === "completed" ? "bg-green-500/10 text-green-500" : ""}
                            >
                              {payment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 items-center min-w-[150px]">
                              {payment.tags?.map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-xs border-primary/50 text-primary group cursor-pointer"
                                  onClick={() => !isDemoMode && removeTag(payment.id, tag)}
                                >
                                  {tag}
                                  {!isDemoMode && (
                                    <X className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  )}
                                </Badge>
                              ))}
                              {!isDemoMode && (
                                <Dialog
                                  open={isTagDialogOpen && selectedPayment?.id === payment.id}
                                  onOpenChange={(open) => {
                                    setIsTagDialogOpen(open)
                                    if (open) setSelectedPayment(payment)
                                    else setSelectedPayment(null)
                                  }}
                                >
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => setSelectedPayment(payment)}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="bg-card border-border">
                                    <DialogHeader>
                                      <DialogTitle className="text-foreground">Add Tag</DialogTitle>
                                      <DialogDescription className="text-muted-foreground">
                                        Add a custom tag to categorize this payment
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="flex gap-2">
                                        <Input
                                          placeholder="Enter tag name..."
                                          value={newTag}
                                          onChange={(e) => setNewTag(e.target.value)}
                                          onKeyPress={(e) => e.key === "Enter" && addTag()}
                                          className="bg-background border-border text-foreground"
                                        />
                                        <Button onClick={addTag}>
                                          <Plus className="h-4 w-4 mr-2" />
                                          Add
                                        </Button>
                                      </div>
                                      {selectedPayment?.tags && selectedPayment.tags.length > 0 && (
                                        <div className="space-y-2">
                                          <p className="text-sm text-muted-foreground">Current tags:</p>
                                          <div className="flex flex-wrap gap-2">
                                            {selectedPayment.tags.map((tag) => (
                                              <Badge
                                                key={tag}
                                                variant="outline"
                                                className="border-primary/50 text-primary group cursor-pointer"
                                                onClick={() => removeTag(selectedPayment.id, tag)}
                                              >
                                                {tag}
                                                <X className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                              </Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-primary whitespace-nowrap">
                            {payment.tx_hash ? (
                              <a
                                href={`https://etherscan.io/tx/${payment.tx_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                {formatAddress(payment.tx_hash)}
                              </a>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </GlassCardContent>
          </GlassCard>
        </TabsContent>

        <TabsContent value="batches">
          <GlassCard className="bg-card border-border">
            <GlassCardHeader>
              <GlassCardTitle className="text-foreground">Batch Payment History</GlassCardTitle>
              <GlassCardDescription className="text-muted-foreground">Your batch payment records</GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="rounded-lg border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                      <TableHead className="text-foreground whitespace-nowrap">Date</TableHead>
                      <TableHead className="text-foreground whitespace-nowrap">Batch Name</TableHead>
                      <TableHead className="text-foreground text-right whitespace-nowrap">Recipients</TableHead>
                      <TableHead className="text-foreground text-right whitespace-nowrap">Total Amount</TableHead>
                      <TableHead className="text-foreground whitespace-nowrap">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No batch payments yet. Create your first batch to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      batches.map((batch) => (
                        <TableRow key={batch.id} className="border-border">
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {formatDate(batch.created_at)}
                          </TableCell>
                          <TableCell className="text-foreground whitespace-nowrap">{batch.batch_name}</TableCell>
                          <TableCell className="text-right text-foreground whitespace-nowrap">
                            {batch.total_recipients}
                          </TableCell>
                          <TableCell className="text-right font-mono text-foreground whitespace-nowrap">
                            ${batch.total_amount_usd?.toFixed(2) || "0.00"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={batch.status === "completed" ? "default" : "secondary"}
                              className={batch.status === "completed" ? "bg-green-500/10 text-green-500" : ""}
                            >
                              {batch.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </GlassCardContent>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  )
}
