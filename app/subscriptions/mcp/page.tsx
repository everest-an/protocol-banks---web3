"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useMCPSubscriptions, type MCPSubscription, type MCPProvider } from "@/hooks/use-mcp-subscriptions"
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import {
  Zap,
  Plus,
  BarChart3,
  Key,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
} from "lucide-react"

export default function MCPSubscriptionsPage() {
  const { toast } = useToast()
  const { isConnected, address } = useWeb3()
  const { isDemoMode } = useDemo()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>("")
  const [selectedPlan, setSelectedPlan] = useState<"free" | "pro" | "enterprise">("free")

  // Use MCP Subscriptions hook for real API integration
  const {
    subscriptions,
    providers,
    subscribe,
    unsubscribe,
    changePlan,
    loading,
    error,
    refresh,
  } = useMCPSubscriptions()

  const handleAddSubscription = async () => {
    if (!selectedProvider) {
      toast({ title: "Error", description: "Please select a provider", variant: "destructive" })
      return
    }

    await subscribe(selectedProvider, selectedPlan)
    setAddDialogOpen(false)
    setSelectedProvider("")
    setSelectedPlan("free")
  }

  const handleCancelSubscription = async (subscriptionId: string) => {
    await unsubscribe(subscriptionId)
  }

  const handleChangePlan = async (subscriptionId: string, newPlan: "free" | "pro" | "enterprise") => {
    await changePlan(subscriptionId, newPlan)
  }

  const totalMonthly = subscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => {
      const provider = providers.find(p => p.id === s.provider_id)
      const planInfo = provider?.pricing[s.plan]
      return sum + (planInfo && "price" in planInfo ? planInfo.price : 0)
    }, 0)

  const totalUsage = subscriptions.reduce((sum, s) => sum + s.calls_used, 0)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      case "paused":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
      case "cancelled":
        return "bg-red-500/10 text-red-400 border-red-500/20"
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/20"
    }
  }

  const getProviderIcon = (providerId: string) => {
    const icons: Record<string, string> = {
      linear: "L",
      notion: "N",
      sentry: "S",
      context7: "C",
      slack: "Sl",
    }
    return icons[providerId] || "?"
  }

  if (!isConnected && !isDemoMode) {
    return (
      <main className="container mx-auto py-6 px-4 max-w-7xl">
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Connect Wallet</h2>
            <p className="text-muted-foreground">Please connect your wallet to manage MCP subscriptions</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCP Subscriptions</h1>
          <p className="text-muted-foreground">Manage your Model Context Protocol service subscriptions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Subscription
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add MCP Subscription</DialogTitle>
                <DialogDescription>
                  Subscribe to an MCP provider for AI-powered integrations
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-xs">
                              {provider.icon}
                            </div>
                            <div>
                              <span className="font-medium">{provider.name}</span>
                              <span className="text-muted-foreground text-xs ml-2">{provider.description}</span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProvider && (
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select value={selectedPlan} onValueChange={(v) => setSelectedPlan(v as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const provider = providers.find(p => p.id === selectedProvider)
                          if (!provider) return null
                          return (
                            <>
                              <SelectItem value="free">
                                <div className="flex items-center justify-between gap-4">
                                  <span>Free</span>
                                  <span className="text-muted-foreground">
                                    {provider.pricing.free.calls} calls/mo
                                  </span>
                                </div>
                              </SelectItem>
                              <SelectItem value="pro">
                                <div className="flex items-center justify-between gap-4">
                                  <span>Pro</span>
                                  <span className="text-muted-foreground">
                                    ${provider.pricing.pro.price}/mo - {provider.pricing.pro.calls} calls
                                  </span>
                                </div>
                              </SelectItem>
                              <SelectItem value="enterprise">
                                <div className="flex items-center justify-between gap-4">
                                  <span>Enterprise</span>
                                  <span className="text-muted-foreground">
                                    ${provider.pricing.enterprise.price}/mo - {provider.pricing.enterprise.calls} calls
                                  </span>
                                </div>
                              </SelectItem>
                            </>
                          )
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedProvider && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Plan Features</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {(() => {
                        const provider = providers.find(p => p.id === selectedProvider)
                        return provider?.pricing[selectedPlan]?.features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            {feature}
                          </li>
                        ))
                      })()}
                    </ul>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddSubscription} disabled={!selectedProvider}>
                  Subscribe
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap className="h-4 w-4" />
              <span className="text-sm">Active Subscriptions</span>
            </div>
            <div className="text-2xl font-bold">
              {subscriptions.filter((s) => s.status === "active").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{subscriptions.length} total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">Monthly Cost</span>
            </div>
            <div className="text-2xl font-bold">${totalMonthly}</div>
            <p className="text-xs text-muted-foreground mt-1">USDC</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Next Billing</span>
            </div>
            <div className="text-2xl font-bold">
              {subscriptions.length > 0
                ? new Date(
                    Math.min(...subscriptions.map((s) => new Date(s.current_period_end).getTime()))
                  ).toLocaleDateString()
                : "N/A"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Key className="h-4 w-4" />
              <span className="text-sm">API Calls Used</span>
            </div>
            <div className="text-2xl font-bold">
              {totalUsage.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">This period</p>
          </CardContent>
        </Card>
      </div>

      {/* Available Providers */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Available MCP Providers</CardTitle>
          <CardDescription>Browse and subscribe to MCP services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map((provider) => {
              const existingSub = subscriptions.find(s => s.provider_id === provider.id && s.status === "active")
              return (
                <Card key={provider.id} className={existingSub ? "border-primary" : ""}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg">
                        {provider.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{provider.name}</h3>
                        <p className="text-sm text-muted-foreground">{provider.description}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {provider.category}
                          </Badge>
                          {existingSub && (
                            <Badge className="bg-emerald-500/10 text-emerald-400 text-xs">
                              Subscribed
                            </Badge>
                          )}
                        </div>
                        <div className="mt-3 text-sm">
                          <span className="text-muted-foreground">From </span>
                          <span className="font-medium">Free</span>
                          <span className="text-muted-foreground"> to </span>
                          <span className="font-medium">${provider.pricing.enterprise.price}/mo</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Subscriptions</CardTitle>
          <CardDescription>Manage your MCP service subscriptions and usage</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No subscriptions yet</p>
              <p className="text-sm">Add your first MCP subscription to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Period End</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => {
                  const provider = providers.find(p => p.id === sub.provider_id)
                  const planInfo = provider?.pricing[sub.plan]
                  const price = planInfo && "price" in planInfo ? planInfo.price : 0
                  
                  return (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-sm">
                            {getProviderIcon(sub.provider_id)}
                          </div>
                          <div>
                            <div className="font-medium">{sub.provider_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {provider?.description}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={sub.plan}
                          onValueChange={(v) => handleChangePlan(sub.id, v as any)}
                          disabled={sub.status !== "active"}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(sub.status)}>
                          {sub.status === "active" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {sub.status === "paused" && <Clock className="h-3 w-3 mr-1" />}
                          {sub.status === "cancelled" && <XCircle className="h-3 w-3 mr-1" />}
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">
                            {sub.calls_used.toLocaleString()} / {sub.calls_limit.toLocaleString()}
                          </div>
                          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${Math.min((sub.calls_used / sub.calls_limit) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {price === 0 ? (
                          <span className="text-emerald-400">Free</span>
                        ) : (
                          `$${price}/mo`
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(sub.current_period_end).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {sub.status === "active" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300"
                            onClick={() => handleCancelSubscription(sub.id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
