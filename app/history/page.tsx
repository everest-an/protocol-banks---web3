"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Download, ArrowUpRight, ArrowDownLeft, ExternalLink, Calendar } from "lucide-react"
import { useWeb3 } from "@/contexts/web3-context"
import { getSupabase } from "@/lib/supabase"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import type { Transaction } from "@/types"
import { FinancialReport } from "@/components/financial-report"
import { BusinessMetrics } from "@/components/business-metrics"
import { PaymentActivity } from "@/components/payment-activity"

export default function HistoryPage() {
  const { isConnected, wallet, chainId } = useWeb3()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")

  useEffect(() => {
    if (isConnected && wallet) {
      loadTransactions()
    } else {
      setLoading(false)
    }
  }, [isConnected, wallet])

  const loadTransactions = async () => {
    try {
      if (!wallet) return

      const response = await fetch(`/api/payments?wallet=${wallet}&type=all`)
      if (!response.ok) {
        throw new Error("Failed to fetch payments")
      }
      
      const data = await response.json()
      const payments = data.payments || []

      // Determine 'sent' or 'received' based on wallet address if not explicit
      // The API returns all relevant payments. We just need to ensure the `type` property is correct for the UI.
      const processed = payments.map((p: any) => {
        // If from_address matches wallet, it's sent. Otherwise received.
        const derivedType = p.from_address?.toLowerCase() === wallet.toLowerCase() ? 'sent' : 'received'
        return {
          ...p,
          type: derivedType,
          // Ensure timestamp is available fallback to created_at
          timestamp: p.timestamp || p.created_at
        }
      })

      setTransactions(processed as Transaction[])
    } catch (error) {
      console.error("Failed to load transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      tx.to_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.from_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.tx_hash || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.notes && tx.notes.toLowerCase().includes(searchQuery.toLowerCase()))

    if (activeTab === "all") return matchesSearch
    if (activeTab === "sent") return matchesSearch && tx.type === "sent"
    if (activeTab === "received") return matchesSearch && tx.type === "received"
    return matchesSearch
  })

  const exportToCSV = () => {
    const headers = ["Date", "Type", "Amount", "Token", "From", "To", "Status", "TX Hash"]
    const rows = filteredTransactions.map((tx) => [
      new Date(tx.timestamp || tx.created_at).toLocaleDateString(),
      tx.type,
      tx.amount,
      tx.token_symbol || tx.token,
      tx.from_address,
      tx.to_address,
      tx.status,
      tx.tx_hash || '',
    ])

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const getExplorerUrl = (txHash: string) => {
    const explorers: Record<string, string> = {
      "1": "https://etherscan.io/tx/",
      "137": "https://polygonscan.com/tx/",
      "8453": "https://basescan.org/tx/",
      "42161": "https://arbiscan.io/tx/",
    }
    return `${explorers[chainId || "1"] || explorers["1"]}${txHash}`
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Transaction History</h1>
          <p className="text-muted-foreground">View all your payments and receipts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Link href="/analytics">
            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
              <Calendar className="h-4 w-4" />
              Reports
            </Button>
          </Link>
        </div>
      </div>

      {!isConnected ? (
        <Alert className="bg-primary/5 border-primary/20">
          <AlertDescription>Connect your wallet to view your transaction history</AlertDescription>
        </Alert>
      ) : (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-secondary/50">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="sent">Sent</TabsTrigger>
                  <TabsTrigger value="received">Received</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-64 bg-secondary/50 border-border"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading transactions...</div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No transactions found</p>
                <Link href="/send">
                  <Button>Make Your First Payment</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          tx.type === "sent" ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
                        }`}
                      >
                        {tx.type === "sent" ? (
                          <ArrowUpRight className="h-5 w-5" />
                        ) : (
                          <ArrowDownLeft className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">
                          {tx.type === "sent" ? "Sent" : "Received"} {tx.token_symbol || tx.token}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {tx.type === "sent"
                            ? `To: ${tx.to_address.slice(0, 6)}...${tx.to_address.slice(-4)}`
                            : `From: ${tx.from_address.slice(0, 6)}...${tx.from_address.slice(-4)}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.timestamp || tx.created_at).toLocaleDateString()} {new Date(tx.timestamp || tx.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div
                          className={`font-mono font-medium ${tx.type === "sent" ? "text-red-500" : "text-green-500"}`}
                        >
                          {tx.type === "sent" ? "-" : "+"}
                          {tx.amount} {tx.token_symbol || tx.token}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ${((tx.amount_usd ?? Number.parseFloat(String(tx.amount))) || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={
                            tx.status === "completed"
                              ? "bg-green-500/10 text-green-500"
                              : "bg-yellow-500/10 text-yellow-500"
                          }
                        >
                          {tx.status}
                        </Badge>
                        <a
                          href={getExplorerUrl(tx.tx_hash || '')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Business Metrics Card - displays key financial metrics */}
      <BusinessMetrics
        payments={transactions.map((tx) => ({
          ...tx,
          amount_usd: tx.amount_usd != null ? tx.amount_usd : (Number.parseFloat(String(tx.amount)) || 0),
          timestamp: tx.timestamp || tx.created_at,
        }))}
        loading={loading}
      />

      {/* Payment Activity Feed Card - shows recent payment activity */}
      <PaymentActivity
        payments={transactions.map((tx) => ({
          ...tx,
          amount_usd: tx.amount_usd != null ? tx.amount_usd : (Number.parseFloat(String(tx.amount)) || 0),
          timestamp: tx.timestamp || tx.created_at,
        }))}
        walletAddress={wallet || undefined}
        loading={loading}
        title="Recent Activity"
        description="Your most recent transactions"
      />

      {/* Financial Report Table Card - detailed transaction report */}
      <FinancialReport
        payments={transactions.map((tx) => ({
          ...tx,
          amount_usd: tx.amount_usd != null ? tx.amount_usd : (Number.parseFloat(String(tx.amount)) || 0),
          timestamp: tx.timestamp || tx.created_at,
        }))}
        loading={loading}
      />
    </main>
  )
}
