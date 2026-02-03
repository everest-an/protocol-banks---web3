"use client"

import { useState } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import { useSubscriptions } from "@/hooks/use-subscriptions"
import { usePaymentHistory } from "@/hooks/use-payment-history"
import {
  validateSubscription,
  calculateNextPaymentDate,
  formatSubscriptionForDisplay,
} from "@/lib/services/subscription-service"
import { processSinglePayment } from "@/lib/services/payment-service"
import type { SubscriptionInput } from "@/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Pause, X, Plus, DollarSign, Calendar, History, Clock, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import type { Subscription } from "@/types"
import { SubscriptionPaymentHistory } from "@/components/subscription-payment-history"

// Helper function to calculate time until next payment
function getTimeUntilPayment(nextPayment: string | undefined): { text: string; urgent: boolean } {
  if (!nextPayment) return { text: "Not scheduled", urgent: false }
  
  const now = new Date()
  const next = new Date(nextPayment)
  const diffMs = next.getTime() - now.getTime()
  
  if (diffMs < 0) return { text: "Overdue", urgent: true }
  
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  
  if (diffDays > 7) {
    return { text: `in ${diffDays} days`, urgent: false }
  } else if (diffDays > 0) {
    return { text: `in ${diffDays}d ${diffHours}h`, urgent: diffDays <= 2 }
  } else if (diffHours > 0) {
    return { text: `in ${diffHours} hours`, urgent: true }
  } else {
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return { text: `in ${diffMinutes} min`, urgent: true }
  }
}

export default function SubscriptionsPage() {
  const { wallets, activeChain } = useWeb3()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()
  const currentWallet = wallets[activeChain]

  const { subscriptions, loading, stats, addSubscription, updateStatus, deleteSubscription } = useSubscriptions({
    isDemoMode,
    walletAddress: currentWallet,
  })

  const { addTransaction } = usePaymentHistory({
    isDemoMode,
    walletAddress: currentWallet,
  })

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [expandedSubscription, setExpandedSubscription] = useState<string | null>(null)
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

  const handleAddSubscription = async () => {
    if (!newSubscription.service_name || !newSubscription.amount || !newSubscription.recipient_address) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" })
      return
    }

    try {
      validateSubscription(newSubscription)

      // Calculate next payment date
      const nextPaymentDate = calculateNextPaymentDate(new Date(), newSubscription.frequency)

      await addSubscription({
        ...newSubscription,
        next_payment: nextPaymentDate.toISOString(),
        created_by: currentWallet || "demo",
      })

      toast({ title: "Success", description: "Subscription added successfully" })
      setShowAddDialog(false)
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
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to add subscription", variant: "destructive" })
    }
  }

  const handleToggleStatus = async (subscription: Subscription) => {
    const newStatus = subscription.status === "active" ? "paused" : "active"

    try {
      await updateStatus(subscription.id, newStatus)
      toast({ title: "Success", description: `Subscription ${newStatus === "active" ? "resumed" : "paused"}` })
    } catch (error) {
      toast({ title: "Error", description: "Failed to update subscription", variant: "destructive" })
    }
  }

  const handlePayNow = async (subscription: Subscription) => {
    if (isDemoMode) {
      toast({ title: "Demo", description: "Payment simulated successfully" })
      return
    }

    if (!currentWallet) {
      toast({ title: "Error", description: "Please connect your wallet", variant: "destructive" })
      return
    }

    try {
      const result = await processSinglePayment(
        {
          address: subscription.recipient_address,
          amount: subscription.amount,
          token: subscription.token,
        },
        currentWallet,
        subscription.chain,
      )

      if (result.success && result.txHash) {
        // Record transaction
        await addTransaction({
          from_address: currentWallet,
          to_address: subscription.recipient_address,
          amount: subscription.amount,
          token: subscription.token,
          chain: subscription.chain,
          tx_hash: result.txHash,
          status: "completed",
          type: "sent",
          created_by: currentWallet,
        })

        // Update next payment date
        const nextDate = calculateNextPaymentDate(new Date(), subscription.frequency)

        // You could update the subscription's next_payment here
        // await updateSubscription(subscription.id, { next_payment: nextDate.toISOString() })

        toast({ title: "Success", description: "Payment processed successfully" })
      } else {
        toast({ title: "Error", description: result.error || "Payment failed", variant: "destructive" })
      }
    } catch (error: any) {
      console.error("[v0] Payment error:", error)
      toast({ title: "Error", description: error.message || "Payment failed", variant: "destructive" })
    }
  }

  const handleCancelSubscription = async (subscription: Subscription) => {
    try {
      await deleteSubscription(subscription.id)
      toast({ title: "Success", description: "Subscription cancelled" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to cancel subscription", variant: "destructive" })
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Subscriptions</h1>
            <p className="text-muted-foreground">Manage your recurring payments</p>
          </div>

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Subscription
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Subscription</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Service Name</Label>
                  <Input
                    value={newSubscription.service_name}
                    onChange={(e) => setNewSubscription({ ...newSubscription, service_name: e.target.value })}
                    placeholder="Netflix, Spotify, etc."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      value={newSubscription.amount || ""}
                      onChange={(e) => setNewSubscription({ ...newSubscription, amount: Number(e.target.value) })}
                      placeholder="9.99"
                    />
                  </div>
                  <div>
                    <Label>Token</Label>
                    <Select
                      value={newSubscription.token}
                      onValueChange={(value) => setNewSubscription({ ...newSubscription, token: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USDC">USDC</SelectItem>
                        <SelectItem value="USDT">USDT</SelectItem>
                        <SelectItem value="DAI">DAI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Frequency</Label>
                  <Select
                    value={newSubscription.frequency}
                    onValueChange={(value: any) => setNewSubscription({ ...newSubscription, frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Recipient Address</Label>
                  <Input
                    value={newSubscription.recipient_address}
                    onChange={(e) => setNewSubscription({ ...newSubscription, recipient_address: e.target.value })}
                    placeholder="0x..."
                  />
                </div>
                <div>
                  <Label>Max Amount (Protection)</Label>
                  <Input
                    type="number"
                    value={newSubscription.max_amount || ""}
                    onChange={(e) => setNewSubscription({ ...newSubscription, max_amount: Number(e.target.value) })}
                    placeholder="Leave empty to use amount"
                  />
                </div>
                <Button onClick={handleAddSubscription} className="w-full">
                  Add Subscription
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Play className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-500/10 p-2">
                <Pause className="h-4 w-4 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paused</p>
                <p className="text-2xl font-bold">{stats.paused}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-500/10 p-2">
                <DollarSign className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Total</p>
                <p className="text-2xl font-bold">${stats.monthlyTotal.toFixed(2)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-500/10 p-2">
                <Calendar className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Next Payment</p>
                <p className="text-sm font-medium">
                  {stats.nextPayment ? new Date(stats.nextPayment).toLocaleDateString() : "N/A"}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Subscriptions List */}
        <div className="space-y-3">
          {loading ? (
            <Card className="p-8 text-center text-muted-foreground">Loading subscriptions...</Card>
          ) : subscriptions.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              No subscriptions yet. Click "Add Subscription" to get started.
            </Card>
          ) : (
            subscriptions.map((subscription) => {
              const formatted = formatSubscriptionForDisplay(subscription)
              const timeUntil = getTimeUntilPayment(subscription.next_payment)
              const isExpanded = expandedSubscription === subscription.id

              return (
                <Collapsible
                  key={subscription.id}
                  open={isExpanded}
                  onOpenChange={(open) => setExpandedSubscription(open ? subscription.id : null)}
                >
                  <Card className="overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold truncate">{subscription.service_name}</h3>
                              <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                                {subscription.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {formatted.formattedAmount} • {formatted.formattedFrequency}
                            </p>
                            
                            {/* Next payment countdown */}
                            {subscription.status === "active" && (
                              <div className="flex items-center gap-2 mt-2">
                                <Clock className={`h-3.5 w-3.5 ${timeUntil.urgent ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                                <span className={`text-xs ${timeUntil.urgent ? 'text-yellow-500 font-medium' : 'text-muted-foreground'}`}>
                                  Next payment {timeUntil.text}
                                </span>
                              </div>
                            )}

                            {/* Last payment status */}
                            {subscription.last_payment && (
                              <div className="flex items-center gap-2 mt-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                <span className="text-xs text-muted-foreground">
                                  Last paid {new Date(subscription.last_payment).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <CollapsibleTrigger asChild>
                            <Button size="sm" variant="outline" className="gap-1">
                              <History className="h-4 w-4" />
                              <span className="hidden sm:inline">History</span>
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </Button>
                          </CollapsibleTrigger>

                          <Button size="sm" variant="outline" onClick={() => handlePayNow(subscription)}>
                            Pay Now
                          </Button>

                          <Button size="sm" variant="outline" onClick={() => handleToggleStatus(subscription)}>
                            {subscription.status === "active" ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>

                          <Button size="sm" variant="outline" onClick={() => handleCancelSubscription(subscription)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Budget usage progress bar */}
                      {subscription.max_amount && Number(subscription.max_amount) > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Budget usage</span>
                            <span className="font-medium">
                              {subscription.amount} / {subscription.max_amount} {subscription.token}
                            </span>
                          </div>
                          <Progress 
                            value={(Number(subscription.amount) / Number(subscription.max_amount)) * 100} 
                            className="h-1.5"
                          />
                        </div>
                      )}
                    </div>

                    {/* Payment History Panel */}
                    <CollapsibleContent>
                      <div className="border-t border-border bg-muted/30 p-4">
                        <SubscriptionPaymentHistory subscription={subscription} isDemoMode={isDemoMode} />
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
