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
} from "@/lib/subscription-helpers"
import { processSinglePayment } from "@/lib/services/payment-service"
import type { SubscriptionInput } from "@/types"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Pause, X, Plus, DollarSign, Calendar } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { Subscription } from "@/types"

export default function SubscriptionsPage() {
  const { wallets, activeChain } = useWeb3()
  const { isDemoMode } = useDemo()
  const { toast } = useToast()
  const currentWallet = wallets[activeChain]

  const { subscriptions, loading, stats, addSubscription, updateStatus, deleteSubscription } = useSubscriptions({
    isDemoMode,
    walletAddress: currentWallet ?? undefined,
  })

  const { addPayment } = usePaymentHistory({
    isDemoMode,
    walletAddress: currentWallet ?? undefined,
  })

  const [showAddDialog, setShowAddDialog] = useState(false)
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
          amount: Number(subscription.amount),
          token: subscription.token,
        },
        currentWallet,
        subscription.chain,
      )

      if (result.success && result.txHash) {
        // Record transaction
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

              return (
                <Card key={subscription.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="font-semibold">{subscription.service_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {formatted.formattedAmount} • {formatted.formattedFrequency}
                        </p>
                        {subscription.next_payment && (
                          <p className="text-xs text-muted-foreground">Next: {formatted.formattedNextPayment}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                        {subscription.status}
                      </Badge>

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
                </Card>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
