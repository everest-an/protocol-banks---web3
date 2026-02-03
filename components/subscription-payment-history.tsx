"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  History,
  RefreshCw,
} from "lucide-react"

interface PaymentRecord {
  id: string
  subscription_id: string
  amount: string
  token?: string
  tx_hash: string | null
  status: "pending" | "completed" | "failed"
  error_message?: string
  created_at: string
  confirmed_at?: string
}

interface SubscriptionPaymentHistoryProps {
  subscriptionId: string
  serviceName: string
  token: string
  chainId?: number
  isDemoMode?: boolean
}

// Demo payment history
const generateDemoHistory = (subscriptionId: string): PaymentRecord[] => {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000

  return [
    {
      id: "pay_1",
      subscription_id: subscriptionId,
      amount: "9.99",
      tx_hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      status: "completed",
      created_at: new Date(now - 1 * day).toISOString(),
      confirmed_at: new Date(now - 1 * day + 60000).toISOString(),
    },
    {
      id: "pay_2",
      subscription_id: subscriptionId,
      amount: "9.99",
      tx_hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      status: "completed",
      created_at: new Date(now - 31 * day).toISOString(),
      confirmed_at: new Date(now - 31 * day + 45000).toISOString(),
    },
    {
      id: "pay_3",
      subscription_id: subscriptionId,
      amount: "9.99",
      tx_hash: null,
      status: "failed",
      error_message: "Insufficient balance",
      created_at: new Date(now - 61 * day).toISOString(),
    },
    {
      id: "pay_4",
      subscription_id: subscriptionId,
      amount: "9.99",
      tx_hash: "0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456",
      status: "completed",
      created_at: new Date(now - 62 * day).toISOString(),
      confirmed_at: new Date(now - 62 * day + 30000).toISOString(),
    },
    {
      id: "pay_5",
      subscription_id: subscriptionId,
      amount: "9.99",
      tx_hash: "0xdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc",
      status: "completed",
      created_at: new Date(now - 92 * day).toISOString(),
      confirmed_at: new Date(now - 92 * day + 55000).toISOString(),
    },
  ]
}

const CHAIN_EXPLORERS: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  8453: "https://basescan.org/tx/",
  42161: "https://arbiscan.io/tx/",
  11155111: "https://sepolia.etherscan.io/tx/",
}

export function SubscriptionPaymentHistory({
  subscriptionId,
  serviceName,
  token,
  chainId = 8453,
  isDemoMode = false,
}: SubscriptionPaymentHistoryProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const loadPayments = async () => {
    setLoading(true)
    try {
      if (isDemoMode) {
        setPayments(generateDemoHistory(subscriptionId))
      } else {
        const response = await fetch(`/api/subscriptions/${subscriptionId}/payments`)
        const data = await response.json()
        if (data.success) {
          setPayments(data.payments || [])
        }
      }
    } catch (error) {
      console.error("Failed to load payment history:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadPayments()
    }
  }, [isOpen, subscriptionId, isDemoMode])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatTxHash = (hash: string) => {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: "bg-green-500/10 text-green-500",
      failed: "bg-red-500/10 text-red-500",
      pending: "bg-yellow-500/10 text-yellow-500",
    }
    return (
      <Badge className={colors[status] || colors.pending}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const stats = {
    total: payments.length,
    successful: payments.filter((p) => p.status === "completed").length,
    failed: payments.filter((p) => p.status === "failed").length,
    totalPaid: payments
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + parseFloat(p.amount), 0),
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="mr-2 h-4 w-4" />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Payment History - {serviceName}</DialogTitle>
          <DialogDescription>
            View all payment transactions for this subscription
          </DialogDescription>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 py-4">
          <Card className="p-3">
            <div className="text-sm text-muted-foreground">Total Payments</div>
            <div className="text-xl font-bold">{stats.total}</div>
          </Card>
          <Card className="p-3">
            <div className="text-sm text-muted-foreground">Successful</div>
            <div className="text-xl font-bold text-green-500">{stats.successful}</div>
          </Card>
          <Card className="p-3">
            <div className="text-sm text-muted-foreground">Failed</div>
            <div className="text-xl font-bold text-red-500">{stats.failed}</div>
          </Card>
          <Card className="p-3">
            <div className="text-sm text-muted-foreground">Total Paid</div>
            <div className="text-xl font-bold">${stats.totalPaid.toFixed(2)}</div>
          </Card>
        </div>

        {/* Payment List */}
        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payment history yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Transaction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-sm">
                      {formatDate(payment.created_at)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {payment.amount} {token}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(payment.status)}
                        {getStatusBadge(payment.status)}
                      </div>
                      {payment.error_message && (
                        <p className="text-xs text-red-500 mt-1">{payment.error_message}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {payment.tx_hash ? (
                        <a
                          href={`${CHAIN_EXPLORERS[chainId] || CHAIN_EXPLORERS[1]}${payment.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-blue-500 hover:underline font-mono"
                        >
                          {formatTxHash(payment.tx_hash)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
