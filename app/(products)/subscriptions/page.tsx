"use client"

import { useState } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { useDemo } from "@/contexts/demo-context"
import { useSubscriptions } from "@/hooks/use-subscriptions"
import { usePaymentHistory } from "@/hooks/use-payment-history"
import {
  validateSubscription,
  calculateNextPaymentDate,
  formatSubscriptionForDisplay,
} from "@/lib/subscription-helpers"
// processSinglePayment is dynamically imported in handlePayNow to avoid bundling server-only modules (prisma, ioredis)
import type { SubscriptionInput, AutoPayUseCase } from "@/types"
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Play, Pause, X, Plus, DollarSign, Calendar, Hash, Shield,
  AlertTriangle, Building2, User, Clock, Users,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Subscription } from "@/types"

type TabFilter = "all" | "enterprise" | "individual"

export default function SubscriptionsPage() {
  const { address: currentWallet } = useUnifiedWallet()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()

  const { subscriptions, loading, stats, addSubscription, updateSubscription, updateStatus, deleteSubscription } =
    useSubscriptions({
      isDemoMode,
      walletAddress: currentWallet ?? undefined,
    })

  const { addPayment } = usePaymentHistory({
    isDemoMode,
    walletAddress: currentWallet ?? undefined,
  })

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [activeTab, setActiveTab] = useState<TabFilter>("all")
  const [newUseCase, setNewUseCase] = useState<AutoPayUseCase>("individual")
  const [showAuthSettings, setShowAuthSettings] = useState(false)
  const [showScheduleSettings, setShowScheduleSettings] = useState(false)
  const [newSubscription, setNewSubscription] = useState<SubscriptionInput>({
    service_name: "",
    amount: 0,
    token: "USDC",
    frequency: "monthly",
    recipient_address: "",
    max_amount: 0,
    chain: "ethereum",
    status: "active",
    next_payment: "",
    created_by: "",
  })

  // Filter subscriptions by tab
  const filteredSubscriptions = subscriptions.filter((s) => {
    if (activeTab === "all") return true
    if (activeTab === "enterprise") return s.use_case === "enterprise"
    return s.use_case === "individual" || !s.use_case
  })

  const handleAddSubscription = async () => {
    if (!newSubscription.service_name || !newSubscription.amount || !newSubscription.recipient_address) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" })
      return
    }

    try {
      const input: SubscriptionInput = {
        ...newSubscription,
        use_case: newUseCase,
      }
      validateSubscription(input)

      const nextPaymentDate = calculateNextPaymentDate(new Date(), newSubscription.frequency, {
        schedule_day: newSubscription.schedule_day,
        schedule_time: newSubscription.schedule_time,
      })

      await addSubscription({
        service_name: newSubscription.service_name,
        recipient_address: newSubscription.recipient_address,
        amount: String(newSubscription.amount),
        token: newSubscription.token,
        chain: newSubscription.chain,
        frequency: newSubscription.frequency,
        status: newSubscription.status,
        max_amount: newSubscription.max_amount ? String(newSubscription.max_amount) : undefined,
        next_payment: nextPaymentDate.toISOString(),
        created_by: currentWallet || "demo",
        use_case: newUseCase,
        max_authorized_amount: newSubscription.max_authorized_amount
          ? String(newSubscription.max_authorized_amount)
          : undefined,
        authorization_expires_at: newSubscription.authorization_expires_at,
        schedule_day: newSubscription.schedule_day,
        schedule_time: newSubscription.schedule_time,
        timezone: newSubscription.timezone || "UTC",
        description: newSubscription.description,
        recipients: newSubscription.recipients,
      })

      toast({ title: "Success", description: "Auto pay created successfully" })
      setShowAddDialog(false)
      resetForm()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create auto pay", variant: "destructive" })
    }
  }

  const resetForm = () => {
    setNewSubscription({
      service_name: "",
      amount: 0,
      token: "USDC",
      frequency: "monthly",
      recipient_address: "",
      max_amount: 0,
      chain: "ethereum",
      status: "active",
      next_payment: "",
      created_by: "",
    })
    setNewUseCase("individual")
    setShowAuthSettings(false)
    setShowScheduleSettings(false)
  }

  const handleToggleStatus = async (subscription: Subscription) => {
    const newStatus = subscription.status === "active" ? "paused" : "active"
    try {
      await updateStatus(subscription.id, newStatus)
      toast({ title: "Success", description: `Auto pay ${newStatus === "active" ? "resumed" : "paused"}` })
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" })
    }
  }

  const handlePayNow = async (subscription: Subscription) => {
    if (isDemoMode) {
      toast({ title: "Test", description: "Payment simulated successfully" })
      return
    }

    if (!currentWallet) {
      toast({ title: "Error", description: "Please connect your wallet", variant: "destructive" })
      return
    }

    try {
      const { processSinglePayment } = await import("@/lib/services/payment-service")
      const result = await processSinglePayment(
        {
          address: subscription.recipient_address,
          amount: Number(subscription.amount),
          token: subscription.token,
        },
        currentWallet,
        subscription.chain,
      )

      if (result.success && result.txHash) {
        await addPayment({
          from_address: currentWallet,
          to_address: subscription.recipient_address,
          amount: String(subscription.amount),
          token: subscription.token,
          chain: subscription.chain,
          tx_hash: result.txHash,
          status: "completed",
          type: "sent",
          timestamp: new Date().toISOString(),
        })

        const nextDate = calculateNextPaymentDate(new Date(), subscription.frequency, {
          schedule_day: subscription.schedule_day,
          schedule_time: subscription.schedule_time,
        })
        await updateSubscription(subscription.id, {
          next_payment: nextDate.toISOString(),
          last_payment: new Date().toISOString(),
        })

        toast({ title: "Success", description: "Payment processed successfully" })
      } else {
        toast({ title: "Error", description: result.error || "Payment failed", variant: "destructive" })
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Payment failed", variant: "destructive" })
    }
  }

  const handleCancelSubscription = async (subscription: Subscription) => {
    try {
      await deleteSubscription(subscription.id)
      toast({ title: "Success", description: "Auto pay cancelled" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to cancel", variant: "destructive" })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>
      case "paused":
        return <Badge variant="secondary">Paused</Badge>
      case "cancelled":
        return <Badge variant="outline">Cancelled</Badge>
      case "payment_failed":
        return <Badge variant="destructive">Failed</Badge>
      case "authorization_expired":
        return <Badge variant="destructive">Auth Expired</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Auto Pay</h1>
            <p className="text-muted-foreground">Enterprise & individual recurring payments</p>
          </div>

          <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetForm() }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Auto Pay
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Auto Pay</DialogTitle>
              </DialogHeader>

              {/* Use Case Toggle */}
              <div className="flex gap-2 rounded-lg border p-1">
                <button
                  type="button"
                  onClick={() => setNewUseCase("individual")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    newUseCase === "individual"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <User className="h-4 w-4" /> Individual
                </button>
                <button
                  type="button"
                  onClick={() => setNewUseCase("enterprise")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    newUseCase === "enterprise"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Building2 className="h-4 w-4" /> Enterprise
                </button>
              </div>

              <div className="space-y-4">
                {/* Common Fields */}
                <div>
                  <Label>{newUseCase === "enterprise" ? "Payment Name" : "Service Name"}</Label>
                  <Input
                    value={newSubscription.service_name}
                    onChange={(e) => setNewSubscription({ ...newSubscription, service_name: e.target.value })}
                    placeholder={newUseCase === "enterprise" ? "Engineering Payroll, Vendor Payment..." : "Netflix, Spotify..."}
                  />
                </div>

                {newUseCase === "enterprise" && (
                  <div>
                    <Label>Description</Label>
                    <Input
                      value={newSubscription.description || ""}
                      onChange={(e) => setNewSubscription({ ...newSubscription, description: e.target.value })}
                      placeholder="Monthly payroll for engineering team"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      value={newSubscription.amount || ""}
                      onChange={(e) => setNewSubscription({ ...newSubscription, amount: Number(e.target.value) })}
                      placeholder={newUseCase === "enterprise" ? "15000" : "9.99"}
                    />
                  </div>
                  <div>
                    <Label>Token</Label>
                    <Select
                      value={newSubscription.token}
                      onValueChange={(value) => setNewSubscription({ ...newSubscription, token: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USDC">USDC</SelectItem>
                        <SelectItem value="USDT">USDT</SelectItem>
                        <SelectItem value="DAI">DAI</SelectItem>
                        <SelectItem value="ETH">ETH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Frequency</Label>
                    <Select
                      value={newSubscription.frequency}
                      onValueChange={(value: any) => setNewSubscription({ ...newSubscription, frequency: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Chain</Label>
                    <Select
                      value={newSubscription.chain}
                      onValueChange={(value) => setNewSubscription({ ...newSubscription, chain: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ethereum">Ethereum</SelectItem>
                        <SelectItem value="base">Base</SelectItem>
                        <SelectItem value="arbitrum">Arbitrum</SelectItem>
                        <SelectItem value="polygon">Polygon</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Recipient Address</Label>
                  <Input
                    value={newSubscription.recipient_address}
                    onChange={(e) => setNewSubscription({ ...newSubscription, recipient_address: e.target.value })}
                    placeholder="0x..."
                  />
                </div>

                {/* Authorization Settings (collapsible) */}
                <div className="rounded-lg border">
                  <button
                    type="button"
                    onClick={() => setShowAuthSettings(!showAuthSettings)}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4" /> Authorization Settings
                    </span>
                    <span className="text-muted-foreground">{showAuthSettings ? "-" : "+"}</span>
                  </button>
                  {showAuthSettings && (
                    <div className="space-y-3 border-t px-4 py-3">
                      <div>
                        <Label>Max Authorized Amount</Label>
                        <Input
                          type="number"
                          value={newSubscription.max_authorized_amount || ""}
                          onChange={(e) =>
                            setNewSubscription({ ...newSubscription, max_authorized_amount: Number(e.target.value) })
                          }
                          placeholder="Total spending cap (e.g., 10000)"
                        />
                      </div>
                      <div>
                        <Label>Authorization Expiry</Label>
                        <Input
                          type="date"
                          value={newSubscription.authorization_expires_at || ""}
                          onChange={(e) =>
                            setNewSubscription({ ...newSubscription, authorization_expires_at: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Schedule Settings (collapsible) */}
                <div className="rounded-lg border">
                  <button
                    type="button"
                    onClick={() => setShowScheduleSettings(!showScheduleSettings)}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Schedule Settings
                    </span>
                    <span className="text-muted-foreground">{showScheduleSettings ? "-" : "+"}</span>
                  </button>
                  {showScheduleSettings && (
                    <div className="space-y-3 border-t px-4 py-3">
                      <div>
                        <Label>
                          {newSubscription.frequency === "weekly" ? "Day of Week (1=Mon..7=Sun)" : "Day of Month (1-31)"}
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          max={newSubscription.frequency === "weekly" ? 7 : 31}
                          value={newSubscription.schedule_day || ""}
                          onChange={(e) =>
                            setNewSubscription({ ...newSubscription, schedule_day: Number(e.target.value) })
                          }
                          placeholder={newSubscription.frequency === "weekly" ? "5 (Friday)" : "5 (5th of month)"}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Time (HH:mm)</Label>
                          <Input
                            type="time"
                            value={newSubscription.schedule_time || ""}
                            onChange={(e) =>
                              setNewSubscription({ ...newSubscription, schedule_time: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <Label>Timezone</Label>
                          <Select
                            value={newSubscription.timezone || "UTC"}
                            onValueChange={(value) => setNewSubscription({ ...newSubscription, timezone: value })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="UTC">UTC</SelectItem>
                              <SelectItem value="America/New_York">US Eastern</SelectItem>
                              <SelectItem value="America/Los_Angeles">US Pacific</SelectItem>
                              <SelectItem value="Europe/London">London</SelectItem>
                              <SelectItem value="Asia/Shanghai">Shanghai</SelectItem>
                              <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Button onClick={handleAddSubscription} className="w-full">
                  Create Auto Pay
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Play className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-500/10 p-2">
                <Calendar className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Next Payment</p>
                <p className="text-sm font-medium">
                  {stats.nextPayment ? new Date(stats.nextPayment).toLocaleDateString() : "N/A"}
                </p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-500/10 p-2">
                <Hash className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payments</p>
                <p className="text-2xl font-bold">{stats.totalPaymentCount}</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-500/10 p-2">
                <DollarSign className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly Total</p>
                <p className="text-lg font-bold">${stats.monthlyTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-500/10 p-2">
                <Shield className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Remaining Quota</p>
                <p className="text-lg font-bold">${stats.totalRemainingQuota.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-orange-500/10 p-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Auth Warnings</p>
                <p className="text-2xl font-bold">{stats.expiringAuthorizations}</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Tab Filter */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabFilter)}>
          <TabsList>
            <TabsTrigger value="all">
              All ({subscriptions.length})
            </TabsTrigger>
            <TabsTrigger value="enterprise">
              <Building2 className="mr-1.5 h-3.5 w-3.5" />
              Enterprise ({stats.enterpriseCount})
            </TabsTrigger>
            <TabsTrigger value="individual">
              <User className="mr-1.5 h-3.5 w-3.5" />
              Individual ({stats.individualCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Subscriptions List */}
        <div className="space-y-3">
          {loading ? (
            <GlassCard className="p-8 text-center text-muted-foreground">Loading auto pay...</GlassCard>
          ) : filteredSubscriptions.length === 0 ? (
            <GlassCard className="p-8 text-center text-muted-foreground">
              No auto pay entries found. Click "New Auto Pay" to get started.
            </GlassCard>
          ) : (
            filteredSubscriptions.map((subscription) => {
              const formatted = formatSubscriptionForDisplay(subscription)

              return (
                <GlassCard key={subscription.id} className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{subscription.service_name}</h3>
                        {getStatusBadge(subscription.status)}
                        {subscription.use_case === "enterprise" && (
                          <Badge variant="outline" className="border-purple-500/30 text-purple-500">
                            <Building2 className="mr-1 h-3 w-3" />
                            Enterprise
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {formatted.formattedAmount} &middot; {formatted.formattedFrequency}
                        {formatted.formattedSchedule && (
                          <> &middot; {formatted.formattedSchedule}</>
                        )}
                      </p>

                      {subscription.description && (
                        <p className="text-xs text-muted-foreground">{subscription.description}</p>
                      )}

                      {/* Meta info row */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {subscription.next_payment && (
                          <span>Next: {formatted.formattedNextPayment}</span>
                        )}
                        {subscription.payment_count !== undefined && subscription.payment_count > 0 && (
                          <span>{subscription.payment_count} payments</span>
                        )}
                        {subscription.recipients && subscription.recipients.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {subscription.recipients.length} recipients
                          </span>
                        )}
                      </div>

                      {/* Authorization quota progress bar */}
                      {subscription.max_authorized_amount && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{formatted.formattedRemainingQuota}</span>
                            {formatted.formattedAuthExpiry && (
                              <span className="text-muted-foreground">{formatted.formattedAuthExpiry}</span>
                            )}
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full transition-all ${
                                subscription.authorization_valid === false
                                  ? "bg-destructive"
                                  : parseFloat(subscription.remaining_quota || "0") <
                                    parseFloat(subscription.amount)
                                  ? "bg-orange-500"
                                  : "bg-primary"
                              }`}
                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    ((parseFloat(subscription.total_paid || "0") /
                                      parseFloat(subscription.max_authorized_amount)) *
                                      100)
                                  )
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {subscription.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => handlePayNow(subscription)}>
                          Pay Now
                        </Button>
                      )}

                      {(subscription.status === "active" || subscription.status === "paused") && (
                        <Button size="sm" variant="outline" onClick={() => handleToggleStatus(subscription)}>
                          {subscription.status === "active" ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                      {subscription.status !== "cancelled" && (
                        <Button size="sm" variant="outline" onClick={() => handleCancelSubscription(subscription)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </GlassCard>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
