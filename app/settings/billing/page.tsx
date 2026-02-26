"use client"

import { useState, useEffect } from "react"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { authHeaders } from "@/lib/authenticated-fetch"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { CreditCard, Check, Zap, Building2, Users, Calendar, ArrowRight } from "lucide-react"
import type { SubscriptionPlan, UserSubscription, PlanLimits } from "@/types/billing"

interface UsageMetrics {
  recipients_count: number
  scheduled_count: number
  team_members_count: number
  transactions_this_month: number
  total_volume_this_month: number
}

export default function BillingPage() {
  const { address } = useUnifiedWallet()
  const { toast } = useToast()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [usage, setUsage] = useState<UsageMetrics | null>(null)
  const [limits, setLimits] = useState<PlanLimits | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)

  useEffect(() => {
    if (address) {
      loadData()
    }
  }, [address])

  const loadData = async () => {
    if (!address) return
    setLoading(true)
    try {
      // Load plans and subscription in parallel
      const [plansRes, subRes] = await Promise.all([
        fetch("/api/billing/plans", { headers: authHeaders(address) }),
        fetch("/api/billing/subscription", {
          headers: authHeaders(address),
        }),
      ])

      const plansData = await plansRes.json()
      const subData = await subRes.json()

      if (plansRes.ok) {
        setPlans(plansData.plans || [])
      }

      if (subRes.ok) {
        setSubscription(subData.subscription)
        setUsage(subData.usage)
        setLimits(subData.limits)
      }
    } catch (error) {
      console.error("Failed to load billing data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async () => {
    if (!address || !selectedPlan) return

    try {
      const response = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: authHeaders(address, { "Content-Type": "application/json" }),
        body: JSON.stringify({ plan_id: selectedPlan.id }),
      })

      const data = await response.json()
      if (response.ok) {
        setSubscription(data.subscription)
        toast({
          title: "Plan Updated",
          description: `You are now on the ${selectedPlan.name} plan`,
        })
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update plan", variant: "destructive" })
    } finally {
      setUpgradeDialogOpen(false)
      setSelectedPlan(null)
    }
  }

  const currentPlan = subscription?.plan as SubscriptionPlan | undefined
  const currentPlanName = currentPlan?.name || "Free"

  const getLimitDisplay = (limit: number) => {
    return limit === -1 ? "Unlimited" : limit.toString()
  }

  const getUsagePercentage = (current: number, limit: number) => {
    if (limit === -1) return 0
    return Math.min((current / limit) * 100, 100)
  }

  if (!address) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Please connect your wallet to manage billing
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Billing & Plans</h1>
        <p className="text-muted-foreground">Manage your subscription and view usage</p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-6">
          {/* Current Plan */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold">{currentPlanName}</h3>
                  <p className="text-muted-foreground">
                    {currentPlan?.price_monthly === 0
                      ? "Free forever"
                      : `$${currentPlan?.price_monthly}/month`}
                  </p>
                </div>
                <Badge variant={currentPlanName === "Free" ? "secondary" : "default"} className="text-lg px-4 py-1">
                  {subscription?.status || "active"}
                </Badge>
              </div>

              {subscription?.current_period_end && (
                <p className="text-sm text-muted-foreground mt-4">
                  Current period ends: {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Usage */}
          {usage && limits && (
            <Card>
              <CardHeader>
                <CardTitle>Usage This Month</CardTitle>
                <CardDescription>Track your usage against plan limits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Team Members
                    </span>
                    <span>
                      {usage.team_members_count} / {getLimitDisplay(limits.max_team_members ?? -1)}
                    </span>
                  </div>
                  <Progress
                    value={getUsagePercentage(usage.team_members_count, limits.max_team_members ?? -1)}
                  />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Scheduled Payments
                    </span>
                    <span>
                      {usage.scheduled_count} / {getLimitDisplay(limits.max_scheduled ?? limits.max_scheduled_payments ?? -1)}
                    </span>
                  </div>
                  <Progress
                    value={getUsagePercentage(usage.scheduled_count, limits.max_scheduled ?? limits.max_scheduled_payments ?? -1)}
                  />
                </div>

                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{usage.transactions_this_month}</p>
                      <p className="text-sm text-muted-foreground">Transactions</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        ${usage.total_volume_this_month.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Volume</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Plans */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const isCurrentPlan = currentPlan?.id === plan.id
                const features = plan.features as string[]
                const planLimits = plan.limits as PlanLimits

                return (
                  <Card
                    key={plan.id}
                    className={isCurrentPlan ? "border-primary" : ""}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          {plan.name === "Free" && <Users className="h-5 w-5" />}
                          {plan.name === "Pro" && <Zap className="h-5 w-5 text-blue-500" />}
                          {plan.name === "Enterprise" && (
                            <Building2 className="h-5 w-5 text-purple-500" />
                          )}
                          {plan.name}
                        </CardTitle>
                        {isCurrentPlan && <Badge>Current</Badge>}
                      </div>
                      <CardDescription>
                        <span className="text-2xl font-bold">${plan.price_monthly}</span>
                        <span className="text-muted-foreground">/month</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500" />
                            {feature}
                          </li>
                        ))}
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          {getLimitDisplay(planLimits.max_recipients ?? planLimits.max_recipients_per_batch)} recipients per batch
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          {getLimitDisplay(planLimits.max_scheduled ?? planLimits.max_scheduled_payments)} scheduled payments
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          {getLimitDisplay(planLimits.max_team_members)} team members
                        </li>
                        {planLimits.transaction_fee_bps > 0 && (
                          <li className="flex items-center gap-2 text-sm text-muted-foreground">
                            {(planLimits.transaction_fee_bps / 100).toFixed(2)}% transaction fee
                          </li>
                        )}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      {isCurrentPlan ? (
                        <Button className="w-full" disabled>
                          Current Plan
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          variant={plan.price_monthly > (currentPlan?.price_monthly || 0) ? "default" : "outline"}
                          onClick={() => {
                            setSelectedPlan(plan)
                            setUpgradeDialogOpen(true)
                          }}
                        >
                          {plan.price_monthly > (currentPlan?.price_monthly || 0) ? (
                            <>
                              Upgrade <ArrowRight className="h-4 w-4 ml-2" />
                            </>
                          ) : (
                            "Downgrade"
                          )}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Transaction Fee Info */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction Fees</CardTitle>
              <CardDescription>
                Fees are calculated based on your plan and transaction volume
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Your Fee Rate</p>
                  <p className="text-sm text-muted-foreground">
                    Based on your {currentPlanName} plan
                  </p>
                </div>
                <p className="text-2xl font-bold">
                  {limits ? (limits.transaction_fee_bps / 100).toFixed(2) : 0}%
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <AlertDialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedPlan && selectedPlan.price_monthly > (currentPlan?.price_monthly || 0)
                ? "Upgrade"
                : "Downgrade"}{" "}
              to {selectedPlan?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedPlan && selectedPlan.price_monthly > (currentPlan?.price_monthly || 0) ? (
                <>
                  You will be charged ${selectedPlan?.price_monthly}/month starting from your next
                  billing cycle. You will immediately get access to all {selectedPlan?.name} features.
                </>
              ) : (
                <>
                  Your plan will be downgraded at the end of your current billing period. You may lose
                  access to some features.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpgrade}>
              {selectedPlan && selectedPlan.price_monthly > (currentPlan?.price_monthly || 0)
                ? "Upgrade Now"
                : "Confirm Downgrade"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
