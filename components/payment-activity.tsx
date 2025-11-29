"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

interface Payment {
  id: string
  timestamp: string
  from_address: string
  to_address: string
  amount: string
  amount_usd: number
  status: string
  token_symbol: string
  tx_hash?: string
  notes?: string
  vendor?: {
    name: string
  }
}

interface PaymentActivityProps {
  payments: Payment[]
  walletAddress?: string
  loading?: boolean
  showAll?: boolean
  title?: string
  description?: string
}

export function PaymentActivity({
  payments,
  walletAddress,
  loading = false,
  showAll = false,
  title = "Payment Activity",
  description = "Recent transactions from your wallet",
}: PaymentActivityProps) {
  // Show last 10 payments unless showAll is true
  const displayPayments = showAll ? payments : payments.slice(0, 10)

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "pending":
        return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "success":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            Completed
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            Pending
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
            Failed
          </Badge>
        )
      default:
        return <Badge variant="outline">{status || "Unknown"}</Badge>
    }
  }

  const isOutgoing = (payment: Payment) => {
    if (!walletAddress) return true
    return payment.from_address?.toLowerCase() === walletAddress.toLowerCase()
  }

  const formatAddress = (address: string) => {
    if (!address) return "Unknown"
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const getExplorerUrl = (txHash: string) => {
    // Default to Etherscan mainnet
    return `https://etherscan.io/tx/${txHash}`
  }

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{title}</CardTitle>
          <CardDescription className="text-muted-foreground">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 bg-muted rounded" />
                  <div className="h-3 w-1/2 bg-muted rounded" />
                </div>
                <div className="h-4 w-20 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (displayPayments.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{title}</CardTitle>
          <CardDescription className="text-muted-foreground">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No transactions yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Your payment activity will appear here once you start making transactions.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">{title}</CardTitle>
        <CardDescription className="text-muted-foreground">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displayPayments.map((payment, index) => {
            const outgoing = isOutgoing(payment)
            const timeAgo = formatDistanceToNow(new Date(payment.timestamp), {
              addSuffix: true,
              locale: zhCN,
            })

            return (
              <div
                key={payment.id || index}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                {/* Direction Icon */}
                <div
                  className={`flex items-center justify-center h-10 w-10 rounded-full ${
                    outgoing ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
                  }`}
                >
                  {outgoing ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                </div>

                {/* Transaction Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {payment.vendor?.name ||
                        (outgoing ? formatAddress(payment.to_address) : formatAddress(payment.from_address))}
                    </span>
                    {getStatusIcon(payment.status)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{timeAgo}</span>
                    {payment.notes && (
                      <>
                        <span>•</span>
                        <span className="truncate">{payment.notes}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Amount & Status */}
                <div className="flex flex-col items-end gap-1">
                  <div className={`font-mono font-medium ${outgoing ? "text-red-500" : "text-green-500"}`}>
                    {outgoing ? "-" : "+"}$
                    {payment.amount_usd?.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || "0.00"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {payment.token_symbol || "ETH"}
                    </Badge>
                    {payment.tx_hash && (
                      <a
                        href={getExplorerUrl(payment.tx_hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {!showAll && payments.length > 10 && (
          <div className="mt-4 pt-4 border-t border-border text-center">
            <a href="/analytics" className="text-sm text-primary hover:text-primary/80 transition-colors">
              View all {payments.length} transactions →
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
