"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { useWeb3 } from "@/contexts/web3-context"
import { useDemo } from "@/contexts/demo-context"
import {
  Zap,
  Plus,
  Settings,
  BarChart3,
  Key,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Shield,
  Loader2,
} from "lucide-react"
import Link from "next/link"

interface MCPSubscription {
  id: string
  name: string
  provider: string
  tier: "free" | "basic" | "pro" | "enterprise"
  status: "active" | "paused" | "expired" | "pending"
  monthlyPrice: number
  usageLimit: number
  usageUsed: number
  nextBilling: string
  features: string[]
}

interface MCPProvider {
  id: string
  name: string
  description: string
  icon: string
  tiers: {
    name: string
    price: number
    limit: number
    features: string[]
  }[]
}

// Demo MCP providers
const MCP_PROVIDERS: MCPProvider[] = [
  {
    id: "linear",
    name: "Linear",
    description: "Issue tracking and project management",
    icon: "L",
    tiers: [
      { name: "basic", price: 10, limit: 1000, features: ["Issue tracking", "Basic analytics"] },
      { name: "pro", price: 25, limit: 10000, features: ["Issue tracking", "Advanced analytics", "Automation"] },
    ],
  },
  {
    id: "notion",
    name: "Notion",
    description: "Knowledge management and documentation",
    icon: "N",
    tiers: [
      { name: "basic", price: 8, limit: 500, features: ["Page access", "Search"] },
      { name: "pro", price: 20, limit: 5000, features: ["Full access", "Search", "AI features"] },
    ],
  },
  {
    id: "sentry",
    name: "Sentry",
    description: "Error tracking and performance monitoring",
    icon: "S",
    tiers: [
      { name: "basic", price: 15, limit: 5000, features: ["Error tracking", "Alerts"] },
      { name: "pro", price: 50, limit: 50000, features: ["Full monitoring", "Performance", "Release tracking"] },
    ],
  },
  {
    id: "context7",
    name: "Context7",
    description: "Documentation and context tools",
    icon: "C",
    tiers: [
      { name: "free", price: 0, limit: 100, features: ["Basic docs"] },
      { name: "pro", price: 12, limit: 2000, features: ["Full docs", "Code examples", "AI assistance"] },
    ],
  },
]

export default function MCPSubscriptionsPage() {
  const { toast } = useToast()
  const { wallets, isConnected } = useWeb3()
  const { isDemoMode } = useDemo()
  const [subscriptions, setSubscriptions] = useState<MCPSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string>("")
  const [selectedTier, setSelectedTier] = useState<string>("")
  const [activeTab, setActiveTab] = useState("active")

  // Load subscriptions
  useEffect(() => {
    const loadSubscriptions = async () => {
      setLoading(true)
      // Demo data
      await new Promise((r) => setTimeout(r, 500))
      setSubscriptions([
        {
          id: "sub_1",
          name: "Linear Pro",
          provider: "linear",
          tier: "pro",
          status: "active",
          monthlyPrice: 25,
          usageLimit: 10000,
          usageUsed: 4523,
          nextBilling: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          features: ["Issue tracking", "Advanced analytics", "Automation"],
        },
        {
          id: "sub_2",
          name: "Sentry Basic",
          provider: "sentry",
          tier: "basic",
          status: "active",
          monthlyPrice: 15,
          usageLimit: 5000,
          usageUsed: 2100,
          nextBilling: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000).toISOString(),
          features: ["Error tracking", "Alerts"],
        },
        {
          id: "sub_3",
          name: "Context7 Free",
          provider: "context7",
          tier: "free",
          status: "active",
          monthlyPrice: 0,
          usageLimit: 100,
          usageUsed: 87,
          nextBilling: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          features: ["Basic docs"],
        },
      ])
      setLoading(false)
    }
    loadSubscriptions()
  }, [])

  const handleAddSubscription = async () => {
    if (!selectedProvider || !selectedTier) {
      toast({ title: "Error", description: "Please select a provider and tier", variant: "destructive" })
      return
    }

    const provider = MCP_PROVIDERS.find((p) => p.id === selectedProvider)
    const tier = provider?.tiers.find((t) => t.name === selectedTier)

    if (!provider || !tier) return

    const newSub: MCPSubscription = {
      id: `sub_${Date.now()}`,
      name: `${provider.name} ${tier.name.charAt(0).toUpperCase() + tier.name.slice(1)}`,
      provider: provider.id,
      tier: tier.name as any,
      status: "active",
      monthlyPrice: tier.price,
      usageLimit: tier.limit,
      usageUsed: 0,
      nextBilling: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      features: tier.features,
    }

    setSubscriptions((prev) => [...prev, newSub])
    setAddDialogOpen(false)
    setSelectedProvider("")
    setSelectedTier("")

    toast({
      title: "Subscription Added",
      description: `${newSub.name} has been activated`,
    })
  }

  const toggleSubscriptionStatus = (id: string) => {
    setSubscriptions((prev) =>
      prev.map((sub) =>
        sub.id === id
          ? { ...sub, status: sub.status === "active" ? "paused" : "active" }
          : sub
      )
    )
    toast({ title: "Status Updated" })
  }

  const cancelSubscription = (id: string) => {
    setSubscriptions((prev) => prev.filter((sub) => sub.id !== id))
    toast({ title: "Subscription Cancelled" })
  }

  const totalMonthly = subscriptions
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + s.monthlyPrice, 0)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      case "paused":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
      case "expired":
        return "bg-red-500/10 text-red-400 border-red-500/20"
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/20"
    }
  }

  return (
    <main className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCP Subscriptions</h1>
          <p className="text-muted-foreground">Manage your Model Context Protocol service subscriptions</p>
        </div>
        <div className="flex gap-2">
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
                      {MCP_PROVIDERS.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-xs font-bold">
                              {provider.icon}
                            </div>
                            <span>{provider.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProvider && (
                  <div className="space-y-2">
                    <Label>Tier</Label>
                    <Select value={selectedTier} onValueChange={setSelectedTier}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a tier" />
                      </SelectTrigger>
                      <SelectContent>
                        {MCP_PROVIDERS.find((p) => p.id === selectedProvider)?.tiers.map((tier) => (
                          <SelectItem key={tier.name} value={tier.name}>
                            <div className="flex items-center justify-between gap-4">
                              <span className="capitalize">{tier.name}</span>
                              <span className="text-muted-foreground">
                                {tier.price === 0 ? "Free" : `$${tier.price}/mo`}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddSubscription}>Subscribe</Button>
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
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-sm">Monthly Cost</span>
            </div>
            <div className="text-2xl font-bold">${totalMonthly}</div>
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
                    Math.min(...subscriptions.map((s) => new Date(s.nextBilling).getTime()))
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
              {subscriptions.reduce((sum, s) => sum + s.usageUsed, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

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
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Next Billing</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-sm font-bold">
                          {MCP_PROVIDERS.find((p) => p.id === sub.provider)?.icon || "?"}
                        </div>
                        <div>
                          <div className="font-medium">{sub.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {MCP_PROVIDERS.find((p) => p.id === sub.provider)?.description}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {sub.tier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(sub.status)}>
                        {sub.status === "active" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {sub.status === "paused" && <Clock className="h-3 w-3 mr-1" />}
                        {sub.status === "expired" && <XCircle className="h-3 w-3 mr-1" />}
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          {sub.usageUsed.toLocaleString()} / {sub.usageLimit.toLocaleString()}
                        </div>
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min((sub.usageUsed / sub.usageLimit) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {sub.monthlyPrice === 0 ? (
                        <span className="text-emerald-400">Free</span>
                      ) : (
                        `$${sub.monthlyPrice}/mo`
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(sub.nextBilling).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSubscriptionStatus(sub.id)}
                        >
                          {sub.status === "active" ? "Pause" : "Resume"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => cancelSubscription(sub.id)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
