"use client"

import { useEffect, useState, useCallback } from "react"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle, GlassCardDescription } from "@/components/ui/glass-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Download, ArrowUpRight, ArrowDownLeft, ExternalLink, Calendar, Filter, ChevronDown, ChevronRight, Layers, FolderOpen, ArrowLeft, ArrowRightLeft, RefreshCw as RefreshCwIcon } from "lucide-react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { authHeaders } from "@/lib/authenticated-fetch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useDemo } from "@/contexts/demo-context"
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

// Demo transaction data for preview when no wallet is connected
const DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: "demo-tx-1",
    type: "sent",
    amount: "500",
    token: "USDC",
    token_symbol: "USDC",
    chain: "ethereum",
    from_address: "0xYourWallet...d3F8",
    to_address: "0xAlice9a2B...7c4E",
    tx_hash: "0xdemo1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef12345678",
    status: "completed",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    notes: "Batch payment - Team payroll",
    amount_usd: 500,
  },
  {
    id: "demo-tx-2",
    type: "received",
    amount: "1200",
    token: "USDC",
    token_symbol: "USDC",
    chain: "ethereum",
    from_address: "0xClient4e7F...b12A",
    to_address: "0xYourWallet...d3F8",
    tx_hash: "0xdemo2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef12345679",
    status: "completed",
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    notes: "Invoice #1042 payment",
    amount_usd: 1200,
  },
  {
    id: "demo-tx-3",
    type: "sent",
    amount: "15.99",
    token: "USDC",
    token_symbol: "USDC",
    chain: "polygon",
    from_address: "0xYourWallet...d3F8",
    to_address: "0xNetflix8cD...e93B",
    tx_hash: "0xdemo3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567a",
    status: "completed",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    notes: "Subscription - Netflix",
    amount_usd: 15.99,
  },
  {
    id: "demo-tx-4",
    type: "sent",
    amount: "2500",
    token: "USDC",
    token_symbol: "USDC",
    chain: "arbitrum",
    from_address: "0xYourWallet...d3F8",
    to_address: "0xAWS5fA1c2...4d7E",
    tx_hash: "0xdemo4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567b",
    status: "completed",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "Auto pay - AWS Infrastructure",
    amount_usd: 2500,
  },
  {
    id: "demo-tx-5",
    type: "received",
    amount: "50",
    token: "USDC",
    token_symbol: "USDC",
    chain: "base",
    from_address: "0xBob3eC7a1...f28D",
    to_address: "0xYourWallet...d3F8",
    tx_hash: "0xdemo5e6f7890abcdef1234567890abcdef1234567890abcdef1234567c",
    status: "completed",
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "Payment link - Coffee reimbursement",
    amount_usd: 50,
  },
]

export default function HistoryPage() {
  const { isConnected, address: wallet, chainId } = useUnifiedWallet()
  const { isDemoMode } = useDemo()
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

  // Cross-chain tab state
  interface CrossChainTx {
    id: string
    type: string
    provider: string
    state: string
    source_chain: string
    source_token: string
    source_amount: string
    dest_chain: string
    dest_token: string
    dest_amount: string | null
    source_tx_hash: string | null
    dest_tx_hash: string | null
    created_at: string
    updated_at: string
  }
  const [crossChainTxs, setCrossChainTxs] = useState<CrossChainTx[]>([])
  const [crossChainLoading, setCrossChainLoading] = useState(false)

  const loadGroups = useCallback(async () => {
    if (!wallet) return
    setGroupsLoading(true)
    try {
      const res = await fetch(`/api/payment-groups?owner=${wallet}`, {
        headers: authHeaders(wallet),
      })
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
      const res = await fetch(`/api/payment-groups/${groupId}`, {
        headers: authHeaders(wallet),
      })
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

  const loadCrossChain = useCallback(async () => {
    if (!wallet) return
    setCrossChainLoading(true)
    try {
      const res = await fetch(`/api/cross-chain?limit=50`, {
        headers: authHeaders(wallet),
      })
      if (res.ok) {
        const data = await res.json()
        setCrossChainTxs(data.transactions || [])
      }
    } catch {
      // silently fail
    } finally {
      setCrossChainLoading(false)
    }
  }, [wallet])

  // Determine if we should show demo data (demo mode or no wallet connected)
  const showDemoData = isDemoMode || !isConnected

  useEffect(() => {
    if (isConnected && wallet && !isDemoMode) {
      loadTransactions()
    } else if (showDemoData) {
      setTransactions(DEMO_TRANSACTIONS)
      setLoading(false)
    } else {
      setLoading(false)
    }
  }, [isConnected, wallet, isDemoMode, showDemoData])

  useEffect(() => {
    if (activeTab === "groups" && isConnected && wallet && !isDemoMode) {
      loadGroups()
    }
    if (activeTab === "cross-chain" && isConnected && wallet && !isDemoMode) {
      loadCrossChain()
    }
  }, [activeTab, isConnected, wallet, loadGroups, loadCrossChain, isDemoMode])

  const loadTransactions = async () => {
    try {
      if (!wallet) return

      const response = await fetch(`/api/payments?wallet=${wallet}&type=all`, {
        headers: authHeaders(wallet),
      })
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
    <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 max-w-5xl pb-24 md:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Transaction History</h1>
          <p className="text-sm sm:text-base text-muted-foreground">View all your payments and receipts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2 bg-transparent">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Link href="/analytics">
            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
              <Calendar className="h-4 w-4" />
              Reports
            </Button>
          </Link>
        </div>
      </div>

      {showDemoData && (
        <Alert className="bg-primary/5 border-primary/20 mb-4">
          <AlertDescription className="flex items-center justify-between">
            <span>
              {!isConnected
                ? "Showing preview data. Connect your wallet to view your real transaction history."
                : "Showing preview data. Disable demo mode to view your real transactions."}
            </span>
            <Badge variant="outline" className="ml-2 shrink-0 border-primary/30 text-primary">
              Preview
            </Badge>
          </AlertDescription>
        </Alert>
      )}

      {(!isConnected && !showDemoData) ? (
        <Alert className="bg-primary/5 border-primary/20">
          <AlertDescription>Connect your wallet to view your transaction history</AlertDescription>
        </Alert>
      ) : (
        <GlassCard className="bg-card border-border">
          <GlassCardHeader>
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="bg-secondary/50 w-full sm:w-auto">
                    <TabsTrigger value="all" className="text-xs sm:text-sm">All</TabsTrigger>
                    <TabsTrigger value="sent" className="text-xs sm:text-sm">Sent</TabsTrigger>
                    <TabsTrigger value="received" className="text-xs sm:text-sm">Received</TabsTrigger>
                    <TabsTrigger value="groups" className="text-xs sm:text-sm">Groups</TabsTrigger>
                    <TabsTrigger value="cross-chain" className="text-xs sm:text-sm">Cross-Chain</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="flex gap-2">
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-full sm:w-48 bg-secondary/50 border-border"
                    />
                  </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 sm:gap-2 bg-secondary/50 border-border shrink-0 h-9">
                    <Filter className="h-4 w-4" />
                    <span className="hidden sm:inline">{filterType === "all" ? "All Types" : filterType === "batch" ? "Batch" : "Individual"}</span>
                    <ChevronDown className="h-3 w-3 opacity-50" />
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
              </div>
            </div>
          </GlassCardHeader>
          <GlassCardContent>
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
                  <GlassCard className="border-border">
                    <GlassCardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <GlassCardTitle className="text-lg">{selectedGroup.name}</GlassCardTitle>
                          {selectedGroup.description && (
                            <GlassCardDescription>{selectedGroup.description}</GlassCardDescription>
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
                    </GlassCardHeader>
                    <GlassCardContent>
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
                    </GlassCardContent>
                  </GlassCard>
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
                    <GlassCard
                      key={group.id}
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => loadGroupDetails(group.id)}
                    >
                      <GlassCardContent className="pt-4 pb-4">
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
                      </GlassCardContent>
                    </GlassCard>
                  ))}
                </div>
              )
            ) : activeTab === "cross-chain" ? (
              crossChainLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading cross-chain transactions...</div>
              ) : crossChainTxs.length === 0 ? (
                <div className="text-center py-12">
                  <ArrowRightLeft className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">No cross-chain transactions yet</p>
                  <p className="text-sm text-muted-foreground">Use Bridge or Swap to create cross-chain transactions.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {crossChainTxs.map((ctx) => {
                    const stateColors: Record<string, string> = {
                      initiated: "bg-yellow-500/10 text-yellow-500",
                      source_pending: "bg-yellow-500/10 text-yellow-500",
                      source_confirmed: "bg-blue-500/10 text-blue-500",
                      bridging: "bg-purple-500/10 text-purple-500",
                      dest_pending: "bg-blue-500/10 text-blue-500",
                      completed: "bg-green-500/10 text-green-500",
                      failed: "bg-red-500/10 text-red-500",
                      refunded: "bg-gray-500/10 text-gray-500",
                    }
                    return (
                      <div key={ctx.id} className="flex items-center justify-between p-3 sm:p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors gap-2 sm:gap-4">
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                            <ArrowRightLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-sm sm:text-base truncate">
                              {ctx.source_chain} → {ctx.dest_chain}
                            </div>
                            <div className="text-xs sm:text-sm text-muted-foreground truncate">
                              {ctx.source_amount} {ctx.source_token} → {ctx.dest_amount || "..."} {ctx.dest_token}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(ctx.created_at).toLocaleDateString()}{" "}
                              <span className="hidden sm:inline">{new Date(ctx.created_at).toLocaleTimeString()}</span>
                              {" · "}{ctx.provider}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                          <Badge variant="secondary" className={`text-xs ${stateColors[ctx.state] || ""}`}>
                            {ctx.state.replace(/_/g, " ")}
                          </Badge>
                          {(ctx.source_tx_hash || ctx.dest_tx_hash) && (
                            <a
                              href={getExplorerUrl(ctx.dest_tx_hash || ctx.source_tx_hash || "")}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
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
                            className="flex items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-secondary/40 transition-colors"
                            onClick={() => toggleBatch(item.tx_hash)}
                         >
                            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                                <Layers className="h-4 w-4 sm:h-5 sm:w-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium flex items-center gap-2 flex-wrap">
                                  <span className="text-sm sm:text-base">Batch Payment</span>
                                  <Badge variant="secondary" className="text-xs">{item.count} recipients</Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-6 shrink-0 ml-2">
                              <div className="text-right">
                                <div className="font-mono font-medium text-foreground text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">
                                  {item.amount} {item.token}
                                </div>
                                <div className="text-xs text-muted-foreground hidden sm:block">Total sent</div>
                              </div>
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </div>
                         </div>
                         
                         {isExpanded && (
                           <div className="border-t border-border/50 bg-secondary/10">
                              {item.transactions.map((tx: Transaction) => (
                                <div key={tx.id} className="flex items-center justify-between p-2 sm:p-3 pl-10 sm:pl-16 hover:bg-secondary/20 transition-colors border-b last:border-0 border-border/30">
                                   <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                      <div className={`h-6 w-6 sm:h-8 sm:w-8 rounded-full flex items-center justify-center shrink-0 ${
                                          tx.type === "sent" ? "bg-red-500/5 text-red-500" : "bg-green-500/5 text-green-500"
                                      }`}>
                                        {tx.type === "sent" ? <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4" /> : <ArrowDownLeft className="h-3 w-3 sm:h-4 sm:w-4" />}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-xs sm:text-sm font-medium truncate">To: {tx.to_address.slice(0, 6)}...{tx.to_address.slice(-4)}</div>
                                      </div>
                                   </div>
                                   <div className="flex items-center gap-2 sm:gap-3 pr-2 sm:pr-4 shrink-0">
                                      <div className="text-right">
                                         <div className="text-xs sm:text-sm font-mono">{tx.amount} {tx.token_symbol || tx.token}</div>
                                      </div>
                                      <a
                                        href={getExplorerUrl(tx.tx_hash || '')}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-muted-foreground hover:text-foreground hidden sm:block"
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
                    className="flex items-center justify-between p-3 sm:p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors gap-2 sm:gap-4"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div
                        className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center shrink-0 ${
                          tx.type === "sent" ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
                        }`}
                      >
                        {tx.type === "sent" ? (
                          <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm sm:text-base truncate">
                          {tx.type === "sent" ? "Sent" : "Received"} {tx.token_symbol || tx.token}
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground truncate">
                          {tx.type === "sent"
                            ? `To: ${tx.to_address.slice(0, 6)}...${tx.to_address.slice(-4)}`
                            : `From: ${tx.from_address.slice(0, 6)}...${tx.from_address.slice(-4)}`}
                        </div>
                        {tx.notes && (
                          <div className="text-xs text-muted-foreground/70 mt-0.5 truncate max-w-[200px] sm:max-w-none">
                            {tx.notes}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.timestamp || tx.created_at).toLocaleDateString()} <span className="hidden sm:inline">{new Date(tx.timestamp || tx.created_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                      <div className="text-right">
                        <div
                          className={`font-mono font-medium text-sm sm:text-base ${tx.type === "sent" ? "text-red-500" : "text-green-500"}`}
                        >
                          {tx.type === "sent" ? "-" : "+"}
                          {tx.amount} <span className="hidden sm:inline">{tx.token_symbol || tx.token}</span>
                        </div>
                        <div className="text-xs text-muted-foreground hidden sm:block">
                          ${((tx.amount_usd ?? Number.parseFloat(String(tx.amount))) || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${
                            tx.status === "completed"
                              ? "bg-green-500/10 text-green-500"
                              : "bg-yellow-500/10 text-yellow-500"
                          }`}
                        >
                          {tx.status}
                        </Badge>
                        <a
                          href={getExplorerUrl(tx.tx_hash || '')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </GlassCardContent>
        </GlassCard>
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
        walletAddress={wallet || (showDemoData ? "0xYourWallet...d3F8" : undefined)}
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
