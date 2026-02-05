"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Download, ArrowUpRight, ArrowDownLeft, ExternalLink, Calendar, Filter, ChevronDown, ChevronRight, Layers, FolderOpen, ArrowLeft } from "lucide-react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { getSupabase } from "@/lib/supabase"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import type { Transaction } from "@/types"
import type { PaymentGroup } from "@/types/payment"
import { FinancialReport } from "@/components/financial-report"
import { BusinessMetrics } from "@/components/business-metrics"
import { PaymentActivity } from "@/components/payment-activity"
import { PURPOSE_COLORS } from "@/lib/payment-constants"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function HistoryPage() {
  const { isConnected, address: wallet, chainId } = useUnifiedWallet()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [filterType, setFilterType] = useState<"all" | "batch" | "individual">("all")
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set())

  // Groups tab state
  const [groups, setGroups] = useState<PaymentGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<(PaymentGroup & { payments?: any[] }) | null>(null)
  const [groupPaymentsLoading, setGroupPaymentsLoading] = useState(false)

  const loadGroups = useCallback(async () => {
    if (!wallet) return
    setGroupsLoading(true)
    try {
      const res = await fetch(`/api/payment-groups?owner=${wallet}`)
      if (res.ok) {
        const data = await res.json()
        setGroups(data.groups || [])
      }
    } catch {
      // silently fail
    } finally {
      setGroupsLoading(false)
    }
  }, [wallet])

  const loadGroupDetails = useCallback(async (groupId: string) => {
    setGroupPaymentsLoading(true)
    try {
      const res = await fetch(`/api/payment-groups/${groupId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedGroup(data.group)
      }
    } catch {
      // silently fail
    } finally {
      setGroupPaymentsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isConnected && wallet) {
      loadTransactions()
    } else {
      setLoading(false)
    }
  }, [isConnected, wallet])

  useEffect(() => {
    if (activeTab === "groups" && isConnected && wallet) {
      loadGroups()
    }
  }, [activeTab, isConnected, wallet, loadGroups])

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

  const toggleBatch = (txHash: string) => {
    const newExpanded = new Set(expandedBatches)
    if (newExpanded.has(txHash)) {
      newExpanded.delete(txHash)
    } else {
      newExpanded.add(txHash)
    }
    setExpandedBatches(newExpanded)
  }

  // Process transactions to identify batches
  const processedItems = transactions.reduce((acc: any[], tx) => {
    // We'll organize logic in filteredTransactions instead
    return acc
  }, [])

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      tx.to_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.from_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.tx_hash || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.notes && tx.notes.toLowerCase().includes(searchQuery.toLowerCase()))

    let matchesTab = true
    if (activeTab === "sent") matchesTab = tx.type === "sent"
    if (activeTab === "received") matchesTab = tx.type === "received"

    return matchesSearch && matchesTab
  })

  // Group transactions for display
  const displayItems = (() => {
    const groups: Record<string, Transaction[]> = {}
    
    // First pass: identify groups by hash
    filteredTransactions.forEach(tx => {
      if (tx.tx_hash) {
        if (!groups[tx.tx_hash]) groups[tx.tx_hash] = []
        groups[tx.tx_hash].push(tx)
      }
    })

    const items: any[] = []
    const processedHashes = new Set<string>()

    filteredTransactions.forEach(tx => {
      if (tx.tx_hash && groups[tx.tx_hash].length > 1) {
        if (!processedHashes.has(tx.tx_hash)) {
          // It's a batch
          const batchTxs = groups[tx.tx_hash]
          const isBatch = true
          
          if (filterType === "all" || filterType === "batch") {
            items.push({
              isBatch: true,
              id: `batch-${tx.tx_hash}`,
              tx_hash: tx.tx_hash,
              timestamp: tx.timestamp || tx.created_at,
              transactions: batchTxs,
              amount: batchTxs.reduce((sum, t) => sum + Number(t.amount), 0),
              token: batchTxs[0].token_symbol || batchTxs[0].token,
              token_symbol: batchTxs[0].token_symbol,
              count: batchTxs.length,
              type: tx.type, // Usually sent
              status: tx.status
            })
          }
          processedHashes.add(tx.tx_hash)
        }
      } else {
        // Individual
        if (filterType === "all" || filterType === "individual") {
          items.push({
            ...tx,
            isBatch: false
          })
        }
      }
    })

    return items
  })()

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
                  <TabsTrigger value="groups">Groups</TabsTrigger>
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
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 bg-secondary/50 border-border">
                    <Filter className="h-4 w-4" />
                    {filterType === "all" ? "All Types" : filterType === "batch" ? "Batch Payments" : "Individual"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setFilterType("all")}>
                    All Types
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType("batch")}>
                    Batch Payments
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType("individual")}>
                    Individual Only
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            {/* Groups Tab Content */}
            {activeTab === "groups" ? (
              groupsLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading groups...</div>
              ) : selectedGroup ? (
                <div className="space-y-4">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedGroup(null)}>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back to Groups
                  </Button>
                  <Card className="border-border">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{selectedGroup.name}</CardTitle>
                          {selectedGroup.description && (
                            <CardDescription>{selectedGroup.description}</CardDescription>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedGroup.purpose && (
                            <Badge variant="outline" className={PURPOSE_COLORS[selectedGroup.purpose] || ""}>
                              {selectedGroup.purpose}
                            </Badge>
                          )}
                          <Badge variant="secondary">
                            {selectedGroup.payment_count} payments
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {groupPaymentsLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Loading payments...</div>
                      ) : selectedGroup.payments && selectedGroup.payments.length > 0 ? (
                        <div className="space-y-2">
                          {selectedGroup.payments.map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
                                  <ArrowUpRight className="h-4 w-4" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium">
                                    To: {p.to_address?.slice(0, 6)}...{p.to_address?.slice(-4)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(p.created_at).toLocaleDateString()}
                                    {p.memo && ` · ${p.memo}`}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-mono font-medium">{p.amount} {p.token_symbol || p.token}</div>
                                <Badge variant="secondary" className={`text-xs ${p.status === "completed" ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"}`}>
                                  {p.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">No payments in this group</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : groups.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">No payment groups yet</p>
                  <p className="text-sm text-muted-foreground">Create a group when sending or batch payments to organize your transactions.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {groups.map((group) => (
                    <Card
                      key={group.id}
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => loadGroupDetails(group.id)}
                    >
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="font-medium">{group.name}</div>
                          {group.purpose && (
                            <Badge variant="outline" className={`text-xs ${PURPOSE_COLORS[group.purpose] || ""}`}>
                              {group.purpose}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{group.payment_count} payments</span>
                          <span>·</span>
                          <span>${Number(group.total_amount).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span>{new Date(group.created_at).toLocaleDateString()}</span>
                          <Badge variant="outline" className="text-xs">
                            {group.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            ) : loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading transactions...</div>
            ) : displayItems.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No transactions found</p>
                <Link href="/send">
                  <Button>Make Your First Payment</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {displayItems.map((item) => {
                  if (item.isBatch) {
                    const isExpanded = expandedBatches.has(item.tx_hash);
                    return (
                      <div key={item.id} className="border border-border/50 rounded-lg overflow-hidden bg-secondary/20">
                         <div 
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/40 transition-colors"
                            onClick={() => toggleBatch(item.tx_hash)}
                         >
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                <Layers className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="font-medium flex items-center gap-2">
                                  Batch Payment
                                  <Badge variant="secondary" className="text-xs">{item.count} recipients</Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <div className="font-mono font-medium text-foreground">
                                  {item.amount} {item.token}
                                </div>
                                <div className="text-xs text-muted-foreground">Total sent</div>
                              </div>
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </div>
                         </div>
                         
                         {isExpanded && (
                           <div className="border-t border-border/50 bg-secondary/10">
                              {item.transactions.map((tx: Transaction) => (
                                <div key={tx.id} className="flex items-center justify-between p-3 pl-16 hover:bg-secondary/20 transition-colors border-b last:border-0 border-border/30">
                                   <div className="flex items-center gap-3">
                                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                          tx.type === "sent" ? "bg-red-500/5 text-red-500" : "bg-green-500/5 text-green-500"
                                      }`}>
                                        {tx.type === "sent" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                                      </div>
                                      <div>
                                        <div className="text-sm font-medium">To: {tx.to_address.slice(0, 6)}...{tx.to_address.slice(-4)}</div>
                                      </div>
                                   </div>
                                   <div className="flex items-center gap-3 pr-4">
                                      <div className="text-right">
                                         <div className="text-sm font-mono">{tx.amount} {tx.token_symbol || tx.token}</div>
                                      </div>
                                      <a
                                        href={getExplorerUrl(tx.tx_hash || '')}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-muted-foreground hover:text-foreground"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                   </div>
                                </div>
                              ))}
                           </div>
                         )}
                      </div>
                    )
                  }
                
                  // Regular Item
                  const tx = item;
                  return (
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
                )})}
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
