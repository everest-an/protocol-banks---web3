"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2, XCircle, Clock, ExternalLink, RefreshCw } from "lucide-react"
import type { Subscription } from "@/types"

interface PaymentRecord {
  id: string
  amount: string
  token: string
  status: "completed" | "failed" | "pending"
  tx_hash?: string
  created_at: string
  error_message?: string
}

interface SubscriptionPaymentHistoryProps {
  subscription: Subscription
  isDemoMode?: boolean
}

// Demo payment history data
const generateDemoHistory = (subscription: Subscription): PaymentRecord[] => {
  const history: PaymentRecord[] = []
  const now = new Date()
  
  for (let i = 0; i < 6; i++) {
    const date = new Date(now)
    if (subscription.frequency === "monthly") {
      date.setMonth(date.getMonth() - i)
    } else if (subscription.frequency === "weekly") {
      date.setDate(date.getDate() - i * 7)
    } else if (subscription.frequency === "daily") {
      date.setDate(date.getDate() - i)
    } else {
      date.setFullYear(date.getFullYear() - i)
    }

    const isSuccess = Math.random() > 0.1 // 90% success rate
    history.push({
      id: `payment-${i}`,
      amount: subscription.amount,
      token: subscription.token,
      status: i === 0 ? "pending" : isSuccess ? "completed" : "failed",
      tx_hash: isSuccess ? `0x${Math.random().toString(16).slice(2, 10)}...` : undefined,
      created_at: date.toISOString(),
      error_message: !isSuccess ? "Insufficient balance" : undefined,
    })
  }
  
  return history
}

export function SubscriptionPaymentHistory({ subscription, isDemoMode = false }: SubscriptionPaymentHistoryProps) {
  const [history, setHistory] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true)
      
      if (isDemoMode) {
        // Simulate loading
        await new Promise(resolve => setTimeout(resolve, 500))
        setHistory(generateDemoHistory(subscription))
      } else {
        // In production, fetch from API
        try {
          const res = await fetch(`/api/subscriptions/${subscription.id}/payments`)
          if (res.ok) {
            const data = await res.json()
            setHistory(data.payments || [])
          }
        } catch (error) {
          console.error("Failed to load payment history:", error)
        }
      }
      
      setLoading(false)
    }

    loadHistory()
  }, [subscription.id, isDemoMode, subscription])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500/10 text-green-500 border-green-500/20">Completed</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pending</Badge>
      default:
        return null
    }
  }

  // Calculate success rate
  const completedCount = history.filter(h => h.status === "completed").length
  const totalCount = history.filter(h => h.status !== "pending").length
  const successRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Payment History</CardTitle>
            <CardDescription>
              {subscription.service_name} - Last {history.length} payments
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Success Rate</p>
            <p className={`text-lg font-bold ${successRate >= 90 ? 'text-green-500' : successRate >= 70 ? 'text-yellow-500' : 'text-destructive'}`}>
              {successRate}%
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No payment history yet</p>
        ) : (
          <div className="space-y-2">
            {history.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(payment.status)}
                  <div>
                    <p className="text-sm font-medium">
                      {payment.amount} {payment.token}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(payment.created_at).toLocaleDateString()} at{" "}
                      {new Date(payment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {payment.error_message && (
                      <p className="text-xs text-destructive mt-1">{payment.error_message}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(payment.status)}
                  {payment.tx_hash && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a
                        href={`https://etherscan.io/tx/${payment.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
