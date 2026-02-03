"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Bell,
  CreditCard,
  Users,
  Webhook,
  RefreshCw,
  Zap,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

// Activity types from dashboard-activity-service
type ActivityType = 
  | "payment_sent"
  | "payment_received"
  | "batch_payment"
  | "subscription_charged"
  | "subscription_created"
  | "subscription_cancelled"
  | "multisig_proposed"
  | "multisig_signed"
  | "multisig_executed"
  | "webhook_triggered"
  | "api_key_created"
  | "vendor_added"
  | "vendor_updated"

interface Activity {
  id: string
  type: ActivityType
  timestamp: string
  title: string
  description: string
  amount?: number
  token?: string
  status: "success" | "pending" | "failed"
  metadata?: {
    tx_hash?: string
    vendor_name?: string
    recipient_count?: number
    subscription_name?: string
    webhook_event?: string
    signer_address?: string
    threshold?: string
  }
}

interface DashboardActivityProps {
  walletAddress?: string
  limit?: number
  showTabs?: boolean
  compact?: boolean
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch activities")
  return res.json()
}

export function DashboardActivity({
  walletAddress,
  limit = 15,
  showTabs = true,
  compact = false,
}: DashboardActivityProps) {
  const [activeTab, setActiveTab] = useState("all")
  
  // Fetch activities from API - use /api/activities for real transaction data
  const { data, error, isLoading, mutate } = useSWR<{ activities: Activity[]; total: number }>(
    walletAddress ? `/api/activities?wallet=${walletAddress}&limit=${limit}` : null,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    }
  )

  // Demo data for when API is not available
  const demoActivities: Activity[] = [
    {
      id: "1",
      type: "payment_sent",
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      title: "Payment Sent",
      description: "Sent to Acme Corp",
      amount: 1500,
      token: "USDC",
      status: "success",
      metadata: { tx_hash: "0x123...abc", vendor_name: "Acme Corp" },
    },
    {
      id: "2",
      type: "batch_payment",
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      title: "Batch Payment",
      description: "5 recipients paid",
      amount: 7500,
      token: "USDT",
      status: "success",
      metadata: { recipient_count: 5, tx_hash: "0x456...def" },
    },
    {
      id: "3",
      type: "subscription_charged",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      title: "Subscription Charged",
      description: "Linear Pro monthly",
      amount: 25,
      token: "USDC",
      status: "success",
      metadata: { subscription_name: "Linear Pro" },
    },
    {
      id: "4",
      type: "multisig_proposed",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      title: "Multisig Proposed",
      description: "Treasury withdrawal",
      amount: 50000,
      token: "USDC",
      status: "pending",
      metadata: { threshold: "2/3" },
    },
    {
      id: "5",
      type: "webhook_triggered",
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      title: "Webhook Triggered",
      description: "payment.completed event",
      status: "success",
      metadata: { webhook_event: "payment.completed" },
    },
    {
      id: "6",
      type: "vendor_added",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      title: "Vendor Added",
      description: "New vendor: TechStartup Inc",
      status: "success",
      metadata: { vendor_name: "TechStartup Inc" },
    },
  ]

  const activities = data?.activities || demoActivities

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case "payment_sent":
        return <ArrowUpRight className="h-4 w-4" />
      case "payment_received":
        return <ArrowDownLeft className="h-4 w-4" />
      case "batch_payment":
        return <Users className="h-4 w-4" />
      case "subscription_charged":
      case "subscription_created":
      case "subscription_cancelled":
        return <CreditCard className="h-4 w-4" />
      case "multisig_proposed":
      case "multisig_signed":
      case "multisig_executed":
        return <Users className="h-4 w-4" />
      case "webhook_triggered":
        return <Webhook className="h-4 w-4" />
      case "api_key_created":
        return <Zap className="h-4 w-4" />
      case "vendor_added":
      case "vendor_updated":
        return <Users className="h-4 w-4" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  const getActivityColor = (type: ActivityType, status: string) => {
    if (status === "failed") return "bg-red-500/10 text-red-500"
    if (status === "pending") return "bg-yellow-500/10 text-yellow-500"
    
    switch (type) {
      case "payment_sent":
        return "bg-orange-500/10 text-orange-500"
      case "payment_received":
        return "bg-green-500/10 text-green-500"
      case "batch_payment":
        return "bg-blue-500/10 text-blue-500"
      case "subscription_charged":
      case "subscription_created":
        return "bg-purple-500/10 text-purple-500"
      case "subscription_cancelled":
        return "bg-red-500/10 text-red-500"
      case "multisig_proposed":
      case "multisig_signed":
        return "bg-yellow-500/10 text-yellow-500"
      case "multisig_executed":
        return "bg-green-500/10 text-green-500"
      case "webhook_triggered":
        return "bg-cyan-500/10 text-cyan-500"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Success
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Pending
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )
      default:
        return null
    }
  }

  const filterActivities = (tab: string) => {
    if (tab === "all") return activities
    if (tab === "payments") return activities.filter(a => 
      ["payment_sent", "payment_received", "batch_payment"].includes(a.type)
    )
    if (tab === "subscriptions") return activities.filter(a => 
      a.type.startsWith("subscription_")
    )
    if (tab === "multisig") return activities.filter(a => 
      a.type.startsWith("multisig_")
    )
    return activities
  }

  const filteredActivities = filterActivities(activeTab)

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Recent Activity</CardTitle>
            <CardDescription className="text-muted-foreground">
              Your latest transactions and events
            </CardDescription>
          </div>
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

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-foreground">Recent Activity</CardTitle>
          <CardDescription className="text-muted-foreground">
            Your latest transactions and events
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => mutate()}
          className="h-8 w-8"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {showTabs && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="subscriptions">Subs</TabsTrigger>
              <TabsTrigger value="multisig">Multisig</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No activity yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Your activity will appear here once you start using Protocol Banks.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActivities.map((activity) => {
              const timeAgo = formatDistanceToNow(new Date(activity.timestamp), {
                addSuffix: true,
                locale: zhCN,
              })

              return (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* Activity Icon */}
                  <div
                    className={`flex items-center justify-center h-10 w-10 rounded-full ${getActivityColor(activity.type, activity.status)}`}
                  >
                    {getActivityIcon(activity.type)}
                  </div>

                  {/* Activity Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">
                        {activity.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{activity.description}</span>
                      <span>•</span>
                      <span>{timeAgo}</span>
                    </div>
                  </div>

                  {/* Amount & Status */}
                  <div className="flex flex-col items-end gap-1">
                    {activity.amount && (
                      <div className="font-mono font-medium text-foreground">
                        ${activity.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        {activity.token && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {activity.token}
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {getStatusBadge(activity.status)}
                      {activity.metadata?.tx_hash && (
                        <a
                          href={`https://basescan.org/tx/${activity.metadata.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors"
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
        )}

        {filteredActivities.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border text-center">
            <a
              href="/history"
              className="text-sm text-primary hover:text-primary/80 transition-colors"
            >
              View all activity →
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
