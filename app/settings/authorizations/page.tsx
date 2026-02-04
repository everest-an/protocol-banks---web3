"use client"

import { useState, useEffect } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  FileCheck,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
  Search,
  RefreshCw,
  Shield,
  Timer
} from "lucide-react"

interface Authorization {
  id: string
  transfer_id: string
  from_address: string
  to_address: string
  amount: string
  token: string
  chain_id: number
  status: "pending" | "signed" | "executed" | "expired" | "cancelled"
  valid_after: string
  valid_before: string
  tx_hash: string | null
  created_at: string
  executed_at: string | null
}

// Demo data
const demoAuthorizations: Authorization[] = [
  {
    id: "auth_1",
    transfer_id: "x402_1706745600_abc123",
    from_address: "0x1234...5678",
    to_address: "0xabcd...efgh",
    amount: "50.00",
    token: "USDC",
    chain_id: 8453,
    status: "executed",
    valid_after: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    valid_before: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
    tx_hash: "0x9f8e7d...3c2b1a",
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    executed_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "auth_2",
    transfer_id: "x402_1706745700_def456",
    from_address: "0x1234...5678",
    to_address: "0x5555...6666",
    amount: "125.50",
    token: "USDT",
    chain_id: 1,
    status: "pending",
    valid_after: new Date().toISOString(),
    valid_before: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
    tx_hash: null,
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    executed_at: null,
  },
  {
    id: "auth_3",
    transfer_id: "x402_1706745500_ghi789",
    from_address: "0x1234...5678",
    to_address: "0x7777...8888",
    amount: "200.00",
    token: "USDC",
    chain_id: 8453,
    status: "expired",
    valid_after: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    valid_before: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    tx_hash: null,
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    executed_at: null,
  },
  {
    id: "auth_4",
    transfer_id: "x402_1706745400_jkl012",
    from_address: "0x1234...5678",
    to_address: "0x9999...0000",
    amount: "75.00",
    token: "DAI",
    chain_id: 42161,
    status: "signed",
    valid_after: new Date().toISOString(),
    valid_before: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    tx_hash: null,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    executed_at: null,
  },
]

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
  11155111: "Sepolia",
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  signed: "bg-blue-500/10 text-blue-500",
  executed: "bg-green-500/10 text-green-500",
  expired: "bg-gray-500/10 text-gray-500",
  cancelled: "bg-red-500/10 text-red-500",
}

export default function AuthorizationsPage() {
  const { address } = useWeb3()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()
  const [authorizations, setAuthorizations] = useState<Authorization[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    loadAuthorizations()
  }, [address, isDemoMode])

  const loadAuthorizations = async () => {
    setLoading(true)
    try {
      if (isDemoMode) {
        setAuthorizations(demoAuthorizations)
      } else if (address) {
        const response = await fetch(`/api/x402/authorizations?from=${address}`)
        const data = await response.json()
        if (data.success) {
          setAuthorizations(data.authorizations || [])
        }
      }
    } catch (error) {
      console.error("Failed to load authorizations:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelAuthorization = async (auth: Authorization) => {
    if (isDemoMode) {
      setAuthorizations((prev) =>
        prev.map((a) => (a.id === auth.id ? { ...a, status: "cancelled" as const } : a))
      )
      toast({ title: "Success", description: "Authorization cancelled (Test)" })
      return
    }

    try {
      const response = await fetch(`/api/x402/authorizations/${auth.id}/cancel`, { method: "POST" })
      if (response.ok) {
        setAuthorizations((prev) =>
          prev.map((a) => (a.id === auth.id ? { ...a, status: "cancelled" as const } : a))
        )
        toast({ title: "Success", description: "Authorization cancelled" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to cancel authorization", variant: "destructive" })
    }
  }

  const filteredAuthorizations = authorizations.filter((auth) => {
    const matchesStatus = statusFilter === "all" || auth.status === statusFilter
    const matchesSearch =
      searchQuery === "" ||
      auth.transfer_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      auth.to_address.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const stats = {
    total: authorizations.length,
    pending: authorizations.filter((a) => a.status === "pending" || a.status === "signed").length,
    executed: authorizations.filter((a) => a.status === "executed").length,
    expired: authorizations.filter((a) => a.status === "expired").length,
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getTimeRemaining = (validBefore: string) => {
    const remaining = new Date(validBefore).getTime() - Date.now()
    if (remaining <= 0) return "Expired"
    const minutes = Math.floor(remaining / (1000 * 60))
    if (minutes < 60) return `${minutes}m remaining`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m remaining`
  }

  const getExplorerUrl = (chainId: number, txHash: string) => {
    const explorers: Record<number, string> = {
      1: "https://etherscan.io/tx/",
      8453: "https://basescan.org/tx/",
      42161: "https://arbiscan.io/tx/",
      11155111: "https://sepolia.etherscan.io/tx/",
    }
    return `${explorers[chainId] || "https://etherscan.io/tx/"}${txHash}`
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Payment Authorizations</h1>
          <p className="text-muted-foreground">
            View and manage your x402 payment authorizations (ERC-3009)
          </p>
        </div>

        {/* Info Card */}
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="flex items-start gap-4 p-4">
            <Shield className="h-5 w-5 text-purple-500 mt-0.5" />
            <div>
              <p className="font-medium text-purple-500">x402 Protocol Authorizations</p>
              <p className="text-sm text-muted-foreground mt-1">
                These are gasless payment authorizations using the x402 protocol (ERC-3009). You sign
                an authorization message, and a relayer executes the transfer on your behalf. Each
                authorization has a validity window and can only be used once.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <FileCheck className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-500/10 p-2">
                <Clock className="h-4 w-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-500/10 p-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Executed</p>
                <p className="text-2xl font-bold">{stats.executed}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-gray-500/10 p-2">
                <XCircle className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expired</p>
                <p className="text-2xl font-bold">{stats.expired}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by ID or recipient..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="signed">Signed</SelectItem>
                  <SelectItem value="executed">Executed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={loadAuthorizations}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Authorizations Table */}
        <Card>
          <CardHeader>
            <CardTitle>Authorization History</CardTitle>
            <CardDescription>
              All your x402 payment authorizations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAuthorizations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No authorizations found</p>
                <p className="text-sm">Authorizations are created when you approve x402 payments</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transfer ID</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Validity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAuthorizations.map((auth) => (
                    <TableRow key={auth.id}>
                      <TableCell className="font-mono text-sm">
                        {auth.transfer_id.slice(0, 20)}...
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {auth.to_address}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {auth.amount} {auth.token}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {CHAIN_NAMES[auth.chain_id] || `Chain ${auth.chain_id}`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{formatDate(auth.valid_before)}</div>
                          {(auth.status === "pending" || auth.status === "signed") && (
                            <div className="text-muted-foreground flex items-center gap-1">
                              <Timer className="h-3 w-3" />
                              {getTimeRemaining(auth.valid_before)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[auth.status]}>
                          {auth.status.charAt(0).toUpperCase() + auth.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {auth.tx_hash && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(getExplorerUrl(auth.chain_id, auth.tx_hash!), "_blank")}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          {(auth.status === "pending" || auth.status === "signed") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelAuthorization(auth)}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
